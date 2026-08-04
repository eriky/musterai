// File: src/web/theme.ts
// Theme profiles and persistence for Muster UI Design Language

export type ColorProfile = 'slate' | 'cyber' | 'amber' | 'emerald' | 'violet';
export type AppearanceMode = 'dark' | 'light';

export interface ThemePreference {
  profile: ColorProfile;
  mode: AppearanceMode;
}

export interface ColorProfileMeta {
  id: ColorProfile;
  name: string;
  /** Literal hue for the swatch: it previews a profile rather than being themed by one. */
  accent: string;
  description: string;
}

export const COLOR_PROFILES: ColorProfileMeta[] = [
  {
    id: 'slate',
    name: 'Modern Slate',
    accent: '#64748b',
    description: 'Sleek neutral modern workplace',
  },
  {
    id: 'cyber',
    name: 'Tactical Cyber',
    accent: '#06b6d4',
    description: 'High-tech tactical mission control',
  },
  {
    id: 'amber',
    name: 'Amber Command',
    accent: '#f59e0b',
    description: 'Command console & priority alerts',
  },
  {
    id: 'emerald',
    name: 'Emerald Matrix',
    accent: '#10b981',
    description: 'System health & code execution',
  },
  {
    id: 'violet',
    name: 'Deep Space',
    accent: '#8b5cf6',
    description: 'Agent coordination suite',
  },
];

const STORAGE_KEY_PREFIX = 'muster_user_theme_';

export function loadThemeForUser(userId: string | null): ThemePreference {
  if (!userId) return { profile: 'slate', mode: 'dark' };
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ThemePreference>;
      const profile = parsed.profile && COLOR_PROFILES.some(p => p.id === parsed.profile)
        ? parsed.profile
        : 'slate';
      const mode: AppearanceMode = parsed.mode === 'light' ? 'light' : 'dark';
      return { profile, mode };
    }
  } catch {
    // ignore
  }
  return { profile: 'slate', mode: 'dark' };
}

export function saveThemeForUser(userId: string | null, theme: ThemePreference): void {
  if (!userId) return;
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(theme));
  } catch {
    // ignore
  }
}

/**
 * Applies the given theme to the <html> element via data attributes.
 * Tailwind `darkMode: 'class'` handles the 'dark' class for dark/light tokens.
 * The data-profile attribute drives CSS custom properties for accent colors.
 */
export function applyTheme(theme: ThemePreference): void {
  const html = document.documentElement;

  // Set dark/light class for Tailwind
  if (theme.mode === 'dark') {
    html.classList.add('dark');
    html.classList.remove('light');
  } else {
    html.classList.remove('dark');
    html.classList.add('light');
  }

  // Set profile data attribute
  html.setAttribute('data-profile', theme.profile);
}
