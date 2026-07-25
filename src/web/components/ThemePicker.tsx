// File: src/web/components/ThemePicker.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Moon, Sun, Palette, Check } from 'lucide-react';
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
        aria-expanded={open}
        className="muster-btn muster-btn-soft font-mono"
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
        <div className="muster-panel absolute right-0 top-full mt-1.5 z-50 shadow-2xl p-3 w-56 flex flex-col gap-3">
          {/* Mode toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide muster-text-muted">
              Appearance
            </span>
            <button onClick={toggleMode} className="muster-btn muster-btn-secondary font-mono">
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

          <div className="muster-divider h-px" aria-hidden="true" />

          {/* Profile selection */}
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide block mb-2 muster-text-muted">
              Color Profile
            </span>
            <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Color profile">
              {COLOR_PROFILES.map(profile => {
                const isActive = theme.profile === profile.id;
                return (
                  <button
                    key={profile.id}
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => { setProfile(profile.id); setOpen(false); }}
                    className={`muster-btn justify-start text-left w-full font-normal ${
                      isActive ? 'muster-btn-soft' : 'muster-btn-ghost'
                    }`}
                  >
                    {/* The swatch is the one place a literal profile hue belongs:
                        it previews the theme rather than being themed by it. */}
                    <span
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: profile.accent }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold leading-none mb-0.5 muster-text-primary">
                        {profile.name}
                      </span>
                      <span className="block text-[10px] leading-none truncate muster-text-muted">
                        {profile.description}
                      </span>
                    </span>
                    {isActive && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
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
