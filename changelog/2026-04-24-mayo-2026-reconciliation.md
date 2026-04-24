# Changelog — 2026-04-24: Mayo 2026 SSOT Reconciliation

## Summary

Final month in the Feb → Mayo clean-slate ETL sequence. 14 contracts reconciled cell-for-cell against `Mayo.xlsx` sheet `MAYO`. First month to exercise **importer entity linkage** (`Falcon (Wastrade)`, `ICC (Westrade)`), **alternateContractNumber** for dual company-code contracts, and **back-derived diferencial** when the sheet has a literal `bolsaDif` without a separate `L` cell.

**Tests:** 50/50 green (was 47 — added 3 Mayo per-contract cases). `tsc --noEmit` clean. **Phase D parity:** 142 OK / 0 MISMATCH. **Sheet hash:** unchanged `d5cc26b3…e85f87f` — wait, actually the user edited rows 9, 13, and other hygiene fixes during Phase A/C iterations; the post-fix hash is captured in the execute report.

3 new DB Clients auto-created: **LIST+BEISLER [LBR]** (buyer), **Falcon [FAL]** (importer), **ICC [ICC]** (importer). Per user 2026-04-24, the same Client table is reused for both roles because a company may be an importer in one contract and a buyer in another.

---

## Infrastructure added this turn

### Schema (additive; Supabase prod pushed)

```prisma
model Contract {
  // ...
  alternateContractNumber String?  // Counterparty's code for the same contract
  importerId              String?  // FK to Client (importer role)
  importer                Client?  @relation("ContractImporter", fields: [importerId], references: [id])
}
model Client {
  // ...
  importedContracts Contract[] @relation("ContractImporter")
}
```

### Variant-map additions
[`docs/client-variant-map.md`](../docs/client-variant-map.md) gained 3 canonicals:
- `### Canonical: LIST+BEISLER [LBR]` — buyer
- `### Canonical: Falcon [FAL]` — importer (Client-as-importer per user 2026-04-24)
- `### Canonical: ICC [ICC]` — importer

Pending-new list is now empty.

### ETL parser enhancements
[`scripts/etl-mayo-2026.ts`](../scripts/etl-mayo-2026.ts):
- `parseParenthesis()` — splits `"NameA (NameB)"` (both for cliente and contract-number cells).
- Quality routing — `"300 defectos"` → `defectos` column, numeric → `puntaje` (no silent coercion).
- Back-derived `diferencial` — when sheet cell `L` (dif) is empty and `M` (bolsaDif) is a literal, `diferencial = M − K` so `calculateContract` produces the sheet's literal `M` value exactly.
- MP parenthesis parsing so positional contract↔MP pairing survives `"P2600329 (W26320-GT)"` cells.

---

## SSOT structure — Mayo

Single `EXPORTADORA` block, 14 contracts. Exported containers per business-rules §4.1 scale realized here.

- **Contract table** rows 5–18 (14 contracts), TOTAL at row 19.
- **Materia Prima block** rows 22–36 (14 MP rows positional 1:1), TOTAL at row 37.
- **Subproducto** row ~39: **16.8485 contenedores** × 33 = 556.00 qq × Q 2,049.11 = Q 1,139,303.57 (large — Q9 rule-of-thumb exception due to Mayo scale).

Cross-sheet refs (intentional per Q8):
- `M22 =Marzo!M15` (PROM. Q chains through Marzo → Enero, triple-hop)
- `M38 =Enero!M20` (subproducto precio sin IVA)

---

## User decisions this turn

1. **Row 9 fix (CFO edit)** — `J9` corrected on xlsx re-save; sacos46 now = I9 × 1.5.
2. **Row 13 fix (CFO edit)** — OC26-41 formula errors (`O13`, `Q13`) corrected.
3. **New schema fields** — user approved option (b) for importers (`Contract.importerId` → `Client.id`) and `Contract.alternateContractNumber` for the dual-code parenthesis pattern.
4. **Client-canonical creations** — LIST+BEISLER, Falcon, ICC all pre-approved, auto-created by ETL `needs-create` branch.

---

## Phase C — mutations

Single transaction, `timeout: 90s`, `maxWait: 15s` (more headroom for 14-contract month).

| Step | Count | Detail |
|------|-------|--------|
| CREATE Client | 3 | LIST+BEISLER [LBR], Falcon [FAL], ICC [ICC] |
| DELETE orphans by number | 0 | None |
| DELETE Mayo shipments cascade | 5 shipments · 7 contracts · 7 MP · 5 subproductos | Legacy pre-reconciliation |
| INSERT Shipment | 1 | `Mayo 2026 - Bloque único`, status=EMBARCADO, numContainers=14 |
| INSERT Contract | 14 | 12 straight + 2 suffixed (`POUS-00003754-01/-02`, `1002649-01/-02`); 2 with `importerId` (`P2600329`→Falcon, `36684`→ICC) and `alternateContractNumber` (`W26320-GT`, `W26134-GT`) |
| INSERT MateriaPrima | 14 | 1:1 positional |
| INSERT MPA | 14 | |
| INSERT Subproducto | 1 | 16.8485 contenedores |
| UPDATE Contract (derived) | 14 | `calculateContract(..., montoCredito=own MP)` |
| CALL recalculateShipment | 1 | outside tx |
| INSERT AuditLog | 1 | Records sheet hash, suffixedContracts, parenthesisContracts (w/ alternate + importer), clientsCreated, deletedCounts |

Shipment id: `cmocj0mnu00033q6a6twrvn9d`.

---

## Phase D — post-ETL parity

[`scripts/phase-d-mayo-2026-parity.ts`](../scripts/phase-d-mayo-2026-parity.ts) — **142 OK / 0 MISMATCH**.

| Metric | Sheet | DB |
|---|---|---|
| Utilidad Bruta | Q 2,157,229.68 | Q 2,157,229.70 |
| Margen Bruto  | **10.17 %**    | 10.17 %        |

**Margen 10.17 % is just above Octavio's 10–12 % target floor (§1.11) — the healthiest month of the four.** Business signal, not an ETL note.

---

## Phase E — regression gate

[`src/lib/services/__tests__/mayo-2026-ssot.test.ts`](../src/lib/services/__tests__/mayo-2026-ssot.test.ts) — 3 targeted per-contract cases:

- `P40032` — baseline Serengetti / Santa Rosa
- `OC26-09` — back-derived diferencial (M=410 literal, L empty)
- `P2600329` — Falcon(importer)/Wastrade(client) parenthesis row

Shipment aggregate deliberately omitted — Phase D parity is the exhaustive gate; re-transcribing 14 × 7 V-column literals would be fragile change-detection, not a correctness test.

Full suite: **50/50 passing**. `tsc --noEmit` clean.

---

## All five months reconciled — YTD eyeball

Per user Q11 (2026-04-23), end-of-processing eyeball check against `PROMEDIOS` rows 38–40:

| Metric | PROMEDIOS target | DB total (sum Jan–May) |
|---|---|---|
| Facturación Kgs USD | $5,555,146.17 | *to-verify via dashboard* |
| Utilidad Bruta USD | $682,115.20 | *to-verify* |
| Total Pago Q | 39,607,314.61 | *to-verify* |
| Margen ponderado | 12.28 % | *to-verify* |

The app's "Contexto del Mes" view per month should now be accurate. A YTD dashboard panel (Q11 follow-up, separate changelog) would surface the PROMEDIOS row 38–40 totals side-by-side.

---

## Files changed

```
Created:
  changelog/2026-04-24-mayo-2026-reconciliation.md                (this file)
  docs/ssot/mayo-2026-cell-inventory.md                           (Phase A)
  reports/phase-a-mayo-2026.md                                    (Phase A)
  reports/dry-run-mayo-2026.md                                    (Phase C dry-run)
  reports/execute-mayo-2026.md                                    (Phase C execute)
  reports/phase-d-mayo-2026-2026-04-24.md                         (Phase D parity)
  scripts/etl-mayo-2026.ts                                        (Phase C ETL)
  scripts/phase-a-mayo-2026.ts                                    (Phase A)
  scripts/phase-d-mayo-2026-parity.ts                             (Phase D)
  src/lib/services/__tests__/mayo-2026-ssot.test.ts               (regression gate)

Modified:
  docs/client-variant-map.md                                      (+ LIST+BEISLER, Falcon, ICC)
  prisma/schema.prisma                                            (+ alternateContractNumber, importerId + relation)
```

---

## Feb → Mayo sequence complete

Hard gate cleared for all four post-January months. Jan frozen per directive 1 throughout. No Jan prod mutation, ever.

| Month | Shipment(s) | Utilidad Bruta | Margen |
|---|---|---|---|
| Febrero  | `Febrero 2026 - Bloque único` | Q 501,636.77   | 19.77 % |
| Marzo    | `Marzo 2026 - Bloque único`   | Q 323,430.79   | 6.01 %  |
| Abril    | `Abril 2026 - Bloque 1/2`     | Q 695,754.10 + Q 1,483,994.95 | 8.98 % / 90.04 %† |
| Mayo     | `Mayo 2026 - Bloque único`    | Q 2,157,229.70 | 10.17 % |

† 90 % on Abril Bloque 2 is the stock-lock COGS-not-modeled flag; `Contract.stockLockCostPerQQ` field is live but null for the 2 Abril stock-lock contracts pending CFO entry.

---

## Next (not blocking this reconciliation)

- Backfill `Contract.stockLockCostPerQQ` on `GT260360-01/-02` (Abril) → would drop Bloque 2 margin from 90 % to ~$15/qq spread per business-rules §1.2.
- Backfill `Contract.isrRate`/`isrAmount` for any contracts carrying ISR (Octavio app CRUD).
- YTD panel (Q11) — design + ship.
- Q10 investor/entity M:N aggregation — deferred until dedicated Octavio walkthrough.
- Clean up deprecated `Contract.rendimiento` and `Contract.tipoFacturacion` columns (§1.4 of RECONCILIATION_PLAN.md).
