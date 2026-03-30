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

  // AI
  aiScoreLead(leadId: string) {
    return this.request<any>(`/ai/score/${leadId}`, { method: 'POST', body: JSON.stringify({}) });
  }

  aiGenerateMessage(data: { leadId: string; personaMode?: string; angle?: string; campaignObjective?: string }) {
    return this.request<any>('/ai/generate-message', { method: 'POST', body: JSON.stringify(data) });
  }

  aiClassifyReply(messageId: string, conversationId: string) {
    return this.request<any>('/ai/classify', { method: 'POST', body: JSON.stringify({ messageId, conversationId }) });
  }

  aiComputeNBA(leadId: string) {
    return this.request<any>(`/ai/nba/${leadId}`, { method: 'POST', body: JSON.stringify({}) });
  }

  // Apollo
  apolloSearch(params: { q_keywords?: string; person_titles?: string[]; person_locations?: string[] }) {
    return this.request<any>('/apollo/search', { method: 'POST', body: JSON.stringify(params) });
  }

  apolloImport(params: { q_keywords?: string; person_titles?: string[]; person_locations?: string[] }) {
    return this.request<any>('/apollo/import', { method: 'POST', body: JSON.stringify(params) });
  }

  apolloEnrich(leadId: string) {
    return this.request<any>(`/apollo/enrich/${leadId}`, { method: 'POST' });
  }

  // Follow Up Boss
  fubSyncLead(leadId: string) {
    return this.request<any>(`/followupboss/sync/${leadId}`, { method: 'POST' });
  }

  fubPushNote(leadId: string, note: string) {
    return this.request<any>(`/followupboss/note/${leadId}`, { method: 'POST', body: JSON.stringify({ note }) });
  }

  fubImportStale() {
    return this.request<any>('/followupboss/import-stale', { method: 'POST' });
  }

  fubSyncLog(leadId: string) {
    return this.request<any>(`/followupboss/sync-log/${leadId}`);
  }

  // OpenClaw
  runWorkflow(leadId: string, workflowType: string) {
    return this.request<any>('/openclaw/run', { method: 'POST', body: JSON.stringify({ leadId, workflowType }) });
  }

  getOpenclawJobs(status?: string) {
    const qs = status ? `?status=${status}` : '';
    return this.request<any>(`/openclaw/jobs${qs}`);
  }

  // Tasks
  getTasks(status?: string) {
    const qs = status ? `?status=${status}` : '';
    return this.request<any>(`/tasks${qs}`);
  }

  updateTaskStatus(id: string, status: string) {
    return this.request<any>(`/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  }

  getEscalationView(taskId: string) {
    return this.request<any>(`/tasks/escalation/${taskId}`);
  }

  // Neighborhood
  getNeighborhoodData(zipCode: string) {
    return this.request<any>(`/neighborhood/${zipCode}`);
  }

  seedNeighborhoodData(records: any[]) {
    return this.request<any>('/neighborhood/bulk', { method: 'POST', body: JSON.stringify({ records }) });
  }

  // Analytics
  getMessagingAnalytics() {
    return this.request<any>('/analytics/messaging');
  }

  getScoreAnalytics() {
    return this.request<any>('/analytics/scores');
  }

  getCampaignAnalyticsOverview() {
    return this.request<any>('/analytics/campaigns');
  }

  getHandoffAnalytics() {
    return this.request<any>('/analytics/handoffs');
  }

  getClassificationAnalytics() {
    return this.request<any>('/analytics/classifications');
  }

  // Audit
  getAuditLogs(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<any>(`/audit/logs${qs}`);
  }

  getAiDecisions(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<any>(`/audit/ai-decisions${qs}`);
  }

  // Compliance
  getComplianceStatus() {
    return this.request<any>('/compliance/status');
  }

  getDncList() {
    return this.request<any>('/compliance/dnc');
  }

  // PropStream
  importPropStreamCSV(csvData: string) {
    return this.request<any>('/propstream/import-csv', { method: 'POST', body: JSON.stringify({ csvData }) });
  }

  getPropStreamColumnGuide() {
    return this.request<any>('/propstream/column-guide');
  }

  // Cal.com
  getBookingUrl(agentSlug: string, leadName?: string, leadEmail?: string) {
    const params = new URLSearchParams({ agentSlug });
    if (leadName) params.set('leadName', leadName);
    if (leadEmail) params.set('leadEmail', leadEmail);
    return this.request<any>(`/calcom/booking-url?${params}`);
  }

  // Circuit breaker status
  getCircuitBreakerStatus() {
    return this.request<any>('/compliance/status');
  }
}

export const api = new ApiClient();
