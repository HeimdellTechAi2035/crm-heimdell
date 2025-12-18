import { config } from '../config.js';
import { createQueue, IJobQueue } from '../lib/queue.js';
import { prisma } from '../lib/prisma.js';
import { sendEmail } from '../lib/email.js';

export const sequenceQueue: IJobQueue = createQueue(
  'sequences',
  config.features.redis,
  config.redis.url
);

export function startSequenceWorker() {
  sequenceQueue.registerProcessor('process-enrollment', async (job) => {
    return await processEnrollment(job.data.enrollmentId);
  });
}

async function processEnrollment(enrollmentId: string) {
  const enrollment = await prisma.sequenceEnrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      sequence: {
        include: {
          steps: {
            orderBy: { position: 'asc' },
            include: {
              emailTemplate: true,
            },
          },
        },
      },
      lead: {
        include: {
          company: true,
          owner: true,
        },
      },
    },
  });

  if (!enrollment || enrollment.status !== 'ACTIVE') {
    console.log('Enrollment not found or not active');
    return;
  }

  const currentStep = enrollment.sequence.steps[enrollment.currentStep];

  if (!currentStep) {
    // Sequence complete
    await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    return;
  }

  // Process step based on type
  if (currentStep.type === 'EMAIL' && currentStep.emailTemplate) {
    // Send email
    const template = currentStep.emailTemplate;
    
    // Replace tokens
    let subject = template.subject;
    let body = template.body;
    
    const replacements: Record<string, string> = {
      '{firstName}': enrollment.lead.firstName || 'there',
      '{lastName}': enrollment.lead.lastName || '',
      '{company}': enrollment.lead.company?.name || 'your company',
      '{service}': 'our services',
      '{email}': enrollment.lead.email,
    };

    Object.entries(replacements).forEach(([token, value]) => {
      subject = subject.replace(new RegExp(token, 'g'), value);
      body = body.replace(new RegExp(token, 'g'), value);
    });

    const result = await sendEmail(enrollment.lead.email, subject, body);

    if (result.success) {
      // Log activity
      await prisma.activity.create({
        data: {
          type: 'EMAIL',
          subject,
          body,
          metadata: {
            sequenceId: enrollment.sequenceId,
            stepPosition: currentStep.position,
            messageId: result.messageId,
          },
          leadId: enrollment.leadId,
          userId: enrollment.lead.ownerId,
          organizationId: enrollment.lead.organizationId,
        },
      });

      // Update last contacted
      await prisma.lead.update({
        where: { id: enrollment.leadId },
        data: { lastContactedAt: new Date() },
      });
    } else {
      console.error('Failed to send email:', result.error);
      // Don't fail the enrollment, just log
    }
  } else if (currentStep.type === 'TASK') {
    // Create task
    await prisma.task.create({
      data: {
        title: currentStep.taskDescription || 'Sequence task',
        description: `From sequence: ${enrollment.sequence.name}`,
        leadId: enrollment.leadId,
        userId: enrollment.lead.ownerId,
        assigneeId: enrollment.lead.ownerId,
        organizationId: enrollment.lead.organizationId,
      },
    });
  }

  // Move to next step
  const nextStepIndex = enrollment.currentStep + 1;
  const nextStep = enrollment.sequence.steps[nextStepIndex];

  if (nextStep) {
    const nextActionAt = new Date();
    nextActionAt.setDate(nextActionAt.getDate() + nextStep.delayDays);

    await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: {
        currentStep: nextStepIndex,
        nextActionAt,
      },
    });

    // Schedule next step
    await sequenceQueue.add(
      'process-enrollment',
      { enrollmentId },
      {
        delay: nextStep.delayDays * 24 * 60 * 60 * 1000,
      }
    );
  } else {
    // Sequence complete
    await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
  }
}

