/**
 * Netlify Functions API Client
 * 
 * This client makes all DB operations through Netlify Functions.
 * NO direct database connections from the frontend.
 */

// Base URL for Netlify Functions
const FUNCTIONS_BASE = '/.netlify/functions';

/**
 * Get stored auth info
 */
function getAuthHeaders(): Record<string, string> {
  // Try to get user info from localStorage or auth context
  const userEmail = localStorage.getItem('user_email');
  const userId = localStorage.getItem('user_id');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (userEmail) {
    headers['X-User-Email'] = userEmail;
  }
  if (userId) {
    headers['X-User-Id'] = userId;
  }
  
  return headers;
}

/**
 * Set user authentication info
 */
export function setNetlifyAuth(email: string, userId?: string) {
  if (email) {
    localStorage.setItem('user_email', email);
  }
  if (userId) {
    localStorage.setItem('user_id', userId);
  }
}

/**
 * Clear user authentication info
 */
export function clearNetlifyAuth() {
  localStorage.removeItem('user_email');
  localStorage.removeItem('user_id');
}

/**
 * Make a request to a Netlify Function
 */
async function fetchFunction<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const url = `${FUNCTIONS_BASE}/${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }
  
  return data;
}

/**
 * API Types
 */
export interface Company {
  id: string;
  user_id: string;
  name: string;
  normalized_name: string;
  website: string | null;
  phone: string | null;
  address: string | null;
  ranking: string | null;
  market: string | null;
  review_count: number | null;
  review_rating: number | null;
  main_category: string | null;
  meta: Record<string, any>;
  created_at: string;
  updated_at: string;
  lead_count?: number;
  deal_count?: number;
  total_deal_value?: number;
}

export interface Lead {
  id: string;
  user_id: string;
  company_id: string;
  status: string;
  source: string;
  meta: Record<string, any>;
  created_at: string;
  company?: Company;
}

export interface Deal {
  id: string;
  user_id: string;
  company_id: string;
  lead_id: string | null;
  title: string;
  stage: string;
  value: number | null;
  probability: number | null;
  expected_close_date: string | null;
  meta: Record<string, any>;
  created_at: string;
  updated_at: string;
  company?: Company;
  lead?: Lead;
}

export interface ImportResult {
  success: boolean;
  import_job_id: string;
  total: number;
  companies_created: number;
  companies_updated: number;
  leads_created: number;
  deals_created: number;
  skipped: number;
  errors: string[];
}

export interface Pipeline {
  id: string;
  name: string;
  stages: Array<{
    id: string;
    name: string;
    position: number;
    deal_count?: number;
    total_value?: number;
  }>;
}

/**
 * Netlify Functions API
 */
export const netlifyApi = {
  /**
   * Import CSV data
   */
  async importCSV(csvText: string, filename?: string): Promise<ImportResult> {
    return fetchFunction<ImportResult>('import_csv', {
      method: 'POST',
      body: JSON.stringify({ csv_text: csvText, filename }),
    });
  },

  /**
   * Import CSV file
   */
  async importCSVFile(file: File): Promise<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    
    const userEmail = localStorage.getItem('user_email');
    if (userEmail) {
      formData.append('email', userEmail);
    }
    
    const response = await fetch(`${FUNCTIONS_BASE}/import_csv`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        // Don't set Content-Type for FormData - browser will set it with boundary
      },
      body: formData,
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Import failed');
    }
    return data;
  },

  /**
   * List companies
   */
  async listCompanies(params?: {
    search?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ companies: Company[]; total: number; has_more: boolean }> {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.category) searchParams.set('category', params.category);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    
    return fetchFunction(`list_companies?${searchParams.toString()}`);
  },

  /**
   * List leads
   */
  async listLeads(params?: {
    search?: string;
    status?: string;
    company_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ leads: Lead[]; total: number; has_more: boolean }> {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.company_id) searchParams.set('company_id', params.company_id);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    
    return fetchFunction(`list_leads?${searchParams.toString()}`);
  },

  /**
   * List deals
   */
  async listDeals(params?: {
    search?: string;
    stage?: string;
    company_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ deals: Deal[]; total: number; has_more: boolean; pipeline: any[] }> {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.stage) searchParams.set('stage', params.stage);
    if (params?.company_id) searchParams.set('company_id', params.company_id);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    
    return fetchFunction(`list_deals?${searchParams.toString()}`);
  },

  /**
   * Get pipelines
   */
  async getPipelines(): Promise<{ pipelines: Pipeline[] }> {
    return fetchFunction('pipelines');
  },

  /**
   * Create or update a company
   */
  async upsertCompany(data: Partial<Company>): Promise<{ company: Company; created: boolean; updated: boolean }> {
    return fetchFunction('company_upsert', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Create a lead
   */
  async createLead(data: {
    company_id: string;
    status?: string;
    source?: string;
    meta?: Record<string, any>;
  }): Promise<{ lead: Lead }> {
    return fetchFunction('lead_create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Create a deal
   */
  async createDeal(data: {
    company_id: string;
    lead_id?: string;
    title?: string;
    stage?: string;
    value?: number;
    probability?: number;
    expected_close_date?: string;
    meta?: Record<string, any>;
  }): Promise<{ deal: Deal }> {
    return fetchFunction('deal_create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update a deal
   */
  async updateDeal(dealId: string, data: {
    stage?: string;
    value?: number;
    probability?: number;
    title?: string;
    expected_close_date?: string;
    meta?: Record<string, any>;
  }): Promise<{ deal: Deal }> {
    return fetchFunction('deal_update', {
      method: 'POST',
      body: JSON.stringify({ deal_id: dealId, ...data }),
    });
  },

  /**
   * Delete an entity
   */
  async delete(type: 'company' | 'lead' | 'deal', id: string): Promise<{ deleted: { companies: number; leads: number; deals: number } }> {
    return fetchFunction('delete', {
      method: 'POST',
      body: JSON.stringify({ type, id }),
    });
  },

  /**
   * Delete a company (and cascade)
   */
  async deleteCompany(id: string) {
    return this.delete('company', id);
  },

  /**
   * Delete a lead
   */
  async deleteLead(id: string) {
    return this.delete('lead', id);
  },

  /**
   * Delete a deal
   */
  async deleteDeal(id: string) {
    return this.delete('deal', id);
  },
};

export default netlifyApi;
