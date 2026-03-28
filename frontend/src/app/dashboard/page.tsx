'use client';

import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/app-shell';
import { StatCard } from '@/components/ui/stat-card';
import { api } from '@/lib/api';

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.getDashboardStats(),
    refetchInterval: 15000,
  });

  return (
    <AppShell>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-display font-bold text-text-primary">Command Center</h1>
            <p className="text-sm text-text-muted mt-0.5">Real-time sales execution overview</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs text-text-secondary">Live</span>
          </div>
        </div>

        {/* Stats Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-bg-secondary border border-border rounded-lg p-4 h-24 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard label="Total Leads" value={stats?.totalLeads ?? 0} />
            <StatCard label="Hot Leads" value={stats?.hotLeads ?? 0} accent />
            <StatCard label="Open Conversations" value={stats?.activeConversations ?? 0} />
            <StatCard label="Active Campaigns" value={stats?.activeCampaigns ?? 0} />
            <StatCard label="Pending Tasks" value={stats?.pendingTasks ?? 0} danger={stats?.pendingTasks > 5} />
            <StatCard label="Messages (24h)" value={stats?.recentMessages ?? 0} />
          </div>
        )}

        {/* Activity Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Recent Activity */}
          <div className="bg-bg-secondary border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-medium text-text-primary">Recent Activity</h2>
            </div>
            <div className="p-4">
              <div className="text-sm text-text-muted text-center py-8">
                Activity feed will populate as leads are imported and campaigns run.
              </div>
            </div>
          </div>

          {/* Hot Leads */}
          <div className="bg-bg-secondary border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-medium text-text-primary">Hot Leads</h2>
            </div>
            <div className="p-4">
              <div className="text-sm text-text-muted text-center py-8">
                Leads scoring above 80 will appear here.
              </div>
            </div>
          </div>
        </div>

        {/* War Room Placeholder */}
        <div className="mt-6 bg-bg-secondary border border-border-bright rounded-lg">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-medium text-text-primary">War Room</h2>
            <span className="text-xs text-text-muted">Press <kbd>W</kbd> for fullscreen</span>
          </div>
          <div className="p-6 text-center">
            <div className="text-text-muted text-sm">
              Live campaign execution view — leads scoring, messages queuing, replies arriving, NBA updating.
            </div>
            <div className="mt-2 text-xs text-text-muted">
              Activates when campaigns are running.
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
