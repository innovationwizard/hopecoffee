# Phase A — Abril 2026 Report

**Generated:** 2026-04-24T05:17:21.660Z
**Scope:** month=4, year=2026. Read-only.

## DB baseline

| Table | Count | Expected (directive 2 clean-slate) |
|-------|-------|------------------------------------|
| Shipment | 1 | 0 |
| Contract | 2 | 0 |
| MateriaPrima | 2 | 0 |
| MateriaPrimaAllocation | 0 | 0 |
| Subproducto | 1 | 0 |

## SSOT summary

- Total contract rows: **9** (7 Exportadora + 2 Stock Lock)
- MP rows: **7** (expected to match Exportadora count: 7)
- Subproducto: **1 block**
- Duplicate contract-numbers (split candidates): **2** — W26350-GT, GT260360
- Cross-sheet refs: **5**
- Excel errors (#REF!) flagged as blocking: **0**
- Excel errors tolerated on stock-lock rows: **9**
- Formula / literal mismatches: **0**
- Variant-map unresolved: **0**
- Variant-map needs-create: **2**

## Variant-map resolution

| Sheet cliente | Rows | Resolution |
|---------------|------|-----------|
| Serengetti | 5, 6 | ✓ → Serengetti [SER] (variant: Serengetti) |
| Stonex | 7, 8 | ✓ → Stonex [STX] (variant: Stonex) |
| Westrade | 9, 10, 11 | ⚠ needs-create → Westrade [WST] (ETL will create on --execute) |
| Plateau Harvest | 36, 37 | ⚠ needs-create → Plateau Harvest [PLH] (ETL will create on --execute) |

## Hygiene findings

| Severity | Cell | Finding |
|----------|------|---------|
| info | `M15` | Cross-sheet reference (to 'Marzo'): Marzo!M15 |
| info | `M24` | Cross-sheet reference (to 'Enero'): Enero!M20 |
| info | `S36` | Excel error in stock-lock row — tolerated per user directive 3 (ETL recomputes via calculateContract with montoCredito=0): 23 |
| info | `S36` | Cross-sheet reference (to 'REF'): (((#REF!*0.08)/12)*2)/U36 |
| info | `T36` | Excel error in stock-lock row — tolerated per user directive 3 (ETL recomputes via calculateContract with montoCredito=0): 23 |
| info | `V36` | Excel error in stock-lock row — tolerated per user directive 3 (ETL recomputes via calculateContract with montoCredito=0): 23 |
| info | `S37` | Excel error in stock-lock row — tolerated per user directive 3 (ETL recomputes via calculateContract with montoCredito=0): 23 |
| info | `S37` | Cross-sheet reference (to 'REF'): (((#REF!*0.08)/12)*2)/U37 |
| info | `T37` | Excel error in stock-lock row — tolerated per user directive 3 (ETL recomputes via calculateContract with montoCredito=0): 23 |
| info | `V37` | Excel error in stock-lock row — tolerated per user directive 3 (ETL recomputes via calculateContract with montoCredito=0): 23 |
| info | `S38` | Excel error in stock-lock row — tolerated per user directive 3 (ETL recomputes via calculateContract with montoCredito=0): 23 |
| info | `S38` | Cross-sheet reference (to 'REF'): (((#REF!/U38)*0.08)/12)*2 |
| info | `T38` | Excel error in stock-lock row — tolerated per user directive 3 (ETL recomputes via calculateContract with montoCredito=0): 23 |
| info | `V38` | Excel error in stock-lock row — tolerated per user directive 3 (ETL recomputes via calculateContract with montoCredito=0): 23 |
| info | `E10,E11` | Duplicate contractNumber 'W26350-GT' across rows 10, 11. Diferencial values: 40, 40. Phase C will split with -01/-02 suffixes. |
| info | `E36,E37` | Duplicate contractNumber 'GT260360' across rows 36, 37. Diferencial values: -37, -52. Phase C will split with -01/-02 suffixes. |
| info | `D9` | Client 'Westrade' is NEEDS-CREATE (map canonical 'Westrade' [WST], DB row missing). Abril ETL will create it on --execute. |
| info | `D36` | Client 'Plateau Harvest' is NEEDS-CREATE (map canonical 'Plateau Harvest' [PLH], DB row missing). Abril ETL will create it on --execute. |

## Contract summary

| Entity | Contrato | Cliente | Lote | Sacos 69 | Bolsa+Dif | Gastos/qq | Fact. Kgs | Total Pago |
|--------|----------|---------|------|----------|-----------|-----------|-----------|-------------|
| EXPORTADORA | P40031 | Serengetti | Santa Rosa | 275 | 325.35 | 14.120000000000001 | 136101.33924750003 | 983678.0318433753 |
| EXPORTADORA | P40025 | Serengetti | Huehue | 275 | 338.35 | 23 | 141539.53629750002 | 997258.2892758752 |
| EXPORTADORA | SCS_177612 | Stonex | Huehue | 206 | 348.35 | 20 | 109159.59835740001 | 778100.8495781102 |
| EXPORTADORA | SCS_177617 | Stonex | Santa Rosa | 75 | 347.35 | 14.120000000000001 | 39628.4841675 | 287476.845681375 |
| EXPORTADORA | W26342-GT | Westrade | Huehue | 275 | 346.9 | 23 | 145116.196665 | 1024619.7410872501 |
| EXPORTADORA | W26350-GT | Westrade | Huehue | 275 | 351.25 | 23 | 146935.90106250002 | 1038540.4797281253 |
| EXPORTADORA | W26350-GT | Westrade | Huehue | 550 | 351.45 | 23 | 294039.13126500003 | 2078361.0273772504 |
| STOCK_LOCK | GT260360 | Plateau Harvest | Stocklot | 275 | 265 | 23 | 110855.55525 | 23 |
| STOCK_LOCK | GT260360 | Plateau Harvest | Stocklot | 275 | 250 | 23 | 104580.71250000001 | 23 |

## MP summary

| Contrato | Rendimiento | Pergamino | Prom. Q | Total MP |
|----------|-------------|-----------|---------|----------|
| P40031 | 1.32 | 544.5 | 1782.34 | 970484.13 |
| P40025 | 1.32 | 544.5 | 1782.34 | 970484.13 |
| SCS_177612 | 1.32 | 407.88 | 1782.34 | 726980.8391999999 |
| SCS_177617 | 1.32 | 148.5 | 1782.34 | 264677.49 |
| W26342-GT | 1.32 | 544.5 | 1782.34 | 970484.13 |
| W26350-GT | 1.32 | 544.5 | 1782.34 | 970484.13 |
| W26350-GT | 1.32 | 1089 | 1782.34 | 1940968.26 |

## Phase B decision

✓ **Phase B: green.** 2 needs-create client(s) will be auto-created on --execute. Safe to proceed to Phase C.

