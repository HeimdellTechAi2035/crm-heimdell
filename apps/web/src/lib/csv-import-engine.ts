/**
 * CSV Import Engine
 * 
 * Handles CSV import with:
 * - Deduplication by domain or company name
 * - Idempotent upsert (importing same CSV twice doesn't create duplicates)
 * - Proper linking: Lead.companyId == Deal.companyId == Company.id
 * - Import batch tracking for traceability
 */

import { getCurrentUserIdSync } from './supabaseClient';
import { 
  parseCSV, 
  extractRowData, 
  generateImportBatchId,
  ExtractedRowData 
} from './csv-import-utils';

// Storage keys
const STORAGE_KEYS = {
  LEADS: 'heimdell_leads',
  COMPANIES: 'heimdell_companies',
  DEALS: 'heimdell_deals',
  IMPORTS: 'heimdell_imports',
  CURRENT_IMPORT: 'heimdell_current_import',
};

// Generate unique ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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

// Save collection to localStorage
function saveCollection<T>(key: string, data: T[]): void {
  const scopedKey = getUserScopedKey(key);
  localStorage.setItem(scopedKey, JSON.stringify(data));
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Company {
  id: string;
  profileId: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  industry: string;
  profileJson: Record<string, any>;
  dedupeKey: string;
  source: string;
  importBatchId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Lead {
  id: string;
  profileId: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  status: string;
  source: string;
  profileJson: Record<string, any>;
  companyId: string;
  dedupeKey: string;
  importBatchId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Deal {
  id: string;
  profileId: string;
  user_id: string;
  name: string;
  companyName: string;
  value: number;
  currency: string;
  stageId: string;
  status: string;
  probability: number;
  profileJson: Record<string, any>;
  leadId: string;
  companyId: string;
  dedupeKey: string;
  source: string;
  importBatchId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ImportResult {
  success: boolean;
  importBatchId: string;
  totalRows: number;
  companiesCreated: number;
  companiesUpdated: number;
  leadsCreated: number;
  leadsUpdated: number;
  dealsCreated: number;
  dealsUpdated: number;
  errors: string[];
  duplicatesHandled: number;
}

// ============================================================================
// IMPORT ENGINE
// ============================================================================

export class CSVImportEngine {
  private userId: string;
  private importBatchId: string;
  private timestamp: string;
  
  // In-memory indexes for fast deduplication
  private companyByDedupeKey: Map<string, Company> = new Map();
  private leadByDedupeKey: Map<string, Lead> = new Map();
  private dealByDedupeKey: Map<string, Deal> = new Map();
  
  constructor() {
    const userId = getCurrentUserIdSync();
    if (!userId) {
      throw new Error('User must be authenticated to import data');
    }
    this.userId = userId;
    this.importBatchId = generateImportBatchId();
    this.timestamp = new Date().toISOString();
    
    // Load existing data into indexes
    this.loadExistingData();
  }
  
  /**
   * Load existing data into deduplication indexes
   */
  private loadExistingData(): void {
    // Load companies
    const companies = getCollection<Company>(STORAGE_KEYS.COMPANIES);
    for (const company of companies) {
      if (company.dedupeKey) {
        this.companyByDedupeKey.set(company.dedupeKey, company);
      }
    }
    
    // Load leads
    const leads = getCollection<Lead>(STORAGE_KEYS.LEADS);
    for (const lead of leads) {
      if (lead.dedupeKey) {
        this.leadByDedupeKey.set(lead.dedupeKey, lead);
      }
    }
    
    // Load deals
    const deals = getCollection<Deal>(STORAGE_KEYS.DEALS);
    for (const deal of deals) {
      if (deal.dedupeKey) {
        this.dealByDedupeKey.set(deal.dedupeKey, deal);
      }
    }
    
    console.log(`Loaded existing data: ${companies.length} companies, ${leads.length} leads, ${deals.length} deals`);
  }
  
  /**
   * Process CSV file and import data with upsert semantics
   */
  async importFromFile(file: File): Promise<ImportResult> {
    const text = await file.text();
    return this.importFromText(text);
  }
  
  /**
   * Import from CSV text
   */
  importFromText(csvText: string): ImportResult {
    const { rows } = parseCSV(csvText);
    return this.importRows(rows);
  }
  
  /**
   * Import from parsed rows
   */
  importRows(rows: Record<string, string>[]): ImportResult {
    const result: ImportResult = {
      success: true,
      importBatchId: this.importBatchId,
      totalRows: rows.length,
      companiesCreated: 0,
      companiesUpdated: 0,
      leadsCreated: 0,
      leadsUpdated: 0,
      dealsCreated: 0,
      dealsUpdated: 0,
      errors: [],
      duplicatesHandled: 0,
    };
    
    console.log(`=== CSV Import Starting ===`);
    console.log(`Import Batch ID: ${this.importBatchId}`);
    console.log(`Total rows: ${rows.length}`);
    
    for (let i = 0; i < rows.length; i++) {
      try {
        const rowData = extractRowData(rows[i], i);
        const rowResult = this.processRow(rowData);
        
        // Aggregate results
        if (rowResult.companyCreated) result.companiesCreated++;
        if (rowResult.companyUpdated) result.companiesUpdated++;
        if (rowResult.leadCreated) result.leadsCreated++;
        if (rowResult.leadUpdated) result.leadsUpdated++;
        if (rowResult.dealCreated) result.dealsCreated++;
        if (rowResult.dealUpdated) result.dealsUpdated++;
        if (rowResult.wasDuplicate) result.duplicatesHandled++;
        
      } catch (error) {
        const errorMsg = `Row ${i + 1}: ${error}`;
        console.error(errorMsg);
        result.errors.push(errorMsg);
      }
    }
    
    // Save all collections
    this.saveAllCollections();
    
    // Log results
    console.log(`=== CSV Import Complete ===`);
    console.log(`Companies: ${result.companiesCreated} created, ${result.companiesUpdated} updated`);
    console.log(`Leads: ${result.leadsCreated} created, ${result.leadsUpdated} updated`);
    console.log(`Deals: ${result.dealsCreated} created, ${result.dealsUpdated} updated`);
    console.log(`Duplicates handled: ${result.duplicatesHandled}`);
    console.log(`Errors: ${result.errors.length}`);
    
    // Store import record
    this.saveImportRecord(result);
    
    return result;
  }
  
  /**
   * Process a single row with upsert semantics
   */
  private processRow(rowData: ExtractedRowData): {
    companyCreated: boolean;
    companyUpdated: boolean;
    leadCreated: boolean;
    leadUpdated: boolean;
    dealCreated: boolean;
    dealUpdated: boolean;
    wasDuplicate: boolean;
  } {
    const result = {
      companyCreated: false,
      companyUpdated: false,
      leadCreated: false,
      leadUpdated: false,
      dealCreated: false,
      dealUpdated: false,
      wasDuplicate: false,
    };
    
    const { dedupeKey } = rowData;
    
    // Profile data shared across all entities
    // Field names match what Leads.tsx UI expects from profileJson
    const profileJson = {
      // Business identity
      businessName: rowData.companyName,
      category: rowData.category,
      address: rowData.address,
      website: rowData.website,
      
      // Review metrics
      rating: rowData.rating,
      reviewCount: rowData.reviewCount,
      
      // Position metrics
      ranking: rowData.ranking,
      averagePosition: rowData.averagePosition,
      marketShare: rowData.marketShare,
      
      // Links
      googleMapsUrl: rowData.mapUrl,
      
      // Additional data
      photosCount: rowData.photosCount,
      description: rowData.description,
      
      // Status and source tracking
      status: rowData.status,
      searchQuery: rowData.searchQuery,
      
      rawData: rowData.rawData,
    };
    
    // Check for existing company by dedupeKey
    let company = this.companyByDedupeKey.get(dedupeKey);
    let profileId: string;
    
    if (company) {
      // UPDATE existing company
      result.wasDuplicate = true;
      profileId = company.profileId;
      
      company = {
        ...company,
        name: rowData.companyName,
        email: rowData.email || company.email,
        phone: rowData.phone || company.phone,
        website: rowData.website || company.website,
        address: rowData.address || company.address,
        industry: rowData.category || company.industry,
        profileJson,
        importBatchId: this.importBatchId,
        updatedAt: this.timestamp,
      };
      this.companyByDedupeKey.set(dedupeKey, company);
      result.companyUpdated = true;
      
    } else {
      // CREATE new company
      profileId = generateId();
      company = {
        id: `company-${profileId}`,
        profileId,
        user_id: this.userId,
        name: rowData.companyName,
        email: rowData.email,
        phone: rowData.phone,
        website: rowData.website,
        address: rowData.address,
        industry: rowData.category,
        profileJson,
        dedupeKey,
        source: 'csv_import',
        importBatchId: this.importBatchId,
        createdAt: this.timestamp,
      };
      this.companyByDedupeKey.set(dedupeKey, company);
      result.companyCreated = true;
    }
    
    // Handle Lead (same dedupeKey)
    let lead = this.leadByDedupeKey.get(dedupeKey);
    
    if (lead) {
      // UPDATE existing lead - ensure companyId matches
      lead = {
        ...lead,
        name: rowData.companyName,
        email: rowData.email || lead.email,
        phone: rowData.phone || lead.phone,
        website: rowData.website || lead.website,
        address: rowData.address || lead.address,
        profileJson,
        companyId: company.id, // CRITICAL: Always link to current company
        importBatchId: this.importBatchId,
        updatedAt: this.timestamp,
      };
      this.leadByDedupeKey.set(dedupeKey, lead);
      result.leadUpdated = true;
      
    } else {
      // CREATE new lead
      lead = {
        id: `lead-${profileId}`,
        profileId,
        user_id: this.userId,
        name: rowData.companyName,
        email: rowData.email,
        phone: rowData.phone,
        website: rowData.website,
        address: rowData.address,
        status: 'new',
        source: 'csv_import',
        profileJson,
        companyId: company.id, // CRITICAL: Link to company
        dedupeKey,
        importBatchId: this.importBatchId,
        createdAt: this.timestamp,
      };
      this.leadByDedupeKey.set(dedupeKey, lead);
      result.leadCreated = true;
    }
    
    // Handle Deal (same dedupeKey)
    let deal = this.dealByDedupeKey.get(dedupeKey);
    
    if (deal) {
      // UPDATE existing deal - ensure companyId and leadId match
      deal = {
        ...deal,
        name: `Deal: ${rowData.companyName}`,
        companyName: rowData.companyName,
        profileJson,
        leadId: lead.id, // CRITICAL: Link to lead
        companyId: company.id, // CRITICAL: Link to company
        importBatchId: this.importBatchId,
        updatedAt: this.timestamp,
      };
      this.dealByDedupeKey.set(dedupeKey, deal);
      result.dealUpdated = true;
      
    } else {
      // CREATE new deal
      deal = {
        id: `deal-${profileId}`,
        profileId,
        user_id: this.userId,
        name: `Deal: ${rowData.companyName}`,
        companyName: rowData.companyName,
        value: 0,
        currency: 'GBP',
        stageId: 'lead',
        status: 'open',
        probability: 10,
        profileJson,
        leadId: lead.id, // CRITICAL: Link to lead
        companyId: company.id, // CRITICAL: Link to company
        dedupeKey,
        source: 'csv_import',
        importBatchId: this.importBatchId,
        createdAt: this.timestamp,
      };
      this.dealByDedupeKey.set(dedupeKey, deal);
      result.dealCreated = true;
    }
    
    return result;
  }
  
  /**
   * Save all collections to localStorage
   */
  private saveAllCollections(): void {
    const companies = Array.from(this.companyByDedupeKey.values());
    const leads = Array.from(this.leadByDedupeKey.values());
    const deals = Array.from(this.dealByDedupeKey.values());
    
    saveCollection(STORAGE_KEYS.COMPANIES, companies);
    saveCollection(STORAGE_KEYS.LEADS, leads);
    saveCollection(STORAGE_KEYS.DEALS, deals);
    
    console.log(`Saved: ${companies.length} companies, ${leads.length} leads, ${deals.length} deals`);
  }
  
  /**
   * Save import record for history
   */
  private saveImportRecord(result: ImportResult): void {
    const imports = getCollection<any>(STORAGE_KEYS.IMPORTS);
    imports.push({
      id: this.importBatchId,
      user_id: this.userId,
      status: result.errors.length > 0 ? 'completed_with_errors' : 'completed',
      totalRows: result.totalRows,
      companiesCreated: result.companiesCreated,
      companiesUpdated: result.companiesUpdated,
      leadsCreated: result.leadsCreated,
      leadsUpdated: result.leadsUpdated,
      dealsCreated: result.dealsCreated,
      dealsUpdated: result.dealsUpdated,
      duplicatesHandled: result.duplicatesHandled,
      errors: result.errors,
      createdAt: this.timestamp,
    });
    saveCollection(STORAGE_KEYS.IMPORTS, imports);
  }
}

// ============================================================================
// CONVENIENCE FUNCTION
// ============================================================================

/**
 * Import CSV file with upsert semantics
 */
export async function importCSVWithUpsert(file: File): Promise<ImportResult> {
  const engine = new CSVImportEngine();
  return engine.importFromFile(file);
}

/**
 * Import CSV text with upsert semantics
 */
export function importCSVTextWithUpsert(csvText: string): ImportResult {
  const engine = new CSVImportEngine();
  return engine.importFromText(csvText);
}
