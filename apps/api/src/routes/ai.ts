import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { openai } from '../lib/openai.js';
import { authenticate } from '../middleware/auth.js';
import { config } from '../config.js';
import {
  generateMockEnrichment,
  generateMockNextAction,
  generateMockSequence,
  generateMockCallSummary,
} from '../lib/mock-ai.js';

const enrichSchema = z.object({
  leadId: z.string().optional(),
  companyId: z.string().optional(),
  companyName: z.string().optional(),
  website: z.string().optional(),
  industry: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

const nextActionSchema = z.object({
  leadId: z.string().optional(),
  dealId: z.string().optional(),
});

const generateSequenceSchema = z.object({
  leadId: z.string().optional(),
  dealId: z.string().optional(),
  goal: z.string(),
  steps: z.number().min(1).max(10).optional(),
});

const summarizeCallSchema = z.object({
  leadId: z.string().optional(),
  dealId: z.string().optional(),
  notes: z.string(),
});

export async function aiRoutes(fastify: FastifyInstance) {
  // AI Lead/Company Enrichment
  fastify.post('/enrich', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const data = enrichSchema.parse(request.body);

      // Check AI usage limit
      const org = await prisma.organization.findUnique({
        where: { id: (request.user as any).organizationId },
      });

      const currentMonth = new Date().toISOString().slice(0, 7);
      const usageCount = await prisma.aiArtifact.count({
        where: {
          organizationId: (request.user as any).organizationId,
          createdAt: {
            gte: new Date(currentMonth + '-01'),
          },
        },
      });

      if (usageCount >= org!.aiMonthlyLimit) {
        return reply.code(429).send({ 
          error: 'AI monthly limit reached',
          limit: org!.aiMonthlyLimit,
          used: usageCount,
        });
      }

      // Get context
      let context = '';
      if (data.leadId) {
        const lead = await prisma.lead.findFirst({
          where: { id: data.leadId, organizationId: (request.user as any).organizationId },
          include: { company: true },
        });
        if (lead) {
          context = `Lead: ${lead.firstName} ${lead.lastName} (${lead.email})`;
          if (lead.company) context += `\nCompany: ${lead.company.name}`;
          if (lead.title) context += `\nTitle: ${lead.title}`;
          if (lead.notes) context += `\nNotes: ${lead.notes}`;
        }
      }

      if (data.companyId) {
        const company = await prisma.company.findFirst({
          where: { id: data.companyId, organizationId: (request.user as any).organizationId },
        });
        if (company) {
          context = `Company: ${company.name}`;
          if (company.industry) context += `\nIndustry: ${company.industry}`;
          if (company.website) context += `\nWebsite: ${company.website}`;
          if (company.location) context += `\nLocation: ${company.location}`;
          if (company.notes) context += `\nNotes: ${company.notes}`;
        }
      }

      if (data.companyName) context += `\nCompany Name: ${data.companyName}`;
      if (data.website) context += `\nWebsite: ${data.website}`;
      if (data.industry) context += `\nIndustry: ${data.industry}`;
      if (data.location) context += `\nLocation: ${data.location}`;
      if (data.notes) context += `\nAdditional Notes: ${data.notes}`;

      // Use mock response if AI is disabled
      if (!config.features.ai) {
        const mockResponse = generateMockEnrichment(context);
        
        // Still store artifact for consistency
        const artifact = await prisma.aiArtifact.create({
          data: {
            type: 'enrichment',
            prompt: `[MOCK] ${context}`,
            response: mockResponse,
            modelName: 'mock',
            promptVersion: '1.0',
            leadId: data.leadId,
            companyId: data.companyId,
            organizationId: (request.user as any).organizationId,
          },
        });

        return reply.send({
          enrichment: mockResponse.enrichedData,
          artifactId: artifact.id,
          warnings: mockResponse.warnings,
          usage: {
            used: usageCount + 1,
            limit: org!.aiMonthlyLimit,
          },
        });
      }

      const prompt = `You are a B2B sales assistant for Heimdell CRM. Analyze this company/lead and provide enrichment data.

${context}

Provide a JSON response with:
1. summary: Brief overview of what the company does (2-3 sentences)
2. painPoints: Array of 3-5 likely pain points this company faces
3. offerAngle: Suggested sales angle/value proposition
4. targetPersona: Best person to target (title/role)
5. coldEmailVariants: Array of 3 short cold email variants (UK English, professional but friendly, 80-120 words each)
6. followUpVariants: Array of 3 follow-up email variants (shorter, 50-80 words each)
7. callScript: Object with "opener" (30 second introduction) and "objectionHandling" (array of 3 common objections with responses)

Use UK English spelling and tone. Be professional but approachable. Focus on value, not features.`;

      const completion = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful B2B sales assistant. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const response = JSON.parse(completion.choices[0].message.content || '{}');

      // Store AI artifact
      const artifact = await prisma.aiArtifact.create({
        data: {
          type: 'enrichment',
          prompt,
          response,
          modelName: config.openai.model,
          promptVersion: '1.0',
          leadId: data.leadId,
          companyId: data.companyId,
          organizationId: (request.user as any).organizationId,
        },
      });

      reply.send({
        enrichment: response,
        artifactId: artifact.id,
        usage: {
          used: usageCount + 1,
          limit: org!.aiMonthlyLimit,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      console.error('AI enrichment error:', error);
      reply.code(500).send({ error: 'AI enrichment failed' });
    }
  });

  // AI Next Best Action
  fastify.post('/next-action', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const data = nextActionSchema.parse(request.body);

      const org = await prisma.organization.findUnique({
        where: { id: (request.user as any).organizationId },
      });

      const currentMonth = new Date().toISOString().slice(0, 7);
      const usageCount = await prisma.aiArtifact.count({
        where: {
          organizationId: (request.user as any).organizationId,
          createdAt: { gte: new Date(currentMonth + '-01') },
        },
      });

      if (usageCount >= org!.aiMonthlyLimit) {
        return reply.code(429).send({ error: 'AI monthly limit reached' });
      }

      let context = '';
      let entityId: string | undefined;
      let entityType: 'lead' | 'deal' | undefined;

      if (data.leadId) {
        const lead = await prisma.lead.findFirst({
          where: { id: data.leadId, organizationId: (request.user as any).organizationId },
          include: {
            activities: {
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
            tasks: {
              where: { status: { not: 'DONE' } },
            },
            deals: {
              include: { stage: true },
            },
          },
        });

        if (!lead) {
          return reply.code(404).send({ error: 'Lead not found' });
        }

        entityId = lead.id;
        entityType = 'lead';

        context = `Lead: ${lead.firstName} ${lead.lastName} (${lead.email})
Status: ${lead.status}
Last Contacted: ${lead.lastContactedAt ? lead.lastContactedAt.toISOString() : 'Never'}

Recent Activities (last 10):
${lead.activities.map((a: any) => `- ${a.type}: ${a.subject || ''} (${a.createdAt.toISOString()})`).join('\n')}

Open Tasks:
${lead.tasks.map((t: any) => `- ${t.title} (due: ${t.dueDate || 'no date'})`).join('\n') || 'None'}

Deals:
${lead.deals.map((d: any) => `- ${d.title} (${d.stage.name})`).join('\n') || 'None'}`;
      }

      if (data.dealId) {
        const deal = await prisma.deal.findFirst({
          where: { id: data.dealId, organizationId: (request.user as any).organizationId },
          include: {
            stage: true,
            pipeline: true,
            activities: {
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
            tasks: {
              where: { status: { not: 'DONE' } },
            },
            lead: true,
          },
        });

        if (!deal) {
          return reply.code(404).send({ error: 'Deal not found' });
        }

        entityId = deal.id;
        entityType = 'deal';

        const daysSinceUpdate = Math.floor(
          (Date.now() - deal.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        context = `Deal: ${deal.title}
Value: £${deal.value}
Stage: ${deal.stage.name} (${deal.stage.probability}% probability)
Days since last update: ${daysSinceUpdate}
Expected close: ${deal.expectedCloseDate || 'Not set'}

Recent Activities:
${deal.activities.map((a: any) => `- ${a.type}: ${a.subject || ''}`).join('\n')}

Open Tasks:
${deal.tasks.map((t: any) => `- ${t.title}`).join('\n') || 'None'}`;
      }

      // Use mock response if AI is disabled
      if (!config.features.ai) {
        const mockResponse = generateMockNextAction(context);
        
        await prisma.aiArtifact.create({
          data: {
            type: 'next_action',
            prompt: `[MOCK] ${context}`,
            response: mockResponse,
            modelName: 'mock',
            promptVersion: '1.0',
            leadId: entityType === 'lead' ? entityId : undefined,
            dealId: entityType === 'deal' ? entityId : undefined,
            organizationId: (request.user as any).organizationId,
          },
        });

        return reply.send({ nextAction: mockResponse.suggestedAction, warnings: mockResponse.warnings });
      }

      const prompt = `You are a sales coach for Heimdell CRM. Based on this ${entityType}'s timeline and status, suggest the next best action.

${context}

Provide a JSON response with:
1. recommendedAction: "email" | "call" | "task" | "meeting"
2. reason: Short explanation (1-2 sentences) why this action is recommended
3. urgency: "low" | "medium" | "high"
4. draftMessage: If email, provide a short draft (80-100 words, UK English)
5. taskSuggestion: If task, provide task title and description
6. callTalkingPoints: If call, provide array of 3-4 talking points

Be specific and actionable. Use UK English.`;

      const completion = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: 'You are a sales coach. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const response = JSON.parse(completion.choices[0].message.content || '{}');

      await prisma.aiArtifact.create({
        data: {
          type: 'next_action',
          prompt,
          response,
          modelName: config.openai.model,
          promptVersion: '1.0',
          leadId: entityType === 'lead' ? entityId : undefined,
          dealId: entityType === 'deal' ? entityId : undefined,
          organizationId: (request.user as any).organizationId,
        },
      });

      reply.send({ nextAction: response });
    } catch (error) {
      console.error('AI next action error:', error);
      reply.code(500).send({ error: 'AI next action failed' });
    }
  });

  // AI Sequence Generator
  fastify.post('/generate-sequence', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const data = generateSequenceSchema.parse(request.body);
      const steps = data.steps || 5;

      const org = await prisma.organization.findUnique({
        where: { id: (request.user as any).organizationId },
      });

      const currentMonth = new Date().toISOString().slice(0, 7);
      const usageCount = await prisma.aiArtifact.count({
        where: {
          organizationId: (request.user as any).organizationId,
          createdAt: { gte: new Date(currentMonth + '-01') },
        },
      });

      if (usageCount >= org!.aiMonthlyLimit) {
        return reply.code(429).send({ error: 'AI monthly limit reached' });
      }

      let context = '';
      if (data.leadId) {
        const lead = await prisma.lead.findFirst({
          where: { id: data.leadId, organizationId: (request.user as any).organizationId },
          include: { company: true },
        });
        if (lead) {
          context = `Lead: ${lead.firstName} ${lead.lastName}
Company: ${lead.company?.name || 'Unknown'}
Title: ${lead.title || 'Unknown'}`;
        }
      }

      if (data.dealId) {
        const deal = await prisma.deal.findFirst({
          where: { id: data.dealId, organizationId: (request.user as any).organizationId },
          include: { 
            lead: {
              include: { company: true }
            }
          },
        });
        if (deal) {
          context = `Deal: ${deal.title}
Value: £${deal.value}
Company: ${deal.lead?.company?.name || 'Unknown'}`;
        }
      }

      const prompt = `You are a sales sequence designer for Heimdell CRM. Create a ${steps}-step outreach sequence.

Goal: ${data.goal}
${context}

Provide a JSON response with:
1. sequenceName: Short name for this sequence
2. sequenceGoal: Refined goal description
3. steps: Array of ${steps} steps, each with:
   - stepNumber: 1, 2, 3...
   - type: "email" | "task" | "wait"
   - delayDays: Days after previous step (0 for first step)
   - subject: Email subject line (if email)
   - body: Email body or task description (80-120 words for email, use {firstName}, {company}, {service} as tokens)
   - note: Brief note about this step's purpose

Mix emails with tasks/calls. Use UK English. Be conversational but professional. Keep emails short and action-oriented.`;

      // Use mock response if AI is disabled
      if (!config.features.ai) {
        const mockResponse = generateMockSequence(data.goal, steps);
        
        await prisma.aiArtifact.create({
          data: {
            type: 'sequence',
            prompt: `[MOCK] ${prompt}`,
            response: mockResponse,
            modelName: 'mock',
            promptVersion: '1.0',
            leadId: data.leadId,
            dealId: data.dealId,
            organizationId: (request.user as any).organizationId,
          },
        });

        return reply.send({ sequence: mockResponse.sequence, warnings: mockResponse.warnings });
      }

      const completion = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: 'You are a sales sequence expert. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
      });

      const response = JSON.parse(completion.choices[0].message.content || '{}');

      await prisma.aiArtifact.create({
        data: {
          type: 'sequence',
          prompt,
          response,
          modelName: config.openai.model,
          promptVersion: '1.0',
          leadId: data.leadId,
          dealId: data.dealId,
          organizationId: (request.user as any).organizationId,
        },
      });

      reply.send({ sequence: response });
    } catch (error) {
      console.error('AI sequence generation error:', error);
      reply.code(500).send({ error: 'AI sequence generation failed' });
    }
  });

  // AI Call Summary
  fastify.post('/summarize-call', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const data = summarizeCallSchema.parse(request.body);

      const org = await prisma.organization.findUnique({
        where: { id: (request.user as any).organizationId },
      });

      const currentMonth = new Date().toISOString().slice(0, 7);
      const usageCount = await prisma.aiArtifact.count({
        where: {
          organizationId: (request.user as any).organizationId,
          createdAt: { gte: new Date(currentMonth + '-01') },
        },
      });

      if (usageCount >= org!.aiMonthlyLimit) {
        return reply.code(429).send({ error: 'AI monthly limit reached' });
      }

      const prompt = `You are a sales call analyzer for Heimdell CRM. Transform these rough call notes into a structured summary.

Call Notes:
${data.notes}

Provide a JSON response with:
1. summary: Clean 2-3 sentence summary of the call
2. keyPoints: Array of 3-5 key discussion points
3. objections: Array of objections raised (or empty array if none)
4. commitments: Array of commitments made by prospect or us
5. nextSteps: Array of specific next steps with suggested due dates (relative, like "in 2 days")
6. sentiment: "positive" | "neutral" | "negative"

Be concise and actionable.`;

      // Use mock response if AI is disabled
      if (!config.features.ai) {
        const mockResponse = generateMockCallSummary(data.notes);
        
        await prisma.aiArtifact.create({
          data: {
            type: 'call_summary',
            prompt: `[MOCK] ${prompt}`,
            response: mockResponse,
            modelName: 'mock',
            promptVersion: '1.0',
            leadId: data.leadId,
            dealId: data.dealId,
            organizationId: (request.user as any).organizationId,
          },
        });

        return reply.send({ summary: mockResponse, warnings: mockResponse.warnings });
      }

      const completion = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: 'You are a call summarizer. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
      });

      const response = JSON.parse(completion.choices[0].message.content || '{}');

      // Create activity
      const activityData: any = {
        type: 'CALL_NOTE',
        subject: 'Call Summary',
        body: response.summary,
        metadata: response,
        userId: (request.user as any).id,
        organizationId: (request.user as any).organizationId,
      };

      if (data.leadId) activityData.leadId = data.leadId;
      if (data.dealId) activityData.dealId = data.dealId;

      const activity = await prisma.activity.create({
        data: activityData,
      });

      // Create tasks from next steps
      const tasks = await Promise.all(
        (response.nextSteps || []).map(async (step: any) => {
          const dueDate = new Date();
          if (step.includes('2 days')) dueDate.setDate(dueDate.getDate() + 2);
          else if (step.includes('week')) dueDate.setDate(dueDate.getDate() + 7);
          else dueDate.setDate(dueDate.getDate() + 1);

          return prisma.task.create({
            data: {
              title: step,
              dueDate,
              leadId: data.leadId,
              dealId: data.dealId,
              userId: (request.user as any).id,
              assigneeId: (request.user as any).id,
              organizationId: (request.user as any).organizationId,
            },
          });
        })
      );

      await prisma.aiArtifact.create({
        data: {
          type: 'call_summary',
          prompt,
          response,
          modelName: config.openai.model,
          promptVersion: '1.0',
          leadId: data.leadId,
          dealId: data.dealId,
          organizationId: (request.user as any).organizationId,
        },
      });

      reply.send({
        summary: response,
        activityId: activity.id,
        tasksCreated: tasks.length,
      });
    } catch (error) {
      console.error('AI call summary error:', error);
      reply.code(500).send({ error: 'AI call summary failed' });
    }
  });

  // Generate Profile from Import Data
  fastify.post('/profile-from-import', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const data = z.object({
        leadId: z.string().optional(),
        companyId: z.string().optional(),
      }).parse(request.body);

      if (!data.leadId && !data.companyId) {
        return reply.code(400).send({ error: 'Must provide leadId or companyId' });
      }

      // Check AI usage limit
      const org = await prisma.organization.findUnique({
        where: { id: (request.user as any).organizationId },
      });

      const currentMonth = new Date().toISOString().slice(0, 7);
      const usageCount = await prisma.aiArtifact.count({
        where: {
          organizationId: (request.user as any).organizationId,
          createdAt: {
            gte: new Date(`${currentMonth}-01`),
          },
        },
      });

      if (usageCount >= (org?.aiMonthlyLimit || 10000)) {
        return reply.code(429).send({ error: 'AI usage limit reached for this month' });
      }

      let context: any = {};
      let entityType: 'lead' | 'company' = 'lead';
      let entityId: string = '';

      if (data.leadId) {
        entityType = 'lead';
        entityId = data.leadId;

        const lead = await prisma.lead.findFirst({
          where: {
            id: data.leadId,
            organizationId: (request.user as any).organizationId,
          },
          include: {
            company: true,
            activities: {
              take: 10,
              orderBy: { createdAt: 'desc' },
            },
            tags: {
              include: { tag: true },
            },
          },
        });

        if (!lead) {
          return reply.code(404).send({ error: 'Lead not found' });
        }

        context = {
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          phone: lead.phone,
          title: lead.title,
          status: lead.status,
          source: lead.source,
          notes: lead.notes,
          company: lead.company ? {
            name: lead.company.name,
            domain: lead.company.domain,
            industry: lead.company.industry,
            location: lead.company.location,
            size: lead.company.size,
          } : null,
          activities: lead.activities.map((a: any) => ({
            type: a.type,
            notes: a.notes,
            createdAt: a.createdAt,
          })),
          tags: lead.tags.map((t: any) => t.tag.name),
        };
      } else if (data.companyId) {
        entityType = 'company';
        entityId = data.companyId;

        const company = await prisma.company.findFirst({
          where: {
            id: data.companyId,
            organizationId: (request.user as any).organizationId,
          },
          include: {
            leads: {
              take: 10,
            },
            activities: {
              take: 10,
              orderBy: { createdAt: 'desc' },
            },
            tags: {
              include: { tag: true },
            },
          },
        });

        if (!company) {
          return reply.code(404).send({ error: 'Company not found' });
        }

        context = {
          name: company.name,
          domain: company.domain,
          website: company.website,
          industry: company.industry,
          location: company.location,
          size: company.size,
          phone: company.phone,
          notes: company.notes,
          leadCount: company.leads.length,
          activities: company.activities.map((a: any) => ({
            type: a.type,
            notes: a.notes,
            createdAt: a.createdAt,
          })),
          tags: company.tags.map((t: any) => t.tag.name),
        };
      }

      // Build prompt
      const fieldsUsed = Object.keys(context).filter(k => context[k] && context[k] !== '' && k !== 'activities' && k !== 'tags');

      const prompt = entityType === 'lead' 
        ? `You are a sales intelligence analyst. Generate a structured profile for this lead based ONLY on the provided data. Do not invent facts.

Lead Data:
${JSON.stringify(context, null, 2)}

Generate a JSON profile with:
- one_liner: Brief description (who they are)
- likely_role: Inferred role based on title/company (or "unknown")
- pain_points: Array of 3-6 likely pain points (based on industry/role, not invented)
- decision_power: "low", "medium", or "high" with reason
- best_offer_angle: Array of 1-3 angles to position your offering
- personalisation_hooks: Array of things to mention in outreach (company info, industry trends)
- objections: Array of 2-3 likely objections with response suggestions
- next_best_action: "call", "email", or "linkedin" with reason
- message_drafts: Object with cold_email_1, follow_up_1, linkedin_dm_1
- confidence: 0-100 score for profile accuracy
- source_fields_used: Array of field names used

Return ONLY valid JSON. Be factual and professional (UK English).`
        : `You are a sales intelligence analyst. Generate a structured profile for this company based ONLY on the provided data. Do not invent facts.

Company Data:
${JSON.stringify(context, null, 2)}

Generate a JSON profile with:
- one_liner: Brief description of the company
- industry_positioning: How they position themselves
- pain_points: Array of 3-6 likely pain points for companies in this industry/size
- decision_makers: Array of typical roles to target
- best_offer_angle: Array of 1-3 angles to position your offering
- personalisation_hooks: Array of things to mention (location, industry, size)
- objections: Array of 2-3 likely objections with response suggestions
- next_best_action: Recommended approach strategy
- message_templates: Object with cold_email_1, follow_up_1
- confidence: 0-100 score for profile accuracy
- source_fields_used: Array of field names used

Return ONLY valid JSON. Be factual and professional (UK English).`;

      const completion = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          { role: 'system', content: 'You are a sales intelligence analyst. Return only valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const response = completion.choices[0].message.content || '{}';
      const profileJson = JSON.parse(response);

      // Generate readable summary
      const summary = entityType === 'lead'
        ? `${profileJson.one_liner || 'Unknown lead'}\n\nRole: ${profileJson.likely_role || 'Unknown'}\nDecision Power: ${profileJson.decision_power || 'Unknown'}\n\nNext Action: ${profileJson.next_best_action || 'Unknown'}\n\nConfidence: ${profileJson.confidence || 0}%`
        : `${profileJson.one_liner || 'Unknown company'}\n\nPositioning: ${profileJson.industry_positioning || 'Unknown'}\n\nNext Action: ${profileJson.next_best_action || 'Unknown'}\n\nConfidence: ${profileJson.confidence || 0}%`;

      // Update entity with profile
      if (entityType === 'lead') {
        await prisma.lead.update({
          where: { id: entityId },
          data: {
            profileSummary: summary,
            profileJson: profileJson,
            profileLastGeneratedAt: new Date(),
          },
        });
      } else {
        await prisma.company.update({
          where: { id: entityId },
          data: {
            profileSummary: summary,
            profileJson: profileJson,
            profileLastGeneratedAt: new Date(),
          },
        });
      }

      // Create AI artifact
      await prisma.aiArtifact.create({
        data: {
          type: 'profile_generation',
          prompt,
          response,
          modelName: config.openai.model,
          promptVersion: '1.0',
          leadId: entityType === 'lead' ? entityId : undefined,
          companyId: entityType === 'company' ? entityId : undefined,
          organizationId: (request.user as any).organizationId,
        },
      });

      reply.send({
        entityType,
        entityId,
        profileSummary: summary,
        profileJson,
        fieldsUsed,
      });
    } catch (error: any) {
      console.error('AI profile generation error:', error);
      reply.code(500).send({ error: error.message || 'AI profile generation failed' });
    }
  });
}



