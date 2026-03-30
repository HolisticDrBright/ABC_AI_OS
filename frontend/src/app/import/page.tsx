'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

type Tab = 'propstream' | 'apollo' | 'csv' | 'fub';

export default function ImportPage() {
  const [tab, setTab] = useState<Tab>('propstream');
  const [csvText, setCsvText] = useState('');
  const [apolloQuery, setApolloQuery] = useState('');
  const [apolloTitles, setApolloTitles] = useState('');
  const [apolloLocations, setApolloLocations] = useState('');

  const propstreamMutation = useMutation({
    mutationFn: (data: string) => api.importPropStreamCSV(data),
  });

  const apolloMutation = useMutation({
    mutationFn: () => api.apolloImport({
      q_keywords: apolloQuery || undefined,
      person_titles: apolloTitles ? apolloTitles.split(',').map((t) => t.trim()) : undefined,
      person_locations: apolloLocations ? apolloLocations.split(',').map((l) => l.trim()) : undefined,
    }),
  });

  const fubMutation = useMutation({
    mutationFn: () => api.fubImportStale(),
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText(ev.target?.result as string || '');
    };
    reader.readAsText(file);
  };

  return (
    <AppShell>
      <div className="p-6">
        <h1 className="text-xl font-display font-bold text-text-primary mb-4">Import Leads</h1>

        {/* Tabs */}
        <div className="flex gap-1 bg-bg-tertiary rounded-md p-1 mb-6 w-fit">
          {[
            { id: 'propstream', label: 'PropStream CSV' },
            { id: 'apollo', label: 'Apollo Search' },
            { id: 'csv', label: 'Generic CSV' },
            { id: 'fub', label: 'Follow Up Boss' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as Tab)}
              className={`px-4 py-1.5 text-sm rounded font-medium transition-colors ${
                tab === t.id ? 'bg-bg-elevated text-text-primary' : 'text-text-muted'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* PropStream Tab */}
        {tab === 'propstream' && (
          <div className="max-w-2xl">
            <div className="bg-bg-secondary border border-border rounded-lg p-4 mb-4">
              <h2 className="text-sm font-medium text-text-primary mb-2">PropStream CSV Import</h2>
              <p className="text-xs text-text-muted mb-4">
                Export your PropStream list as CSV with standard columns, then upload here.
                Leads will be matched by owner name or created new. Property data attaches to each lead.
              </p>

              <div className="bg-bg-tertiary border border-border rounded-md p-3 mb-4">
                <h3 className="text-xs text-text-muted uppercase tracking-wider mb-2">Required Columns</h3>
                <div className="text-xs text-text-secondary font-mono leading-relaxed">
                  address, city, state, zip, owner_name, mailing_address,
                  equity_estimate, estimated_value, mortgage_balance, years_owned,
                  ownership_type, occupancy_status, lien_count, tax_delinquent,
                  pre_foreclosure, last_sale_date, last_sale_price
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-text-muted block mb-1">Upload CSV File</label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="text-sm text-text-secondary"
                  />
                </div>

                {csvText && (
                  <div className="text-xs text-text-muted">
                    {csvText.split('\n').length - 1} rows detected
                  </div>
                )}

                <div>
                  <label className="text-xs text-text-muted block mb-1">Or paste CSV data</label>
                  <textarea
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    rows={6}
                    placeholder="address,city,state,zip,owner_name,..."
                    className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-md text-xs text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:border-accent"
                  />
                </div>

                <Button
                  onClick={() => propstreamMutation.mutate(csvText)}
                  disabled={!csvText.trim() || propstreamMutation.isPending}
                >
                  {propstreamMutation.isPending ? 'Importing...' : 'Import PropStream Data'}
                </Button>
              </div>

              {propstreamMutation.isSuccess && (
                <div className="mt-3 p-3 bg-success/10 border border-success/20 rounded-md text-xs">
                  Imported {propstreamMutation.data.imported} of {propstreamMutation.data.total} rows.
                  {propstreamMutation.data.errors > 0 && (
                    <span className="text-danger ml-2">{propstreamMutation.data.errors} errors</span>
                  )}
                </div>
              )}

              {propstreamMutation.isError && (
                <div className="mt-3 text-xs text-danger">
                  {(propstreamMutation.error as Error).message}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Apollo Tab */}
        {tab === 'apollo' && (
          <div className="max-w-2xl bg-bg-secondary border border-border rounded-lg p-4">
            <h2 className="text-sm font-medium text-text-primary mb-3">Apollo People Search + Import</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-muted block mb-1">Keywords</label>
                <input
                  type="text"
                  value={apolloQuery}
                  onChange={(e) => setApolloQuery(e.target.value)}
                  placeholder="e.g. real estate investor"
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-md text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Titles (comma-separated)</label>
                <input
                  type="text"
                  value={apolloTitles}
                  onChange={(e) => setApolloTitles(e.target.value)}
                  placeholder="e.g. Owner, CEO, Real Estate Agent"
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-md text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Locations (comma-separated)</label>
                <input
                  type="text"
                  value={apolloLocations}
                  onChange={(e) => setApolloLocations(e.target.value)}
                  placeholder="e.g. Austin TX, Dallas TX"
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-md text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
              </div>
              <Button
                onClick={() => apolloMutation.mutate()}
                disabled={apolloMutation.isPending}
              >
                {apolloMutation.isPending ? 'Searching + Importing...' : 'Search & Import'}
              </Button>
              {apolloMutation.isSuccess && (
                <div className="text-xs text-success">
                  Imported {apolloMutation.data.imported?.filter((i: any) => i.action === 'created').length} leads
                </div>
              )}
            </div>
          </div>
        )}

        {/* Generic CSV Tab */}
        {tab === 'csv' && (
          <div className="max-w-2xl bg-bg-secondary border border-border rounded-lg p-4">
            <h2 className="text-sm font-medium text-text-primary mb-3">Generic CSV Import</h2>
            <p className="text-xs text-text-muted">
              Upload any CSV with columns: first_name, last_name, email, phone, company, city, state, zip.
              Uses the standard bulk lead creation endpoint.
            </p>
            <div className="mt-3">
              <Badge variant="muted">Coming soon</Badge>
            </div>
          </div>
        )}

        {/* FUB Tab */}
        {tab === 'fub' && (
          <div className="max-w-2xl bg-bg-secondary border border-border rounded-lg p-4">
            <h2 className="text-sm font-medium text-text-primary mb-3">Follow Up Boss Import</h2>
            <p className="text-xs text-text-muted mb-3">
              Import stale leads from Follow Up Boss. Pulls the 100 least-recently-active contacts.
            </p>
            <p className="text-xs text-warning mb-3">
              Note: FUB handles email drip sequences via Action Plans. ABC AI OS handles SMS outreach only.
              Do not duplicate email campaigns.
            </p>
            <Button
              onClick={() => fubMutation.mutate()}
              disabled={fubMutation.isPending}
            >
              {fubMutation.isPending ? 'Importing...' : 'Import Stale Leads'}
            </Button>
            {fubMutation.isSuccess && (
              <div className="mt-2 text-xs text-success">
                Imported {fubMutation.data.filter((i: any) => i.action === 'created').length} leads
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
