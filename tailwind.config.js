/** @type {import('tailwindcss').Config} */

/**
 * Bind a Tailwind colour family to a CSS-variable ramp defined in
 * src/web/index.css. `<alpha-value>` keeps opacity modifiers working,
 * so `bg-cyan-600/20` still renders a 20% tint of the themed value.
 */
const ramp = (name) =>
  Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((step) => [
      step,
      `rgb(var(--${name}-${step}) / <alpha-value>)`,
    ]),
  );

const neutral = ramp('neutral');
const brand = ramp('brand');
const success = ramp('success');
const warning = ramp('warning');
const danger = ramp('danger');
const info = ramp('info');
const alt = ramp('alt');

export default {
  content: ['./src/web/**/*.{html,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Semantic families (use these in new code) ──────────
        neutral,
        brand,
        success,
        warning,
        danger,
        info,

        // ── Hue-named families are aliases onto the semantic
        //    ramps, so existing markup themes correctly. Prefer the
        //    semantic names above; see DESIGN_LANGUAGE.md §7.
        zinc: neutral,
        slate: neutral,
        gray: neutral,
        cyan: brand,
        emerald: success,
        green: success,
        amber: warning,
        yellow: warning,
        rose: danger,
        red: danger,
        blue: info,
        sky: info,
        indigo: alt,
        violet: alt,
        purple: alt,

        // ── Structural tokens ─────────────────────────────────
        command: {
          bg: 'var(--color-surface-base)',
          surface: 'var(--color-surface-elevated)',
          card: 'var(--color-surface-elevated)',
          border: 'var(--color-border-subtle)',
          muted: 'var(--color-text-muted)',
        },
        cap: {
          accent: 'var(--color-accent)',
          'accent-solid': 'var(--color-accent-solid)',
          'on-accent': 'var(--color-on-accent)',
          surface: 'var(--color-surface-elevated)',
          base: 'var(--color-surface-base)',
          hover: 'var(--color-surface-hover)',
          border: 'var(--color-border-subtle)',
          text: 'var(--color-text-primary)',
          muted: 'var(--color-text-muted)',
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
