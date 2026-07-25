# Muster UI Design Language

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
   and badges come from the `muster-*` vocabulary in `src/web/index.css`. A
   section that invents its own button is the defect this document exists to
   prevent.

## 2. How theming works

`src/web/index.css` defines every palette family as CSS custom properties
holding raw `R G B` triplets:

```
--neutral-50 … --neutral-950     surfaces, borders, text
--brand-50   … --brand-950       the active colour profile
--success-*  --warning-*  --danger-*  --info-*
```

`tailwind.config.js` binds Tailwind's colour families to those variables via
`<alpha-value>`, so opacity modifiers keep working:

```js
neutral, brand, success, warning, danger, info   // and nothing else
// bg-brand-600/20 → rgb(var(--brand-600) / 0.2)
```

Three things worth internalising:

- **Hue names are not aliased, deliberately.** There is no `zinc`, `cyan` or
  `emerald` family. `bg-zinc-900` produces *no CSS rule at all* — a loud,
  visible failure rather than a silently mis-named colour. That is the point:
  the aliases existed during the migration and let hue-naming creep back in.
- **Light mode is a ramp inversion, not an override.** Each step keeps its
  *role* across modes: `400` is always "readable text colour", `600` is always
  "solid fill that carries `--color-on-accent` text", `950` is always "faintest
  tinted panel". That is why light mode needs no `!important` anywhere.
- **Structural `muster-*` colours are alpha-capable.** `bg-muster-surface`,
  `border-muster-border/60` and friends resolve through the ramp triplets. Binding
  them to the `--color-*` aliases instead would make any opacity modifier
  silently emit nothing.

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

Preference is per human operator, persisted at `muster_user_theme_<user_id>`, with
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

Each has a matching utility: `muster-text-primary`, `muster-text-muted`, `muster-accent`,
`muster-text-{success,warning,danger,info}`, `bg-muster-surface`, `border-muster-border`,
and so on. Prefer the utility at call sites; reach for the raw token only in CSS.

## 4. Component vocabulary

Defined in `src/web/index.css` under `@layer components`.

### Buttons

Always `muster-btn` plus exactly one variant.

| Variant | Use for |
| :-- | :-- |
| `muster-btn-primary` | The one main action in a view. Brand fill. |
| `muster-btn-secondary` | Cancel, dismiss, back. Neutral raised face. |
| `muster-btn-soft` | Secondary actions that should still read as "ours". Brand tint. |
| `muster-btn-ghost` | Toolbar and inline icon actions. Chromeless until hover. |
| `muster-btn-danger` | Confirming a destructive action. |
| `muster-btn-danger-soft` | Triggering a destructive flow. |
| `muster-btn-ghost-danger` | Row-level delete icons. |

Modifiers: `muster-btn-lg` (roomier, for modal footers), `muster-btn-icon`
(square, icon-only).

**Primary buttons are brand-coloured everywhere.** A section does not get its
own primary hue — that was the single largest source of visual inconsistency in
this codebase.

### Other primitives

| Class | Use for |
| :-- | :-- |
| `muster-input`, `muster-input-lg` | Every text input, textarea and select |
| `muster-label` | The label above a form control |
| `muster-panel` | Cards, side panels, floating overlays |
| `muster-dialog` | Modal body |
| `muster-scrim` | Modal backdrop; already handles fixed/centering/blur |
| `muster-badge` + `muster-badge-{accent,success,warning,danger,info,neutral}` | Status pills |
| `muster-chip` | Mono identity chips — entity names, agent handles, IDs |
| `muster-segmented` + `muster-segmented-item` | View switchers (`aria-selected` drives the active style) |
| `muster-tab` / `muster-tab-active` | Top-level navigation |
| `muster-divider` | Rules and dot separators |

Text helpers: `muster-text-primary`, `muster-text-secondary`, `muster-text-muted`,
`muster-text-faint`, `muster-accent`, `muster-text-{success,warning,danger,info}`.

## 5. Categorical scales

Some colour does not mean *status* — it distinguishes *kinds of thing*. Those
scales are exempt from profile theming, because their whole job is to stay
mutually distinguishable, and they must never borrow the semantic families:
tinting a card badge with `brand` asserts "a card is our brand colour", which is
false, and collapses the encoding whenever the profile shifts.

There are exactly two:

**Entity types** (`--entity-*` in `index.css`). Pair a selector class with a
role class:

```jsx
<span className="muster-badge muster-badge-entity muster-entity-document">DOC</span>
<FileText className="muster-entity-icon muster-entity-document" />
```

Available: `muster-entity-{card,agent,document,board,project,kb}`. The selector
class only picks a foreground/background pair; the role class consumes it.

**Knowledge-graph nodes** (`TYPE_COLORS_DARK` / `TYPE_COLORS_LIGHT` in
`KnowledgeGraphCanvas.tsx`). Rendered to canvas by vis-network, so it is
plain JS hex rather than CSS, with an explicit variant per mode. Treat it as a
chart scale.

The `--alt-*` ramp exists but is **not** exposed as a utility family: it feeds
the ambient body gradient and is the reservoir these scales draw from. "alt" is
not a function, so it is not a call-site colour name.

## 6. Shape & spacing

Radius comes from tokens; `rounded` and `rounded-md` are the same 6px value.

- `radius-sm` (4px) — badges, tag pills, inline code
- `radius-md` (6px) — buttons, inputs, selects
- `radius-lg` (8px) — cards, panels, dialogs
- `radius-xl` (12px) — outer app containers, board columns
- `rounded-full` — avatars, status dots

Spacing:

- Button padding: compact `px-3 py-1.5` (`muster-btn`), standard `px-4 py-2` (`muster-btn-lg`)
- Card padding: compact `p-3`, standard `p-4`
- Grid gaps: `gap-4` or `gap-6`

## 7. Contrast

WCAG 2.1 AA is a build requirement, not an aspiration: **4.5:1 for body text,
3:1 for large text (≥24px, or ≥18.66px bold)**, in every combination of
`{dark, light} × {cyber, amber, emerald, violet}`.

The token ramps are chosen so that conforming markup passes automatically. The
combinations were verified empirically by walking the rendered DOM, compositing
each element's effective background through its ancestors, and computing the
real contrast ratio — not by eyeballing screenshots. Re-run that check after
touching ramps or adding a profile.

Decorative glyphs (rules, dot separators) are exempt, and are therefore marked
`aria-hidden` and drawn with `muster-divider` rather than being coloured text.

## 8. Rules for agents

1. Reach for a `muster-*` component class first. Only write bespoke styling when
   no primitive fits — and then add the primitive instead of inlining it.
2. Never hardcode a colour: no `#rrggbb`, no `rgb(...)`, no arbitrary
   `rounded-[11px]`. Use tokens and the radius scale.
3. Never write `dark:` variants or `.light` overrides. If something looks wrong
   in one mode, the ramp is wrong — fix `index.css`, not the component.
4. The only colour families are `neutral`, `brand`, `success`, `warning`,
   `danger`, `info`, plus the `muster-*` structural tokens and the categorical
   scales in §5. Hue names do not resolve; if you reach for `text-zinc-400` the
   element renders unstyled.
5. One `muster-btn-primary` per view. Everything else is secondary, soft or ghost.
6. Before picking a colour, ask whether it means *status* (use a semantic
   family) or *kind* (use a categorical scale from §5). Getting this backwards
   is how a card badge ends up claiming to be a success state.
7. After a visual change, verify contrast in both modes before calling it done.
