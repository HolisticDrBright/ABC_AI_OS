'use client';

import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/app-shell';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { getNbaLabel } from '@/lib/utils';

function BarChart({ data, maxVal }: { data: { label: string; value: number; color?: string }[]; maxVal?: number }) {
  const max = maxVal || Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-1.5">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2">
          <span className="text-xs text-text-muted w-20 text-right truncate">{d.label}</span>
          <div className="flex-1 h-5 bg-bg-tertiary rounded overflow-hidden">
            <div
              className="h-full rounded transition-all duration-500"
              style={{
                width: `${Math.max((d.value / max) * 100, 1)}%`,
                backgroundColor: d.color || 'var(--color-accent)',
              }}
            />
          </div>
          <span className="text-xs text-text-secondary w-10 font-mono">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

function MiniLineChart({ data }: { data: { date: string; sent: number; received: number }[] }) {
  const maxVal = Math.max(...data.flatMap((d) => [d.sent, d.received]), 1);
  const h = 120;
  const w = data.length > 0 ? 100 / data.length : 10;

  return (
    <div className="flex items-end gap-px h-32">
      {data.map((d) => (
        <div key={d.date} className="flex-1 flex flex-col items-center gap-px justify-end h-full">
          <div
            className="w-full bg-accent/60 rounded-t-sm transition-all min-h-[1px]"
            style={{ height: `${(d.sent / maxVal) * 100}%` }}
            title={`Sent: ${d.sent}`}
          />
          <div
            className="w-full bg-success/60 rounded-t-sm transition-all min-h-[1px]"
            style={{ height: `${(d.received / maxVal) * 100}%` }}
            title={`Received: ${d.received}`}
          />
          <span className="text-[8px] text-text-muted mt-1">{d.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const { data: messaging } = useQuery({
    queryKey: ['analytics-messaging'],
    queryFn: () => api.getMessagingAnalytics(),
  });

  const { data: scores } = useQuery({
    queryKey: ['analytics-scores'],
    queryFn: () => api.getScoreAnalytics(),
  });

  const { data: campaigns } = useQuery({
    queryKey: ['analytics-campaigns'],
    queryFn: () => api.getCampaignAnalyticsOverview(),
  });

  const { data: handoffs } = useQuery({
    queryKey: ['analytics-handoffs'],
    queryFn: () => api.getHandoffAnalytics(),
  });

  const { data: classifications } = useQuery({
    queryKey: ['analytics-classifications'],
    queryFn: () => api.getClassificationAnalytics(),
  });

  return (
    <AppShell>
      <div className="p-6">
        <h1 className="text-xl font-display font-bold text-text-primary mb-6">Analytics</h1>

        {/* Top Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          <StatCard label="Total Sent" value={messaging?.sent ?? '—'} />
          <StatCard label="Delivered" value={messaging?.delivered ?? '—'} />
          <StatCard label="Replies" value={messaging?.inbound ?? '—'} accent />
          <StatCard label="Reply Rate" value={messaging?.replyRate ? `${messaging.replyRate}%` : '—'} />
          <StatCard label="Avg Score" value={scores?.avgScore ?? '—'} />
          <StatCard label="Handoff Rate" value={handoffs?.handoffRate ? `${handoffs.handoffRate}%` : '—'} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Message Volume */}
          <div className="bg-bg-secondary border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-medium text-text-primary">Message Volume (14d)</h2>
              <div className="flex gap-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent/60" /> Sent</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success/60" /> Received</span>
              </div>
            </div>
            <div className="p-4">
              {messaging?.daily ? (
                <MiniLineChart data={messaging.daily} />
              ) : (
                <div className="h-32 flex items-center justify-center text-text-muted text-sm">Loading...</div>
              )}
            </div>
          </div>

          {/* Score Distribution */}
          <div className="bg-bg-secondary border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-medium text-text-primary">Score Distribution</h2>
            </div>
            <div className="p-4">
              {scores?.distribution ? (
                <BarChart
                  data={Object.entries(scores.distribution).map(([label, value]) => ({
                    label,
                    value: value as number,
                    color: label === '81-100' ? 'var(--color-hot)' : label === '61-80' ? 'var(--color-accent-bright)' : undefined,
                  }))}
                />
              ) : (
                <div className="h-32 flex items-center justify-center text-text-muted text-sm">Loading...</div>
              )}
              {scores && (
                <div className="flex gap-4 mt-3 text-xs text-text-muted">
                  <span>Total scored: {scores.total}</span>
                  <span>Avg close prob: {scores.avgCloseProbability}%</span>
                </div>
              )}
            </div>
          </div>

          {/* NBA Distribution */}
          <div className="bg-bg-secondary border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-medium text-text-primary">NBA Distribution</h2>
            </div>
            <div className="p-4">
              {scores?.nbaDistribution ? (
                <BarChart
                  data={Object.entries(scores.nbaDistribution)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([label, value]) => ({
                      label: getNbaLabel(label),
                      value: value as number,
                    }))}
                />
              ) : (
                <div className="h-32 flex items-center justify-center text-text-muted text-sm">Loading...</div>
              )}
            </div>
          </div>

          {/* Classification Breakdown */}
          <div className="bg-bg-secondary border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-medium text-text-primary">Reply Classifications</h2>
            </div>
            <div className="p-4">
              {classifications?.breakdown ? (
                <BarChart
                  data={Object.entries(classifications.breakdown)
                    .sort(([, a], [, b]) => (b as any).count - (a as any).count)
                    .map(([label, data]: [string, any]) => ({
                      label,
                      value: data.count,
                      color: ['interested', 'curious', 'vague_positive'].includes(label)
                        ? 'var(--color-success)'
                        : ['stop', 'not_interested'].includes(label)
                        ? 'var(--color-danger)'
                        : undefined,
                    }))}
                />
              ) : (
                <div className="h-24 flex items-center justify-center text-text-muted text-sm">
                  No classifications yet
                </div>
              )}
            </div>
          </div>

          {/* Campaign Comparison */}
          <div className="bg-bg-secondary border border-border rounded-lg lg:col-span-2">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-medium text-text-primary">Campaign Performance</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2 text-xs text-text-muted uppercase">Campaign</th>
                    <th className="text-left px-4 py-2 text-xs text-text-muted uppercase">Status</th>
                    <th className="text-right px-4 py-2 text-xs text-text-muted uppercase">Leads</th>
                    <th className="text-right px-4 py-2 text-xs text-text-muted uppercase">Sent</th>
                    <th className="text-right px-4 py-2 text-xs text-text-muted uppercase">Replies</th>
                    <th className="text-right px-4 py-2 text-xs text-text-muted uppercase">Reply Rate</th>
                    <th className="text-left px-4 py-2 text-xs text-text-muted uppercase">Variants</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns?.length ? (
                    campaigns.map((c: any) => (
                      <tr key={c.id} className="border-b border-border/50">
                        <td className="px-4 py-2 font-medium text-text-primary">{c.name}</td>
                        <td className="px-4 py-2">
                          <Badge variant={c.status === 'active' ? 'success' : 'muted'}>{c.status}</Badge>
                        </td>
                        <td className="px-4 py-2 text-right font-mono">{c.leads}</td>
                        <td className="px-4 py-2 text-right font-mono">{c.sent}</td>
                        <td className="px-4 py-2 text-right font-mono text-accent">{c.replies}</td>
                        <td className="px-4 py-2 text-right font-mono font-bold">{c.replyRate}%</td>
                        <td className="px-4 py-2">
                          <div className="flex gap-1">
                            {c.variants.map((v: any) => (
                              <Badge key={v.label} variant="accent">{v.label}: {v.messageCount}</Badge>
                            ))}
                            {!c.variants.length && <span className="text-text-muted">—</span>}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-text-muted">No campaigns yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Human Handoff */}
          <div className="bg-bg-secondary border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-medium text-text-primary">Human Handoff</h2>
            </div>
            <div className="p-4">
              {handoffs ? (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Total Tasks</span>
                    <span className="text-text-primary font-mono">{handoffs.totalTasks}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Escalations</span>
                    <span className="text-warning font-mono">{handoffs.escalations}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Handoff Rate</span>
                    <span className="text-text-primary font-bold font-mono">{handoffs.handoffRate}%</span>
                  </div>
                  <div className="h-4 bg-bg-tertiary rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-warning rounded-full transition-all"
                      style={{ width: `${Math.min(handoffs.handoffRate, 100)}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="h-24 flex items-center justify-center text-text-muted text-sm">Loading...</div>
              )}
            </div>
          </div>

          {/* Urgency Breakdown */}
          <div className="bg-bg-secondary border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-medium text-text-primary">Urgency Breakdown</h2>
            </div>
            <div className="p-4">
              {scores?.urgencyDistribution ? (
                <BarChart
                  data={Object.entries(scores.urgencyDistribution).map(([label, value]) => ({
                    label,
                    value: value as number,
                    color: label === 'high' ? 'var(--color-danger)' : label === 'medium' ? 'var(--color-warning)' : 'var(--color-text-muted)',
                  }))}
                />
              ) : (
                <div className="h-24 flex items-center justify-center text-text-muted text-sm">Loading...</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
