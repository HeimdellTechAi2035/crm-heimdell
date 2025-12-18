import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../app';
import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';

describe('Business Units API', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let userToken: string;
  let testBusinessUnitId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Create test users
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@test.com',
        password: 'hashed_password',
        role: 'ADMIN',
        firstName: 'Admin',
        lastName: 'User',
      },
    });

    const regularUser = await prisma.user.create({
      data: {
        email: 'user@test.com',
        password: 'hashed_password',
        role: 'USER',
        firstName: 'Regular',
        lastName: 'User',
      },
    });

    // Generate tokens
    adminToken = app.jwt.sign({ userId: adminUser.id, role: adminUser.role });
    userToken = app.jwt.sign({ userId: regularUser.id, role: regularUser.role });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.businessUnit.deleteMany({});
    await prisma.user.deleteMany({});
    await app.close();
  });

  beforeEach(async () => {
    // Clean up business units before each test
    await prisma.businessUnit.deleteMany({});
  });

  describe('POST /api/business-units', () => {
    it('should create business unit as ADMIN', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/business-units',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: 'Test Brand',
          subdomain: 'test-brand',
          settings: { theme: 'blue' },
        },
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      expect(data.name).toBe('Test Brand');
      expect(data.subdomain).toBe('test-brand');
      expect(data.isActive).toBe(true);
      
      testBusinessUnitId = data.id;
    });

    it('should reject creation as regular USER', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/business-units',
        headers: {
          authorization: `Bearer ${userToken}`,
        },
        payload: {
          name: 'Unauthorized Brand',
          subdomain: 'unauthorized',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should reject duplicate subdomain', async () => {
      // Create first business unit
      await app.inject({
        method: 'POST',
        url: '/api/business-units',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: 'First Brand',
          subdomain: 'duplicate',
        },
      });

      // Try to create second with same subdomain
      const response = await app.inject({
        method: 'POST',
        url: '/api/business-units',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: 'Second Brand',
          subdomain: 'duplicate',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require name and subdomain', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/business-units',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: 'Incomplete Brand',
          // Missing subdomain
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/business-units', () => {
    beforeEach(async () => {
      // Create test business units
      await prisma.businessUnit.createMany({
        data: [
          { name: 'Active Brand 1', subdomain: 'active1', isActive: true },
          { name: 'Active Brand 2', subdomain: 'active2', isActive: true },
          { name: 'Inactive Brand', subdomain: 'inactive', isActive: false },
        ],
      });
    });

    it('should list all business units as ADMIN', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/business-units',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.length).toBe(3);
    });

    it('should list only active business units', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/business-units/active',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.length).toBe(2);
      expect(data.every((bu: any) => bu.isActive)).toBe(true);
    });
  });

  describe('PATCH /api/business-units/:id', () => {
    let businessUnitId: string;

    beforeEach(async () => {
      const bu = await prisma.businessUnit.create({
        data: {
          name: 'Original Name',
          subdomain: 'original',
          isActive: true,
        },
      });
      businessUnitId = bu.id;
    });

    it('should update business unit as ADMIN', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/business-units/${businessUnitId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: 'Updated Name',
          settings: { theme: 'dark' },
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.name).toBe('Updated Name');
      expect(data.subdomain).toBe('original'); // Should not change
      expect(data.settings.theme).toBe('dark');
    });

    it('should reject update as regular USER', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/business-units/${businessUnitId}`,
        headers: {
          authorization: `Bearer ${userToken}`,
        },
        payload: {
          name: 'Unauthorized Update',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 404 for non-existent business unit', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/business-units/nonexistent-id',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: 'Updated Name',
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/business-units/:id (soft delete)', () => {
    let businessUnitId: string;

    beforeEach(async () => {
      const bu = await prisma.businessUnit.create({
        data: {
          name: 'To Delete',
          subdomain: 'to-delete',
          isActive: true,
        },
      });
      businessUnitId = bu.id;
    });

    it('should soft delete (deactivate) business unit as ADMIN', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/business-units/${businessUnitId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      // Verify it's deactivated, not deleted
      const bu = await prisma.businessUnit.findUnique({
        where: { id: businessUnitId },
      });
      expect(bu).not.toBeNull();
      expect(bu?.isActive).toBe(false);
    });

    it('should reject deletion as regular USER', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/business-units/${businessUnitId}`,
        headers: {
          authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /api/business-units/:id/stats', () => {
    let businessUnitId: string;

    beforeEach(async () => {
      const bu = await prisma.businessUnit.create({
        data: {
          name: 'Stats Brand',
          subdomain: 'stats-brand',
          isActive: true,
        },
      });
      businessUnitId = bu.id;

      // Create test data
      await prisma.lead.createMany({
        data: [
          { email: 'lead1@test.com', businessUnitId, status: 'new' },
          { email: 'lead2@test.com', businessUnitId, status: 'qualified' },
        ],
      });

      await prisma.deal.createMany({
        data: [
          {
            title: 'Deal 1',
            businessUnitId,
            pipelineId: 'pipeline1',
            stage: 'proposal',
            value: 10000,
          },
          {
            title: 'Deal 2',
            businessUnitId,
            pipelineId: 'pipeline1',
            stage: 'negotiation',
            value: 20000,
          },
        ],
      });
    });

    it('should return statistics for business unit', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/business-units/${businessUnitId}/stats`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.leadCount).toBe(2);
      expect(data.dealCount).toBe(2);
      expect(data.totalDealValue).toBe(30000);
    });
  });

  describe('Data Isolation', () => {
    let brand1Id: string;
    let brand2Id: string;

    beforeEach(async () => {
      // Create two brands
      const brand1 = await prisma.businessUnit.create({
        data: { name: 'Brand 1', subdomain: 'brand1', isActive: true },
      });
      const brand2 = await prisma.businessUnit.create({
        data: { name: 'Brand 2', subdomain: 'brand2', isActive: true },
      });

      brand1Id = brand1.id;
      brand2Id = brand2.id;

      // Create leads for each brand
      await prisma.lead.createMany({
        data: [
          { email: 'brand1-lead@test.com', businessUnitId: brand1Id, status: 'new' },
          { email: 'brand2-lead@test.com', businessUnitId: brand2Id, status: 'new' },
        ],
      });
    });

    it('should only return leads for specific business unit', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/leads?business_unit_id=${brand1Id}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.length).toBe(1);
      expect(data[0].email).toBe('brand1-lead@test.com');
    });

    it('should prevent cross-brand data access', async () => {
      // This test verifies that filtering by business unit is enforced
      const allLeadsResponse = await app.inject({
        method: 'GET',
        url: '/api/leads',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      const allLeads = JSON.parse(allLeadsResponse.body);
      
      const brand1LeadsResponse = await app.inject({
        method: 'GET',
        url: `/api/leads?business_unit_id=${brand1Id}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      const brand1Leads = JSON.parse(brand1LeadsResponse.body);
      
      // Brand 1 leads should be subset of all leads
      expect(brand1Leads.length).toBeLessThanOrEqual(allLeads.length);
      expect(brand1Leads.every((l: any) => l.businessUnitId === brand1Id)).toBe(true);
    });
  });
});
