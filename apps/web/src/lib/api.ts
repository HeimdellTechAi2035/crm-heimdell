// Local-only API Client - All data stored in browser localStorage
// No backend server required!

import { localDb } from './local-db';
import { sanitizeWebsiteUrl } from './url-sanitizer';
import { CSVImportEngine, ImportResult } from './csv-import-engine';
import { runIntegrityAudit, getDataCounts, AuditReport } from './data-integrity-audit';

// Helper to sanitize website in any data object
function sanitizeDataWebsite<T extends Record<string, any>>(data: T): T {
  if (data && typeof data.website === 'string') {
    return { ...data, website: sanitizeWebsiteUrl(data.website) || '' };
  }
  return data;
}

class LocalApiClient {
  private requestCache = new Map();

  clearCache() {
    this.requestCache.clear();
  }

  // Auth - Always logged in for local mode
  setToken(_token: string | null) {
    // No-op for local mode
  }

  getToken() {
    return 'local-token';
  }

  async login(_email: string, _password: string) {
    const user = localDb.auth.getUser();
    return { user, token: 'local-token' };
  }

  async register(_data: any) {
    const user = localDb.auth.getUser();
    return { user, token: 'local-token' };
  }

  async logout() {
    // No-op for local mode
  }

  async getCurrentUser() {
    return localDb.auth.getUser();
  }

  // Leads
  async getLeads(params?: any) {
    const leads = localDb.leads.getAll(params);
    return { leads, total: leads.length };
  }

  async getLead(id: string) {
    const lead = localDb.leads.get(id);
    if (!lead) throw new Error('Lead not found');
    return lead;
  }

  async createLead(data: any) {
    return localDb.leads.create(sanitizeDataWebsite(data));
  }

  async updateLead(id: string, data: any) {
    const updated = localDb.leads.update(id, sanitizeDataWebsite(data));
    if (!updated) throw new Error('Lead not found');
    return updated;
  }

  async deleteLead(id: string) {
    // Get lead to find profileId for cascade delete
    const lead = localDb.leads.get(id);
    if (!lead) throw new Error('Lead not found');
    
    const profileId = lead.profileId;
    
    // Cascade delete: remove linked company and deal
    if (profileId) {
      const companyId = `company-${profileId}`;
      const dealId = `deal-${profileId}`;
      localDb.companies.delete(companyId);
      localDb.deals.delete(dealId);
    }
    
    // Delete the lead
    localDb.leads.delete(id);
    return { success: true };
  }

  // Companies
  async getCompanies(params?: any) {
    const companies = localDb.companies.getAll(params);
    return { companies, total: companies.length };
  }

  async getCompany(id: string) {
    const company = localDb.companies.get(id);
    if (!company) throw new Error('Company not found');
    return company;
  }

  async createCompany(data: any) {
    return localDb.companies.create(sanitizeDataWebsite(data));
  }

  async updateCompany(id: string, data: any) {
    const updated = localDb.companies.update(id, sanitizeDataWebsite(data));
    if (!updated) throw new Error('Company not found');
    return updated;
  }

  async deleteCompany(id: string) {
    // Get company to find profileId for cascade delete
    const company = localDb.companies.get(id);
    if (!company) throw new Error('Company not found');
    
    const profileId = company.profileId;
    
    // Cascade delete: remove linked lead and deal
    if (profileId) {
      const leadId = `lead-${profileId}`;
      const dealId = `deal-${profileId}`;
      localDb.leads.delete(leadId);
      localDb.deals.delete(dealId);
    }
    
    // Delete the company
    localDb.companies.delete(id);
    return { success: true };
  }

  // Deals
  async getDeals(_params?: any) {
    const deals = localDb.deals.getAll();
    return { deals, total: deals.length };
  }

  async getDeal(id: string) {
    const deal = localDb.deals.get(id);
    if (!deal) throw new Error('Deal not found');
    return deal;
  }

  async createDeal(data: any) {
    return localDb.deals.create(data);
  }

  async updateDeal(id: string, data: any) {
    const updated = localDb.deals.update(id, data);
    if (!updated) throw new Error('Deal not found');
    return updated;
  }

  async deleteDeal(id: string) {
    // Get deal to find profileId for cascade delete
    const deal = localDb.deals.get(id);
    if (!deal) throw new Error('Deal not found');
    
    const profileId = deal.profileId;
    
    // Cascade delete: remove linked lead and company
    if (profileId) {
      const leadId = `lead-${profileId}`;
      const companyId = `company-${profileId}`;
      localDb.leads.delete(leadId);
      localDb.companies.delete(companyId);
    }
    
    // Delete the deal
    localDb.deals.delete(id);
    return { success: true };
  }

  async moveDeal(id: string, stageId: string) {
    return this.updateDeal(id, { stageId });
  }

  async closeDeal(id: string, status: 'won' | 'lost', lostReason?: string) {
    return this.updateDeal(id, { status, lostReason, closedAt: new Date().toISOString() });
  }

  // Activities
  async getActivities(_params?: any) {
    const activities = localDb.activities.getAll();
    return { activities, total: activities.length };
  }

  async createActivity(data: any) {
    return localDb.activities.create(data);
  }

  // Tasks
  async getTasks(_params?: any) {
    const tasks = localDb.tasks.getAll();
    return { tasks, total: tasks.length };
  }

  async createTask(data: any) {
    return localDb.tasks.create(data);
  }

  async updateTask(id: string, data: any) {
    const updated = localDb.tasks.update(id, data);
    if (!updated) throw new Error('Task not found');
    return updated;
  }

  // Pipelines - Return static demo data
  async getPipelines() {
    return {
      pipelines: [
        {
          id: 'default',
          name: 'Sales Pipeline',
          stages: [
            { id: 'lead', name: 'Lead', order: 1 },
            { id: 'qualified', name: 'Qualified', order: 2 },
            { id: 'proposal', name: 'Proposal', order: 3 },
            { id: 'negotiation', name: 'Negotiation', order: 4 },
            { id: 'closed', name: 'Closed', order: 5 },
          ],
        },
      ],
    };
  }

  async getPipelineBoard(id: string) {
    const deals = localDb.deals.getAll();
    const pipelines = await this.getPipelines();
    const pipeline = pipelines.pipelines.find(p => p.id === id) || pipelines.pipelines[0];
    
    return {
      pipeline,
      deals: deals.map(d => ({
        ...d,
        stage: pipeline.stages.find(s => s.id === d.stageId) || pipeline.stages[0],
      })),
    };
  }

  // Sequences - Return static demo data
  async getSequences() {
    return { sequences: [] };
  }

  async createSequence(data: any) {
    return { id: 'seq-' + Date.now(), ...data };
  }

  async enrollLead(_sequenceId: string, _leadId: string) {
    return { success: true };
  }

  // AI - Return mock responses (no actual AI in local mode)
  async enrichLead(data: any) {
    return {
      enriched: true,
      data: {
        ...data,
        enrichedAt: new Date().toISOString(),
        note: 'AI enrichment not available in local mode',
      },
    };
  }

  async getNextAction(_data: any) {
    return {
      action: 'Follow up',
      suggestion: 'Consider reaching out to discuss their needs.',
      note: 'AI suggestions not available in local mode',
    };
  }

  async generateSequence(_data: any) {
    return {
      steps: [
        { type: 'email', subject: 'Introduction', delay: 0 },
        { type: 'call', delay: 3 },
        { type: 'email', subject: 'Follow up', delay: 7 },
      ],
      note: 'AI sequence generation not available in local mode',
    };
  }

  async summarizeCall(_data: any) {
    return {
      summary: 'Call summary not available in local mode',
      note: 'AI call summarization not available in local mode',
    };
  }

  async generateProfile(_data: { leadId?: string; companyId?: string }) {
    return {
      profile: null,
      note: 'AI profile generation not available in local mode',
    };
  }

  // CSV Imports - This is the main feature!
  // Now using improved import engine with upsert/deduplication
  private pendingImportFile: File | null = null;
  private pendingImportData: any = null;
  
  async uploadCSV(file: File) {
    // Store the file for later processing
    this.pendingImportFile = file;
    
    // Parse and preview the file (using old method for preview)
    const result = await localDb.imports.processCSV(file);
    this.pendingImportData = result;
    return result;
  }

  async submitImportMapping(importJobId: string, _mapping: any): Promise<{
    success: boolean;
    imported: number;
    skipped: number;
    errors: string[];
    leadsCreated: number;
    companiesCreated: number;
    dealsCreated: number;
    leadsUpdated?: number;
    companiesUpdated?: number;
    dealsUpdated?: number;
    duplicatesHandled?: number;
  }> {
    // Use the new import engine with upsert semantics
    if (!this.pendingImportFile) {
      // Fall back to old method if no file stored
      const result = localDb.imports.executeImport(importJobId, _mapping);
      return {
        success: true,
        ...result,
      };
    }
    
    try {
      const engine = new CSVImportEngine();
      const result: ImportResult = await engine.importFromFile(this.pendingImportFile);
      
      // Clear pending file
      this.pendingImportFile = null;
      this.pendingImportData = null;
      
      return {
        success: result.success,
        imported: result.totalRows,
        skipped: result.duplicatesHandled,
        errors: result.errors,
        leadsCreated: result.leadsCreated,
        companiesCreated: result.companiesCreated,
        dealsCreated: result.dealsCreated,
        leadsUpdated: result.leadsUpdated,
        companiesUpdated: result.companiesUpdated,
        dealsUpdated: result.dealsUpdated,
        duplicatesHandled: result.duplicatesHandled,
      };
    } catch (error) {
      console.error('Import failed:', error);
      return {
        success: false,
        imported: 0,
        skipped: 0,
        errors: [String(error)],
        leadsCreated: 0,
        companiesCreated: 0,
        dealsCreated: 0,
      };
    }
  }

  // Data integrity audit
  async runDataIntegrityAudit(): Promise<AuditReport> {
    return runIntegrityAudit();
  }
  
  async getDataCounts(): Promise<{ companies: number; leads: number; deals: number }> {
    return getDataCounts();
  }

  async getImportStatus(importJobId: string) {
    const imports = localDb.imports.getAll();
    const importJob = imports.find((i: any) => i.id === importJobId);
    return importJob || { status: 'not_found' };
  }

  async getImportErrors(importJobId: string) {
    const imports = localDb.imports.getAll();
    const importJob = imports.find((i: any) => i.id === importJobId);
    return { errors: importJob?.errors || [] };
  }

  async getImports() {
    const imports = localDb.imports.getAll();
    return { imports };
  }

  /**
   * Clean all existing website URLs in leads and companies.
   * Useful for sanitizing data that was imported before URL sanitization was added.
   */
  async cleanAllWebsiteUrls() {
    const leads = localDb.leads.getAll();
    const companies = localDb.companies.getAll();
    
    let cleanedCount = 0;
    
    // Clean leads
    for (const lead of leads) {
      if (lead.website) {
        const cleaned = sanitizeWebsiteUrl(lead.website);
        if (cleaned !== lead.website) {
          localDb.leads.update(lead.id, { website: cleaned || '' });
          cleanedCount++;
        }
      }
    }
    
    // Clean companies  
    for (const company of companies) {
      if (company.website) {
        const cleaned = sanitizeWebsiteUrl(company.website);
        if (cleaned !== company.website) {
          localDb.companies.update(company.id, { website: cleaned || '' });
          cleanedCount++;
        }
      }
    }
    
    return { cleaned: cleanedCount, total: leads.length + companies.length };
  }

  // Dashboard
  async getDashboard(_params?: any) {
    const stats = localDb.dashboard.getStats();
    // Return in the format expected by the Dashboard component
    return {
      metrics: {
        overview: {
          newLeads: stats.totalLeads,
          contactedLeads: 0,
          totalPipelineValue: 0,
          dealsCreated: stats.totalDeals,
          dealsWon: 0,
          wonValue: 0,
          winRate: 0,
          avgTimeToClose: 0,
        },
        taskStats: {
          todo: stats.openTasks,
          completed: stats.totalTasks - stats.openTasks,
        },
      },
      ...stats,
    };
  }

  // Helper methods for compatibility - return any to avoid TypeScript union issues
  async get(endpoint: string, _useCache: boolean = true): Promise<any> {
    // Route to appropriate method based on endpoint
    if (endpoint.includes('/leads')) return this.getLeads();
    if (endpoint.includes('/companies')) return this.getCompanies();
    if (endpoint.includes('/deals')) return this.getDeals();
    if (endpoint.includes('/tasks')) return this.getTasks();
    if (endpoint.includes('/activities')) return this.getActivities();
    if (endpoint.includes('/dashboard')) return this.getDashboard();
    if (endpoint.includes('/pipelines')) return this.getPipelines();
    if (endpoint.includes('/imports')) return this.getImports();
    if (endpoint.includes('/sequences')) return this.getSequences();
    if (endpoint.includes('/field-history')) return { data: [] };
    if (endpoint.includes('/forecasting')) return { data: {} };
    if (endpoint.includes('/knowledge')) return { data: [] };
    if (endpoint.includes('/health')) return { data: { status: 'ok' } };
    if (endpoint.includes('/alerts')) return { data: [] };
    if (endpoint.includes('/workers')) return { data: [] };
    if (endpoint.includes('/diagnostics')) return { data: { runs: [], results: [] } };
    if (endpoint.includes('/brands') || endpoint.includes('/brand')) return { data: [] };
    return {};
  }

  async post(endpoint: string, data?: any) {
    if (endpoint.includes('/leads')) return this.createLead(data);
    if (endpoint.includes('/companies')) return this.createCompany(data);
    if (endpoint.includes('/deals')) return this.createDeal(data);
    if (endpoint.includes('/tasks')) return this.createTask(data);
    if (endpoint.includes('/activities')) return this.createActivity(data);
    return { success: true };
  }

  async put(endpoint: string, data?: any) {
    return this.patch(endpoint, data);
  }

  async patch(endpoint: string, data?: any) {
    const idMatch = endpoint.match(/\/([^/]+)$/);
    const id = idMatch ? idMatch[1] : '';
    
    if (endpoint.includes('/leads')) return this.updateLead(id, data);
    if (endpoint.includes('/companies')) return this.updateCompany(id, data);
    if (endpoint.includes('/deals')) return this.updateDeal(id, data);
    if (endpoint.includes('/tasks')) return this.updateTask(id, data);
    return { success: true };
  }

  async delete(endpoint: string) {
    const idMatch = endpoint.match(/\/([^/]+)$/);
    const id = idMatch ? idMatch[1] : '';
    
    if (endpoint.includes('/leads')) return this.deleteLead(id);
    return { success: true };
  }
}

export const api = new LocalApiClient();
