'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { api } from '@/lib/api';
import { formatRelativeTime, getNbaLabel, getNbaColor } from '@/lib/utils';

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [smsBody, setSmsBody] = useState('');

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => api.getLead(id),
  });

  const scoreMutation = useMutation({
    mutationFn: () => api.scoreLead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lead', id] }),
  });

  const sendSmsMutation = useMutation({
    mutationFn: (body: string) => api.sendMessage({ leadId: id, body }),
    onSuccess: () => {
      setSmsBody('');
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
    },
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-6 text-text-muted">Loading lead...</div>
      </AppShell>
    );
  }

  if (!lead) {
    return (
      <AppShell>
        <div className="p-6 text-text-muted">Lead not found</div>
      </AppShell>
    );
  }

  const latestScore = lead.scores?.[0];

  return (
    <AppShell>
      <div className="p-6">
        {/* Back + Header */}
        <button onClick={() => router.back()} className="text-xs text-text-muted hover:text-text-secondary mb-4">
          &larr; Back to Leads
        </button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-display font-bold text-text-primary">
              {lead.fullName || 'Unknown Lead'}
            </h1>
            <div className="flex gap-3 mt-1 text-sm text-text-secondary">
              {lead.company && <span>{lead.company}</span>}
              {lead.title && <span>· {lead.title}</span>}
              {lead.city && <span>· {lead.city}, {lead.state}</span>}
            </div>
            <div className="flex gap-2 mt-2">
              <Badge variant={lead.doNotContact ? 'danger' : 'default'}>
                {lead.doNotContact ? 'DNC' : lead.leadStatus}
              </Badge>
              {lead.sourceLabel && <Badge variant="muted">{lead.sourceLabel}</Badge>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => scoreMutation.mutate()}>
              {scoreMutation.isPending ? 'Scoring...' : 'Rescore'}
            </Button>
            <Button variant="secondary" size="sm">Run Research</Button>
            <Button variant="danger" size="sm">Mark DNC</Button>
          </div>
        </div>

        {/* Score Panel */}
        {latestScore && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            <StatCard label="Total Score" value={Math.round(latestScore.totalScore)} accent={latestScore.totalScore >= 70} />
            <StatCard label="Fit" value={Math.round(latestScore.fitScore)} />
            <StatCard label="Urgency" value={Math.round(latestScore.urgencyScore)} />
            <StatCard label="Engagement" value={Math.round(latestScore.engagementScore)} />
            <StatCard label="Motivation" value={Math.round(latestScore.motivationScore)} />
            <StatCard label="Close %" value={`${(latestScore.closeProbability * 100).toFixed(0)}%`} />
            <div className="bg-bg-secondary border border-border rounded-lg p-4">
              <div className="text-xs text-text-muted uppercase tracking-wider mb-2">NBA</div>
              <div className={`text-sm font-bold ${getNbaColor(latestScore.nextBestAction)}`}>
                {getNbaLabel(latestScore.nextBestAction)}
              </div>
              <div className="text-xs text-text-muted mt-1">{latestScore.nextBestActionReason}</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Message Thread */}
          <div className="lg:col-span-2 bg-bg-secondary border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-medium text-text-primary">Message History</h2>
            </div>
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              {lead.messages?.length ? (
                lead.messages.map((msg: any) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg text-sm ${
                      msg.direction === 'outbound'
                        ? 'bg-accent/10 border border-accent/20 ml-8'
                        : 'bg-bg-tertiary border border-border mr-8'
                    }`}
                  >
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-text-muted">
                        {msg.direction === 'outbound' ? 'Sent' : 'Received'}
                        {msg.aiGenerated && ' · AI'}
                      </span>
                      <span className="text-xs text-text-muted">{formatRelativeTime(msg.createdAt)}</span>
                    </div>
                    <div className="text-text-primary">{msg.body}</div>
                  </div>
                ))
              ) : (
                <div className="text-center text-text-muted py-8">No messages yet</div>
              )}
            </div>
            {/* Quick Send */}
            <div className="p-4 border-t border-border">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (smsBody.trim()) sendSmsMutation.mutate(smsBody.trim());
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={smsBody}
                  onChange={(e) => setSmsBody(e.target.value)}
                  className="flex-1 px-3 py-2 bg-bg-tertiary border border-border rounded-md text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
                <Button type="submit" size="sm" disabled={sendSmsMutation.isPending || !smsBody.trim()}>
                  Send
                </Button>
              </form>
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-4">
            {/* Contact Info */}
            <div className="bg-bg-secondary border border-border rounded-lg p-4">
              <h3 className="text-xs text-text-muted uppercase tracking-wider mb-3">Contact</h3>
              <div className="space-y-2 text-sm">
                {lead.email && (
                  <div><span className="text-text-muted">Email:</span> <span className="text-text-primary">{lead.email}</span></div>
                )}
                {lead.phone && (
                  <div><span className="text-text-muted">Phone:</span> <span className="text-text-primary">{lead.phone}</span></div>
                )}
                {lead.zip && (
                  <div><span className="text-text-muted">Zip:</span> <span className="text-text-primary">{lead.zip}</span></div>
                )}
              </div>
            </div>

            {/* Enrichment */}
            <div className="bg-bg-secondary border border-border rounded-lg p-4">
              <h3 className="text-xs text-text-muted uppercase tracking-wider mb-3">Enrichment</h3>
              {lead.enrichments?.length ? (
                <div className="text-xs text-text-secondary">
                  <div>Provider: {lead.enrichments[0].provider}</div>
                  <div>Last enriched: {formatRelativeTime(lead.enrichments[0].lastEnrichedAt)}</div>
                </div>
              ) : (
                <div className="text-xs text-text-muted">Not enriched yet</div>
              )}
            </div>

            {/* Campaigns */}
            <div className="bg-bg-secondary border border-border rounded-lg p-4">
              <h3 className="text-xs text-text-muted uppercase tracking-wider mb-3">Campaigns</h3>
              {lead.campaignLeads?.length ? (
                <div className="space-y-2">
                  {lead.campaignLeads.map((cl: any) => (
                    <div key={cl.id} className="text-sm">
                      <span className="text-text-primary">{cl.campaign.name}</span>
                      <Badge variant="muted" className="ml-2">{cl.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-text-muted">Not enrolled in any campaign</div>
              )}
            </div>

            {/* Persona Memory */}
            <div className="bg-bg-secondary border border-border rounded-lg p-4">
              <h3 className="text-xs text-text-muted uppercase tracking-wider mb-3">Persona Memory</h3>
              {lead.personaMemories?.length ? (
                <div className="space-y-1">
                  {lead.personaMemories.map((pm: any) => (
                    <div key={pm.id} className="flex items-center gap-2 text-xs">
                      <Badge variant={pm.worked ? 'success' : 'muted'}>{pm.personaMode}</Badge>
                      <span className="text-text-secondary">{pm.toneSignal}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-text-muted">No persona memory yet</div>
              )}
            </div>

            {/* Tasks */}
            <div className="bg-bg-secondary border border-border rounded-lg p-4">
              <h3 className="text-xs text-text-muted uppercase tracking-wider mb-3">Tasks</h3>
              {lead.tasks?.length ? (
                <div className="space-y-2">
                  {lead.tasks.map((task: any) => (
                    <div key={task.id} className="text-sm">
                      <div className="text-text-primary">{task.title}</div>
                      <div className="text-xs text-text-muted">{task.status}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-text-muted">No tasks</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
