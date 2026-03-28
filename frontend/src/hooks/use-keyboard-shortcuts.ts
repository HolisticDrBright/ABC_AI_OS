'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const SHORTCUTS: Record<string, string> = {
  d: '/dashboard',
  l: '/leads',
  c: '/campaigns',
  i: '/conversations',
  e: '/escalation',
  r: '/openclaw',
  p: '/playbooks',
  a: '/analytics',
  s: '/settings',
  t: '/audit',
};

export function useKeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger if typing in an input, textarea, or select
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      // Don't trigger with modifier keys (allow Ctrl/Cmd shortcuts to work normally)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toLowerCase();
      const path = SHORTCUTS[key];

      if (path) {
        e.preventDefault();
        router.push(path);
      }

      // War Room toggle with 'w'
      if (key === 'w') {
        e.preventDefault();
        const event = new CustomEvent('toggle-warroom');
        window.dispatchEvent(event);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);
}
