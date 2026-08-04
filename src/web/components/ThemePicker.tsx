// File: src/web/components/ThemePicker.tsx
import React from 'react';
import { Moon, Sun, Check, Sparkles } from 'lucide-react';
import { useTheme } from '../ThemeContext.js';
import { COLOR_PROFILES } from '../theme.js';

export const ThemePicker: React.FC = () => {
  const { theme, setProfile, toggleMode } = useTheme();

  return (
    <div className="space-y-6 w-full font-sans">
      {/* Light / Dark Mode Toggle Section */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider muster-text-muted mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 muster-accent" /> Appearance Mode
        </h3>
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <button
            type="button"
            onClick={() => { if (theme.mode !== 'dark') toggleMode(); }}
            className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
              theme.mode === 'dark'
                ? 'bg-brand-500/10 border-brand-500 muster-text-primary shadow-sm font-bold'
                : 'bg-muster-surface border-muster-border muster-text-muted hover:muster-text-primary'
            }`}
          >
            <Moon className={`w-4 h-4 ${theme.mode === 'dark' ? 'muster-accent' : ''}`} />
            <span className="muster-text-primary">Dark Mode</span>
            {theme.mode === 'dark' && <Check className="w-3.5 h-3.5 muster-accent ml-auto" />}
          </button>

          <button
            type="button"
            onClick={() => { if (theme.mode !== 'light') toggleMode(); }}
            className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
              theme.mode === 'light'
                ? 'bg-brand-500/10 border-brand-500 muster-text-primary shadow-sm font-bold'
                : 'bg-muster-surface border-muster-border muster-text-muted hover:muster-text-primary'
            }`}
          >
            <Sun className={`w-4 h-4 ${theme.mode === 'light' ? 'muster-accent' : ''}`} />
            <span className="muster-text-primary">Light Mode</span>
            {theme.mode === 'light' && <Check className="w-3.5 h-3.5 muster-accent ml-auto" />}
          </button>
        </div>
      </div>

      <div className="border-t border-muster-border/60" />

      {/* Color Profile Grid Section */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider muster-text-muted mb-2">
          Color Profile Theme
        </h3>
        <p className="text-xs muster-text-secondary mb-3">
          Choose a color profile for the entire platform interface.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Color profile">
          {COLOR_PROFILES.map((profile) => {
            const isActive = theme.profile === profile.id;
            return (
              <button
                key={profile.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => setProfile(profile.id)}
                className={`flex items-start gap-3 p-3.5 rounded-lg border text-left cursor-pointer transition-all ${
                  isActive
                    ? 'bg-brand-500/10 border-brand-500 shadow-sm ring-1 ring-brand-500/50'
                    : 'bg-muster-surface border-muster-border/80 hover:border-muster-border hover:bg-muster-surface-hover'
                }`}
              >
                <span
                  className="w-5 h-5 rounded-full shrink-0 mt-0.5 shadow-sm border border-black/20"
                  style={{ backgroundColor: profile.accent }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs muster-text-primary">
                      {profile.name}
                    </span>
                    {isActive && <Check className="w-4 h-4 muster-accent shrink-0" />}
                  </div>
                  <span className="block text-[11px] muster-text-muted mt-0.5 leading-snug">
                    {profile.description}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
