'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';

const WORKFLOWS = [
  { id: 'deep_lead_research', label: 'Deep Lead Research', description: 'Full lead analysis with motivations, objections, and outreach ideas' },
  { id: 'personalized_followup_plan', label: 'Personalized Follow-up Plan', description: '3-step follow-up sequence with ideal angles' },
  { id: 'hot_lead_call_brief', label: 'Hot Lead Call Brief', description: 'One-page call prep with openers and close questions' },
];

export default function OpenClawPage() {
  const queryClient = useQueryClient();
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [selectedWorkflow, setSelectedWorkflow] = useState(WORKFLOWS[0].id);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['openclaw-jobs'],
    queryFn: () => api.getOpenclawJobs(),
    refetchInterval: 10000,
  });

  const runMutation = useMutation({
    mutationFn: () => api.runWorkflow(selectedLeadId, selectedWorkflow),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['openclaw-jobs'] });
      setSelectedLeadId('');
    },
  });

  const statusVariant = (s: string): 'success' | 'warning' | 'danger' | 'default' | 'accent' => {
    const map: Record<string, any> = { completed: 'success', running: 'warning', failed: 'danger', pending: 'accent' };
    return map[s] || 'default';
  };

  return (
    <AppShell>
      <div className="p-6">
        <h1 className="text-xl font-display font-bold text-text-primary mb-6">OpenClaw Research</h1>

        {/* Run Workflow Panel */}
        <div className="bg-bg-secondary border border-border rounded-lg p-4 mb-6">
          <h2 className="text-sm font-medium text-text-primary mb-3">Run Workflow</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {WORKFLOWS.map((wf) => (
              <button
                key={wf.id}
                onClick={() => setSelectedWorkflow(wf.id)}
                className={`text-left p-3 rounded-md border transition-colors ${
                  selectedWorkflow === wf.id
                    ? 'bg-accent/10 border-accent/30 text-text-primary'
                    : 'bg-bg-tertiary border-border text-text-secondary hover:border-border-bright'
                }`}
              >
                <div className="text-sm font-medium">{wf.label}</div>
                <div className="text-xs text-text-muted mt-1">{wf.description}</div>
              </button>
            ))}
          </div>
          <div className="flex gap-3 mt-3">
            <input
              type="text"
              placeholder="Lead ID"
              value={selectedLeadId}
              onChange={(e) => setSelectedLeadId(e.target.value)}
              className="flex-1 max-w-sm px-3 py-2 bg-bg-tertiary border border-border rounded-md text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
            <Button
              onClick={() => runMutation.mutate()}
              disabled={!selectedLeadId || runMutation.isPending}
            >
              {runMutation.isPending ? 'Running...' : 'Run Workflow'}
            </Button>
          </div>
          {runMutation.isError && (
            <div className="mt-2 text-xs text-danger">{(runMutation.error as Error).message}</div>
          )}
        </div>

        {/* Jobs List */}
        <div className="bg-bg-secondary border border-border rounded-lg">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-medium text-text-primary">Recent Jobs</h2>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-text-muted">Loading jobs...</div>
          ) : (
            <div className="divide-y divide-border/50">
              {jobs?.length ? (
                jobs.map((job: any) => (
                  <div key={job.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                        <span className="text-sm text-text-primary">{job.workflowType.replace(/_/g, ' ')}</span>
                        <span className="text-xs text-text-muted">
                          {job.lead?.fullName || job.leadId?.substring(0, 8)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-text-muted">{formatRelativeTime(job.createdAt)}</span>
                        {job.status === 'completed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                          >
                            {expandedJob === job.id ? 'Hide' : 'View'}
                          </Button>
                        )}
                      </div>
                    </div>
                    {job.errorMessage && (
                      <div className="mt-1 text-xs text-danger">{job.errorMessage}</div>
                    )}
                    {expandedJob === job.id && job.outputPayloadJson && (
                      <div className="mt-3 p-3 bg-bg-tertiary rounded-md">
                        <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono">
                          {JSON.stringify(job.outputPayloadJson, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-text-muted text-sm">
                  No research jobs yet. Run a workflow on a lead to get started.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
