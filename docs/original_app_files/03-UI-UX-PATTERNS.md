# Guide 03 — UI/UX Patterns & The "Excel Replacement" Feel

> **Goal**: Make the transition from Excel seamless. Users should feel *faster* in HOPE COFFEE within the first session, not slower. This guide defines the interaction patterns that make that happen.

---

## Design Philosophy

The #1 reason enterprise Excel replacements fail: **they feel slower than Excel.** 

Excel users are keyboard-driven. They expect instant feedback. They expect to see 50+ rows at once. They hate modals. They hate loading spinners. They hate clicking 3 times to do what took 1 keystroke.

HOPE COFFEE must be:
- **Dense**: Show more data per screen than feels comfortable. Users will thank you.
- **Instant**: Calculations update as you type. No submit buttons for computed fields.
- **Keyboard-first**: Tab between fields, Enter to save, Escape to cancel, shortcuts for everything.
- **Predictable**: Same layout patterns everywhere. Learn one page, know them all.

---

## Core UI Components

### 1. The Data Table (Most Important Component)

Every major page centers on a TanStack Table. This is not a basic HTML table — it must match Excel's density and interactivity.

**Required features**:
- Column resizing (drag column borders)
- Column sorting (click header, shift+click for multi-sort)
- Column pinning (pin Cliente and Contrato to left)
- Row selection (checkbox column)
- Inline editing (double-click a cell to edit)
- Sticky header + footer (totals row)
- Compact row height (32px, not the bloated 48px default)
- Monospace font for numbers (tabular alignment)
- Right-align all numeric columns
- Conditional formatting (red for negative margins, green for >10%)
- Virtual scrolling for 100+ row tables

**Styling cues**:
```css
/* Dense table for financial data */
.data-table td {
  padding: 4px 8px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  border-bottom: 1px solid var(--border-subtle);
}

.data-table td.numeric {
  text-align: right;
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
}

.data-table tr:hover {
  background: var(--row-hover);
}

.data-table tfoot td {
  font-weight: 600;
  background: var(--surface-elevated);
  border-top: 2px solid var(--border-strong);
}
```

### 2. The Calculation Preview Panel

When creating or editing a contract, show a live preview panel on the right side that updates as the user types. This is the "aha" moment — it replaces the mental model of Excel's cell-to-cell formula chain.

```
┌──── CONTRACT FORM ─────────────────┐  ┌──── LIVE PREVIEW ─────────┐
│                                     │  │                            │
│  Cliente:    [Serengetti ▼]         │  │  Sacos 46kg:     412.5    │
│  Contrato:   [P40129    ]          │  │  Bolsa+Dif:      $416.00  │
│  Puntaje:    [82        ]          │  │                            │
│  Sacos 69kg: [275       ] ← typing │  │  Fact. Lbs:   $171,600.00 │
│  Bolsa:      [376       ]          │  │  Fact. Kgs:   $174,022.31 │
│  Diferencial:[40        ]          │  │  Gastos Exp:   -$9,487.50 │
│                                     │  │  Utilidad:    $164,534.81 │
│  [Cancel]         [Save Contract]   │  │  Costo Fin:    -$2,016.67 │
│                                     │  │  Util s/CF:   $162,518.14 │
└─────────────────────────────────────┘  │                            │
                                         │  T.C.:              7.65   │
                                         │  ─────────────────────     │
                                         │  TOTAL Q: Q1,243,263.76   │
                                         └────────────────────────────┘
```

Implementation: Use a Zustand store or `useReducer` that recalculates on every field change via `calculateContract()`. No debounce — `Decimal.js` is fast enough for instant computation.

### 3. Status Badges

Consistent color language across the entire app:

| Status      | Color         | Badge Style                     |
| ----------- | ------------- | ------------------------------- |
| NEGOCIACION | Amber/Yellow  | Outline, pulsing dot            |
| CONFIRMADO  | Blue          | Solid fill                      |
| FIJADO      | Green         | Solid fill, checkmark icon      |
| NO_FIJADO   | Orange        | Outline, warning icon           |
| EMBARCADO   | Purple        | Solid fill, ship icon           |
| LIQUIDADO   | Gray          | Muted, checkmark                |
| CANCELADO   | Red           | Strikethrough text              |

### 4. Currency Formatting

All amounts must show the correct currency symbol and use Guatemalan locale conventions:

```typescript
// src/lib/utils/format.ts
export function formatUSD(value: number | Decimal): string {
  const num = typeof value === "number" ? value : value.toNumber();
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(num);
}

export function formatGTQ(value: number | Decimal): string {
  const num = typeof value === "number" ? value : value.toNumber();
  return `Q${new Intl.NumberFormat("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)}`;
}

export function formatPercent(value: number | Decimal): string {
  const num = typeof value === "number" ? value : value.toNumber();
  return `${(num * 100).toFixed(2)}%`;
}
```

### 5. The Shipment P&L View

This is the most complex page and should feel like a financial statement, not a form. Use a vertical flow with clear sections:

```
HEADER
  Shipment name, month/year, status badge, container count, region tags

SECTION 1: CONTRACTS TABLE
  Full contract table (see Data Table spec above)
  Footer row with column sums

SECTION 2: MATERIA PRIMA TABLE
  Supplier | Puntaje | Oro | Rendimiento | Pergamino | Precio Prom Q | Total MP
  Footer row with sums

SECTION 3: MARGIN CARD
  Styled like a financial summary card
  Revenue line items → Costs → Net

SECTION 4: SUBPRODUCTO
  Inline form/table for by-product entries
```

Each section should be collapsible (accordion) so power users can focus on what matters.

---

## Page Layout Patterns

### List Pages (`/contracts`, `/shipments`, etc.)

```
┌─ Page Header ─────────────────────────────────────────┐
│  [icon] Contracts                    [+ New Contract]  │
├─ Filters Bar ─────────────────────────────────────────┤
│  [Status ▼] [Client ▼] [Region ▼] [Date Range] [🔍]  │
├─ Data Table ──────────────────────────────────────────┤
│  (full width, takes remaining vertical space)          │
│  ...                                                   │
│  ...                                                   │
│  FOOTER: totals row                                    │
├─ Pagination ──────────────────────────────────────────┤
│  Showing 1-50 of 127           [◀] [1] [2] [3] [▶]   │
└───────────────────────────────────────────────────────┘
```

### Detail Pages (`/contracts/[id]`, `/shipments/[id]`)

```
┌─ Breadcrumb ──────────────────────────────────────────┐
│  Contracts > P40129                                    │
├─ Header ──────────────────────────────────────────────┤
│  P40129 — Serengetti     [FIJADO]    [Edit] [Delete]  │
├─ Two-Column Layout ──────────────────────────────────┤
│  ┌─ Left (2/3) ──────┐  ┌─ Right (1/3) ────────────┐ │
│  │ Contract Details   │  │ Calculation Summary      │ │
│  │ (editable fields)  │  │ (live computed values)   │ │
│  │                    │  │                          │ │
│  │ History / Audit    │  │ Quick Actions            │ │
│  │ Log for this       │  │ • Change Status          │ │
│  │ entity             │  │ • Assign to Shipment     │ │
│  └────────────────────┘  │ • Duplicate              │ │
│                          └──────────────────────────┘ │
└───────────────────────────────────────────────────────┘
```

### Dashboard (`/dashboard`)

```
┌─ KPI Cards ───────────────────────────────────────────┐
│  [Revenue YTD]  [Avg Margin]  [Containers]  [Active]  │
├─ Charts (2 columns) ─────────────────────────────────┤
│  ┌─ Revenue by Month ────┐  ┌─ Margin Trend ────────┐ │
│  │  (bar chart)           │  │  (line chart)          │ │
│  └────────────────────────┘  └────────────────────────┘ │
├─ Tables (2 columns) ─────────────────────────────────┤
│  ┌─ Top Clients ─────────┐  ┌─ Pipeline ────────────┐ │
│  │  (ranked table)        │  │  (by status)           │ │
│  └────────────────────────┘  └────────────────────────┘ │
└───────────────────────────────────────────────────────┘
```

---

## Keyboard Shortcuts

| Shortcut     | Action                         | Scope       |
| ------------ | ------------------------------ | ----------- |
| `Ctrl+N`     | New (contract/shipment/etc.)   | List pages  |
| `Ctrl+S`     | Save current form              | Edit pages  |
| `Escape`     | Cancel edit / close panel      | Global      |
| `Enter`      | Confirm inline edit            | Tables      |
| `Tab`        | Next field / next cell         | Forms/Table |
| `/`          | Focus search box               | List pages  |
| `Ctrl+F`     | Open filter panel              | List pages  |
| `1-9`        | Quick status change            | Detail page |

---

## Empty States

Every list page needs a well-designed empty state for first-time use:

```
┌─────────────────────────────────────────────┐
│                                             │
│         📋                                  │
│                                             │
│    No contracts yet                         │
│                                             │
│    Create your first contract or import     │
│    from your existing Excel file.           │
│                                             │
│    [+ New Contract]   [Import from Excel]   │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Error & Validation Patterns

**Inline validation**: Show errors below the field, not in a modal or toast. Red border + helper text.

**Calculation warnings**: If a computed margin is negative or unusually high (>25%), show a yellow warning banner:
```
⚠️ Gross margin (32.5%) is unusually high. Please verify pricing inputs.
```

**Stale data protection**: Before saving, check if the record was modified by another user since the form was loaded. If so, show a conflict resolution dialog.

---

## Responsive Behavior

| Breakpoint | Behavior                                                |
| ---------- | ------------------------------------------------------- |
| Desktop    | Full sidebar + table + detail panels                    |
| Tablet     | Collapsed sidebar (icons only) + full table             |
| Mobile     | Bottom nav, card-based list instead of table, stacked forms |

The contract table on mobile should switch to a card view:
```
┌─────────────────────────────────┐
│ P40129 — Serengetti    [FIJADO] │
│ 82pts · 275 sacos · $416/saco  │
│ Total: Q1,243,263.76           │
│ Margin: 7.13%                   │
└─────────────────────────────────┘
```

---

## Performance Targets

| Metric         | Target    | How                                    |
| -------------- | --------- | -------------------------------------- |
| First paint    | <1.5s     | SSR with streaming                     |
| Table render   | <200ms    | Virtual scrolling, memoized cells      |
| Calculation    | <5ms      | Decimal.js is fast, no network needed  |
| Save           | <500ms    | Server action, optimistic UI update    |
| Search         | <300ms    | Debounced, server-side with DB index   |
