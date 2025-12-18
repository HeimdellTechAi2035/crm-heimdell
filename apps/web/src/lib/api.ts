const API_URL = import.meta.env.VITE_API_URL || '/api';

class ApiClient {
  private token: string | null = null;
  private baseUrl: string = API_URL;
  private requestCache = new Map();
  private cacheTimeout = 30000; // 30 seconds cache

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getToken() {
    if (!this.token) {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.setToken(null);
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: 'Request failed' }));
      throw new Error(error.message || error.error || 'Request failed');
    }

    return response.json();
  }

  // Helper methods
  async get(endpoint: string, useCache: boolean = true) {
    // Check cache for GET requests
    if (useCache) {
      const cacheKey = `GET:${endpoint}`;
      const cached = this.requestCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }
    
    const result = await this.request(endpoint, { method: 'GET' });
    
    // Cache successful GET requests
    if (useCache) {
      this.requestCache.set(`GET:${endpoint}`, {
        data: result,
        timestamp: Date.now()
      });
    }
    
    return result;
  }

  async post(endpoint: string, data?: any) {
    return this.request(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put(endpoint: string, data?: any) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete(endpoint: string) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // Auth
  async login(email: string, password: string) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async register(data: any) {
    const response = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setToken(response.token);
    return response;
  }

  async logout() {
    await this.request('/api/auth/logout', { method: 'POST' });
    this.setToken(null);
  }

  async getCurrentUser() {
    return this.request('/api/auth/me');
  }

  // Leads
  async getLeads(params?: any) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/leads?${query}`);
  }

  async getLead(id: string) {
    return this.request(`/api/leads/${id}`);
  }

  async createLead(data: any) {
    return this.request('/api/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLead(id: string, data: any) {
    return this.request(`/api/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteLead(id: string) {
    return this.request(`/api/leads/${id}`, { method: 'DELETE' });
  }

  // Companies
  async getCompanies(params?: any) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/companies?${query}`);
  }

  async getCompany(id: string) {
    return this.request(`/api/companies/${id}`);
  }

  async createCompany(data: any) {
    return this.request('/api/companies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCompany(id: string, data: any) {
    return this.request(`/api/companies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Deals
  async getDeals(params?: any) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/deals?${query}`);
  }

  async getDeal(id: string) {
    return this.request(`/api/deals/${id}`);
  }

  async createDeal(data: any) {
    return this.request('/api/deals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDeal(id: string, data: any) {
    return this.request(`/api/deals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async moveDeal(id: string, stageId: string) {
    return this.request(`/api/deals/${id}/move`, {
      method: 'POST',
      body: JSON.stringify({ stageId }),
    });
  }

  async closeDeal(id: string, status: 'won' | 'lost', lostReason?: string) {
    return this.request(`/api/deals/${id}/close`, {
      method: 'POST',
      body: JSON.stringify({ status, lostReason }),
    });
  }

  // Activities
  async getActivities(params?: any) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/activities?${query}`);
  }

  async createActivity(data: any) {
    return this.request('/api/activities', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Tasks
  async getTasks(params?: any) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/tasks?${query}`);
  }

  async createTask(data: any) {
    return this.request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTask(id: string, data: any) {
    return this.request(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Pipelines
  async getPipelines() {
    return this.request('/api/pipelines');
  }

  async getPipelineBoard(id: string) {
    return this.request(`/api/pipelines/${id}/board`);
  }

  // Sequences
  async getSequences() {
    return this.request('/api/sequences');
  }

  async createSequence(data: any) {
    return this.request('/api/sequences', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async enrollLead(sequenceId: string, leadId: string) {
    return this.request(`/api/sequences/${sequenceId}/enroll`, {
      method: 'POST',
      body: JSON.stringify({ leadId }),
    });
  }

  // AI
  async enrichLead(data: any) {
    return this.request('/api/ai/enrich', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getNextAction(data: any) {
    return this.request('/api/ai/next-action', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async generateSequence(data: any) {
    return this.request('/api/ai/generate-sequence', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async summarizeCall(data: any) {
    return this.request('/api/ai/summarize-call', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async generateProfile(data: { leadId?: string; companyId?: string }) {
    return this.request('/api/ai/profile-from-import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Imports
  async uploadCSV(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const token = this.token || localStorage.getItem('access_token');
    const response = await fetch(`${this.baseUrl}/api/imports/csv`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }

    return response.json();
  }

  async submitImportMapping(importJobId: string, mapping: any) {
    return this.request(`/api/imports/${importJobId}/mapping`, {
      method: 'POST',
      body: JSON.stringify(mapping),
    });
  }

  async getImportStatus(importJobId: string) {
    return this.request(`/api/imports/${importJobId}/status`);
  }

  async getImportErrors(importJobId: string) {
    return this.request(`/api/imports/${importJobId}/errors`);
  }

  async getImports() {
    return this.request('/api/imports');
  }

  // Dashboard
  async getDashboard(params?: any) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/dashboard?${query}`);
  }
}

export const api = new ApiClient();
