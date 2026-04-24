# Phase A — Marzo 2026 Report

**Generated:** 2026-04-24T04:25:48.923Z
**Sheet:** `Marzo` in `Mayo.xlsx`
**Scope:** month=3, year=2026. Read-only.

## DB baseline

| Table | Count | Expected (directive 2 clean-slate) |
|-------|-------|------------------------------------|
| Shipment | 5 | 0 |
| Contract | 15 | 0 |
| MateriaPrima | 16 | 0 |
| MateriaPrimaAllocation | 0 | 0 |
| Subproducto | 5 | 0 |

## SSOT summary

- Contract rows: **6**
- MP rows: **6**
- Subproducto: **1 block**
- Duplicate contract-numbers (split candidates): **1**
- Cross-sheet refs: **2**
- Excel errors (#REF!): **0**
- Formula / literal mismatches: **0**
- Variant-map unresolved: **0**

## Variant-map resolution

| Sheet cliente | Rows | Resolution |
|---------------|------|-----------|
| Serengetti | 6, 7 | ✓ → Serengetti [SER] (variant: Serengetti) |
| Opal | 8, 9, 10 | ✓ → Opal [OPL] (variant: Opal) |
| Onyx | 11 | ✓ → Onyx [ONX] (variant: Onyx) |

## Hygiene findings

| Severity | Cell | Finding |
|----------|------|---------|
| info | `M15` | Cross-sheet reference (to 'Enero'): Enero!M13 |
| info | `M24` | Cross-sheet reference (to 'Enero'): Enero!M20 |
| info | `E9,E10` | Duplicate contractNumber 'POUS-00003761' across rows 9, 10. Diferencial values: 50, 38. Phase C will split with -01/-02 suffixes per user Q2. |

## Contract summary

| Contrato | Cliente | Lote | Sacos 69 | Bolsa+Dif | Gastos/qq | Facturación Kgs | Total Pago Q |
|----------|---------|------|----------|-----------|-----------|------------------|---------------|
| P40030 | Serengetti | Santa Rosa | 275 | 308 | 14.120000000000001 | 128843.43780000001 | 928155.0857700001 |
| P40024 | Serengetti | Huehue | 275 | 322.55 | 23 | 134930.03526750003 | 946695.6063963753 |
| POUS-00003748 | Opal | Huehue | 275 | 354.1 | 20 | 148128.12118500003 | 1057127.8386652502 |
| POUS-00003761 | Opal | Orgnaico | 100 | 364.1 | 23 | 55385.945340000006 | 392604.60425100004 |
| POUS-00003761 | Opal | Huehue | 175 | 352.1 | 23 | 93730.93894500002 | 662620.3971292502 |
| 1002605 | Onyx | Santa Rosa | 275 | 340.8 | 14.120000000000001 | 142564.42728 | 1033120.655292 |

## MP summary

| Contrato | Proveedor | Rendimiento | Pergamino | Prom. Q | Total MP |
|----------|-----------|-------------|-----------|---------|----------|
| P40030 | Comprado Jose David | 1.32 | 544.5 | 1782.34 | 970484.13 |
| P40024 | Comprado / Huehue | 1.32 | 544.5 | 1782.34 | 970484.13 |
| POUS-00003748 | Comprado / Huehue | 1.32 | 544.5 | 1782.34 | 970484.13 |
| POUS-00003761 | Organico | 1.32 | 198 | 1782.34 | 352903.32 |
| POUS-00003761 | Comprado / Huehue | 1.32 | 346.5 | 1782.34 | 617580.8099999999 |
| 1002605 | Comprado Jose David | 1.32 | 544.5 | 1782.34 | 970484.13 |

## Phase B decision

✓ **Phase B: green.** No errors, no unresolved variants, no formula mismatches. Safe to proceed to Phase C: `scripts/etl-marzo-2026.ts`.

---
*End of Phase A Marzo 2026 report.*
