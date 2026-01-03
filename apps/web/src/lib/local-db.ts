// Local Storage Database for Offline CRM
// All data persists in browser localStorage with USER ISOLATION
// Each user's data is stored in separate collections using user_id

import { sanitizeWebsiteUrl } from './url-sanitizer';
import { getCurrentUserIdSync } from './supabaseClient';

const STORAGE_KEYS = {
  LEADS: 'heimdell_leads',
  COMPANIES: 'heimdell_companies',
  DEALS: 'heimdell_deals',
  TASKS: 'heimdell_tasks',
  ACTIVITIES: 'heimdell_activities',
  IMPORTS: 'heimdell_imports',
  USER: 'heimdell_user',
  CURRENT_IMPORT: 'heimdell_current_import',
};

// Default pipeline stages
const DEFAULT_PIPELINE_STAGES = [
  { id: 'lead', name: 'Lead', order: 1 },
  { id: 'qualified', name: 'Qualified', order: 2 },
  { id: 'proposal', name: 'Proposal', order: 3 },
  { id: 'negotiation', name: 'Negotiation', order: 4 },
  { id: 'closed', name: 'Closed', order: 5 },
];

// Helper to generate unique IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Get storage key scoped to current user
 * This ensures complete data isolation between users
 */
function getUserScopedKey(baseKey: string): string {
  const userId = getCurrentUserIdSync();
  if (!userId) {
    // If no user logged in, use a temporary key that will be cleared
    return `${baseKey}_anonymous`;
  }
  return `${baseKey}_${userId}`;
}

/**
 * Get current user ID or throw if not authenticated
 */
function requireUserId(): string {
  const userId = getCurrentUserIdSync();
  if (!userId) {
    throw new Error('User must be authenticated to perform this operation');
  }
  return userId;
}

// Generic storage helpers - ALL NOW USER-SCOPED
function getCollection<T>(key: string): T[] {
  try {
    const scopedKey = getUserScopedKey(key);
    const data = localStorage.getItem(scopedKey);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveCollection<T>(key: string, data: T[]): void {
  const scopedKey = getUserScopedKey(key);
  localStorage.setItem(scopedKey, JSON.stringify(data));
}

function getItem<T>(key: string, id: string): T | undefined {
  const collection = getCollection<T & { id: string }>(key);
  return collection.find(item => item.id === id);
}

function addItem<T extends { id?: string }>(key: string, item: T): T & { id: string } {
  const userId = requireUserId();
  const collection = getCollection<T & { id: string }>(key);
  const newItem = { 
    ...item, 
    id: item.id || generateId(), 
    user_id: userId, // CRITICAL: Attach user_id to all records
    createdAt: new Date().toISOString() 
  };
  collection.push(newItem as T & { id: string });
  saveCollection(key, collection);
  return newItem as T & { id: string };
}

function updateItem<T extends { id: string }>(key: string, id: string, updates: Partial<T>): T | undefined {
  const collection = getCollection<T>(key);
  const index = collection.findIndex((item: any) => item.id === id);
  if (index === -1) return undefined;
  collection[index] = { ...collection[index], ...updates, updatedAt: new Date().toISOString() } as T;
  saveCollection(key, collection);
  return collection[index];
}

function deleteItem(key: string, id: string): boolean {
  const collection = getCollection<{ id: string }>(key);
  const filtered = collection.filter(item => item.id !== id);
  if (filtered.length === collection.length) return false;
  saveCollection(key, filtered);
  return true;
}

// CSV Parser
function parseCSV(csvText: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) return { headers: [], rows: [] };

  // Parse header
  const headers = parseCSVLine(lines[0]);
  
  // Parse rows
  const rows = lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  }).filter(row => Object.values(row).some(v => v.trim() !== ''));

  return { headers, rows };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Lead mapping from CSV row - creates a unified company profile
// CRITICAL: All records include user_id for data isolation
function mapCSVRowToCompanyProfile(row: Record<string, string>, index: number, userId: string): {
  id: string;
  lead: any;
  company: any;
  deal: any;
} {
  // Auto-detect common field names - check exact keys first, then partial match
  const findField = (names: string[]): string => {
    // First try exact match
    for (const name of names) {
      if (row[name] && row[name].trim()) return row[name].trim();
    }
    // Then try partial match (case-insensitive)
    for (const name of names) {
      const key = Object.keys(row).find(k => k.toLowerCase().includes(name.toLowerCase()));
      if (key && row[key] && row[key].trim()) return row[key].trim();
    }
    return '';
  };

  // Handle Google Maps export format (place/name, place/phone, etc.)
  const name = findField(['place/name', 'name', 'business', 'company', 'title']) || `Business ${index + 1}`;
  const phone = findField(['place/phone', 'phone', 'tel', 'mobile', 'contact']);
  // Sanitize website URL - handles Google redirect URLs, tracking params, and junk text
  const rawWebsite = findField(['place/website_url', 'website', 'url', 'web', 'site']);
  const website = sanitizeWebsiteUrl(rawWebsite) || '';
  const address = findField(['place/address', 'address', 'location', 'street']);
  const category = findField(['place/main_category', 'category', 'type', 'industry', 'service']) || 'Uncategorized';
  const rating = parseFloat(findField(['place/ave_review_rating', 'rating', 'stars', 'score'])) || null;
  const reviewCount = parseInt(findField(['place/review_count', 'reviews', 'review_count', 'reviewcount'])) || 0;
  const mapUrl = findField(['place/map_url', 'map_url', 'google_maps']);
  const email = findField(['email', 'mail']);
  const marketShare = findField(['market_share', 'share']);
  const avgPosition = findField(['average_position', 'position', 'rank']);

  // Generate a unique ID that links all three records
  const profileId = generateId();
  const timestamp = new Date().toISOString();

  // Shared profile data
  const profileData = {
    category,
    rating,
    reviewCount,
    mapUrl,
    marketShare,
    avgPosition,
    description: findField(['description', 'about', 'bio', 'summary']),
    rawData: row, // Store all original CSV data
  };

  // LEAD record - includes user_id for data isolation
  const lead = {
    id: `lead-${profileId}`,
    profileId,
    user_id: userId, // CRITICAL: User isolation
    name,
    email,
    phone: phone.replace(/[^\d+]/g, ''),
    website,
    address,
    status: 'new',
    source: 'csv_import',
    profileJson: profileData,
    companyId: `company-${profileId}`,
    dealId: `deal-${profileId}`,
    createdAt: timestamp,
  };

  // COMPANY record - includes user_id for data isolation
  const company = {
    id: `company-${profileId}`,
    profileId,
    user_id: userId, // CRITICAL: User isolation
    name,
    email,
    phone: phone.replace(/[^\d+]/g, ''),
    website,
    address,
    industry: category,
    profileJson: profileData,
    leadId: `lead-${profileId}`,
    dealId: `deal-${profileId}`,
    createdAt: timestamp,
  };

  // DEAL record (added to pipeline) - includes user_id for data isolation
  const deal = {
    id: `deal-${profileId}`,
    profileId,
    user_id: userId, // CRITICAL: User isolation
    name: `Deal: ${name}`,
    companyName: name,
    value: 0,
    currency: 'GBP',
    stageId: 'lead', // Start in Lead stage
    status: 'open',
    probability: 10,
    profileJson: profileData,
    leadId: `lead-${profileId}`,
    companyId: `company-${profileId}`,
    createdAt: timestamp,
  };

  return { id: profileId, lead, company, deal };
}

// Local Database API
export const localDb = {
  // Leads
  leads: {
    getAll: (params?: { search?: string }) => {
      let leads = getCollection<any>(STORAGE_KEYS.LEADS);
      if (params?.search) {
        const search = params.search.toLowerCase();
        leads = leads.filter(l => 
          l.name?.toLowerCase().includes(search) ||
          l.email?.toLowerCase().includes(search) ||
          l.phone?.includes(search) ||
          l.profileJson?.category?.toLowerCase().includes(search)
        );
      }
      return leads;
    },
    get: (id: string) => getItem<any>(STORAGE_KEYS.LEADS, id),
    create: (data: any) => addItem(STORAGE_KEYS.LEADS, data),
    update: (id: string, data: any) => updateItem(STORAGE_KEYS.LEADS, id, data),
    delete: (id: string) => deleteItem(STORAGE_KEYS.LEADS, id),
  },

  // Companies
  companies: {
    getAll: (params?: { search?: string }) => {
      let companies = getCollection<any>(STORAGE_KEYS.COMPANIES);
      if (params?.search) {
        const search = params.search.toLowerCase();
        companies = companies.filter(c => 
          c.name?.toLowerCase().includes(search)
        );
      }
      return companies;
    },
    get: (id: string) => getItem<any>(STORAGE_KEYS.COMPANIES, id),
    create: (data: any) => addItem(STORAGE_KEYS.COMPANIES, data),
    update: (id: string, data: any) => updateItem(STORAGE_KEYS.COMPANIES, id, data),
    delete: (id: string) => deleteItem(STORAGE_KEYS.COMPANIES, id),
  },

  // Deals
  deals: {
    getAll: () => getCollection<any>(STORAGE_KEYS.DEALS),
    get: (id: string) => getItem<any>(STORAGE_KEYS.DEALS, id),
    create: (data: any) => addItem(STORAGE_KEYS.DEALS, data),
    update: (id: string, data: any) => updateItem(STORAGE_KEYS.DEALS, id, data),
    delete: (id: string) => deleteItem(STORAGE_KEYS.DEALS, id),
  },

  // Tasks
  tasks: {
    getAll: () => getCollection<any>(STORAGE_KEYS.TASKS),
    get: (id: string) => getItem<any>(STORAGE_KEYS.TASKS, id),
    create: (data: any) => addItem(STORAGE_KEYS.TASKS, data),
    update: (id: string, data: any) => updateItem(STORAGE_KEYS.TASKS, id, data),
    delete: (id: string) => deleteItem(STORAGE_KEYS.TASKS, id),
  },

  // Activities
  activities: {
    getAll: () => getCollection<any>(STORAGE_KEYS.ACTIVITIES),
    create: (data: any) => addItem(STORAGE_KEYS.ACTIVITIES, data),
  },

  // CSV Import - Comprehensive ingestion system
  imports: {
    getAll: () => getCollection<any>(STORAGE_KEYS.IMPORTS),
    
    /**
     * Process CSV file - clears any previous import data and prepares for fresh import
     */
    processCSV: async (file: File): Promise<{ importJobId: string; preview: any; headers: string[]; rowCount: number }> => {
      console.log('=== CSV UPLOAD: Starting fresh import ===');
      
      // STEP 1: Clear any temporary/cached data from prior uploads
      localStorage.removeItem(STORAGE_KEYS.CURRENT_IMPORT);
      console.log('Cleared previous import cache');
      
      const text = await file.text();
      const { headers, rows } = parseCSV(text);
      
      console.log(`Parsed CSV: ${rows.length} rows, ${headers.length} columns`);
      console.log('Headers:', headers);
      
      const importJob = {
        id: generateId(),
        filename: file.name,
        status: 'pending',
        headers,
        rowCount: rows.length,
        preview: rows.slice(0, 5),
        rawRows: rows,
        createdAt: new Date().toISOString(),
      };
      
      // Store current import job
      localStorage.setItem(STORAGE_KEYS.CURRENT_IMPORT, JSON.stringify(importJob));
      addItem(STORAGE_KEYS.IMPORTS, { ...importJob, rawRows: undefined }); // Don't store raw rows in history
      
      return {
        importJobId: importJob.id,
        preview: rows.slice(0, 5),
        headers,
        rowCount: rows.length,
      };
    },

    /**
     * Execute import - Creates unified profiles in LEADS, COMPANIES, and DEALS
     * Treats CSV as single source of truth - clears existing data first
     */
    executeImport: (importJobId: string, options?: { clearExisting?: boolean }): { 
      imported: number; 
      skipped: number; 
      errors: string[];
      leadsCreated: number;
      companiesCreated: number;
      dealsCreated: number;
    } => {
      console.log('=== EXECUTING IMPORT ===');
      console.log('Import Job ID:', importJobId);
      
      // CRITICAL: Get current user ID for data isolation
      const userId = requireUserId();
      console.log('User ID:', userId);
      
      // Get the current import job
      const currentImportJson = localStorage.getItem(STORAGE_KEYS.CURRENT_IMPORT);
      if (!currentImportJson) {
        console.error('No current import job found');
        return { imported: 0, skipped: 0, errors: ['No import job found'], leadsCreated: 0, companiesCreated: 0, dealsCreated: 0 };
      }
      
      const importJob = JSON.parse(currentImportJson);
      if (importJob.id !== importJobId) {
        console.error('Import job ID mismatch');
        return { imported: 0, skipped: 0, errors: ['Import job ID mismatch'], leadsCreated: 0, companiesCreated: 0, dealsCreated: 0 };
      }
      
      const rows = importJob.rawRows || [];
      console.log(`Processing ${rows.length} rows from CSV`);
      
      // STEP 2: Clear existing data FOR THIS USER ONLY
      // Data is already user-scoped via getUserScopedKey()
      console.log('Clearing existing LEADS, COMPANIES, and DEALS for current user...');
      const scopedLeadsKey = getUserScopedKey(STORAGE_KEYS.LEADS);
      const scopedCompaniesKey = getUserScopedKey(STORAGE_KEYS.COMPANIES);
      const scopedDealsKey = getUserScopedKey(STORAGE_KEYS.DEALS);
      localStorage.removeItem(scopedLeadsKey);
      localStorage.removeItem(scopedCompaniesKey);
      localStorage.removeItem(scopedDealsKey);
      
      // Initialize fresh collections
      const leads: any[] = [];
      const companies: any[] = [];
      const deals: any[] = [];
      const errors: string[] = [];
      
      // STEP 3: Process each row - create unified profile across all three entities
      console.log('Creating unified profiles...');
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          // Create unified profile with linked LEAD, COMPANY, and DEAL
          // Pass userId for data isolation
          const profile = mapCSVRowToCompanyProfile(row, i, userId);
          
          // Validate profile has required data
          if (!profile.lead.name || profile.lead.name === `Business ${i + 1}`) {
            console.warn(`Row ${i + 1}: No business name found, using default`);
          }
          
          // Add to all three collections
          leads.push(profile.lead);
          companies.push(profile.company);
          deals.push(profile.deal);
          
          if ((i + 1) % 50 === 0) {
            console.log(`Processed ${i + 1}/${rows.length} rows`);
          }
        } catch (err) {
          const errorMsg = `Row ${i + 1}: ${err}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }
      
      // STEP 4: Save all collections to localStorage (user-scoped)
      console.log('Saving to localStorage...');
      saveCollection(STORAGE_KEYS.LEADS, leads);
      saveCollection(STORAGE_KEYS.COMPANIES, companies);
      saveCollection(STORAGE_KEYS.DEALS, deals);
      
      // STEP 5: Verify data integrity
      const savedLeads = getCollection<any>(STORAGE_KEYS.LEADS);
      const savedCompanies = getCollection<any>(STORAGE_KEYS.COMPANIES);
      const savedDeals = getCollection<any>(STORAGE_KEYS.DEALS);
      
      console.log('=== IMPORT COMPLETE ===');
      console.log(`Leads created: ${savedLeads.length}`);
      console.log(`Companies created: ${savedCompanies.length}`);
      console.log(`Deals created: ${savedDeals.length}`);
      console.log(`Errors: ${errors.length}`);
      
      // Validate linkage
      const linkedCorrectly = savedLeads.every((lead: any) => {
        const company = savedCompanies.find((c: any) => c.profileId === lead.profileId);
        const deal = savedDeals.find((d: any) => d.profileId === lead.profileId);
        return company && deal;
      });
      
      if (!linkedCorrectly) {
        console.error('WARNING: Some profiles are not correctly linked!');
        errors.push('Data integrity warning: Some profiles may not be correctly linked');
      } else {
        console.log('✓ All profiles correctly linked across LEADS, COMPANIES, and DEALS');
      }
      
      // Update import history
      const importsCollection = getCollection<any>(STORAGE_KEYS.IMPORTS);
      const importIndex = importsCollection.findIndex((i: any) => i.id === importJobId);
      if (importIndex !== -1) {
        importsCollection[importIndex] = {
          ...importsCollection[importIndex],
          status: 'completed',
          leadsCreated: savedLeads.length,
          companiesCreated: savedCompanies.length,
          dealsCreated: savedDeals.length,
          errors,
          completedAt: new Date().toISOString(),
        };
        saveCollection(STORAGE_KEYS.IMPORTS, importsCollection);
      }
      
      // Clear current import cache
      localStorage.removeItem(STORAGE_KEYS.CURRENT_IMPORT);
      
      return { 
        imported: leads.length, 
        skipped: 0, 
        errors,
        leadsCreated: savedLeads.length,
        companiesCreated: savedCompanies.length,
        dealsCreated: savedDeals.length,
      };
    },
  },

  // Dashboard stats
  dashboard: {
    getStats: () => {
      const leads = getCollection<any>(STORAGE_KEYS.LEADS);
      const deals = getCollection<any>(STORAGE_KEYS.DEALS);
      const tasks = getCollection<any>(STORAGE_KEYS.TASKS);

      // Group leads by category
      const categories: Record<string, number> = {};
      leads.forEach(l => {
        const cat = l.profileJson?.category || 'Other';
        categories[cat] = (categories[cat] || 0) + 1;
      });

      return {
        totalLeads: leads.length,
        totalDeals: deals.length,
        totalTasks: tasks.length,
        openTasks: tasks.filter(t => !t.completed).length,
        leadsByCategory: categories,
        recentLeads: leads.slice(-10).reverse(),
      };
    },
  },

  // Auth (mock - always logged in for local mode)
  auth: {
    getUser: () => {
      const stored = localStorage.getItem(STORAGE_KEYS.USER);
      if (stored) return JSON.parse(stored);
      
      // Create default user
      const defaultUser = {
        id: 'local-user',
        email: 'user@local.app',
        name: 'Local User',
        role: 'admin',
      };
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(defaultUser));
      return defaultUser;
    },
  },

  // Export all data
  exportAll: () => {
    return {
      leads: getCollection(STORAGE_KEYS.LEADS),
      companies: getCollection(STORAGE_KEYS.COMPANIES),
      deals: getCollection(STORAGE_KEYS.DEALS),
      tasks: getCollection(STORAGE_KEYS.TASKS),
      activities: getCollection(STORAGE_KEYS.ACTIVITIES),
      imports: getCollection(STORAGE_KEYS.IMPORTS),
      exportedAt: new Date().toISOString(),
    };
  },

  // Clear all data
  clearAll: () => {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  },
};

export { parseCSV, mapCSVRowToCompanyProfile };
