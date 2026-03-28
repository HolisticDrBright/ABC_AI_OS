'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '◆', shortcut: 'D' },
  { href: '/leads', label: 'Leads', icon: '◉', shortcut: 'L' },
  { href: '/campaigns', label: 'Campaigns', icon: '▶', shortcut: 'C' },
  { href: '/conversations', label: 'Inbox', icon: '◫', shortcut: 'I' },
  { href: '/escalation', label: 'Escalations', icon: '⚡', shortcut: 'E' },
  { href: '/openclaw', label: 'Research', icon: '⊛', shortcut: 'R' },
  { href: '/playbooks', label: 'Playbooks', icon: '☰', shortcut: 'P' },
  { href: '/analytics', label: 'Analytics', icon: '◧', shortcut: 'A' },
  { href: '/settings', label: 'Settings', icon: '⚙', shortcut: 'S' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { organization, user, logout } = useAuthStore();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-56 bg-bg-secondary border-r border-border flex flex-col z-50">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-border">
        <span className="font-display text-lg font-bold tracking-tight text-accent">
          ABC
        </span>
        <span className="font-display text-lg font-bold tracking-tight text-text-primary ml-1">
          AI OS
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary',
              )}
            >
              <span className="text-xs w-4 text-center">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              <kbd>{item.shortcut}</kbd>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-border">
        <div className="text-xs text-text-muted mb-1">{organization?.name}</div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary truncate">{user?.name}</span>
          <button
            onClick={logout}
            className="text-xs text-text-muted hover:text-danger transition-colors"
          >
            Exit
          </button>
        </div>
      </div>
    </aside>
  );
}
