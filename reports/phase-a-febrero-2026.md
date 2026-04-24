# Phase A — Febrero 2026 Report

**Generated:** 2026-04-24T03:46:55.145Z
**Sheet:** `Febrero` in `Mayo.xlsx`
**Scope:** month=2, year=2026. Read-only.

## DB baseline (Feb 2026)

| Table | Count | Expected (directive 2 clean-slate) |
|-------|-------|------------------------------------|
| Shipment | 0 | 0 |
| Contract | 0 | 0 |
| MateriaPrima | 0 | 0 |
| MateriaPrimaAllocation | 0 | 0 |
| Subproducto | 0 | 0 |

## SSOT summary

- Contract rows: **2**
- MP rows: **2**
- Subproducto: **1 block**
- Cross-sheet cell references: **2**
- Excel errors (#REF! etc.): **0**
- Formula / literal mismatches: **0**

## Hygiene findings

| Severity | Cell | Finding |
|----------|------|---------|
| info | `M12` | Cross-sheet reference in formula (to 'Enero'): Enero!M32 |
| info | `M17` | Cross-sheet reference in formula (to 'Enero'): Enero!M20 |

## Contract summary

| Contrato | Cliente | Lote | Sacos 69 | Bolsa+Dif | Gastos/qq | Facturación Kgs | Total Pago Q |
|----------|---------|------|----------|-----------|-----------|------------------|---------------|
| P40029 | SERENGETTI | Santa Rosa | 275 | 395 | 14.120000000000001 | 165237.52575000003 | 1206569.8585875002 |
| P40023 | SERENGETTI | Huehuetenango | 275 | 397.75 | 23 | 166387.91358750002 | 1187348.3755443753 |

## MP summary

| Contrato | Proveedor | Rendimiento | Pergamino | Prom. Q | Total MP |
|----------|-----------|-------------|-----------|---------|----------|
| P40029 | Santa Rosa | 1.32 | 544.5 | 1782.34 | 970484.13 |
| P40023 | Huehue | 1.32 | 544.5 | 1782.34 | 970484.13 |

## Next step (Phase B)

✓ **Phase B: green**. No errors, no formula/literal mismatches. Safe to proceed to Phase C: write `scripts/etl-febrero-2026.ts` with `--dry-run` / `--execute` modes.

---
*End of Phase A Febrero 2026 report.*
