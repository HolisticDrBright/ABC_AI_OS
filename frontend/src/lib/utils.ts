import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatScore(score: number): string {
  return Math.round(score).toString();
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

export function getNbaColor(nba: string): string {
  const colors: Record<string, string> = {
    send_intro_sms: 'text-accent',
    send_followup_sms: 'text-accent-bright',
    call_now: 'text-hot',
    escalate_to_human: 'text-warning',
    run_openclaw_research: 'text-purple-400',
    wait: 'text-text-secondary',
    move_to_nurture: 'text-text-muted',
    stop_outreach: 'text-danger',
  };
  return colors[nba] || 'text-text-secondary';
}

export function getNbaLabel(nba: string): string {
  const labels: Record<string, string> = {
    send_intro_sms: 'Send Intro',
    send_followup_sms: 'Follow Up',
    call_now: 'Call Now',
    escalate_to_human: 'Escalate',
    run_openclaw_research: 'Research',
    wait: 'Wait',
    move_to_nurture: 'Nurture',
    stop_outreach: 'Stop',
  };
  return labels[nba] || nba;
}
