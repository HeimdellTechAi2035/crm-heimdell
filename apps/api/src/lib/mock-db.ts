/**
 * Mock In-Memory Database for DEV_TEST_MODE
 * Stores data in memory when no database is available
 */

import { randomUUID } from 'crypto';

// Types matching Prisma models
export interface MockImportJob {
  id: string;
  organizationId: string;
  createdByUserId: string;
  status: 'mapping_required' | 'ready' | 'processing' | 'completed' | 'failed';
  originalFilename: string;
  rowCount: number;
  processedCount: number;
  successCount: number;
  errorCount: number;
  mapping?: any;
  errorLog?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockImportRow {
  id: string;
  importJobId: string;
  rowNumber: number;
  rawJson: Record<string, any>;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
  createdAt: Date;
}

export interface MockCompany {
  id: string;
  organizationId: string;
  name: string;
  domain?: string;
  website?: string;
  industry?: string;
  location?: string;
  size?: string;
  phone?: string;
  notes?: string;
  ownerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockLead {
  id: string;
  organizationId: string;
  companyId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  status: string;
  source?: string;
  notes?: string;
  ownerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory storage
class MockDatabase {
  private importJobs: Map<string, MockImportJob> = new Map();
  private importRows: Map<string, MockImportRow> = new Map();
  private companies: Map<string, MockCompany> = new Map();
  private leads: Map<string, MockLead> = new Map();
  private auditLogs: any[] = [];

  // Import Jobs
  createImportJob(data: Omit<MockImportJob, 'id' | 'createdAt' | 'updatedAt' | 'processedCount' | 'successCount' | 'errorCount'>): MockImportJob {
    const job: MockImportJob = {
      ...data,
      id: randomUUID(),
      processedCount: 0,
      successCount: 0,
      errorCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.importJobs.set(job.id, job);
    return job;
  }

  getImportJob(id: string): MockImportJob | undefined {
    return this.importJobs.get(id);
  }

  updateImportJob(id: string, data: Partial<MockImportJob>): MockImportJob | undefined {
    const job = this.importJobs.get(id);
    if (job) {
      Object.assign(job, data, { updatedAt: new Date() });
      return job;
    }
    return undefined;
  }

  listImportJobs(organizationId: string): MockImportJob[] {
    return Array.from(this.importJobs.values())
      .filter(j => j.organizationId === organizationId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  deleteImportJob(id: string): boolean {
    // Delete associated rows
    for (const [rowId, row] of this.importRows) {
      if (row.importJobId === id) {
        this.importRows.delete(rowId);
      }
    }
    return this.importJobs.delete(id);
  }

  // Import Rows
  createImportRows(rows: Omit<MockImportRow, 'id' | 'createdAt'>[]): void {
    for (const rowData of rows) {
      const row: MockImportRow = {
        ...rowData,
        id: randomUUID(),
        createdAt: new Date(),
      };
      this.importRows.set(row.id, row);
    }
  }

  getImportRowsByJobId(jobId: string): MockImportRow[] {
    return Array.from(this.importRows.values())
      .filter(r => r.importJobId === jobId)
      .sort((a, b) => a.rowNumber - b.rowNumber);
  }

  updateImportRow(id: string, data: Partial<MockImportRow>): MockImportRow | undefined {
    const row = this.importRows.get(id);
    if (row) {
      Object.assign(row, data);
      return row;
    }
    return undefined;
  }

  // Companies
  createCompany(data: Omit<MockCompany, 'id' | 'createdAt' | 'updatedAt'>): MockCompany {
    const company: MockCompany = {
      ...data,
      id: randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.companies.set(company.id, company);
    return company;
  }

  findCompanyByDomain(organizationId: string, domain: string): MockCompany | undefined {
    return Array.from(this.companies.values()).find(
      c => c.organizationId === organizationId && c.domain === domain
    );
  }

  findCompanyByName(organizationId: string, name: string): MockCompany | undefined {
    return Array.from(this.companies.values()).find(
      c => c.organizationId === organizationId && c.name.toLowerCase() === name.toLowerCase()
    );
  }

  listCompanies(organizationId: string): MockCompany[] {
    return Array.from(this.companies.values())
      .filter(c => c.organizationId === organizationId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getCompaniesCount(organizationId: string): number {
    return this.listCompanies(organizationId).length;
  }

  // Leads
  createLead(data: Omit<MockLead, 'id' | 'createdAt' | 'updatedAt'>): MockLead {
    const lead: MockLead = {
      ...data,
      id: randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.leads.set(lead.id, lead);
    return lead;
  }

  findLeadByEmail(organizationId: string, email: string): MockLead | undefined {
    return Array.from(this.leads.values()).find(
      l => l.organizationId === organizationId && l.email?.toLowerCase() === email.toLowerCase()
    );
  }

  listLeads(organizationId: string): MockLead[] {
    return Array.from(this.leads.values())
      .filter(l => l.organizationId === organizationId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getLeadsCount(organizationId: string): number {
    return this.listLeads(organizationId).length;
  }

  getLeadsCountForCompany(companyId: string): number {
    return Array.from(this.leads.values()).filter(l => l.companyId === companyId).length;
  }

  // Audit Logs
  createAuditLog(data: any): void {
    this.auditLogs.push({ ...data, id: randomUUID(), createdAt: new Date() });
  }

  // Stats
  getStats(organizationId: string) {
    return {
      companiesCount: this.getCompaniesCount(organizationId),
      leadsCount: this.getLeadsCount(organizationId),
      importsCount: this.listImportJobs(organizationId).length,
    };
  }

  // Clear all data (for testing)
  clear(): void {
    this.importJobs.clear();
    this.importRows.clear();
    this.companies.clear();
    this.leads.clear();
    this.auditLogs = [];
  }
}

// Singleton instance
export const mockDb = new MockDatabase();
