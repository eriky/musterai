/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/web/**/*.{html,js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Backward-compatible command-* tokens (still used throughout existing components)
        command: {
          bg:      'var(--color-surface-base)',
          surface: 'var(--color-surface-elevated)',
          card:    'var(--color-surface-elevated)',
          border:  'var(--color-border-subtle)',
          muted:   'var(--color-text-muted)',
          // Legacy named colours kept for gradual migration
          cyan:    '#06b6d4',
          emerald: '#10b981',
          amber:   '#f59e0b',
          rose:    '#f43f5e',
          indigo:  '#6366f1',
        },
        // New semantic profile-aware tokens (use these going forward)
        cap: {
          accent:  'var(--color-accent)',
          surface: 'var(--color-surface-elevated)',
          base:    'var(--color-surface-base)',
          hover:   'var(--color-surface-hover)',
          border:  'var(--color-border-subtle)',
          text:    'var(--color-text-primary)',
          muted:   'var(--color-text-muted)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
