# Phase A — MAYO 2026 Report

**Generated:** 2026-04-24T06:23:29.120Z

## DB baseline

| Table | Count |
|-------|-------|
| Shipment | 5 |
| Contract | 7 |
| MateriaPrima | 7 |
| MateriaPrimaAllocation | 0 |
| Subproducto | 5 |

## SSOT summary

- Contract rows: **14**
- MP rows: **14**
- Subproducto: **1 block**
- Duplicate contract-numbers: **2** — POUS-00003754, 1002649
- Parenthesis rows (importer/client): **2**
- Variant-map resolved: **5**
- Variant-map needs-create: **1**
- Variant-map unresolved: **0**

## Variant-map resolution

| Sheet cliente | Rows | Resolution |
|---------------|------|-----------|
| Serengetti | 5, 6 | ✓ → Serengetti [SER] (variant: Serengetti) |
| Opal | 7, 8 | ✓ → Opal [OPL] (variant: Opal) |
| LIST+BEISLER | 9, 10 | ➕ needs-create → LIST+BEISLER [LBR] |
| ONYX | 11, 12, 13 | ✓ → Onyx [ONX] (variant: Onyx) |
| Wastrade | 14, 15, 16, 17 | ✓ → Westrade [WST] (variant: Wastrade) |
| Westrade | 18 | ✓ → Westrade [WST] (variant: Westrade) |

## Importers (parenthesis pattern)

Detected 2 distinct IMPORTER name(s) in the plain portion of "Name (Name)" cliente cells:
- Falcon
- ICC

Per `feedback_importer_client_parenthesis.md`, Falcon and ICC are confirmed IMPORTERS (Wastrade is the CLIENT). For any other plain name in a parenthesis pattern, stop and ask.

**Schema decision pending** — current schema has no Importer entity. Options:
1. Use existing `ShipmentParty.role=IMPORTER` for the relation.
2. Add `Contract.importerId` pointing at a reused Client row.
3. Add a first-class `Importer` model.
Phase C is BLOCKED until this decision + needed schema migration land.

## Hygiene findings

| Severity | Cell | Finding |
|----------|------|---------|
| info | `E17` | Contract number parenthesis: primary='P2600329' secondary='W26320-GT'. Phase B must decide how to persist the secondary (importer's reference? alias? ignore?). |
| warn | `D17` | Importer/client parenthesis pattern: IMPORTER='Falcon' CLIENT='Wastrade' (per feedback_importer_client_parenthesis.md, plain=IMPORTER, paren=CLIENT). Schema decision pending for Importer entity (ShipmentParty vs first-class); Phase C blocked until resolved. |
| info | `E18` | Contract number parenthesis: primary='36684' secondary='W26134-GT'. Phase B must decide how to persist the secondary (importer's reference? alias? ignore?). |
| warn | `D18` | Importer/client parenthesis pattern: IMPORTER='ICC' CLIENT='Westrade' (per feedback_importer_client_parenthesis.md, plain=IMPORTER, paren=CLIENT). Schema decision pending for Importer entity (ShipmentParty vs first-class); Phase C blocked until resolved. |
| info | `M22` | Cross-sheet reference (to 'Marzo'): Marzo!M15 |
| info | `M38` | Cross-sheet reference (to 'Enero'): Enero!M20 |
| info | `E7,E8` | Duplicate contractNumber 'POUS-00003754' across rows 7, 8. Phase C will split with -01/-02 suffixes. |
| info | `E9,E10` | Duplicate contractNumber '1002649' across rows 9, 10. Phase C will split with -01/-02 suffixes. |
| info | `D9` | Client 'LIST+BEISLER' is NEEDS-CREATE → canonical 'LIST+BEISLER' [LBR] |
| warn | `(importers)` | Importers seen in parenthesis pattern: Falcon, ICC. Schema decision needed: persist via ShipmentParty.role=IMPORTER OR add Contract.importerId / first-class Importer entity. Phase C blocked. |

## Contract summary

| Contrato | Cliente | Importer | Lote | Quality | Sacos 69 | Bolsa+Dif | Gastos/qq | Fact Kgs |
|----------|---------|----------|------|---------|----------|-----------|-----------|----------|
| P40032 | Serengetti | - | Santa Rosa | puntaje=82 | 275 | 315.35 | 20 | 131918.11074750003 |
| P40026 | Serengetti | - | Huehue | puntaje=83 | 275 | 328.35 | 23 | 137356.30779750002 |
| POUS-00003754 | Opal | - | Huehue | puntaje=83 | 225 | 338.35 | 20 | 115805.07515250001 |
| POUS-00003754 | Opal | - | Huehue | puntaje=83 | 50 | 350.35 | 23 | 26647.165545000003 |
| 1002649 | LIST+BEISLER | - | Huehue | puntaje=85 | 125 | 386.35 | 23 | 73463.1968625 |
| 1002649 | LIST+BEISLER | - | Huehue | puntaje=84 | 150 | 386.35 | 23 | 88155.83623500001 |
| OC26-09 | ONYX | - | Huehue | puntaje=84 | 20 | 410 | 23 | 12473.626799999998 |
| OC26-08 | ONYX | - | Huehue | puntaje=84 | 255 | 410 | 23 | 159038.7417 |
| OC26-41 | ONYX | - | Huehue | puntaje=84 | 275 | 355.35 | 23 | 148651.02474750002 |
| W26381-GT | Wastrade | - | Huehue | puntaje=84 | 825 | 350.35 | 23 | 439678.23149250005 |
| W26380-GT | Wastrade | - | Huehue | puntaje=83 | 1375 | 345.35 | 23 | 722338.9812375001 |
| W26359-GT | Wastrade | - | Huehue | puntaje=84 | 825 | 352.35 | 23 | 442188.1685925001 |
| P2600329 | Wastrade | Falcon | SHB HUEHUE | puntaje=83 | 275 | 337.35 | 20 | 141121.21344750002 |
| 36684 | Westrade | ICC | HB SANTA ROSA | puntaje=80 | 275 | 321.35 | 20 | 134428.0478475 |

## Phase B decision

⚠️ **PAUSED per directive 9**: 2 importer(s) awaiting schema decision. Append unresolved variants to `docs/client-variant-map.md` and decide schema for importers before --execute.

