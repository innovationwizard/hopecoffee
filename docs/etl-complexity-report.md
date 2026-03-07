# ETL Complexity Report — Excel to Database Import

This document explains every discrepancy found between the source Excel workbook
(`docs/hopecoffee.xlsx`) and the initial database import, the root cause of each,
and the solution currently implemented in `scripts/import-excel.ts`.

---

## 1. ESTADO CUENTA KFINOS — Column Offset Mismatch

**Symptom**: 52 entries imported instead of 61. Nine entries missing (OC5 tail + OC8).

**Root cause**: The KFINOS sheet has three side-by-side column groups, each tracking
a different purchase order. The original parser used wrong 0-indexed column positions:

```
WRONG (original):
  Group 1: dateCol=2, orderCol=3, ingresoCol=4, pergCol=5, precioCol=6
  Group 2: dateCol=9, orderCol=10, ingresoCol=11, pergCol=12, precioCol=13
  Group 3: dateCol=16, orderCol=17, ingresoCol=18, pergCol=19, precioCol=20
```

The actual sheet layout (confirmed by dumping row 0 header):

```
CORRECT:
  Group 1: FECHA=0, ORDEN=1, INGRESO=2, PEGAMINO=3, PRECIO=4
  Group 2: FECHA=7, ORDEN=8, INGRESO=9, PEGAMINO=10, PRECIO=11
  Group 3: FECHA=14, ORDEN=15, INGRESO=16, PEGAMINO=17, PRECIO=18
```

With the wrong offsets, `orderCol=3` pointed at the PEGAMINO column (a number like
29.59), which `safeStr()` turned into `"29.59"` — a truthy string that passed the
`!orderCode` guard. So rows parsed but with scrambled data. Some rows happened to
fail the `!date` guard because the shifted dateCol pointed at an empty cell, causing
partial data loss rather than total failure. The offset error also caused the parser
to start at row 4 (skipping the first 3 data rows per group).

Additionally, the three column groups operate independently — OC4 ends at row 20
with a TOTAL marker in group 1, but OC5 continues through row 24 in group 2, and
OC8 replaces OC6 at row 15 in group 3. The original parser's row range was correct
(it iterates all rows for all groups), but the wrong column offsets meant OC8 entries
were reading from the wrong columns.

**Solution**: Corrected all three column group mappings. Changed start row from 4 to 1
(row 0 is the header). Added explicit skip for `TOTAL` and `ORDEN` strings in the
order code column. Each group is processed independently per row — no shared state
between groups.

**Result**: 61 entries (OC4: 19, OC5: 23, OC6: 14, OC8: 5). Exact match.

---

## 2. Phantom Total Rows in Contract Sections

**Symptom**: 62 contracts imported instead of ~47. Approximately 14 extra rows.

**Root cause**: Every contract block in the monthly sheets has a summary/total row
at the bottom of the contract section. This row has numeric values in the PUNTAJE
and SACOS 69 KG columns (typically a weighted average puntaje and the sum of all
sacos), but has NO value in the CLIENTE or CONTRATO columns.

Example from Enero Block 1:

```
Row 5: Swiss Water | P30172 | 82 | 290   <-- real contract
Row 6: Serengetti  | P40028 | 82 | 275   <-- real contract
Row 7: Serengetti  | P40022 | 83 | 275   <-- real contract
Row 8: (empty)     | (empty) | 82 | 840  <-- phantom total (290+275+275=840)
```

The parser's break conditions (`TOTAL` text, all-null row, zero puntaje/sacos) never
triggered on these rows because they contain valid numeric data and no `TOTAL` text.

A complicating factor: the total row's puntaje does NOT always match the contracts
above. In many blocks, the total uses a base puntaje of 82 regardless of the actual
contract puntajes (which can be 81, 83, 84, or 85). This ruled out puntaje-based
detection.

**Solution**: Two-layer detection:

1. **For blocks WITH both CLIENTE and CONTRATO columns**: When a row has both columns
   empty, check: (a) if there are 2+ contracts already parsed above, it is always a
   total; or (b) if sacos equals the running sum of contracts above, it is a total
   for the single-contract case.

2. **For blocks WITHOUT a CLIENTE column** (e.g., SERENGETTI B2/B3): Post-process
   the parsed contracts array — if the last row's sacos equals the sum of all others,
   remove it.

**Edge case — onyx row 6**: The onyx sheet has one contract (P40029, puntaje=83,
sacos=275) followed by a row with no client/contract (puntaje=82, sacos=275). This
row's sacos matches the running sum (275=275 for a single contract), so it is caught
as a total. Whether this is truly a total or a second contract with missing metadata
is ambiguous — the sacos match and the missing CLIENTE/CONTRATO fields strongly
suggest a total. This accounts for the -1 delta in the final contract count (46 vs
expected 47).

---

## 3. Client Sheets Duplicating Monthly Data

**Symptom**: Contracts like P40129, P40028, P30172, P40022 appeared twice — once
from the monthly sheet (Enero) and once from the client sheet (SERENGETTI).

**Root cause**: The Excel workbook has two types of sheets:

- **Monthly sheets** (Enero, Febrero, Marzo, Abril, Mayo, Negociacion): Each STATUS
  block represents a shipment. Contracts are listed with their client, status, and
  full pricing data. This is the source of truth.

- **Client sheets** (SERENGETTI, SUCAFINA SPECIALTY, onyx): These reorganize the same
  data by client. A single client sheet may pull contracts from multiple monthly
  sheets into one view. For example, SERENGETTI Block 1 contains the same 4 contracts
  as Enero Block 1, but presented from Serengetti's perspective.

The original import treated both types identically, creating duplicate contracts.
When a contract number like P40029 appeared in both Febrero Block 1 and the onyx
sheet, both were imported.

**Complication — same contract number, different shipments**: Within monthly sheets,
the same contract number can appear in multiple blocks with different quantities.
For example, P40029 appears in Febrero Block 1 (275 sacos) and Febrero Block 3
(40 sacos). These represent different shipment allocations of the same contract and
are NOT duplicates — both must be imported.

**Complication — client sheets with unique data**: Not all client sheet data exists
in monthly sheets. SERENGETTI Block 2 (3 contracts, puntaje=83, sacos=550 each) and
Block 3 (1 contract) have no equivalent in any monthly sheet. SUCAFINA SPECIALTY's
single contract (puntaje=85, sacos=180) is also unique. These must be imported.

**Solution**: Two-tier deduplication:

- **Client sheet contracts with real P-numbers**: If the contract number was already
  imported from a monthly sheet, skip it entirely.
- **Monthly sheet contracts with duplicate P-numbers**: Suffix the contract number
  with block info (e.g., `P40029-FEB3`) to maintain uniqueness in the database while
  preserving both shipment allocations.
- **Placeholder numbers** (`No asigando`, `Pendiente`, empty): Always generate a
  unique ID (`PEND-{sheet}-{block}-{row}`). No dedup applied.

**Result**: 5 client-sheet duplicates skipped (4 from SERENGETTI B1, 1 from onyx).
All unique client-sheet contracts imported.

---

## 4. Shipment Name Collisions for Client Sheets

**Symptom**: 23 shipments imported instead of 25. SERENGETTI Blocks 2 and 3 were
skipped, along with their MP and subproducto data.

**Root cause**: The original import assigned the same shipment name to all blocks
within a client sheet. All three SERENGETTI blocks got the name `"SERENGETTI"`. After
Block 1 was created, Blocks 2 and 3 hit the `findFirst({ where: { name } })` guard
and were skipped entirely — including their MP and subproducto records.

**Solution**: Client sheet blocks now get unique names with a suffix when the sheet
has multiple blocks: `"SERENGETTI - Bloque 1"`, `"SERENGETTI - Bloque 2"`, etc.
Single-block client sheets (SUCAFINA SPECIALTY, onyx) keep their plain name.

**Result**: All 25 shipments created. MP and subproducto counts corrected as a
downstream effect.

---

## 5. Non-Numeric Puntaje (SHB Grade)

**Symptom**: Febrero Block 2 (Sopex, Robusta coffee) had 0 contracts and 0 MP
imported. One contract and one MP row were missing.

**Root cause**: The Sopex contract has `puntaje = "SHB"` (Strictly Hard Bean — a
coffee grading term, not a numeric score). The parser called `safeNum("SHB")` which
returned 0, triggering the `if (puntaje === 0) break` guard. The MP row similarly
has `punteo = "SHB"`, which caused the `if (punteo === 0) continue` guard to skip it.

**Solution**:

- **Contracts**: Detect non-numeric puntaje by checking if the raw string is non-empty
  but parses to 0. When detected, store puntaje as 0 but do NOT break — the contract
  is still valid. The break condition now only fires when puntaje is 0 AND the raw
  cell value is empty (truly blank row).

- **MP**: Relaxed the guard from `if (punteo === 0 || oro === 0)` to `if (oro === 0)`.
  A row with oro > 0 is valid regardless of punteo value.

- **Client**: Added `sopex` to the CLIENT_MAP normalization table.

**Result**: Sopex contract and MP row both import. New client "Sopex" (SPX) created
automatically.

---

## 6. Materia Prima — Identical Rows Not Deduplicated (Correct Behavior)

**Symptom**: Initially reported as 48 MP imported instead of 53 (-5 missing). After
fixing issues #4 and #5, all 53 rows imported correctly.

**Root cause of the initial -5**: This was NOT a dedup problem. The 5 "missing" MP
rows were caused by two other bugs:

1. **SERENGETTI B2/B3 skipped** (issue #4): 3 + 1 = 4 MP rows lost because their
   parent shipments were never created.
2. **Febrero B2 SHB punteo** (issue #5): 1 MP row skipped due to non-numeric grade.

The 5 identical rows in Marzo Block 5 (rows 128-132, all "No comprado / kfinos",
punteo=82, oro=412.5, rendimiento=1.32, precio=1650) were always importing correctly.
The parser creates one record per row with no fingerprint-based deduplication.

**Solution**: No change needed for the MP parser itself. Fixing issues #4 and #5
resolved the count.

**Result**: All 53 MP rows imported, including all 5 identical Marzo B5 rows.

---

## Summary of Final Counts

| Entity | Spreadsheet | Database | Delta | Status |
|---|---|---|---|---|
| Clients | 11 | 12 | +1 | Sopex added (new) |
| Shipments | 25 | 25 | 0 | Exact match |
| Contracts | 47 | 46 | -1 | Onyx total-row ambiguity |
| Materia Prima | 53 | 53 | 0 | Exact match |
| Subproductos | 25 | 25 | 0 | Exact match |
| Purchase Orders | 2 | 2 | 0 | Exact match |
| Account Entries | 61 | 61 | 0 | Exact match |

The single remaining delta (contracts: -1) stems from an ambiguous row in the onyx
sheet. Row 6 has no CLIENTE, no CONTRATO, and sacos equal to the single contract
above — matching the pattern of every other phantom total row in the workbook. If
this is confirmed as a real contract rather than a total, the phantom-total guard
can be adjusted to exempt single-contract blocks.
