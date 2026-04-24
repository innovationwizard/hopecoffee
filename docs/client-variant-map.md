---
name: Client & Importer Canonical Variant Map
description: Single source of truth mapping every xlsx spelling variant to a canonical DB Client. ETL scripts consult this first; unresolved variants block --execute until the user appends them.
status: LIVE — append-only, user-maintained. Updated as new variants appear in month sheets.
authored: 2026-04-24
---

# Client & Importer Variant Map

This document maps every xlsx-sheet spelling variant of a client/importer name to a single **canonical DB `Client` record**. It is the enforcement point against duplicate creation.

> **Operating the monthly ETL?** See [`docs/monthly-reconciliation-playbook.md`](monthly-reconciliation-playbook.md) — §13 covers the variant-map cookbook (adding canonicals, handling typos as variants, parenthesis-pattern canonicals).

## How ETL scripts use this map

1. On each sheet client value, the script normalizes (uppercase + strip non-alphanumeric) and checks it against every variant listed below.
2. **Match found** → use the canonical DB client. Proceed.
3. **No match** → script emits a `SUGGESTION` in `--dry-run` (Levenshtein + substring against DB names) but **refuses to run in `--execute` mode** until a human appends the variant here (either to an existing canonical or as a new canonical to create).
4. Matching is exact on normalized strings — no fuzzy magic at execute time. The Levenshtein layer is dry-run-only scaffolding; after a few months of ETL, every observed variant will be in the map and the fuzzy layer can be deleted entirely.

**Format:** one `## Canonical: <DB name> [<code>]` heading per client, followed by a list of variant strings (one per line). Blank lines between entries are fine.

**Never delete entries.** This is append-only history — a past variant may disappear from a given sheet version but could reappear later; keeping it here is free insurance.

---

## Canonical clients (seeded 2026-04-24 from Supabase prod — 12 rows)

### Canonical: Serengetti [SER]
- Serengetti
- SERENGETTI

### Canonical: Swiss Water [SWP]
- Swiss Water

### Canonical: Opal [OPL]
- Opal

### Canonical: Onyx [ONX]
- Onyx

### Canonical: Atlas [ATL]
- Atlas

### Canonical: Stonex [STX]
- Stonex

### Canonical: Sucafina Specialty [SUC]
- Sucafina Specialty

### Canonical: Florina [FLO]
- Florina

### Canonical: LM [LMC]
- LM

### Canonical: Margaro [MAR]
- Margaro

### Canonical: Sopex [SPX]
- Sopex

### Canonical: Walker [WLK]
- Walker

### Canonical: Plateau Harvest [PLH]
_Added 2026-04-24 for Abril stock-lot-afloat block (GT260360). Per user directive, this canonical is authorized for DB creation; ETL `needs-create` branch will insert the Client row on Abril --execute._
- Plateau Harvest

### Canonical: Westrade [WST]
_Added 2026-04-24 for Abril Exportadora block (W26342-GT, W26350-GT). `Wastrade` is a typo observed in PROMEDIOS May rows `Falcon (Wastrade)` and `ICC (Wastrade)`; per user direction, Wastrade is a variant of Westrade and must never create a duplicate. Per `feedback_importer_client_parenthesis.md`, the May parenthesis rows encode `Falcon`/`ICC` as IMPORTER and `Wastrade`/Westrade as CLIENT — that split is confirmed and does not need re-asking._
- Westrade
- Wastrade

### Canonical: LIST+BEISLER [LBR]
_Added 2026-04-24 for Mayo rows 9–10 (contract `1002649`). User-approved `needs-create` canonical._
- LIST+BEISLER

### Canonical: Falcon [FAL]
_Added 2026-04-24 for Mayo row 17, parenthesis pattern `Falcon (Wastrade)`. Per `feedback_importer_client_parenthesis.md`: Falcon is the IMPORTER here; stored as a `Client` row because the same company may act as a buyer in other contracts (user 2026-04-24 confirmed dual role). ETL links via `Contract.importerId` → this Client._
- Falcon

### Canonical: ICC [ICC]
_Added 2026-04-24 for Mayo row 18, parenthesis pattern `ICC (Westrade)`. Per `feedback_importer_client_parenthesis.md`: ICC is the IMPORTER; same dual-role rationale as Falcon._
- ICC

---

## Pending / not yet confirmed

_Variants encountered in ETL dry-runs that don't match any canonical above. Each entry needs a user decision: either append the variant under an existing canonical (if it's just a different spelling) or add a new `## Canonical: …` section (if it's a genuinely new client)._

_(empty — populated by ETL dry-runs when unresolved variants appear)_

---

## Known likely-new canonicals to add when their months ETL

Surfaced from the PROMEDIOS sheet during Phase 0.1; not yet in DB. Listed here so the user can pre-seed if desired:

_(none pending — Mayo surfaced LIST+BEISLER, Falcon, ICC; all promoted to canonicals above.)_

These are tentative until the relevant month's `phase-a-{month}-2026.ts` extracts the exact strings.
