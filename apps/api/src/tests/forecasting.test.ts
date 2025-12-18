import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../app';
import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';

describe('Forecasting & Pipeline Analytics', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let pipelineId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    const admin = await prisma.user.create({
      data: {
        email: 'admin@test.com',
        password: 'hashed',
        role: 'ADMIN',
        firstName: 'Admin',
        lastName: 'User',
      },
    });

    adminToken = app.jwt.sign({ userId: admin.id, role: admin.role });

    // Create test pipeline
    const pipeline = await prisma.pipeline.create({
      data: {
        name: 'Sales Pipeline',
        stages: ['discovery', 'proposal', 'negotiation', 'closed_won', 'closed_lost'],
      },
    });
    pipelineId = pipeline.id;
  });

  afterAll(async () => {
    await prisma.deal.deleteMany({});
    await prisma.stageProbability.deleteMany({});
    await prisma.pipeline.deleteMany({});
    await prisma.user.deleteMany({});
    await app.close();
  });

  beforeEach(async () => {
    await prisma.deal.deleteMany({});
    await prisma.stageProbability.deleteMany({});
  });

  describe('GET /api/forecasting/pipeline', () => {
    beforeEach(async () => {
      // Create test deals
      await prisma.deal.createMany({
        data: [
          {
            title: 'Deal 1',
            pipelineId,
            stage: 'discovery',
            value: 10000,
            closedAt: null,
          },
          {
            title: 'Deal 2',
            pipelineId,
            stage: 'proposal',
            value: 20000,
            closedAt: null,
          },
          {
            title: 'Deal 3',
            pipelineId,
            stage: 'negotiation',
            value: 30000,
            closedAt: null,
          },
        ],
      });

      // Create stage probabilities
      await prisma.stageProbability.createMany({
        data: [
          { pipelineId, stage: 'discovery', probability: 20 },
          { pipelineId, stage: 'proposal', probability: 50 },
          { pipelineId, stage: 'negotiation', probability: 80 },
        ],
      });
    });

    it('should calculate pipeline value correctly', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/forecasting/pipeline?pipeline_id=${pipelineId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      // Total pipeline value
      expect(data.pipelineValue).toBe(60000); // 10k + 20k + 30k
      expect(data.dealCount).toBe(3);
    });

    it('should calculate expected value with probabilities', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/forecasting/pipeline?pipeline_id=${pipelineId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      const data = JSON.parse(response.body);
      
      // Expected value = (10k * 0.2) + (20k * 0.5) + (30k * 0.8)
      // = 2k + 10k + 24k = 36k
      expect(data.expectedValue).toBe(36000);
    });

    it('should calculate probable value (>= 70% probability)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/forecasting/pipeline?pipeline_id=${pipelineId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      const data = JSON.parse(response.body);
      
      // Only negotiation stage (80%) qualifies
      expect(data.probableValue).toBe(30000);
    });

    it('should group deals by stage', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/forecasting/pipeline?pipeline_id=${pipelineId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      const data = JSON.parse(response.body);
      
      expect(data.dealsByStage).toBeDefined();
      expect(data.dealsByStage.length).toBeGreaterThan(0);
      
      const discoveryStage = data.dealsByStage.find((s: any) => s.stage === 'discovery');
      expect(discoveryStage).toBeDefined();
      expect(discoveryStage.count).toBe(1);
      expect(discoveryStage.totalValue).toBe(10000);
      expect(discoveryStage.probability).toBe(20);
    });

    it('should filter by business unit if provided', async () => {
      const bu = await prisma.businessUnit.create({
        data: {
          name: 'Test Brand',
          subdomain: 'test',
          isActive: true,
        },
      });

      await prisma.deal.create({
        data: {
          title: 'Brand Deal',
          pipelineId,
          stage: 'proposal',
          value: 15000,
          businessUnitId: bu.id,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/forecasting/pipeline?pipeline_id=${pipelineId}&business_unit_id=${bu.id}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      const data = JSON.parse(response.body);
      expect(data.dealCount).toBe(1);
      expect(data.pipelineValue).toBe(15000);
    });
  });

  describe('GET /api/forecasting/stale-deals', () => {
    beforeEach(async () => {
      const now = new Date();
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      await prisma.deal.createMany({
        data: [
          {
            title: 'Recent Deal',
            pipelineId,
            stage: 'proposal',
            value: 10000,
            updatedAt: now,
          },
          {
            title: 'Stale Deal 1',
            pipelineId,
            stage: 'proposal',
            value: 20000,
            updatedAt: twoWeeksAgo,
          },
          {
            title: 'Very Stale Deal',
            pipelineId,
            stage: 'negotiation',
            value: 30000,
            updatedAt: oneMonthAgo,
          },
        ],
      });
    });

    it('should detect stale deals (no update in 14+ days)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/forecasting/stale-deals',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      expect(data.length).toBeGreaterThanOrEqual(2);
      expect(data.some((d: any) => d.title === 'Stale Deal 1')).toBe(true);
      expect(data.some((d: any) => d.title === 'Very Stale Deal')).toBe(true);
      expect(data.some((d: any) => d.title === 'Recent Deal')).toBe(false);
    });

    it('should include days since update', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/forecasting/stale-deals',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      const data = JSON.parse(response.body);
      const veryStale = data.find((d: any) => d.title === 'Very Stale Deal');
      
      expect(veryStale).toBeDefined();
      expect(veryStale.daysSinceUpdate).toBeGreaterThanOrEqual(28);
    });

    it('should sort by staleness (oldest first)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/forecasting/stale-deals',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      const data = JSON.parse(response.body);
      
      // First deal should be the stalest
      expect(data[0].title).toBe('Very Stale Deal');
    });
  });

  describe('POST /api/forecasting/stage-probability', () => {
    it('should create stage probability configuration', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/forecasting/stage-probability',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          pipelineId,
          stage: 'discovery',
          probability: 25,
        },
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      expect(data.stage).toBe('discovery');
      expect(data.probability).toBe(25);
    });

    it('should update existing stage probability', async () => {
      // Create initial probability
      await prisma.stageProbability.create({
        data: {
          pipelineId,
          stage: 'proposal',
          probability: 40,
        },
      });

      // Update it
      const response = await app.inject({
        method: 'POST',
        url: '/api/forecasting/stage-probability',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          pipelineId,
          stage: 'proposal',
          probability: 60,
        },
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      expect(data.probability).toBe(60);
    });

    it('should validate probability range (0-100)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/forecasting/stage-probability',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          pipelineId,
          stage: 'discovery',
          probability: 150, // Invalid
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/forecasting/conversion-rates', () => {
    beforeEach(async () => {
      const now = new Date();
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Create won and lost deals
      await prisma.deal.createMany({
        data: [
          {
            title: 'Won Deal 1',
            pipelineId,
            stage: 'closed_won',
            value: 10000,
            closedAt: oneMonthAgo,
          },
          {
            title: 'Won Deal 2',
            pipelineId,
            stage: 'closed_won',
            value: 20000,
            closedAt: oneMonthAgo,
          },
          {
            title: 'Lost Deal',
            pipelineId,
            stage: 'closed_lost',
            value: 15000,
            closedAt: oneMonthAgo,
          },
        ],
      });
    });

    it('should calculate win rate', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/forecasting/conversion-rates?pipeline_id=${pipelineId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      // 2 won out of 3 closed = 66.67%
      expect(data.winRate).toBeCloseTo(66.67, 1);
    });

    it('should calculate average deal value', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/forecasting/conversion-rates?pipeline_id=${pipelineId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      const data = JSON.parse(response.body);
      
      // Average of won deals: (10k + 20k) / 2 = 15k
      expect(data.avgWonValue).toBe(15000);
    });

    it('should respect date range filters', async () => {
      const startDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const response = await app.inject({
        method: 'GET',
        url: `/api/forecasting/conversion-rates?pipeline_id=${pipelineId}&start_date=${startDate}&end_date=${endDate}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.winRate).toBeDefined();
    });
  });

  describe('Probability Calculation Edge Cases', () => {
    it('should handle deals with no stage probability', async () => {
      await prisma.deal.create({
        data: {
          title: 'No Probability Deal',
          pipelineId,
          stage: 'unknown_stage',
          value: 10000,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/forecasting/pipeline?pipeline_id=${pipelineId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      // Should still return results, with default probability
      expect(data.pipelineValue).toBe(10000);
    });

    it('should handle empty pipeline', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/forecasting/pipeline?pipeline_id=${pipelineId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      expect(data.pipelineValue).toBe(0);
      expect(data.expectedValue).toBe(0);
      expect(data.probableValue).toBe(0);
      expect(data.dealCount).toBe(0);
    });
  });

  describe('Pipeline Filtering', () => {
    it('should only include open deals in forecast', async () => {
      await prisma.deal.createMany({
        data: [
          {
            title: 'Open Deal',
            pipelineId,
            stage: 'proposal',
            value: 10000,
            closedAt: null,
          },
          {
            title: 'Closed Deal',
            pipelineId,
            stage: 'closed_won',
            value: 20000,
            closedAt: new Date(),
          },
        ],
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/forecasting/pipeline?pipeline_id=${pipelineId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      const data = JSON.parse(response.body);
      
      // Should only include open deal
      expect(data.dealCount).toBe(1);
      expect(data.pipelineValue).toBe(10000);
    });
  });
});
