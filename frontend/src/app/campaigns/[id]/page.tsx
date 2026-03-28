'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { api } from '@/lib/api';

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => api.getCampaign(id),
  });

  const { data: analytics } = useQuery({
    queryKey: ['campaign-analytics', id],
    queryFn: () => api.getCampaignAnalytics(id),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.updateCampaignStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaign', id] }),
  });

  if (isLoading) {
    return <AppShell><div className="p-6 text-text-muted">Loading...</div></AppShell>;
  }

  if (!campaign) {
    return <AppShell><div className="p-6 text-text-muted">Campaign not found</div></AppShell>;
  }

  return (
    <AppShell>
      <div className="p-6">
        <button onClick={() => router.back()} className="text-xs text-text-muted hover:text-text-secondary mb-4">
          &larr; Back to Campaigns
        </button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-display font-bold text-text-primary">{campaign.name}</h1>
            {campaign.description && <p className="text-sm text-text-secondary mt-1">{campaign.description}</p>}
            <div className="flex gap-2 mt-2">
              <Badge variant={campaign.status === 'active' ? 'success' : 'muted'}>{campaign.status}</Badge>
              {campaign.personaMode && <Badge>{campaign.personaMode}</Badge>}
              {campaign.splitTestEnabled && <Badge variant="accent">A/B Split</Badge>}
            </div>
          </div>
          <div className="flex gap-2">
            {campaign.status === 'draft' && (
              <Button size="sm" onClick={() => statusMutation.mutate('active')}>Launch</Button>
            )}
            {campaign.status === 'active' && (
              <Button variant="secondary" size="sm" onClick={() => statusMutation.mutate('paused')}>Pause</Button>
            )}
            {campaign.status === 'paused' && (
              <Button size="sm" onClick={() => statusMutation.mutate('active')}>Resume</Button>
            )}
          </div>
        </div>

        {/* Analytics */}
        {analytics && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <StatCard label="Enrolled" value={analytics.totalEnrolled} />
            <StatCard label="Sent" value={analytics.sent} />
            <StatCard label="Delivered" value={analytics.delivered} />
            <StatCard label="Replies" value={analytics.replies} accent />
            <StatCard label="Reply Rate" value={`${analytics.replyRate}%`} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Enrolled Leads */}
          <div className="bg-bg-secondary border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-medium text-text-primary">
                Enrolled Leads ({campaign.campaignLeads?.length || 0})
              </h2>
            </div>
            <div className="divide-y divide-border/50 max-h-80 overflow-y-auto">
              {campaign.campaignLeads?.map((cl: any) => (
                <div key={cl.id} className="px-4 py-2 flex items-center justify-between">
                  <div>
                    <span className="text-sm text-text-primary">{cl.lead?.fullName || 'Unknown'}</span>
                    <span className="text-xs text-text-muted ml-2">{cl.lead?.email}</span>
                  </div>
                  <div className="flex gap-2">
                    {cl.variant && <Badge variant="accent">{cl.variant}</Badge>}
                    <Badge>{cl.status}</Badge>
                  </div>
                </div>
              ))}
              {!campaign.campaignLeads?.length && (
                <div className="p-4 text-sm text-text-muted text-center">No leads enrolled</div>
              )}
            </div>
          </div>

          {/* Variants */}
          <div className="bg-bg-secondary border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-medium text-text-primary">Variants</h2>
            </div>
            <div className="p-4 space-y-3">
              {campaign.variants?.length ? (
                campaign.variants.map((v: any) => (
                  <div key={v.id} className="bg-bg-tertiary border border-border rounded-md p-3">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="accent">{v.variantLabel}</Badge>
                      <span className="text-xs text-text-muted">{v.messageCount} sent</span>
                    </div>
                    {v.angle && <div className="text-xs text-text-secondary">Angle: {v.angle}</div>}
                    {v.replyRate != null && <div className="text-xs text-text-secondary">Reply rate: {v.replyRate}%</div>}
                  </div>
                ))
              ) : (
                <div className="text-sm text-text-muted text-center">No variants configured</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
