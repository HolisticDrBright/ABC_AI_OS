'use client';

import { AppShell } from '@/components/layout/app-shell';

export default function AnalyticsPage() {
  return (
    <AppShell>
      <div className="p-6">
        <h1 className="text-xl font-display font-bold text-text-primary mb-6">Analytics</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Message Performance */}
          <div className="bg-bg-secondary border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-medium text-text-primary">Message Performance</h2>
            </div>
            <div className="p-6 text-center text-text-muted text-sm py-16">
              Charts populate as campaigns run and messages are sent.
              <div className="mt-2 text-xs">Sends · Deliveries · Replies · Positive Replies · Handoffs</div>
            </div>
          </div>

          {/* Segment Performance */}
          <div className="bg-bg-secondary border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-medium text-text-primary">Segment Performance</h2>
            </div>
            <div className="p-6 text-center text-text-muted text-sm py-16">
              Breakdown by segment, persona, angle, and variant.
            </div>
          </div>

          {/* A/B Variant Comparison */}
          <div className="bg-bg-secondary border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-medium text-text-primary">A/B Variant Comparison</h2>
            </div>
            <div className="p-6 text-center text-text-muted text-sm py-16">
              Head-to-head variant performance when split tests are running.
            </div>
          </div>

          {/* Score Distribution */}
          <div className="bg-bg-secondary border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-medium text-text-primary">Score Distribution</h2>
            </div>
            <div className="p-6 text-center text-text-muted text-sm py-16">
              Lead score distribution over time with decay visualization.
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
