'use client';

import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const PLAYBOOKS = [
  {
    name: 'Off-Market Seller Acquisition',
    type: 'acquisition',
    description: 'Outreach to homeowners likely to sell off-market. Uses neighborhood intelligence and equity signals.',
    angle: 'Market opportunity + buyer demand',
    persona: 'Trusted local expert',
    steps: 4,
  },
  {
    name: 'Stale Lead Reactivation',
    type: 'reactivation',
    description: 'Re-engage cold leads from CRM with fresh angles and updated market data.',
    angle: 'Market update + value check-in',
    persona: 'Helpful advisor',
    steps: 3,
  },
  {
    name: 'Investor / Deal Flow Outreach',
    type: 'investor',
    description: 'Targeted outreach to active real estate investors with deal-focused messaging.',
    angle: 'Deal opportunity + ROI focus',
    persona: 'Numbers-driven analyst',
    steps: 3,
  },
  {
    name: 'Sphere / Referral Reconnect',
    type: 'sphere',
    description: 'Reconnect with past clients and referral sources. Light, relationship-first messaging.',
    angle: 'Relationship check-in',
    persona: 'Friendly connector',
    steps: 2,
  },
];

export default function PlaybooksPage() {
  return (
    <AppShell>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-display font-bold text-text-primary">Playbooks</h1>
            <p className="text-sm text-text-muted mt-0.5">Reusable outreach sequences with AI-powered personalization</p>
          </div>
          <Button size="sm">+ Create Playbook</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PLAYBOOKS.map((pb) => (
            <div key={pb.type} className="bg-bg-secondary border border-border rounded-lg p-5">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-sm font-medium text-text-primary">{pb.name}</h3>
                <Badge variant="accent">{pb.type}</Badge>
              </div>
              <p className="text-xs text-text-secondary mb-4">{pb.description}</p>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-muted">Angle</span>
                  <span className="text-text-primary">{pb.angle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Persona</span>
                  <span className="text-text-primary">{pb.persona}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Sequence Steps</span>
                  <span className="text-text-primary">{pb.steps}</span>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="secondary" size="sm" className="flex-1">Edit</Button>
                <Button variant="ghost" size="sm" className="flex-1">Use in Campaign</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
