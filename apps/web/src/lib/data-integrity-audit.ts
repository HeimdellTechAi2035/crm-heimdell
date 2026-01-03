/**
 * Data Integrity Audit Module
 * 
 * Performs comprehensive checks on CRM data:
 * - Orphan leads (no matching company)
 * - Orphan deals (no matching company or lead)
 * - Duplicate companies (by dedupeKey)
 * - Broken linkages (mismatched companyId/leadId)
 * - Data consistency validation
 */

import { getCurrentUserIdSync } from './supabaseClient';

// Storage keys
const STORAGE_KEYS = {
  LEADS: 'heimdell_leads',
  COMPANIES: 'heimdell_companies',
  DEALS: 'heimdell_deals',
};

// Get user-scoped storage key
function getUserScopedKey(baseKey: string): string {
  const userId = getCurrentUserIdSync();
  if (!userId) return `${baseKey}_anonymous`;
  return `${baseKey}_${userId}`;
}

// Get collection from localStorage
function getCollection<T>(key: string): T[] {
  try {
    const scopedKey = getUserScopedKey(key);
    const data = localStorage.getItem(scopedKey);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface IntegrityViolation {
  type: 'orphan_lead' | 'orphan_deal' | 'duplicate_company' | 'broken_link' | 'missing_required_field';
  severity: 'error' | 'warning';
  entityType: 'company' | 'lead' | 'deal';
  entityId: string;
  entityName: string;
  details: string;
}

export interface AuditReport {
  timestamp: string;
  userId: string | null;
  
  // Counts
  companyCount: number;
  leadCount: number;
  dealCount: number;
  
  // Violations
  orphanLeads: IntegrityViolation[];
  orphanDeals: IntegrityViolation[];
  duplicateCompanies: IntegrityViolation[];
  brokenLinks: IntegrityViolation[];
  missingFields: IntegrityViolation[];
  
  // Summary
  totalViolations: number;
  hasErrors: boolean;
  passed: boolean;
  
  // Detailed stats
  stats: {
    companiesWithMultipleLeads: number;
    companiesWithMultipleDeals: number;
    leadsWithoutDeals: number;
    dealsWithoutLeads: number;
    recordsWithImportBatchId: number;
    recordsWithSource: number;
  };
}

// ============================================================================
// AUDIT ENGINE
// ============================================================================

export class DataIntegrityAuditor {
  private companies: any[] = [];
  private leads: any[] = [];
  private deals: any[] = [];
  
  private companyById: Map<string, any> = new Map();
  private leadById: Map<string, any> = new Map();
  private dealById: Map<string, any> = new Map();
  
  private companyByDedupeKey: Map<string, any[]> = new Map();
  
  constructor() {
    this.loadData();
    this.buildIndexes();
  }
  
  /**
   * Load data from localStorage
   */
  private loadData(): void {
    this.companies = getCollection(STORAGE_KEYS.COMPANIES);
    this.leads = getCollection(STORAGE_KEYS.LEADS);
    this.deals = getCollection(STORAGE_KEYS.DEALS);
  }
  
  /**
   * Build lookup indexes
   */
  private buildIndexes(): void {
    // Index companies by ID
    for (const company of this.companies) {
      this.companyById.set(company.id, company);
      
      // Index by dedupeKey for duplicate detection
      if (company.dedupeKey) {
        const existing = this.companyByDedupeKey.get(company.dedupeKey) || [];
        existing.push(company);
        this.companyByDedupeKey.set(company.dedupeKey, existing);
      }
    }
    
    // Index leads by ID
    for (const lead of this.leads) {
      this.leadById.set(lead.id, lead);
    }
    
    // Index deals by ID
    for (const deal of this.deals) {
      this.dealById.set(deal.id, deal);
    }
  }
  
  /**
   * Run full integrity audit
   */
  runAudit(): AuditReport {
    const report: AuditReport = {
      timestamp: new Date().toISOString(),
      userId: getCurrentUserIdSync(),
      
      companyCount: this.companies.length,
      leadCount: this.leads.length,
      dealCount: this.deals.length,
      
      orphanLeads: [],
      orphanDeals: [],
      duplicateCompanies: [],
      brokenLinks: [],
      missingFields: [],
      
      totalViolations: 0,
      hasErrors: false,
      passed: true,
      
      stats: {
        companiesWithMultipleLeads: 0,
        companiesWithMultipleDeals: 0,
        leadsWithoutDeals: 0,
        dealsWithoutLeads: 0,
        recordsWithImportBatchId: 0,
        recordsWithSource: 0,
      },
    };
    
    // Run all checks
    this.checkOrphanLeads(report);
    this.checkOrphanDeals(report);
    this.checkDuplicateCompanies(report);
    this.checkBrokenLinks(report);
    this.checkMissingFields(report);
    this.calculateStats(report);
    
    // Calculate totals
    report.totalViolations = 
      report.orphanLeads.length +
      report.orphanDeals.length +
      report.duplicateCompanies.length +
      report.brokenLinks.length +
      report.missingFields.length;
    
    report.hasErrors = 
      report.orphanLeads.some(v => v.severity === 'error') ||
      report.orphanDeals.some(v => v.severity === 'error') ||
      report.duplicateCompanies.some(v => v.severity === 'error') ||
      report.brokenLinks.some(v => v.severity === 'error') ||
      report.missingFields.some(v => v.severity === 'error');
    
    report.passed = report.totalViolations === 0;
    
    return report;
  }
  
  /**
   * Check for orphan leads (leads without matching company)
   */
  private checkOrphanLeads(report: AuditReport): void {
    for (const lead of this.leads) {
      if (!lead.companyId) {
        report.orphanLeads.push({
          type: 'orphan_lead',
          severity: 'error',
          entityType: 'lead',
          entityId: lead.id,
          entityName: lead.name || 'Unknown',
          details: 'Lead has no companyId',
        });
        continue;
      }
      
      if (!this.companyById.has(lead.companyId)) {
        report.orphanLeads.push({
          type: 'orphan_lead',
          severity: 'error',
          entityType: 'lead',
          entityId: lead.id,
          entityName: lead.name || 'Unknown',
          details: `Lead references non-existent company: ${lead.companyId}`,
        });
      }
    }
  }
  
  /**
   * Check for orphan deals (deals without matching company/lead)
   */
  private checkOrphanDeals(report: AuditReport): void {
    for (const deal of this.deals) {
      // Check companyId
      if (!deal.companyId) {
        report.orphanDeals.push({
          type: 'orphan_deal',
          severity: 'error',
          entityType: 'deal',
          entityId: deal.id,
          entityName: deal.name || 'Unknown',
          details: 'Deal has no companyId',
        });
      } else if (!this.companyById.has(deal.companyId)) {
        report.orphanDeals.push({
          type: 'orphan_deal',
          severity: 'error',
          entityType: 'deal',
          entityId: deal.id,
          entityName: deal.name || 'Unknown',
          details: `Deal references non-existent company: ${deal.companyId}`,
        });
      }
      
      // Check leadId (warning, not error, as deals might not always have leads)
      if (deal.leadId && !this.leadById.has(deal.leadId)) {
        report.orphanDeals.push({
          type: 'orphan_deal',
          severity: 'warning',
          entityType: 'deal',
          entityId: deal.id,
          entityName: deal.name || 'Unknown',
          details: `Deal references non-existent lead: ${deal.leadId}`,
        });
      }
    }
  }
  
  /**
   * Check for duplicate companies (same dedupeKey)
   */
  private checkDuplicateCompanies(report: AuditReport): void {
    for (const [dedupeKey, companies] of this.companyByDedupeKey.entries()) {
      if (companies.length > 1) {
        for (const company of companies) {
          report.duplicateCompanies.push({
            type: 'duplicate_company',
            severity: 'error',
            entityType: 'company',
            entityId: company.id,
            entityName: company.name || 'Unknown',
            details: `Duplicate dedupeKey: ${dedupeKey} (${companies.length} copies)`,
          });
        }
      }
    }
  }
  
  /**
   * Check for broken links (mismatched IDs)
   */
  private checkBrokenLinks(report: AuditReport): void {
    // For each lead, verify its company has this lead as a reference
    for (const lead of this.leads) {
      if (lead.companyId) {
        const company = this.companyById.get(lead.companyId);
        if (company && company.profileId !== lead.profileId) {
          report.brokenLinks.push({
            type: 'broken_link',
            severity: 'warning',
            entityType: 'lead',
            entityId: lead.id,
            entityName: lead.name || 'Unknown',
            details: `Lead profileId (${lead.profileId}) doesn't match company profileId (${company.profileId})`,
          });
        }
      }
    }
    
    // For each deal, verify company and lead have matching profileIds
    for (const deal of this.deals) {
      if (deal.companyId && deal.leadId) {
        const company = this.companyById.get(deal.companyId);
        const lead = this.leadById.get(deal.leadId);
        
        if (company && lead && company.profileId !== lead.profileId) {
          report.brokenLinks.push({
            type: 'broken_link',
            severity: 'error',
            entityType: 'deal',
            entityId: deal.id,
            entityName: deal.name || 'Unknown',
            details: `Deal's company (${company.name}) and lead (${lead.name}) have different profileIds`,
          });
        }
      }
    }
  }
  
  /**
   * Check for missing required fields
   */
  private checkMissingFields(report: AuditReport): void {
    // Check companies
    for (const company of this.companies) {
      if (!company.name) {
        report.missingFields.push({
          type: 'missing_required_field',
          severity: 'warning',
          entityType: 'company',
          entityId: company.id,
          entityName: company.id,
          details: 'Company missing name',
        });
      }
    }
    
    // Check leads
    for (const lead of this.leads) {
      if (!lead.name) {
        report.missingFields.push({
          type: 'missing_required_field',
          severity: 'warning',
          entityType: 'lead',
          entityId: lead.id,
          entityName: lead.id,
          details: 'Lead missing name',
        });
      }
    }
    
    // Check deals
    for (const deal of this.deals) {
      if (!deal.name && !deal.companyName) {
        report.missingFields.push({
          type: 'missing_required_field',
          severity: 'warning',
          entityType: 'deal',
          entityId: deal.id,
          entityName: deal.id,
          details: 'Deal missing name and companyName',
        });
      }
    }
  }
  
  /**
   * Calculate additional statistics
   */
  private calculateStats(report: AuditReport): void {
    // Count leads per company
    const leadsPerCompany = new Map<string, number>();
    for (const lead of this.leads) {
      if (lead.companyId) {
        leadsPerCompany.set(lead.companyId, (leadsPerCompany.get(lead.companyId) || 0) + 1);
      }
    }
    report.stats.companiesWithMultipleLeads = Array.from(leadsPerCompany.values()).filter(c => c > 1).length;
    
    // Count deals per company
    const dealsPerCompany = new Map<string, number>();
    for (const deal of this.deals) {
      if (deal.companyId) {
        dealsPerCompany.set(deal.companyId, (dealsPerCompany.get(deal.companyId) || 0) + 1);
      }
    }
    report.stats.companiesWithMultipleDeals = Array.from(dealsPerCompany.values()).filter(c => c > 1).length;
    
    // Leads without deals
    const dealsWithLeads = new Set(this.deals.filter(d => d.leadId).map(d => d.leadId));
    report.stats.leadsWithoutDeals = this.leads.filter(l => !dealsWithLeads.has(l.id)).length;
    
    // Deals without leads
    report.stats.dealsWithoutLeads = this.deals.filter(d => !d.leadId).length;
    
    // Records with importBatchId
    const allRecords = [...this.companies, ...this.leads, ...this.deals];
    report.stats.recordsWithImportBatchId = allRecords.filter(r => r.importBatchId).length;
    
    // Records with source
    report.stats.recordsWithSource = allRecords.filter(r => r.source).length;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Run a quick integrity audit and return the report
 */
export function runIntegrityAudit(): AuditReport {
  const auditor = new DataIntegrityAuditor();
  return auditor.runAudit();
}

/**
 * Get current data counts
 */
export function getDataCounts(): { companies: number; leads: number; deals: number } {
  return {
    companies: getCollection(STORAGE_KEYS.COMPANIES).length,
    leads: getCollection(STORAGE_KEYS.LEADS).length,
    deals: getCollection(STORAGE_KEYS.DEALS).length,
  };
}

/**
 * Verify data relationship integrity
 * Returns true if all leads and deals properly reference existing companies
 */
export function verifyRelationships(): boolean {
  const auditor = new DataIntegrityAuditor();
  const report = auditor.runAudit();
  return report.orphanLeads.length === 0 && 
         report.orphanDeals.filter(v => v.severity === 'error').length === 0;
}

/**
 * Print audit report to console
 */
export function printAuditReport(report: AuditReport): void {
  console.log('='.repeat(60));
  console.log('DATA INTEGRITY AUDIT REPORT');
  console.log('='.repeat(60));
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`User ID: ${report.userId || 'Unknown'}`);
  console.log('');
  
  console.log('COUNTS:');
  console.log(`  Companies: ${report.companyCount}`);
  console.log(`  Leads: ${report.leadCount}`);
  console.log(`  Deals: ${report.dealCount}`);
  console.log('');
  
  console.log('VIOLATIONS:');
  console.log(`  Orphan Leads: ${report.orphanLeads.length}`);
  console.log(`  Orphan Deals: ${report.orphanDeals.length}`);
  console.log(`  Duplicate Companies: ${report.duplicateCompanies.length}`);
  console.log(`  Broken Links: ${report.brokenLinks.length}`);
  console.log(`  Missing Fields: ${report.missingFields.length}`);
  console.log('');
  
  console.log('STATISTICS:');
  console.log(`  Companies with multiple leads: ${report.stats.companiesWithMultipleLeads}`);
  console.log(`  Companies with multiple deals: ${report.stats.companiesWithMultipleDeals}`);
  console.log(`  Leads without deals: ${report.stats.leadsWithoutDeals}`);
  console.log(`  Deals without leads: ${report.stats.dealsWithoutLeads}`);
  console.log(`  Records with importBatchId: ${report.stats.recordsWithImportBatchId}`);
  console.log(`  Records with source: ${report.stats.recordsWithSource}`);
  console.log('');
  
  console.log('RESULT:');
  console.log(`  Total Violations: ${report.totalViolations}`);
  console.log(`  Has Errors: ${report.hasErrors}`);
  console.log(`  PASSED: ${report.passed ? '✓ YES' : '✗ NO'}`);
  console.log('='.repeat(60));
  
  // Print detailed violations if any
  if (!report.passed) {
    console.log('');
    console.log('DETAILED VIOLATIONS:');
    
    const allViolations = [
      ...report.orphanLeads,
      ...report.orphanDeals,
      ...report.duplicateCompanies,
      ...report.brokenLinks,
      ...report.missingFields,
    ];
    
    for (const v of allViolations.slice(0, 20)) { // Limit to first 20
      console.log(`  [${v.severity.toUpperCase()}] ${v.type}: ${v.entityName} (${v.entityId})`);
      console.log(`    ${v.details}`);
    }
    
    if (allViolations.length > 20) {
      console.log(`  ... and ${allViolations.length - 20} more violations`);
    }
  }
}
