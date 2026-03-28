'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/app-shell';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatRelativeTime, getNbaLabel, getNbaColor } from '@/lib/utils';

function WarRoom() {
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.getDashboardStats(),
    refetchInterval: 3000,
  });

  const { data: compliance } = useQuery({
    queryKey: ['compliance-status'],
    queryFn: () => api.getComplianceStatus(),
    refetchInterval: 10000,
  });

  const { data: messaging } = useQuery({
    queryKey: ['analytics-messaging'],
    queryFn: () => api.getMessagingAnalytics(),
    refetchInterval: 5000,
  });

  const { data: scores } = useQuery({
    queryKey: ['analytics-scores'],
    queryFn: () => api.getScoreAnalytics(),
    refetchInterval: 10000,
  });

  return (
    <div className="fixed inset-0 z-[100] bg-bg-primary overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-bg-secondary">
        <div className="flex items-center gap-3">
          <span className="font-display text-lg font-bold text-accent">ABC</span>
          <span className="font-display text-lg font-bold text-text-primary">WAR ROOM</span>
          <div className="flex items-center gap-2 ml-4">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs text-success font-mono">LIVE</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-text-muted">
          <span>Press <kbd>W</kbd> to exit</span>
          {compliance?.currentlyQuietHours && (
            <Badge variant="warning">QUIET HOURS ACTIVE</Badge>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="p-4 grid grid-cols-4 lg:grid-cols-6 gap-3">
        {/* Core Stats */}
        <StatCard label="Active Leads" value={stats?.totalLeads ?? 0} />
        <StatCard label="Hot Leads" value={stats?.hotLeads ?? 0} accent />
        <StatCard label="Open Threads" value={stats?.activeConversations ?? 0} />
        <StatCard label="Campaigns Live" value={stats?.activeCampaigns ?? 0} />
        <StatCard label="Pending Tasks" value={stats?.pendingTasks ?? 0} danger={stats?.pendingTasks > 5} />
        <StatCard label="Messages (24h)" value={stats?.recentMessages ?? 0} />
      </div>

      <div className="px-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Message Flow */}
        <div className="bg-bg-secondary border border-border rounded-lg p-4">
          <h3 className="text-xs text-text-muted uppercase tracking-wider mb-3">Message Pipeline</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Sent</span>
              <span className="text-text-primary font-mono font-bold">{messaging?.sent ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Delivered</span>
              <span className="text-success font-mono font-bold">{messaging?.delivered ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Failed</span>
              <span className="text-danger font-mono font-bold">{messaging?.failed ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Replies</span>
              <span className="text-accent font-mono font-bold">{messaging?.inbound ?? 0}</span>
            </div>
            <div className="h-px bg-border my-2" />
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Reply Rate</span>
              <span className="text-accent-bright font-mono font-bold text-lg">{messaging?.replyRate ?? 0}%</span>
            </div>
          </div>
        </div>

        {/* Score Overview */}
        <div className="bg-bg-secondary border border-border rounded-lg p-4">
          <h3 className="text-xs text-text-muted uppercase tracking-wider mb-3">Score Engine</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Total Scored</span>
              <span className="text-text-primary font-mono">{scores?.total ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Avg Score</span>
              <span className="text-accent font-mono font-bold text-lg">{scores?.avgScore ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Avg Close Prob</span>
              <span className="text-text-primary font-mono">{scores?.avgCloseProbability ?? 0}%</span>
            </div>
            <div className="h-px bg-border my-2" />
            <h4 className="text-xs text-text-muted">Distribution</h4>
            {scores?.distribution && Object.entries(scores.distribution).map(([range, count]) => (
              <div key={range} className="flex items-center gap-2">
                <span className="text-xs text-text-muted w-12">{range}</span>
                <div className="flex-1 h-3 bg-bg-tertiary rounded overflow-hidden">
                  <div
                    className="h-full bg-accent rounded"
                    style={{ width: `${scores.total > 0 ? ((count as number) / scores.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-text-secondary w-6 text-right">{count as number}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Compliance Panel */}
        <div className="bg-bg-secondary border border-border rounded-lg p-4">
          <h3 className="text-xs text-text-muted uppercase tracking-wider mb-3">Compliance Status</h3>
          {compliance?.checks ? (
            <div className="space-y-2">
              {Object.entries(compliance.checks).map(([check, passed]) => (
                <div key={check} className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">
                    {check.replace(/([A-Z])/g, ' $1').replace(/^./, (s: string) => s.toUpperCase())}
                  </span>
                  <span className={passed ? 'text-success' : 'text-danger'}>
                    {passed ? 'PASS' : 'FAIL'}
                  </span>
                </div>
              ))}
              <div className="h-px bg-border my-2" />
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">DNC Leads</span>
                <span className="text-danger font-mono">{compliance.dncLeads}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">AI Decisions Logged</span>
                <span className="text-success font-mono">{compliance.totalAiDecisions}</span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-text-muted">Loading...</div>
          )}
        </div>
      </div>

      {/* Live Feed */}
      <div className="px-4 mt-3 pb-4">
        <div className="bg-bg-secondary border border-border rounded-lg p-4">
          <h3 className="text-xs text-text-muted uppercase tracking-wider mb-3">Live Message Feed (14d)</h3>
          {messaging?.daily ? (
            <div className="flex items-end gap-1 h-20">
              {messaging.daily.map((d: any) => {
                const total = d.sent + d.received;
                const maxDay = Math.max(...messaging.daily.map((dd: any) => dd.sent + dd.received), 1);
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-px justify-end h-full">
                    <div
                      className="w-full bg-accent/50 rounded-t-sm"
                      style={{ height: `${(d.sent / maxDay) * 100}%`, minHeight: total > 0 ? '2px' : '0' }}
                    />
                    <div
                      className="w-full bg-success/50 rounded-t-sm"
                      style={{ height: `${(d.received / maxDay) * 100}%`, minHeight: d.received > 0 ? '2px' : '0' }}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-20 flex items-center justify-center text-text-muted text-xs">Loading...</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [warRoomActive, setWarRoomActive] = useState(false);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.getDashboardStats(),
    refetchInterval: 15000,
  });

  useEffect(() => {
    function handleToggle() {
      setWarRoomActive((prev) => !prev);
    }
    window.addEventListener('toggle-warroom', handleToggle);
    return () => window.removeEventListener('toggle-warroom', handleToggle);
  }, []);

  if (warRoomActive) {
    return <WarRoom />;
  }

  return (
    <AppShell>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-display font-bold text-text-primary">Command Center</h1>
            <p className="text-sm text-text-muted mt-0.5">Real-time sales execution overview</p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="secondary" size="sm" onClick={() => setWarRoomActive(true)}>
              War Room <kbd className="ml-2">W</kbd>
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs text-text-secondary">Live</span>
            </div>
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
      </div>
    </AppShell>
  );
}
