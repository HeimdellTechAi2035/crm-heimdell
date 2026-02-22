// Mock AI responses for offline/development mode
// Used when config.features.ai is false

export function generateMockEnrichment(data: {
  companyName?: string;
  industry?: string;
  location?: string;
}) {
  const company = data.companyName || 'Unknown Company';
  return {
    companySummary: `${company} is a growing business in the ${data.industry || 'technology'} sector based in ${data.location || 'the UK'}. They appear to be in a growth phase with potential need for sales infrastructure improvements.`,
    painPoints: [
      'Manual sales processes slowing growth',
      'Lack of unified CRM platform',
      'Difficulty tracking pipeline metrics',
      'Inefficient lead qualification process',
    ],
    salesAngle: `Position our CRM as the solution to ${company}'s scaling challenges. Focus on automation capabilities and pipeline visibility.`,
    coldEmails: [
      {
        subject: `Quick question about ${company}'s sales process`,
        body: `Hi {{firstName}},\n\nI noticed ${company} has been growing rapidly. Many companies at your stage struggle with manual sales tracking.\n\nWe help teams like yours automate pipeline management and close deals 30% faster.\n\nWorth a quick chat?\n\nBest,\n{{senderName}}`,
      },
      {
        subject: `${company} + Heimdell CRM`,
        body: `Hi {{firstName}},\n\nI've been following ${company}'s progress in the ${data.industry || 'tech'} space — impressive trajectory.\n\nCurious: how are you currently tracking your sales pipeline? We've helped similar companies reduce deal cycle time significantly.\n\nHappy to share some ideas if useful.\n\nCheers,\n{{senderName}}`,
      },
      {
        subject: `Idea for ${company}`,
        body: `Hi {{firstName}},\n\nQuick thought — based on what I've seen from companies in ${data.industry || 'your space'}, there's usually a big opportunity to improve close rates with better pipeline visibility.\n\nWould it be helpful if I shared a 2-minute overview of how we approach this?\n\nBest regards,\n{{senderName}}`,
      },
    ],
    followUps: [
      {
        subject: `Re: Quick question about ${company}'s sales process`,
        body: `Hi {{firstName}},\n\nJust bumping this up in case it got buried. I genuinely think there's a good fit here.\n\nHappy to keep it to 15 minutes — would tomorrow or Thursday work?\n\nBest,\n{{senderName}}`,
      },
      {
        subject: `One more thought for ${company}`,
        body: `Hi {{firstName}},\n\nI was thinking more about ${company}'s situation. One thing that often surprises our clients is how much revenue they were losing from stale deals.\n\nNo pressure at all — just thought it might be worth a conversation.\n\nCheers,\n{{senderName}}`,
      },
      {
        subject: `Closing the loop`,
        body: `Hi {{firstName}},\n\nI don't want to be a pest, so I'll leave this here: if improving your sales pipeline efficiency ever becomes a priority, I'd love to chat.\n\nFeel free to reach out anytime.\n\nAll the best,\n{{senderName}}`,
      },
    ],
    callScript: {
      opener: `Hi {{firstName}}, this is {{senderName}} from Heimdell. I noticed ${company} has been growing in the ${data.industry || 'tech'} space and wanted to quickly see if improving your sales pipeline is on your radar?`,
      discovery: [
        'How are you currently managing your sales pipeline?',
        'What does your sales team structure look like?',
        'What are the biggest bottlenecks in your current process?',
        'How do you track deal progress and forecast revenue?',
      ],
      objectionHandling: {
        'We already have a CRM': `That's great that you're already thinking about it. Out of curiosity, what do you like most about your current setup? Many of our clients switched because they wanted better AI-powered insights and automation.`,
        'We\'re too small': `Actually, that's exactly when the best teams start. Getting your process right now means you scale efficiently. Our starter plan is designed for teams your size.`,
        'Not the right time': `I completely understand. Would it make sense to reconnect in a few weeks? I can also send over some resources that might be useful in the meantime.`,
        'Send me information': `Absolutely. I'll send over a brief overview and a case study from a similar company. What email is best for you?`,
      },
      close: `Based on what you've shared, I think there's genuine value we could add. Would you be open to a 20-minute demo next week so I can show you exactly how this would work for ${company}?`,
    },
  };
}

export function generateMockNextAction(data: {
  leadName?: string;
  dealStage?: string;
  daysSinceContact?: number;
}) {
  const daysSince = data.daysSinceContact || 3;
  const isStale = daysSince > 5;

  return {
    action: isStale ? 'follow_up_email' : 'schedule_call',
    priority: isStale ? 'high' : 'medium',
    reasoning: isStale
      ? `It's been ${daysSince} days since last contact with ${data.leadName || 'this lead'}. Risk of going cold. A follow-up email would re-engage the conversation.`
      : `${data.leadName || 'This lead'} is in the ${data.dealStage || 'qualification'} stage with recent activity. A call would help advance the deal.`,
    suggestedMessage: isStale
      ? `Hi {{firstName}},\n\nI wanted to follow up on our last conversation. Have you had a chance to think about what we discussed?\n\nI'm happy to answer any questions or schedule a quick call to go over next steps.\n\nBest,\n{{senderName}}`
      : null,
    talkingPoints: [
      'Reference the last conversation topic',
      `Address their key pain point: ${data.dealStage === 'negotiation' ? 'pricing concerns' : 'process efficiency'}`,
      'Propose a specific next step with a date',
    ],
  };
}

export function generateMockSequence(data: {
  goal?: string;
  leadName?: string;
  companyName?: string;
}) {
  return {
    name: `Outreach: ${data.companyName || 'New Prospect'}`,
    steps: [
      {
        position: 1,
        type: 'EMAIL',
        delayDays: 0,
        subject: `Introduction — ${data.companyName || 'your company'} + Heimdell`,
        body: `Hi {{firstName}},\n\n${data.goal || 'I wanted to reach out about improving your sales process.'}\n\nWould you be open to a brief chat?\n\nBest,\n{{senderName}}`,
      },
      {
        position: 2,
        type: 'WAIT',
        delayDays: 3,
      },
      {
        position: 3,
        type: 'EMAIL',
        delayDays: 0,
        subject: `Quick follow-up`,
        body: `Hi {{firstName}},\n\nJust following up on my previous email. I think there could be a great fit here.\n\nWould a 15-minute call this week work?\n\nCheers,\n{{senderName}}`,
      },
      {
        position: 4,
        type: 'WAIT',
        delayDays: 4,
      },
      {
        position: 5,
        type: 'TASK',
        delayDays: 0,
        taskDescription: `Call ${data.leadName || 'lead'} at ${data.companyName || 'company'} — try direct outreach`,
      },
      {
        position: 6,
        type: 'WAIT',
        delayDays: 5,
      },
      {
        position: 7,
        type: 'EMAIL',
        delayDays: 0,
        subject: `One last thought`,
        body: `Hi {{firstName}},\n\nI don't want to be a bother, so this will be my last note.\n\nIf improving your sales efficiency is ever a priority, I'd love to help. Feel free to reach out anytime.\n\nAll the best,\n{{senderName}}`,
      },
    ],
  };
}

export function generateMockCallSummary(data: {
  notes?: string;
  leadName?: string;
}) {
  return {
    summary: `Call with ${data.leadName || 'the prospect'}. Discussed their current sales process and pain points. They expressed interest in learning more about automation capabilities. Currently evaluating options and will make a decision within the next 2-3 weeks.`,
    keyPoints: [
      'Prospect is currently using spreadsheets for pipeline tracking',
      'Team of 5 sales reps, growing to 10 by Q2',
      'Main pain point: lack of visibility into deal progress',
      'Budget approved for CRM tool this quarter',
    ],
    objections: [
      'Concerned about onboarding time and disruption',
      'Wants to ensure data migration is seamless',
    ],
    commitments: [
      'Prospect agreed to a demo next Tuesday',
      'Will share their current process document beforehand',
      'Decision maker (VP Sales) will join the demo',
    ],
    followUpTasks: [
      {
        title: `Send demo calendar invite to ${data.leadName || 'prospect'}`,
        dueDate: 'tomorrow',
        priority: 'high',
      },
      {
        title: 'Prepare customised demo with their industry data',
        dueDate: 'next Monday',
        priority: 'medium',
      },
      {
        title: 'Send case study from similar-sized company',
        dueDate: 'today',
        priority: 'high',
      },
    ],
    sentiment: 'positive',
    nextSteps: `Send calendar invite for Tuesday demo. Include VP Sales. Prepare custom demo showing pipeline automation features. Send ${data.leadName || 'them'} the case study from TechCorp.`,
  };
}
