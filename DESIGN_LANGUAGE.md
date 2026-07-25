# CAP UI Design Language

Normative for every UI change in `src/web/`. If a rule here conflicts with
existing markup, the rule wins and the markup is the bug.

## 1. Core principles

1. **Colour is named by function, never by hue.** `success`, `warning`,
   `danger`, `info`, `brand`, `neutral`. What hue those resolve to depends on
   the user's colour profile and appearance mode, and is not a component's
   business.
2. **Theming happens at the ramp, not at the call site.** No component ever
   branches on light vs. dark. No `dark:` variants. No `.light .foo` overrides.
3. **Shared components before bespoke ones.** Buttons, inputs, panels, dialogs
   and badges come from the `cap-*` vocabulary in `src/web/index.css`. A
   section that invents its own button is the defect this document exists to
   prevent.

## 2. How theming works

`src/web/index.css` defines every palette family as CSS custom properties
holding raw `R G B` triplets:

```
--neutral-50 … --neutral-950     surfaces, borders, text
--brand-50   … --brand-950       the active colour profile
--success-*  --warning-*  --danger-*  --info-*  --alt-*
```

`tailwind.config.js` binds Tailwind's colour families to those variables via
`<alpha-value>`, so opacity modifiers keep working:

```js
cyan: brand,   // bg-cyan-600/20 → rgb(var(--brand-600) / 0.2)
zinc: neutral,
emerald: success,  amber: warning,  rose: danger,  blue: info
```

Two consequences worth internalising:

- **Hue-named utility classes are aliases onto semantic ramps.** `text-amber-400`
  *is* warning text. It themes correctly, but the name lies about intent —
  prefer `cap-text-warning` or `success`/`warning`/`danger` family names in new
  code.
- **Light mode is a ramp inversion, not an override.** Each step keeps its
  *role* across modes: `400` is always "readable text colour", `600` is always
  "solid fill that carries `--color-on-accent` text", `950` is always "faintest
  tinted panel". That is why light mode needs no `!important` anywhere.

The active theme is set on `<html>`:

```html
<html class="dark|light" data-profile="cyber|amber|emerald|violet">
```

Specificity is deliberate: `html.light` (0,1,1) outranks `[data-profile]`
(0,1,0), and `html.light[data-profile='x']` (0,2,1) outranks both.

### Colour profiles

| Profile | Brand hue | Identity |
| :-- | :-- | :-- |
| `cyber` (default) | Cyan | High-tech tactical mission control |
| `amber` | Amber | Command console & priority alerts |
| `emerald` | Emerald | System health & code execution |
| `violet` | Violet | Agent coordination |

Preference is per human operator, persisted at `cap_user_theme_<user_id>`, with
colour profile and light/dark chosen independently.

Two known consequences of profile theming, accepted deliberately:

- Under the `amber` and `emerald` profiles the brand hue coincides with the
  `warning` / `success` hue. Status is still distinguishable by placement and
  iconography, not by hue alone.
- The violet dark ramp is shifted one step lighter from `400` up, because
  violet at equal ramp steps is too dark to carry near-black text on a solid
  fill. This preserves the universal rule (dark mode: solid brand fill takes
  near-black text) instead of special-casing `--color-on-accent`.

## 3. Semantic tokens

Use these in inline styles and in new CSS. Never a literal hex.

| Token | Role |
| :-- | :-- |
| `--color-surface-base` | Page background |
| `--color-surface-elevated` | Panels, cards, dialogs |
| `--color-surface-hover` | Raised / hovered rows, secondary button face |
| `--color-surface-active` | Pressed / active surface |
| `--color-border-subtle` | Default border and divider |
| `--color-border-hover` | Border on hover |
| `--color-text-primary` | Headings and body |
| `--color-text-secondary` | Supporting copy |
| `--color-text-muted` | Labels, metadata, timestamps |
| `--color-text-faint` | Decorative glyphs only — never meaningful text |
| `--color-accent` | Brand as **text/icon** on a surface |
| `--color-accent-solid` | Brand as a **fill** |
| `--color-on-accent` | The only legible text colour on `accent-solid` |
| `--color-success` / `-subtle` / `-border` | Healthy, online, approved |
| `--color-warning` / `-subtle` / `-border` | Needs attention, in review |
| `--color-danger` / `-solid` / `-subtle` / `-border` | Destructive, failed |
| `--color-info` / `-subtle` / `-border` | Neutral informational |
| `--color-scrim` | Modal backdrop (dark in both modes, by design) |

## 4. Component vocabulary

Defined in `src/web/index.css` under `@layer components`.

### Buttons

Always `cap-btn` plus exactly one variant.

| Variant | Use for |
| :-- | :-- |
| `cap-btn-primary` | The one main action in a view. Brand fill. |
| `cap-btn-secondary` | Cancel, dismiss, back. Neutral raised face. |
| `cap-btn-soft` | Secondary actions that should still read as "ours". Brand tint. |
| `cap-btn-ghost` | Toolbar and inline icon actions. Chromeless until hover. |
| `cap-btn-danger` | Confirming a destructive action. |
| `cap-btn-danger-soft` | Triggering a destructive flow. |
| `cap-btn-ghost-danger` | Row-level delete icons. |

Modifiers: `cap-btn-lg` (roomier, for modal footers), `cap-btn-icon`
(square, icon-only).

**Primary buttons are brand-coloured everywhere.** A section does not get its
own primary hue — that was the single largest source of visual inconsistency in
this codebase.

### Other primitives

| Class | Use for |
| :-- | :-- |
| `cap-input`, `cap-input-lg` | Every text input, textarea and select |
| `cap-label` | The label above a form control |
| `cap-panel` | Cards, side panels, floating overlays |
| `cap-dialog` | Modal body |
| `cap-scrim` | Modal backdrop; already handles fixed/centering/blur |
| `cap-badge` + `cap-badge-{accent,success,warning,danger,info,neutral}` | Status pills |
| `cap-chip` | Mono identity chips — entity names, agent handles, IDs |
| `cap-segmented` + `cap-segmented-item` | View switchers (`aria-selected` drives the active style) |
| `cap-tab` / `cap-tab-active` | Top-level navigation |
| `cap-divider` | Rules and dot separators |

Text helpers: `cap-text-primary`, `cap-text-secondary`, `cap-text-muted`,
`cap-text-faint`, `cap-accent`, `cap-text-{success,warning,danger,info}`.

## 5. Shape & spacing

Radius comes from tokens; `rounded` and `rounded-md` are the same 6px value.

- `radius-sm` (4px) — badges, tag pills, inline code
- `radius-md` (6px) — buttons, inputs, selects
- `radius-lg` (8px) — cards, panels, dialogs
- `radius-xl` (12px) — outer app containers, board columns
- `rounded-full` — avatars, status dots

Spacing:

- Button padding: compact `px-3 py-1.5` (`cap-btn`), standard `px-4 py-2` (`cap-btn-lg`)
- Card padding: compact `p-3`, standard `p-4`
- Grid gaps: `gap-4` or `gap-6`

## 6. Contrast

WCAG 2.1 AA is a build requirement, not an aspiration: **4.5:1 for body text,
3:1 for large text (≥24px, or ≥18.66px bold)**, in every combination of
`{dark, light} × {cyber, amber, emerald, violet}`.

The token ramps are chosen so that conforming markup passes automatically. The
combinations were verified empirically by walking the rendered DOM, compositing
each element's effective background through its ancestors, and computing the
real contrast ratio — not by eyeballing screenshots. Re-run that check after
touching ramps or adding a profile.

Decorative glyphs (rules, dot separators) are exempt, and are therefore marked
`aria-hidden` and drawn with `cap-divider` rather than being coloured text.

## 7. Rules for agents

1. Reach for a `cap-*` component class first. Only write bespoke styling when
   no primitive fits — and then add the primitive instead of inlining it.
2. Never hardcode a colour: no `#rrggbb`, no `rgb(...)`, no arbitrary
   `rounded-[11px]`. Use tokens and the radius scale.
3. Never write `dark:` variants or `.light` overrides. If something looks wrong
   in one mode, the ramp is wrong — fix `index.css`, not the component.
4. Prefer semantic family names (`success`, `warning`, `danger`, `info`,
   `brand`, `neutral`) over hue names (`emerald`, `amber`, `rose`, `cyan`).
5. One `cap-btn-primary` per view. Everything else is secondary, soft or ghost.
6. Data visualisation is the one exception: the knowledge-graph node palette in
   `KnowledgeGraphCanvas.tsx` is a *categorical encoding* of entity type, and
   legitimately uses fixed per-category hues with separate light/dark variants.
   Treat it as a chart scale, not as UI chrome.
7. After a visual change, verify contrast in both modes before calling it done.
