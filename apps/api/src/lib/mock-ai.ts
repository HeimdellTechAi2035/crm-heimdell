/**
 * Mock AI Responses for DEV_TEST_MODE
 */

export function generateMockEnrichment(context: string): any {
  return {
    enrichedData: {
      industry: 'Technology',
      size: '50-200 employees',
      location: 'San Francisco, CA',
      linkedin: 'https://linkedin.com/company/example',
      description: '[MOCK] This is a sample enrichment response for development testing.',
    },
    confidence: 0.3,
    warnings: ['AI disabled: mock response'],
    source: 'mock',
  };
}

export function generateMockNextAction(context: string): any {
  const actions = [
    { action: 'Send follow-up email', priority: 'high', reasoning: '[MOCK] Lead has not responded in 3 days' },
    { action: 'Schedule demo call', priority: 'medium', reasoning: '[MOCK] Lead showed interest in product' },
    { action: 'Send pricing information', priority: 'medium', reasoning: '[MOCK] Lead asked about costs' },
  ];
  
  return {
    suggestedAction: actions[Math.floor(Math.random() * actions.length)],
    confidence: 0.4,
    warnings: ['AI disabled: mock response'],
  };
}

export function generateMockSequence(goal: string, steps: number = 5): any {
  const mockSteps = [];
  for (let i = 0; i < steps; i++) {
    mockSteps.push({
      day: i * 2 + 1,
      action: 'email',
      subject: `[MOCK] Follow-up ${i + 1}`,
      body: `[MOCK] This is a sample email template for step ${i + 1}.\n\nThe goal is: ${goal}`,
    });
  }
  
  return {
    sequence: {
      name: `[MOCK] ${goal} Sequence`,
      steps: mockSteps,
    },
    confidence: 0.3,
    warnings: ['AI disabled: mock response'],
  };
}

export function generateMockCallSummary(notes: string): any {
  return {
    summary: '[MOCK] This is a sample call summary. Key points: customer interested in product, mentioned budget of $10k, wants to schedule follow-up next week.',
    sentiment: 'positive',
    nextSteps: [
      'Send pricing proposal',
      'Schedule demo for next week',
      'Follow up with case studies',
    ],
    confidence: 0.4,
    warnings: ['AI disabled: mock response'],
  };
}

export function generateMockSearchResults(query: string): any {
  return {
    results: [
      {
        type: 'lead',
        id: 'mock-lead-1',
        name: 'John Doe',
        email: 'john@example.com',
        relevance: 0.8,
      },
      {
        type: 'company',
        id: 'mock-company-1',
        name: 'Acme Corp',
        industry: 'Technology',
        relevance: 0.7,
      },
    ],
    query,
    confidence: 0.3,
    warnings: ['AI disabled: mock response'],
  };
}

export function generateMockForecast(dealIds: string[]): any {
  return {
    forecast: {
      totalValue: 150000,
      weightedValue: 90000,
      confidence: 0.65,
      predictions: dealIds.map((id, idx) => ({
        dealId: id,
        predictedCloseDate: new Date(Date.now() + (idx + 1) * 7 * 24 * 60 * 60 * 1000).toISOString(),
        winProbability: 0.6 + (Math.random() * 0.2),
        reasoning: '[MOCK] Based on deal age and historical patterns',
      })),
    },
    warnings: ['AI disabled: mock response'],
  };
}
