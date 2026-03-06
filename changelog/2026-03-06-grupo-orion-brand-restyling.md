# Changelog — 2026-03-06: Grupo Orion Brand Restyling

## Summary

Complete visual restyling of HOPE COFFEE to match the Grupo Orion holding group brand identity. Replaces the previous emerald/gray theme with a navy blue + white corporate palette derived from the trademarked Grupo Orion logo. Typography updated to DM Sans (body) + JetBrains Mono (data) for a corporate-geeky dashboard aesthetic. Dark mode set as default, with a discrete light/dark toggle added to the top bar. TypeScript: 0 errors.

---

## Design Decisions

- **Brand colors**: Custom `orion` palette (50-950) derived from the Grupo Orion logo's deep navy `#0a1628`. Used for all interactive/chrome elements (buttons, links, focus rings, sidebar active states, progress bars).
- **Semantic colors preserved**: `emerald` kept for positive status badges (FIJADO), margin indicators (>12%). `amber`, `red`, `blue`, `purple`, `orange` kept for their existing semantic meanings in badges and status indicators. These are data-display colors, not brand-chrome.
- **Neutral base**: Switched from Tailwind `gray-*` to `slate-*` for a cooler, more corporate tone that pairs better with the navy brand.
- **Typography**: DM Sans replaces Inter (matching the Maya TD Gantt reference). JetBrains Mono retained for all numeric/data display. KPI labels use `font-mono text-[10px] uppercase tracking-wider` for data-dashboard feel.
- **Dark mode surfaces**: `orion-900` (sidebar, cards), `orion-950` (page background), `orion-800` (borders, inputs) instead of generic grays.
- **Default theme**: Changed from `light` to `dark` to match the navy brand identity.

---

## 1. Tailwind Configuration

Added custom `orion` color scale and updated font families.

### Files modified:

| File | Change |
|------|--------|
| `tailwind.config.ts` | Added `colors.orion` scale (50-950). Updated `fontFamily.sans` to use `var(--font-dm-sans)` / DM Sans. Updated `fontFamily.mono` to use `var(--font-mono)` / JetBrains Mono. |

---

## 2. Root Layout & Global Styles

Swapped body font from Inter to DM Sans. Changed default theme to dark. Rewrote CSS variables.

### Files modified:

| File | Change |
|------|--------|
| `src/app/layout.tsx` | Replaced `Inter` import with `DM_Sans` (400/500/700). Variable renamed to `--font-dm-sans`. `defaultTheme` changed from `"light"` to `"dark"`. Title updated to `"HOPE COFFEE — Grupo Orion"`. |
| `src/app/globals.css` | CSS variables: borders now use `slate` (light) / `orion-800` (dark). Added `--accent` / `--accent-dim` variables. `.data-table th` background updated to `#f8fafc` (light) / `#0a1628` (dark). Added `.dense-table` component for dashboard compact tables. |

---

## 3. AppShell — Sidebar & Top Bar

Navy sidebar with Grupo Orion brand mark. Theme toggle added to top bar.

### Files modified:

| File | Change |
|------|--------|
| `src/components/layout/app-shell.tsx` | Added `useTheme` from `next-themes` + `Sun`/`Moon` icons from lucide. Sidebar brand area: `GO` monogram in rounded square + "HOPE COFFEE" title + "GRUPO ORION" mono subtitle. All `gray-*` classes replaced with `slate-*` (light) / `orion-*` (dark). Active nav states: `emerald-*` replaced with `orion-*`. Role badge colors updated. Avatar circle: `emerald-600` replaced with `orion-600`. Sidebar width: 64 -> 60 (`md:w-60`). Top bar height: 14 -> 12 (`h-12`). Added Sun/Moon toggle button (right side of top bar). |
| `src/components/layout/sidebar-link.tsx` | Active state: `emerald-50/700` replaced with `orion-50/700` (light), `orion-800/300` (dark). Hover state: `gray-100/800` replaced with `slate-100` / `white/5`. |

---

## 4. UI Primitives

All interactive component variants updated from emerald/gray to orion/slate.

### Files modified:

| File | Change |
|------|--------|
| `src/components/ui/button.tsx` | `primary` variant: `emerald-600/700` -> `orion-600/700` (light), `orion-500/600` (dark). `secondary`: `gray-*` -> `slate-*` / `orion-800/700`. `outline`: `gray-*` -> `slate-*` / `orion-700` + `white/5`. `ghost`: `gray-*` -> `slate-*` / `white/5`. |
| `src/components/ui/card.tsx` | Background: `gray-900` -> `orion-900`. Borders: `gray-200/700` -> `slate-200` / `orion-800`. |
| `src/components/ui/input.tsx` | Labels: `gray-700/300` -> `slate-700/300`. Input bg: `gray-800` -> `orion-800`. Focus ring: `emerald-500` -> `orion-400`. Borders: `gray-300/600` -> `slate-300` / `orion-700`. |
| `src/components/ui/select.tsx` | Same changes as input.tsx (labels, backgrounds, focus rings, borders). |
| `src/components/ui/badge.tsx` | `gray` variant: `gray-*` -> `slate-*` with `/30` and `/50` opacity modifiers in dark mode. `emerald` variant: dark mode opacity tuned to `/20` and `/50` for subtlety on navy backgrounds. |

---

## 5. Data Components

### Files modified:

| File | Change |
|------|--------|
| `src/components/ui/data-table.tsx` | Table border: `gray-200/700` -> `slate-200` / `orion-800`. Sort icons: `gray-400` -> `slate-400`. Pagination text: `gray-500` -> `slate-500`. Pagination buttons: `gray-300/600` -> `slate-300` / `orion-700`, hover `white/5`. |
| `src/components/ui/page-header.tsx` | Breadcrumbs: added `font-mono`. Link hover: `gray-700` -> `orion-600/400`. Separator: explicit `slate-300/600`. Title: added `tracking-tight`. |
| `src/components/ui/empty-state.tsx` | Icon color: `gray-300/600` -> `slate-300` / `orion-700`. Text: `gray-*` -> `slate-*`. |
| `src/components/ui/loading-skeleton.tsx` | Skeleton bars: `gray-200/700/800` -> `slate-200` / `orion-800` / `orion-800/50`. Card skeleton: borders and bg updated to `orion-*`. |
| `src/components/ui/collapsible-section.tsx` | Borders: `gray-200/700` -> `slate-200` / `orion-800`. Badge: added `font-mono`, bg `gray-100/700` -> `slate-100` / `orion-800`. Chevron: `gray-500` -> `slate-400`. |

---

## 6. Login & Auth

Brand identity on the login screen.

### Files modified:

| File | Change |
|------|--------|
| `src/app/(auth)/layout.tsx` | Background: `gray-50/950` -> `slate-50` / `orion-950`. |
| `src/app/(auth)/login/page.tsx` | Added GO brand monogram (12x12 rounded square, dark/light aware). Title: `gray-900` -> `slate-900`, added `tracking-tight`. Subtitle: replaced plain text with `font-mono text-xs uppercase tracking-wider` "Grupo Orion" label. Inputs: `gray-*` / `emerald-*` -> `slate-*` / `orion-*`. Submit button: `emerald-600` -> `orion-600/500`. |

---

## 7. Dashboard

KPI cards and tables updated to brand colors.

### Files modified:

| File | Change |
|------|--------|
| `src/app/(dashboard)/dashboard/page.tsx` | KPI labels: `text-xs text-gray-500 uppercase tracking-wide` -> `text-[10px] font-mono text-slate-400 uppercase tracking-wider`. Revenue KPI value: `emerald-700/400` -> `orion-600/400` (brand blue). Break-even progress bar: `gray-200/700` -> `slate-200` / `orion-800`; fill `emerald-500` -> `orion-500`. Section headers: `gray-700/300` -> `slate-700/300`. All links: `text-blue-600` -> `text-orion-600 dark:text-orion-400`. Margin alert: dark border opacity tuned to `/40`, bg to `/10`. |

---

## Colors NOT changed (semantic, intentional)

These colors remain as-is because they carry data meaning, not brand identity:

| Color | Usage | Reason |
|-------|-------|--------|
| `emerald` | Badge variant for FIJADO status, margin color (>= 12%) | Semantic: green = positive/confirmed |
| `amber` | Badge for NEGOCIACION, margin warning (>= 10%) | Semantic: yellow = caution |
| `red` | Badge for CANCELADO, margin danger (< 10%), error states | Semantic: red = danger/error |
| `blue` | Badge for CONFIRMADO | Semantic: blue = confirmed |
| `purple` | Badge for EMBARCADO | Semantic: purple = in-transit |
| `orange` | Badge for NO_FIJADO | Semantic: orange = unfixed |
| `gray-900/white` on KPI values | Contenedores, Contratos Activos, Break-even numbers | Neutral data display, no brand significance |
| `gray-400/500` on secondary text | Muted labels, timestamps, pagination counts | Standard neutral muted text |

---

## Theme Toggle

- Location: Top bar, right-aligned
- Icons: `Sun` (shown in dark mode) / `Moon` (shown in light mode) from lucide-react
- Behavior: Toggles between `"dark"` and `"light"` via `next-themes` `useTheme()` hook
- Style: Discrete `p-1.5 rounded-md` button, hover states only
