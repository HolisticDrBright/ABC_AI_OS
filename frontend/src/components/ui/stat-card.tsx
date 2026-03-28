import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  accent?: boolean;
  danger?: boolean;
}

export function StatCard({ label, value, change, accent, danger }: StatCardProps) {
  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4">
      <div className="text-xs text-text-muted uppercase tracking-wider mb-2">{label}</div>
      <div
        className={cn(
          'text-2xl font-display font-bold',
          accent && 'text-accent',
          danger && 'text-danger',
          !accent && !danger && 'text-text-primary',
        )}
      >
        {value}
      </div>
      {change && (
        <div className="text-xs text-text-secondary mt-1">{change}</div>
      )}
    </div>
  );
}
