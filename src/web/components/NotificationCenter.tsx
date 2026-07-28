// File: src/web/components/NotificationCenter.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { NotificationPrefs } from '../notifications.js';

interface NotificationCenterProps {
  attentionCount: number;
  permission: NotificationPermission | 'unsupported';
  prefs: NotificationPrefs;
  onUpdatePrefs: (prefs: NotificationPrefs) => void;
  onRequestPermission: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  attentionCount,
  permission,
  prefs,
  onUpdatePrefs,
  onRequestPermission,
}) => {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const Icon = permission === 'granted' ? BellRing : Bell;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        aria-expanded={open}
        className="muster-btn muster-btn-ghost relative"
      >
        <Icon className="w-3.5 h-3.5" />
        {attentionCount > 0 && (
          <span className="muster-badge muster-badge-warning absolute -top-1.5 -right-1.5 rounded-full min-w-[1.1rem] h-[1.1rem] px-1 justify-center">
            {attentionCount > 99 ? '99+' : attentionCount}
          </span>
        )}
      </button>

      {open && (
        <div className="muster-panel absolute right-0 top-full mt-1.5 z-50 shadow-2xl p-3 w-64 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide muster-text-muted">
              Attention
            </span>
            <span className="muster-badge muster-badge-neutral">{attentionCount} awaiting review</span>
          </div>

          <div className="muster-divider h-px" aria-hidden="true" />

          {permission === 'unsupported' ? (
            <p className="text-xs muster-text-muted">
              Desktop notifications aren't supported in this browser. The badge above still tracks cards awaiting review.
            </p>
          ) : permission === 'denied' ? (
            <p className="text-xs muster-text-muted">
              Desktop notifications are blocked in your browser's site settings. The badge above is the fallback.
            </p>
          ) : permission === 'granted' ? (
            <p className="text-xs muster-text-success">Desktop notifications are on.</p>
          ) : (
            <button onClick={onRequestPermission} className="muster-btn muster-btn-soft font-mono">
              <Bell className="w-3.5 h-3.5" /> Enable Desktop Notifications
            </button>
          )}

          <div className="muster-divider h-px" aria-hidden="true" />

          <div>
            <span className="text-xs font-semibold uppercase tracking-wide block mb-2 muster-text-muted">
              Notify me when a card
            </span>
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center space-x-2 cursor-pointer select-none text-xs muster-text-primary">
                <input
                  type="checkbox"
                  checked={prefs.in_review}
                  onChange={(e) => onUpdatePrefs({ ...prefs, in_review: e.target.checked })}
                  className="rounded border-muster-border bg-muster-base text-brand-600 focus:ring-brand-500 focus:ring-offset-0"
                />
                <span>Moves to Review</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer select-none text-xs muster-text-primary">
                <input
                  type="checkbox"
                  checked={prefs.blocked}
                  onChange={(e) => onUpdatePrefs({ ...prefs, blocked: e.target.checked })}
                  className="rounded border-muster-border bg-muster-base text-brand-600 focus:ring-brand-500 focus:ring-offset-0"
                />
                <span>Becomes Blocked</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
