// File: src/web/components/ThemePicker.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Moon, Sun, Palette } from 'lucide-react';
import { useTheme } from '../ThemeContext.js';
import { COLOR_PROFILES } from '../theme.js';

export const ThemePicker: React.FC = () => {
  const { theme, setProfile, toggleMode } = useTheme();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
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

  const activeProfile = COLOR_PROFILES.find(p => p.id === theme.profile) ?? COLOR_PROFILES[0];

  return (
    <div className="relative" ref={panelRef}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        title="Theme & Appearance"
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono border transition-all cursor-pointer"
        style={{
          backgroundColor: 'var(--color-accent-subtle)',
          borderColor: 'var(--color-accent-border)',
          color: 'var(--color-accent)',
        }}
      >
        <Palette className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{activeProfile.name}</span>
        {theme.mode === 'dark' ? (
          <Moon className="w-3 h-3 opacity-70" />
        ) : (
          <Sun className="w-3 h-3 opacity-70" />
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-50 rounded-lg shadow-2xl border p-3 w-56 flex flex-col gap-3 animate-in"
          style={{
            backgroundColor: 'var(--color-surface-elevated)',
            borderColor: 'var(--color-border-subtle)',
          }}
        >
          {/* Mode toggle */}
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Appearance
            </span>
            <button
              onClick={toggleMode}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono border transition-all cursor-pointer"
              style={{
                backgroundColor: 'var(--color-surface-hover)',
                borderColor: 'var(--color-border-hover)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {theme.mode === 'dark' ? (
                <>
                  <Moon className="w-3.5 h-3.5" />
                  Dark
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5" />
                  Light
                </>
              )}
            </button>
          </div>

          {/* Divider */}
          <div style={{ height: '1px', backgroundColor: 'var(--color-border-subtle)' }} />

          {/* Profile selection */}
          <div>
            <span
              className="text-xs font-semibold uppercase tracking-wide block mb-2"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Color Profile
            </span>
            <div className="flex flex-col gap-1.5">
              {COLOR_PROFILES.map(profile => {
                const isActive = theme.profile === profile.id;
                return (
                  <button
                    key={profile.id}
                    onClick={() => { setProfile(profile.id); setOpen(false); }}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs text-left transition-all cursor-pointer"
                    style={isActive ? {
                      backgroundColor: 'var(--color-accent-subtle)',
                      border: '1px solid var(--color-accent-border)',
                      color: 'var(--color-text-primary)',
                    } : {
                      backgroundColor: 'transparent',
                      border: '1px solid transparent',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    <span
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: profile.accent,
                        outline: isActive ? `2px solid ${profile.accent}` : '2px solid transparent',
                        outlineOffset: '2px',
                      }}
                    />
                    <div className="min-w-0">
                      <div className="font-semibold leading-none mb-0.5">{profile.name}</div>
                      <div
                        className="text-[10px] leading-none truncate"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {profile.description}
                      </div>
                    </div>
                    {isActive && (
                      <span
                        className="ml-auto text-[10px] font-bold uppercase"
                        style={{ color: 'var(--color-accent)' }}
                      >
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
