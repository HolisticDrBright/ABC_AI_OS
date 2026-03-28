'use client';

import { AppShell } from '@/components/layout/app-shell';

export default function ConversationsPage() {
  return (
    <AppShell>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-display font-bold text-text-primary">Inbox</h1>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span><kbd>A</kbd> Approve</span>
            <span><kbd>S</kbd> Skip</span>
            <span><kbd>R</kbd> Reassign</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Threads List */}
          <div className="bg-bg-secondary border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border">
              <input
                type="text"
                placeholder="Search conversations..."
                className="w-full px-3 py-1.5 bg-bg-tertiary border border-border rounded-md text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
            </div>
            <div className="p-4 text-sm text-text-muted text-center py-12">
              Conversations appear here when leads reply to campaigns.
            </div>
          </div>

          {/* Thread Detail + Ghost Mode */}
          <div className="lg:col-span-2 bg-bg-secondary border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-medium text-text-primary">Thread</h2>
              <Badge variant="accent">Ghost Mode</Badge>
            </div>
            <div className="p-6 text-center text-text-muted">
              <div className="text-sm mb-2">Select a conversation to view</div>
              <div className="text-xs">
                Ghost Mode shows the next 3 pre-drafted messages for swipe-approve.
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Badge({ children, variant }: { children: React.ReactNode; variant?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
      variant === 'accent' ? 'bg-accent/10 text-accent border-accent/20' : 'bg-bg-tertiary text-text-secondary border-border'
    }`}>
      {children}
    </span>
  );
}
