'use client';

import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  const integrations = [
    { name: 'Apollo', description: 'Prospect sourcing and enrichment', status: 'Not connected', key: 'APOLLO_API_KEY' },
    { name: 'Follow Up Boss', description: 'CRM sync and pipeline', status: 'Not connected', key: 'FUB_API_KEY' },
    { name: 'Twilio', description: 'SMS transport', status: 'Not connected', key: 'TWILIO_ACCOUNT_SID' },
    { name: 'OpenClaw', description: 'Autonomous research workflows', status: 'Not connected', key: 'OPENCLAW_API_KEY' },
    { name: 'Claude API', description: 'AI scoring, classification, generation', status: 'Not connected', key: 'ANTHROPIC_API_KEY' },
  ];

  return (
    <AppShell>
      <div className="p-6">
        <h1 className="text-xl font-display font-bold text-text-primary mb-6">Settings</h1>

        <div className="space-y-6 max-w-3xl">
          {/* Integrations */}
          <div className="bg-bg-secondary border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-medium text-text-primary">Integrations</h2>
            </div>
            <div className="divide-y divide-border/50">
              {integrations.map((int) => (
                <div key={int.name} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-text-primary">{int.name}</div>
                    <div className="text-xs text-text-muted">{int.description}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-text-muted">{int.status}</span>
                    <Button variant="secondary" size="sm">Configure</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Compliance */}
          <div className="bg-bg-secondary border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-medium text-text-primary">Compliance</h2>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-text-muted block mb-1">Quiet Hours Start</label>
                  <input
                    type="time"
                    defaultValue="21:00"
                    className="w-full px-3 py-1.5 bg-bg-tertiary border border-border rounded-md text-sm text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted block mb-1">Quiet Hours End</label>
                  <input
                    type="time"
                    defaultValue="08:00"
                    className="w-full px-3 py-1.5 bg-bg-tertiary border border-border rounded-md text-sm text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Timezone</label>
                <select className="w-full px-3 py-1.5 bg-bg-tertiary border border-border rounded-md text-sm text-text-primary focus:outline-none focus:border-accent">
                  <option>America/New_York</option>
                  <option>America/Chicago</option>
                  <option>America/Denver</option>
                  <option>America/Los_Angeles</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Score Decay Threshold (hours)</label>
                <input
                  type="number"
                  defaultValue={72}
                  className="w-full px-3 py-1.5 bg-bg-tertiary border border-border rounded-md text-sm text-text-primary focus:outline-none focus:border-accent"
                />
              </div>
              <Button size="sm">Save Compliance Settings</Button>
            </div>
          </div>

          {/* Team */}
          <div className="bg-bg-secondary border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-medium text-text-primary">Team</h2>
            </div>
            <div className="p-4">
              <div className="text-sm text-text-muted">Team management coming soon. Invite agents and set roles.</div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
