import { prisma } from '../lib/prisma';

export interface PolicyContext {
  userId: string;
  organizationId: string;
  role: string;
}

export class PermissionPolicyEngine {
  private policyCache: Map<string, any[]> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes

  async canPerform(
    action: string,
    resource: string,
    context: PolicyContext,
    metadata?: Record<string, any>
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Admin can do everything
    if (context.role === 'ADMIN') {
      return { allowed: true };
    }

    // Get applicable policies
    const policies = await this.getPoliciesForRole(
      context.organizationId,
      context.role
    );

    // Find matching policies
    const matchingPolicies = policies.filter(
      p =>
        p.action === action &&
        p.resource === resource &&
        p.isActive
    );

    if (matchingPolicies.length === 0) {
      // No explicit policy = allowed by default
      return { allowed: true };
    }

    // Check conditions
    for (const policy of matchingPolicies) {
      if (policy.condition) {
        const conditionMet = this.evaluateCondition(
          policy.condition,
          metadata || {}
        );

        if (!conditionMet) {
          return {
            allowed: false,
            reason: policy.description || 'Policy condition not met'
          };
        }
      }
    }

    return { allowed: true };
  }

  async canViewField(
    fieldName: string,
    entityType: string,
    context: PolicyContext
  ): Promise<boolean> {
    const result = await this.canPerform(
      'view_field',
      `${entityType}.${fieldName}`,
      context
    );

    return result.allowed;
  }

  async canEditField(
    fieldName: string,
    entityType: string,
    context: PolicyContext,
    metadata?: Record<string, any>
  ): Promise<{ allowed: boolean; reason?: string }> {
    return this.canPerform(
      'edit_field',
      `${entityType}.${fieldName}`,
      context,
      metadata
    );
  }

  async canExportData(
    context: PolicyContext
  ): Promise<{ allowed: boolean; reason?: string }> {
    return this.canPerform('export_data', 'leads', context);
  }

  async canMarkWonLost(
    context: PolicyContext,
    dealValue?: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    return this.canPerform('mark_won_lost', 'deal', context, {
      dealValue
    });
  }

  async canApproveDiscount(
    context: PolicyContext,
    discountAmount: number,
    dealValue: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    const discountPercent = (discountAmount / dealValue) * 100;

    return this.canPerform('approve_discount', 'deal', context, {
      discountAmount,
      discountPercent,
      dealValue
    });
  }

  private async getPoliciesForRole(
    organizationId: string,
    role: string
  ): Promise<any[]> {
    const cacheKey = `${organizationId}:${role}`;
    const cached = this.policyCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const policies = await prisma.permissionPolicy.findMany({
      where: {
        organizationId,
        role: role as any,
        isActive: true
      }
    });

    this.policyCache.set(cacheKey, policies);

    // Clear cache after expiry
    setTimeout(() => {
      this.policyCache.delete(cacheKey);
    }, this.cacheExpiry);

    return policies;
  }

  private evaluateCondition(
    condition: any,
    metadata: Record<string, any>
  ): boolean {
    // Simple condition evaluator
    // In production, use a proper rules engine

    if (condition.maxValue !== undefined) {
      return metadata.dealValue <= condition.maxValue;
    }

    if (condition.maxDiscountPercent !== undefined) {
      return metadata.discountPercent <= condition.maxDiscountPercent;
    }

    if (condition.requiredRole) {
      return metadata.userRole === condition.requiredRole;
    }

    // Default: condition met
    return true;
  }

  clearCache() {
    this.policyCache.clear();
  }
}

// Singleton instance
export const policyEngine = new PermissionPolicyEngine();
