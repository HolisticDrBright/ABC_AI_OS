'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

export default function CampaignsPage() {
  const router = useRouter();

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.getCampaigns(),
  });

  const statusVariant = (s: string) => {
    const map: Record<string, 'success' | 'warning' | 'default' | 'muted'> = {
      active: 'success', paused: 'warning', draft: 'muted', completed: 'default',
    };
    return map[s] || 'default';
  };

  const columns = [
    { key: 'name', header: 'Campaign', render: (r: any) => <span className="font-medium text-text-primary">{r.name}</span> },
    { key: 'status', header: 'Status', render: (r: any) => <Badge variant={statusVariant(r.status)}>{r.status}</Badge> },
    { key: 'leads', header: 'Leads', render: (r: any) => r._count?.campaignLeads ?? 0 },
    { key: 'personaMode', header: 'Persona', render: (r: any) => r.personaMode || '—' },
    { key: 'approvalMode', header: 'Mode', render: (r: any) => <Badge variant={r.approvalMode === 'auto' ? 'warning' : 'default'}>{r.approvalMode}</Badge> },
    { key: 'splitTest', header: 'A/B', render: (r: any) => r.splitTestEnabled ? <Badge variant="accent">Split</Badge> : '—' },
    { key: 'variants', header: 'Variants', render: (r: any) => r.variants?.length ?? 0 },
    { key: 'segment', header: 'Segment', render: (r: any) => r.targetSegment?.name || '—' },
  ];

  return (
    <AppShell>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-display font-bold text-text-primary">Campaigns</h1>
          <Button size="sm">+ New Campaign</Button>
        </div>

        <div className="bg-bg-secondary border border-border rounded-lg">
          {isLoading ? (
            <div className="p-8 text-center text-text-muted">Loading campaigns...</div>
          ) : (
            <DataTable
              columns={columns}
              data={campaigns || []}
              onRowClick={(r: any) => router.push(`/campaigns/${r.id}`)}
              emptyMessage="No campaigns yet. Create one to start outreach."
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
