# CAP UI Design Language Specification

## 1. Overview & Core Philosophy
The Collaborative Agent Platform (CAP) design language provides a unified, tactical visual system built for maximum clarity, density, and accessibility across human and AI interactions.

All visual decisions in CAP are governed by two fundamental principles:
1. **Functional Color Naming**: Colors are named by their intent and purpose (`alert`, `warning`, `success`, `info`, `brand-primary`, `surface-base`), never by literal color terms (e.g. "red", "green", "blue").
2. **Harmonious Geometry & Shapes**: All interactive and structural elements conform to standardized spatial scale, padding, border-radii, and field dimensions.

---

## 2. User Color Profiles & Theme Mode Architecture

### User Binding & Persistence
Theme preferences are explicitly linked to the active human operator profile (`agent_registration` record of type `human`):
- **Selected Color Profile**: Choice of primary brand identity accent suite.
- **Appearance Mode**: Independent selection of `Dark` or `Light` mode.
- **Persistence**: Saved in local storage key `cap_user_theme_<user_id>` and synced with user profile settings.

---

## 3. Color Profiles

CAP supports four curated tactical color profiles:

### 1. Tactical Cyber (Default Cyan)
- **Primary Accent**: Cyan (`#06b6d4`)
- **Theme Identity**: High-tech tactical mission control.

### 2. Amber Command (Tactical Gold)
- **Primary Accent**: Warm Amber (`#f59e0b`)
- **Theme Identity**: Command console & priority warning alert system.

### 3. Emerald Matrix (Tactical Green)
- **Primary Accent**: Emerald (`#10b981`)
- **Theme Identity**: System health, active telemetry, and code execution.

### 4. Deep Space Violet (Tactical Purple)
- **Primary Accent**: Violet (`#8b5cf6`)
- **Theme Identity**: Deep space exploration & agent coordination.

---

## 4. Independent Light & Dark Mode Mapping

Each color profile dynamically provides both **Dark Mode** and **Light Mode** variations without altering semantic token names.

### Semantic Token Matrix

| Semantic Token | Dark Mode (Default) | Light Mode |
| :--- | :--- | :--- |
| `--color-surface-base` | `#09090b` (Obsidian) | `#f8fafc` (Slate 50) |
| `--color-surface-elevated` | `#18181b` (Zinc 900) | `#ffffff` (White) |
| `--color-surface-hover` | `#27272a` (Zinc 800) | `#f1f5f9` (Slate 100) |
| `--color-surface-active` | `#3f3f46` (Zinc 700) | `#e2e8f0` (Slate 200) |
| `--color-border-subtle` | `rgba(39, 39, 42, 0.8)` | `#cbd5e1` (Slate 300) |
| `--color-border-hover` | `#3f3f46` | `#94a3b8` (Slate 400) |
| `--color-border-focus` | Profile Accent (`rgba(accent, 0.5)`) | Profile Accent (`rgba(accent, 0.6)`) |
| `--color-text-primary` | `#f4f4f5` (Zinc 100) | `#0f172a` (Slate 900) |
| `--color-text-secondary` | `#d4d4d8` (Zinc 300) | `#334155` (Slate 700) |
| `--color-text-muted` | `#a1a1aa` (Zinc 400) | `#64748b` (Slate 500) |
| `--color-status-success` | `#10b981` (Emerald) | `#059669` (Emerald 600) |
| `--color-status-warning` | `#f59e0b` (Amber) | `#d97706` (Amber 600) |
| `--color-status-alert` | `#ef4444` (Rose/Red) | `#dc2626` (Red 600) |
| `--color-status-info` | `#3b82f6` (Blue) | `#2563eb` (Blue 600) |

---

## 5. Shapes, Geometry & Radius Standards

To preserve visual rhythm across inputs, buttons, containers, and cards, the following corner radius scale must be strictly applied:

### Radius Scale
- `radius-sm` (`0.25rem` / 4px): Badge indicators, tag pills, inline code elements.
- `radius-md` (`0.375rem` / 6px): Buttons, form inputs, dropdown selectors.
- `radius-lg` (`0.5rem` / 8px): Kanban cards, document viewer containers, modal dialogs.
- `radius-xl` (`0.75rem` / 12px): Outer application containers, main board columns.
- `radius-full` (`9999px`): Agent avatar circles, status indicator dots.

### Height & Component Spacing Standards
- **Form Control Height**: Standard inputs & select controls are `2.25rem` (36px, `h-9`).
- **Button Padding**: Compact `px-3 py-1.5`, Standard `px-4 py-2`.
- **Card Padding**: Compact `p-3`, Standard `p-4`.
- **Grid Gaps**: Standard layout gap `gap-4` (16px) or `gap-6` (24px).

---

## 6. Typography & Visual Hierarchy

- **Font Stack**: Monospace / Sans-serif tactical UI typography.
- **Headings**:
  - `h1`: `text-xl font-bold text-amber-500 dark:text-amber-300` (Main doc title)
  - `h2`: `text-lg font-semibold text-slate-800 dark:text-zinc-100` (Section headers)
  - `h3`: `text-sm font-semibold text-slate-700 dark:text-zinc-200` (Sub-sections & card titles)
- **Code & Telemetry**: Monospace (`font-mono`, `text-xs`) with emerald or cyan highlight tokens.

---

## 7. Agent Implementation Guidelines
When introducing or modifying UI components in CAP:
1. Always use semantic CSS class tokens or functional Tailwind colors (`emerald` for success, `rose` for alert, `amber` for warning, `cyan` for brand primary).
2. Support both Light and Dark mode variations using Tailwind's `dark:` variant or CSS custom property variables.
3. Avoid inline hardcoded color values (`#ff0000`, `rgb(...)`) or arbitrary corner radii (`rounded-[11px]`). Use standard radius and color tokens.
4. Color profile and light/dark preferences must be linked to the human operator session.
