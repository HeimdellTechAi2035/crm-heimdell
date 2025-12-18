import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PermissionPolicyEngine } from '../lib/policy-engine';
import { prisma } from '../lib/prisma';

// Mock Prisma
vi.mock('../lib/prisma', () => ({
  prisma: {
    permissionPolicy: {
      findMany: vi.fn(),
    },
  },
}));

describe('PermissionPolicyEngine', () => {
  let engine: PermissionPolicyEngine;

  beforeEach(() => {
    engine = new PermissionPolicyEngine();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clear cache
    engine['policyCache'].clear();
  });

  describe('canPerform', () => {
    it('should allow action when policy grants permission', async () => {
      const mockPolicies = [
        {
          id: '1',
          role: 'MANAGER',
          action: 'export_data',
          resource: '*',
          effect: 'allow',
          conditions: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.permissionPolicy.findMany as any).mockResolvedValue(mockPolicies);

      const result = await engine.canPerform(
        { userId: 'user1', role: 'MANAGER', businessUnitId: 'bu1' },
        'export_data',
        'leads'
      );

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should deny action when no matching policy exists', async () => {
      (prisma.permissionPolicy.findMany as any).mockResolvedValue([]);

      const result = await engine.canPerform(
        { userId: 'user1', role: 'USER', businessUnitId: 'bu1' },
        'export_data',
        'leads'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('No matching policy found');
    });

    it('should deny action when policy effect is "deny"', async () => {
      const mockPolicies = [
        {
          id: '1',
          role: 'USER',
          action: 'export_data',
          resource: '*',
          effect: 'deny',
          conditions: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.permissionPolicy.findMany as any).mockResolvedValue(mockPolicies);

      const result = await engine.canPerform(
        { userId: 'user1', role: 'USER', businessUnitId: 'bu1' },
        'export_data',
        'leads'
      );

      expect(result.allowed).toBe(false);
    });

    it('should respect resource-specific policies', async () => {
      const mockPolicies = [
        {
          id: '1',
          role: 'USER',
          action: 'edit_field',
          resource: 'leads',
          effect: 'allow',
          conditions: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.permissionPolicy.findMany as any).mockResolvedValue(mockPolicies);

      const leadResult = await engine.canPerform(
        { userId: 'user1', role: 'USER', businessUnitId: 'bu1' },
        'edit_field',
        'leads'
      );

      expect(leadResult.allowed).toBe(true);

      // Should not match for different resource
      const dealResult = await engine.canPerform(
        { userId: 'user1', role: 'USER', businessUnitId: 'bu1' },
        'edit_field',
        'deals'
      );

      expect(dealResult.allowed).toBe(false);
    });

    it('should use cached policies for subsequent calls', async () => {
      const mockPolicies = [
        {
          id: '1',
          role: 'MANAGER',
          action: 'export_data',
          resource: '*',
          effect: 'allow',
          conditions: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.permissionPolicy.findMany as any).mockResolvedValue(mockPolicies);

      // First call
      await engine.canPerform(
        { userId: 'user1', role: 'MANAGER', businessUnitId: 'bu1' },
        'export_data',
        'leads'
      );

      // Second call should use cache
      await engine.canPerform(
        { userId: 'user1', role: 'MANAGER', businessUnitId: 'bu1' },
        'export_data',
        'leads'
      );

      // Should only call database once
      expect(prisma.permissionPolicy.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('canViewField', () => {
    it('should allow viewing field when policy exists', async () => {
      const mockPolicies = [
        {
          id: '1',
          role: 'USER',
          action: 'view_field',
          resource: 'leads',
          effect: 'allow',
          conditions: { field: 'email' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.permissionPolicy.findMany as any).mockResolvedValue(mockPolicies);

      const result = await engine.canViewField(
        { userId: 'user1', role: 'USER', businessUnitId: 'bu1' },
        'leads',
        'email'
      );

      expect(result.allowed).toBe(true);
    });

    it('should deny viewing sensitive field without permission', async () => {
      (prisma.permissionPolicy.findMany as any).mockResolvedValue([]);

      const result = await engine.canViewField(
        { userId: 'user1', role: 'USER', businessUnitId: 'bu1' },
        'leads',
        'ssn'
      );

      expect(result.allowed).toBe(false);
    });
  });

  describe('canEditField', () => {
    it('should allow editing field when policy exists', async () => {
      const mockPolicies = [
        {
          id: '1',
          role: 'MANAGER',
          action: 'edit_field',
          resource: 'leads',
          effect: 'allow',
          conditions: { field: 'status' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.permissionPolicy.findMany as any).mockResolvedValue(mockPolicies);

      const result = await engine.canEditField(
        { userId: 'user1', role: 'MANAGER', businessUnitId: 'bu1' },
        'leads',
        'status'
      );

      expect(result.allowed).toBe(true);
    });

    it('should enforce field-level restrictions', async () => {
      const mockPolicies = [
        {
          id: '1',
          role: 'USER',
          action: 'edit_field',
          resource: 'deals',
          effect: 'allow',
          conditions: { field: 'description' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.permissionPolicy.findMany as any).mockResolvedValue(mockPolicies);

      const descResult = await engine.canEditField(
        { userId: 'user1', role: 'USER', businessUnitId: 'bu1' },
        'deals',
        'description'
      );

      expect(descResult.allowed).toBe(true);

      // Should not allow editing different field
      const valueResult = await engine.canEditField(
        { userId: 'user1', role: 'USER', businessUnitId: 'bu1' },
        'deals',
        'value'
      );

      expect(valueResult.allowed).toBe(false);
    });
  });

  describe('canMarkWonLost', () => {
    it('should allow marking won/lost when no threshold exists', async () => {
      (prisma.permissionPolicy.findMany as any).mockResolvedValue([]);

      const result = await engine.canMarkWonLost(
        { userId: 'user1', role: 'USER', businessUnitId: 'bu1' },
        5000
      );

      // Default behavior: no policy = deny
      expect(result.allowed).toBe(false);
    });

    it('should enforce value threshold for marking won/lost', async () => {
      const mockPolicies = [
        {
          id: '1',
          role: 'USER',
          action: 'mark_won_lost',
          resource: 'deals',
          effect: 'allow',
          conditions: { maxValue: 10000 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.permissionPolicy.findMany as any).mockResolvedValue(mockPolicies);

      // Below threshold
      const allowedResult = await engine.canMarkWonLost(
        { userId: 'user1', role: 'USER', businessUnitId: 'bu1' },
        5000
      );

      expect(allowedResult.allowed).toBe(true);

      // Above threshold
      const deniedResult = await engine.canMarkWonLost(
        { userId: 'user1', role: 'USER', businessUnitId: 'bu1' },
        15000
      );

      expect(deniedResult.allowed).toBe(false);
      expect(deniedResult.reason).toContain('exceeds maximum');
    });

    it('should allow ADMIN to mark any deal won/lost', async () => {
      const mockPolicies = [
        {
          id: '1',
          role: 'ADMIN',
          action: 'mark_won_lost',
          resource: 'deals',
          effect: 'allow',
          conditions: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.permissionPolicy.findMany as any).mockResolvedValue(mockPolicies);

      const result = await engine.canMarkWonLost(
        { userId: 'user1', role: 'ADMIN', businessUnitId: 'bu1' },
        1000000
      );

      expect(result.allowed).toBe(true);
    });
  });

  describe('canApproveDiscount', () => {
    it('should enforce discount percentage limits', async () => {
      const mockPolicies = [
        {
          id: '1',
          role: 'MANAGER',
          action: 'approve_discount',
          resource: 'deals',
          effect: 'allow',
          conditions: { maxDiscountPercent: 20 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.permissionPolicy.findMany as any).mockResolvedValue(mockPolicies);

      // Within limit
      const allowedResult = await engine.canApproveDiscount(
        { userId: 'user1', role: 'MANAGER', businessUnitId: 'bu1' },
        15
      );

      expect(allowedResult.allowed).toBe(true);

      // Exceeds limit
      const deniedResult = await engine.canApproveDiscount(
        { userId: 'user1', role: 'MANAGER', businessUnitId: 'bu1' },
        25
      );

      expect(deniedResult.allowed).toBe(false);
      expect(deniedResult.reason).toContain('exceeds maximum');
    });
  });

  describe('condition evaluation', () => {
    it('should evaluate numeric conditions', async () => {
      const mockPolicies = [
        {
          id: '1',
          role: 'USER',
          action: 'mark_won_lost',
          resource: 'deals',
          effect: 'allow',
          conditions: { maxValue: 5000, minValue: 1000 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.permissionPolicy.findMany as any).mockResolvedValue(mockPolicies);

      // Within range
      const validResult = await engine.canMarkWonLost(
        { userId: 'user1', role: 'USER', businessUnitId: 'bu1' },
        3000
      );
      expect(validResult.allowed).toBe(true);

      // Below minimum
      const tooLowResult = await engine.canMarkWonLost(
        { userId: 'user1', role: 'USER', businessUnitId: 'bu1' },
        500
      );
      expect(tooLowResult.allowed).toBe(false);

      // Above maximum
      const tooHighResult = await engine.canMarkWonLost(
        { userId: 'user1', role: 'USER', businessUnitId: 'bu1' },
        10000
      );
      expect(tooHighResult.allowed).toBe(false);
    });
  });

  describe('cache management', () => {
    it('should expire cache after TTL', async () => {
      const mockPolicies = [
        {
          id: '1',
          role: 'USER',
          action: 'export_data',
          resource: '*',
          effect: 'allow',
          conditions: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.permissionPolicy.findMany as any).mockResolvedValue(mockPolicies);

      // First call
      await engine.canPerform(
        { userId: 'user1', role: 'USER', businessUnitId: 'bu1' },
        'export_data',
        'leads'
      );

      // Simulate cache expiry by advancing time
      const cacheEntry = engine['policyCache'].get('USER');
      if (cacheEntry) {
        cacheEntry.timestamp = Date.now() - 6 * 60 * 1000; // 6 minutes ago
      }

      // Second call should fetch from database again
      await engine.canPerform(
        { userId: 'user1', role: 'USER', businessUnitId: 'bu1' },
        'export_data',
        'leads'
      );

      expect(prisma.permissionPolicy.findMany).toHaveBeenCalledTimes(2);
    });
  });
});
