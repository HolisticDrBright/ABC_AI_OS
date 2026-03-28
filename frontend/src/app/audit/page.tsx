'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';

type Tab = 'audit' | 'ai';

export default function AuditPage() {
  const [tab, setTab] = useState<Tab>('audit');
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState('');
  const [decisionTypeFilter, setDecisionTypeFilter] = useState('');

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['audit-logs', page, entityFilter],
    queryFn: () => {
      const params: Record<string, string> = { page: String(page), limit: '30' };
      if (entityFilter) params.entityType = entityFilter;
      return api.getAuditLogs(params);
    },
    enabled: tab === 'audit',
  });

  const { data: aiData, isLoading: aiLoading } = useQuery({
    queryKey: ['ai-decisions', page, decisionTypeFilter],
    queryFn: () => {
      const params: Record<string, string> = { page: String(page), limit: '30' };
      if (decisionTypeFilter) params.decisionType = decisionTypeFilter;
      return api.getAiDecisions(params);
    },
    enabled: tab === 'ai',
  });

  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const actionColor = (action: string) => {
    if (action.includes('created') || action.includes('register')) return 'success';
    if (action.includes('error') || action.includes('failed') || action.includes('dnc')) return 'danger';
    if (action.includes('scored') || action.includes('enriched')) return 'accent';
    return 'default' as const;
  };

  return (
    <AppShell>
      <div className="p-6">
        <h1 className="text-xl font-display font-bold text-text-primary mb-4">Audit Trail</h1>

        {/* Tabs */}
        <div className="flex gap-1 bg-bg-tertiary rounded-md p-1 mb-4 w-fit">
          <button
            onClick={() => { setTab('audit'); setPage(1); }}
            className={`px-4 py-1.5 text-sm rounded font-medium transition-colors ${
              tab === 'audit' ? 'bg-bg-elevated text-text-primary' : 'text-text-muted'
            }`}
          >
            System Logs
          </button>
          <button
            onClick={() => { setTab('ai'); setPage(1); }}
            className={`px-4 py-1.5 text-sm rounded font-medium transition-colors ${
              tab === 'ai' ? 'bg-bg-elevated text-text-primary' : 'text-text-muted'
            }`}
          >
            AI Decisions
          </button>
        </div>

        {tab === 'audit' && (
          <>
            {/* Filters */}
            <div className="flex gap-3 mb-4">
              <select
                value={entityFilter}
                onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
                className="px-3 py-1.5 bg-bg-tertiary border border-border rounded-md text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="">All Entity Types</option>
                <option value="user">User</option>
                <option value="lead">Lead</option>
                <option value="lead_score">Lead Score</option>
                <option value="lead_enrichment">Enrichment</option>
                <option value="campaign">Campaign</option>
                <option value="message">Message</option>
                <option value="task">Task</option>
                <option value="fub_sync">FUB Sync</option>
                <option value="openclaw_job">OpenClaw</option>
              </select>
            </div>

            <div className="bg-bg-secondary border border-border rounded-lg">
              {auditLoading ? (
                <div className="p-8 text-center text-text-muted">Loading...</div>
              ) : (
                <>
                  <div className="divide-y divide-border/50">
                    {auditData?.logs?.map((log: any) => (
                      <div key={log.id} className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <Badge variant={actionColor(log.action)}>{log.action}</Badge>
                          <span className="text-xs text-text-secondary">{log.entityType}</span>
                          {log.entityId && (
                            <span className="text-xs text-text-muted font-mono">{log.entityId.substring(0, 8)}</span>
                          )}
                          <span className="flex-1" />
                          {log.user && <span className="text-xs text-text-muted">{log.user.name}</span>}
                          <span className="text-xs text-text-muted">{formatRelativeTime(log.createdAt)}</span>
                        </div>
                        {log.metadataJson && (
                          <div className="text-xs text-text-muted mt-1 font-mono">
                            {JSON.stringify(log.metadataJson).substring(0, 120)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {auditData && auditData.totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                      <span className="text-xs text-text-muted">
                        {auditData.total} logs — Page {auditData.page} of {auditData.totalPages}
                      </span>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
                        <Button variant="ghost" size="sm" disabled={page >= auditData.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {tab === 'ai' && (
          <>
            <div className="flex gap-3 mb-4">
              <select
                value={decisionTypeFilter}
                onChange={(e) => { setDecisionTypeFilter(e.target.value); setPage(1); }}
                className="px-3 py-1.5 bg-bg-tertiary border border-border rounded-md text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="">All Decision Types</option>
                <option value="lead_scoring">Lead Scoring</option>
                <option value="message_generation">Message Generation</option>
                <option value="reply_classification">Reply Classification</option>
                <option value="openclaw_deep_lead_research">OpenClaw Research</option>
                <option value="openclaw_personalized_followup_plan">Follow-up Plan</option>
                <option value="openclaw_hot_lead_call_brief">Call Brief</option>
              </select>
            </div>

            <div className="bg-bg-secondary border border-border rounded-lg">
              {aiLoading ? (
                <div className="p-8 text-center text-text-muted">Loading...</div>
              ) : (
                <>
                  <div className="divide-y divide-border/50">
                    {aiData?.decisions?.map((dec: any) => (
                      <div key={dec.id} className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <Badge variant="accent">{dec.decisionType}</Badge>
                          {dec.lead && (
                            <span className="text-xs text-text-secondary">{dec.lead.fullName}</span>
                          )}
                          <span className="text-xs text-text-muted font-mono">{dec.modelVersion}</span>
                          <span className="flex-1" />
                          <span className="text-xs text-text-muted">{formatRelativeTime(dec.createdAt)}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedRow(expandedRow === dec.id ? null : dec.id)}
                          >
                            {expandedRow === dec.id ? 'Hide' : 'Inspect'}
                          </Button>
                        </div>
                        {expandedRow === dec.id && (
                          <div className="mt-2 grid grid-cols-2 gap-3">
                            <div className="bg-bg-tertiary rounded-md p-3">
                              <div className="text-xs text-text-muted mb-1 font-medium">Input</div>
                              <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                                {JSON.stringify(dec.inputJson, null, 2)}
                              </pre>
                            </div>
                            <div className="bg-bg-tertiary rounded-md p-3">
                              <div className="text-xs text-text-muted mb-1 font-medium">Output</div>
                              <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                                {JSON.stringify(dec.outputJson, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {aiData && aiData.totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                      <span className="text-xs text-text-muted">
                        {aiData.total} decisions — Page {aiData.page} of {aiData.totalPages}
                      </span>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
                        <Button variant="ghost" size="sm" disabled={page >= aiData.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
