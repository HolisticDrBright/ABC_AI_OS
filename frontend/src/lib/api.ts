const API_BASE = '/api';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('abc_token', token);
    } else {
      localStorage.removeItem('abc_token');
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = typeof window !== 'undefined' ? localStorage.getItem('abc_token') : null;
    }
    return this.token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: { message: 'Request failed' } }));
      throw new Error(body.error?.message || `HTTP ${res.status}`);
    }

    return res.json();
  }

  // Auth
  login(email: string, password: string) {
    return this.request<{ token: string; user: any; organization: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  register(data: { organizationName: string; name: string; email: string; password: string }) {
    return this.request<{ token: string; user: any; organization: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getProfile() {
    return this.request<any>('/auth/me');
  }

  // Dashboard
  getDashboardStats() {
    return this.request<any>('/dashboard/stats');
  }

  // Leads
  getLeads(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<any>(`/leads${qs}`);
  }

  getLead(id: string) {
    return this.request<any>(`/leads/${id}`);
  }

  createLead(data: any) {
    return this.request<any>('/leads', { method: 'POST', body: JSON.stringify(data) });
  }

  updateLead(id: string, data: any) {
    return this.request<any>(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  scoreLead(id: string) {
    return this.request<any>(`/leads/${id}/score`, { method: 'POST' });
  }

  bulkCreateLeads(leads: any[]) {
    return this.request<any>('/leads/bulk', { method: 'POST', body: JSON.stringify({ leads }) });
  }

  // Campaigns
  getCampaigns(status?: string) {
    const qs = status ? `?status=${status}` : '';
    return this.request<any>(`/campaigns${qs}`);
  }

  getCampaign(id: string) {
    return this.request<any>(`/campaigns/${id}`);
  }

  createCampaign(data: any) {
    return this.request<any>('/campaigns', { method: 'POST', body: JSON.stringify(data) });
  }

  enrollLeadInCampaign(campaignId: string, leadId: string) {
    return this.request<any>(`/campaigns/${campaignId}/enroll`, {
      method: 'POST',
      body: JSON.stringify({ leadId }),
    });
  }

  updateCampaignStatus(id: string, status: string) {
    return this.request<any>(`/campaigns/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  getCampaignAnalytics(id: string) {
    return this.request<any>(`/campaigns/${id}/analytics`);
  }

  // Messages
  sendMessage(data: { leadId: string; body: string; campaignId?: string }) {
    return this.request<any>('/messages/send', { method: 'POST', body: JSON.stringify(data) });
  }

  getConversation(leadId: string) {
    return this.request<any>(`/messages/conversation/${leadId}`);
  }
}

export const api = new ApiClient();
