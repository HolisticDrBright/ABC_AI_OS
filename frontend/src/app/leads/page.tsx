'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatRelativeTime, getNbaLabel, getNbaColor } from '@/lib/utils';

export default function LeadsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['leads', search, statusFilter, page],
    queryFn: () => {
      const params: Record<string, string> = { page: String(page), limit: '50' };
      if (search) params.search = search;
      if (statusFilter) params.leadStatus = statusFilter;
      return api.getLeads(params);
    },
  });

  const columns = [
    {
      key: 'fullName',
      header: 'Name',
      render: (row: any) => (
        <div>
          <div className="font-medium text-text-primary">{row.fullName || 'Unknown'}</div>
          <div className="text-xs text-text-muted">{row.company || ''}</div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone' },
    { key: 'email', header: 'Email', className: 'max-w-48 truncate' },
    { key: 'sourceLabel', header: 'Source' },
    {
      key: 'score',
      header: 'Score',
      render: (row: any) => {
        const score = row.scores?.[0];
        if (!score) return <span className="text-text-muted">—</span>;
        const color = score.totalScore >= 80 ? 'text-hot' : score.totalScore >= 50 ? 'text-accent' : 'text-text-secondary';
        return <span className={`font-display font-bold ${color}`}>{Math.round(score.totalScore)}</span>;
      },
    },
    {
      key: 'closeProbability',
      header: 'Close %',
      render: (row: any) => {
        const score = row.scores?.[0];
        if (!score) return <span className="text-text-muted">—</span>;
        return <span className="font-mono text-xs">{(score.closeProbability * 100).toFixed(0)}%</span>;
      },
    },
    {
      key: 'nba',
      header: 'NBA',
      render: (row: any) => {
        const score = row.scores?.[0];
        if (!score) return <span className="text-text-muted">—</span>;
        return (
          <Badge variant={score.nextBestAction === 'call_now' ? 'warning' : 'default'}>
            <span className={getNbaColor(score.nextBestAction)}>
              {getNbaLabel(score.nextBestAction)}
            </span>
          </Badge>
        );
      },
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (row: any) => (
        <span className="text-text-secondary text-xs">{row.owner?.name || 'Unassigned'}</span>
      ),
    },
    {
      key: 'leadStatus',
      header: 'Status',
      render: (row: any) => (
        <Badge variant={row.leadStatus === 'new' ? 'accent' : 'default'}>
          {row.leadStatus}
        </Badge>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Last Updated',
      render: (row: any) => (
        <span className="text-xs text-text-muted">{formatRelativeTime(row.updatedAt)}</span>
      ),
    },
  ];

  return (
    <AppShell>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-display font-bold text-text-primary">Leads</h1>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm">Import CSV</Button>
            <Button variant="secondary" size="sm">Apollo Import</Button>
            <Button size="sm">+ Add Lead</Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 max-w-sm px-3 py-1.5 bg-bg-tertiary border border-border rounded-md text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 bg-bg-tertiary border border-border rounded-md text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="nurture">Nurture</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-bg-secondary border border-border rounded-lg">
          {isLoading ? (
            <div className="p-8 text-center text-text-muted">Loading leads...</div>
          ) : (
            <>
              <DataTable
                columns={columns}
                data={data?.leads || []}
                onRowClick={(row: any) => router.push(`/leads/${row.id}`)}
                emptyMessage="No leads yet. Import from Apollo or add manually."
              />
              {/* Pagination */}
              {data && data.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <span className="text-xs text-text-muted">
                    {data.total} leads — Page {data.page} of {data.totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      Prev
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={page >= data.totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
