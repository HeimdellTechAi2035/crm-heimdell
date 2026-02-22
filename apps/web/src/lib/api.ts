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

  async patch(endpoint: string, data?: any) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete(endpoint: string) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // Auth
  async login(email: string, password: string) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async register(data: any) {
    const response = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setToken(response.token);
    return response;
  }

  async logout() {
    await this.request('/auth/logout', { method: 'POST' });
    this.setToken(null);
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  // ── Leads ────────────────────────────────────────────────
  async getLeads(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request(`/leads${query}`);
  }

  async getLead(id: string) {
    return this.request(`/leads/${id}`);
  }

  async createLead(data: any) {
    return this.request('/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLead(id: string, data: any) {
    return this.request(`/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async logAction(id: string, action: string, notes?: string) {
    return this.request(`/leads/${id}/actions`, {
      method: 'POST',
      body: JSON.stringify({ action, notes }),
    });
  }

  async getLeadStats() {
    return this.request('/leads/stats');
  }

  // ── Pipeline ────────────────────────────────────────────
  async advancePipeline(leadId: string, targetStatus: string) {
    return this.request(`/pipeline/advance/${leadId}`, {
      method: 'POST',
      body: JSON.stringify({ targetStatus }),
    });
  }

  async getDueLeads() {
    return this.request('/pipeline/due');
  }

  async getPipelineStatus(leadId: string) {
    return this.request(`/pipeline/status/${leadId}`);
  }

  async runSchedulerTick() {
    return this.request('/pipeline/scheduler-tick', { method: 'POST' });
  }

  // ── Google Sheets Integration ───────────────────────────
  async getSheetsConfigs() {
    return this.request('/integrations/configs');
  }

  async createSheetsConfig(data: any) {
    return this.request('/integrations/configs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async triggerSyncIn(configId: string, dryRun = false) {
    return this.request('/integrations/sync-in', {
      method: 'POST',
      body: JSON.stringify({ configId, dryRun }),
    });
  }

  async triggerSyncOut(configId: string) {
    return this.request('/integrations/sync-out', {
      method: 'POST',
      body: JSON.stringify({ configId }),
    });
  }

  async getSyncLogs(configId: string) {
    return this.request(`/integrations/sync-logs/${configId}`);
  }

  // ── API Keys (Admin) ───────────────────────────────────
  async getApiKeys() {
    return this.request('/api-keys');
  }

  async createApiKey(name: string, permissions: string[]) {
    return this.request('/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name, permissions }),
    });
  }

  async revokeApiKey(id: string) {
    return this.request(`/api-keys/${id}`, { method: 'DELETE' });
  }

  // ── Email Senders (Phase 3) ────────────────────────────
  async getEmailSenders() {
    return this.request('/integrations/email/senders');
  }

  async createEmailSender(data: any) {
    return this.request('/integrations/email/senders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEmailSender(id: string, data: any) {
    return this.request(`/integrations/email/senders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async testSendEmail(data: { senderEmail: string; to: string; subject: string; text: string }) {
    return this.request('/integrations/email/test-send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getEmailLogs(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request(`/integrations/email/logs${query}`);
  }

  async getEmailAllowlist() {
    return this.request('/integrations/email/allowlist');
  }

  // ── CSV Upload (legacy) ────────────────────────────────
  async uploadCSV(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const token = this.token || localStorage.getItem('token');
    const response = await fetch(`${this.baseUrl}/imports/csv`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }
    return response.json();
  }
}

export const api = new ApiClient();
