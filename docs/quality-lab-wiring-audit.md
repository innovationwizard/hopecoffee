# Quality Lab → Financial Pipeline — End-to-End Wiring Audit

**Date:** 2026-04-15
**Scope:** Trace every handoff between Hector's operational quality-lab workflow and the CFO's financial layer (calc engine + shipment aggregation + supplier payments). Verify that a yield variance detected at the bodega actually reaches the margin calculation and the supplier ledger.
**Source material:** [hector.txt](../hector.txt) (Hector COO walkthrough), [prisma/schema.prisma](../prisma/schema.prisma), `src/app/(dashboard)/quality-lab/`, `src/app/(dashboard)/suppliers/`, `src/lib/services/`.

---

## ⚠️ 2026-04-15 RETRACTION — Handoff 3 is NOT a bug

This document was written under the assumption that Lab-world and CFO-world should be unified: a yield adjustment detected by Hector should flow all the way through to Octavio's contract margin. Under that assumption, Handoff 3 (YieldAdjustment → MateriaPrima cost) was classified as **broken**, and commit `4103987` implemented a best-effort bridge.

**User direction 2026-04-15 supersedes that framing:** *"Octavio's numbers come from Octavio's xlsx files. Hector's numbers come from Hector's Lab. The app doesn't break if they differ."*

The two worlds are now permanently independent at Lab-3 scope. Applied yield adjustments update the supplier ledger via `SupplierAccountEntry` and nothing else. They do **not** propagate to `MateriaPrima.totalMP`, they do **not** trigger `recalculateShipment`, and the CFO dashboard is **unaffected** by any catación Hector enters. Divergence between the two views of the same contract's cost is tolerated by design.

The Handoff 3 code from commit `4103987` has been reverted. `applyYieldAdjustment` now does three things and three things only: flip the status, create a `SupplierAccountEntry`, set the bidirectional FK. See `src/app/(dashboard)/quality-lab/actions.ts` `applyYieldAdjustment` for the current implementation.

**Revised handoff scorecard** (as of 2026-04-15 post-revert):

| # | Handoff | Status | Notes |
|---|---|---|---|
| 1 | Cupping → YieldAdjustment auto-create | ✅ plumbed | unchanged |
| 2 | YieldAdjustment apply → SupplierAccountEntry | ✅ plumbed | commit `4103987` — retained |
| 3 | YieldAdjustment → MateriaPrima cost | ⛔ **intentionally not bridged** | was broken, then bridged, then reverted per user direction. No longer a bug. |
| 4 | Lot ↔ MateriaPrima | ⛔ **intentionally parallel** | permanent independence, not a deferred unification |

The rest of this document — especially the §"Business impact" and §"Fix scope" sections — is preserved as the historical record of how the decision was arrived at. It remains accurate to the facts observed at the time; the **interpretation** of those facts has changed.

The live plan for Hector's workflow is in [docs/lot-materia-prima-unification-plan.md §H](lot-materia-prima-unification-plan.md), which supersedes this audit's Fix-scope section for implementation direction.

---

---

## The loop Hector asked for (from hector.txt)

> "Si se compra con 1.32, si no me da 1.33 en el laboratorio, el precio debe ser ajustado. La idea es que cuando yo ingrese mi catación con el número de recibo, cuando aquel genere su pago, plum, ya era el ajuste."

Translated into system requirements, the loop has four handoffs:

1. **Cupping → YieldAdjustment auto-creation.** When a `CuppingRecord` is saved with a `yieldMeasured` that differs from the lot's `contractedYield` by more than the configured tolerance, a `YieldAdjustment` must be auto-created in `PENDIENTE`.
2. **YieldAdjustment apply → SupplierAccountEntry.** When the adjustment is applied, the supplier's account ledger must receive an entry for the delta so accounting pays the correct amount.
3. **YieldAdjustment → MateriaPrima cost.** The affected contract's materia prima cost must reflect the adjustment so the margin calculation is right.
4. **Lot ↔ MateriaPrima linkage.** The operational inventory (physical lots) and the financial inventory (MP rollup the margin calc reads) must share a model so one is derivable from the other.

---

## Results

| # | Handoff | Status | Where |
|---|---|---|---|
| 1 | Cupping → YieldAdjustment auto-create | ✅ **Plumbed** | [quality-lab/actions.ts:143-182](../src/app/(dashboard)/quality-lab/actions.ts#L143-L182) |
| 2 | YieldAdjustment apply → SupplierAccountEntry | ❌ **Broken** | [quality-lab/actions.ts:256-284](../src/app/(dashboard)/quality-lab/actions.ts#L256-L284) — status flip only |
| 3 | YieldAdjustment → MateriaPrima cost | ❌ **Broken** | No consumer anywhere in `src/lib/services/` |
| 4 | Lot ↔ MateriaPrima | ❌ **Parallel worlds** | Two inventory models with no bridge |

---

## Handoff 1 — Cupping → YieldAdjustment ✅

`createCuppingRecord` in [quality-lab/actions.ts:95-196](../src/app/(dashboard)/quality-lab/actions.ts#L95-L196) does exactly what Hector asked for. When a cupping record is saved with `yieldMeasured != null`:

1. It looks up the lot's `contractedYield`.
2. Computes `diff = |actualYield − contractedYield|`.
3. Reads the global `YieldToleranceConfig.toleranceValue` (default 0.01).
4. If `diff > tolerance`, it creates a `YieldAdjustment` in `PENDIENTE` with `priceAdjustmentPerQQ` = `(actual − contracted) × ADJUSTMENT_RATE_PER_POINT` and `totalAdjustment` = `priceAdjustmentPerQQ × lot.quantityQQ`.

This is Hector's "plum" moment: *"cuando yo ingrese mi catación... plum, ya era el ajuste."* The auto-creation works. ✅

**Sign-convention note:** a positive `actual − contracted` (e.g. 1.33 vs 1.32) produces a positive `totalAdjustment`. Whether this represents "Hope Coffee owes more" or "supplier is penalized" depends on the sign of the `ADJUSTMENT_RATE_PER_POINT` constant and the semantics the apply step attaches. This should be explicitly verified with Hector — the audit doesn't conclusively establish the business meaning.

---

## Handoff 2 — YieldAdjustment apply → SupplierAccountEntry ❌

`applyYieldAdjustment` in [quality-lab/actions.ts:256-284](../src/app/(dashboard)/quality-lab/actions.ts#L256-L284) does three things and three things only:

```ts
const updated = await prisma.yieldAdjustment.update({
  where: { id },
  data: {
    status: "APLICADO",
    appliedAt: new Date(),
    appliedByUserId: session.userId,
  },
});
await createAuditLog(...);
```

It flips the status, timestamps the action, and audit-logs. **It does not write to `SupplierAccountEntry`.** A full grep of the codebase for `supplierAccountEntry.create` confirms: the only site that creates a `SupplierAccountEntry` is [suppliers/actions.ts:61](../src/app/(dashboard)/suppliers/actions.ts#L61), which handles the inbound "bodega receipt" path and is completely unrelated to yield adjustments.

**Schema evidence the loop was planned but not wired:** `YieldAdjustment.supplierAccountEntryId` already exists as an optional FK ([schema.prisma:697-698](../prisma/schema.prisma#L697-L698)). Someone designed the schema expecting the apply step to link the adjustment back to a ledger entry. The link just never got implemented.

**Impact:** every applied yield adjustment is invisible to accounting. The supplier is paid the unadjusted amount from the original bodega receipt. If Hope Coffee expected $5,000 of price discounts from applied adjustments across a month, the supplier ledger carries $0 of that.

---

## Handoff 3 — YieldAdjustment → MateriaPrima cost ❌

A full grep for every reference to `yieldAdjustment` in `src/`:

| Location | Usage |
|---|---|
| [quality-lab/actions.ts](../src/app/(dashboard)/quality-lab/actions.ts) | CRUD (create, list, apply, reject, delete) |
| [quality-lab/adjustments/page.tsx](../src/app/(dashboard)/quality-lab/adjustments/page.tsx) | List view |
| [quality-lab/adjustments/_components/adjustment-actions.tsx](../src/app/(dashboard)/quality-lab/adjustments/_components/adjustment-actions.tsx) | Apply/reject buttons |
| [reports/actions.ts:538](../src/app/(dashboard)/reports/actions.ts#L538) | Read-only yield variance report |
| [dashboard/actions.ts:88](../src/app/(dashboard)/dashboard/actions.ts#L88) | Pending count for a dashboard badge |
| [validations/schemas.ts](../src/lib/validations/schemas.ts) | Zod schema |

**Zero references in `src/lib/services/`** — the directory that houses `calculations.ts` and `shipment-aggregation.ts`, i.e. the financial layer. The calc path never reads `YieldAdjustment.totalAdjustment`, never modifies `MateriaPrima.totalMP` in response, never subtracts a yield-adjustment line from `Shipment.utilidadBruta`.

**Impact:** even if handoff 2 were fixed, the contract margin reported in the app would still ignore the adjustment, because the margin is computed from `MateriaPrima.totalMP` (unchanged) × the proration in `recalculateShipment`. The CFO and the COO would see different numbers for the same contract.

---

## Handoff 4 — Lot ↔ MateriaPrima ❌ (parallel worlds)

Two inventory models run side-by-side without touching each other:

**Lot-world (operational):**
- [suppliers/actions.ts:48-71](../src/app/(dashboard)/suppliers/actions.ts#L48-L71) wraps `supplierAccountEntry.create` + `lot.create` in a transaction. Every bodega receipt automatically produces a Lot with `contractedYield`, `costPerQQ`, supplier, facility, and quantity.
- `CuppingRecord` references a Lot and writes `actualYield` + `cuppingScore` back to it.
- `ContractLotAllocation` ([contracts/lot-actions.ts:47-86](../src/app/(dashboard)/contracts/lot-actions.ts#L47-L86)) lets users allocate specific Lots to specific Contracts via the UI.

**MateriaPrima-world (financial):**
- `MateriaPrima` rows are created by the Excel importer ([scripts/import-excel.ts](../scripts/import-excel.ts)) directly from xlsx cells. They carry `rendimiento`, `precioPromQ`, `totalMP`.
- `MateriaPrimaAllocation` (populated for January as of 2026-04-15) links MP rows to Contracts.
- `shipment-aggregation.ts` reads `MateriaPrima.totalMP` via `prisma.materiaPrima.aggregate` and never touches Lot.

**The two models never meet.** A Lot has `supplierId` and `costPerQQ`. A MateriaPrima row has `supplierId` and `totalMP`. But there is no FK between them and no service-layer code that derives one from the other. In prod, this means:

- Hector's team sees Lot-world: real receipts, real lab measurements, pending adjustments, manual contract-to-lot allocations.
- The CFO sees MateriaPrima-world: the averaged rollup from the xlsx. What the dashboard margin is based on.
- The two views of the same coffee are never reconciled.

Fixing this properly is an architectural refactor: `MateriaPrima` should become a computed view over `ContractLotAllocation × Lot × CuppingRecord × YieldAdjustment`, not a separately-imported table. The Excel importer would stop creating MP rows directly and instead populate Lots + allocations that the MP view aggregates. **Out of scope for this audit's fix** — it's its own PR, probably several days of work, touching the importer and the aggregation layer.

---

## Business impact

Right now, every time Hector flags a yield variance:

1. A `YieldAdjustment` row is auto-created with the correct delta. ✅
2. Someone applies it and the status goes `PENDIENTE → APLICADO`. ✅ (cosmetic)
3. **Nothing else happens.**
   - Supplier is paid the unadjusted amount.
   - Contract margin stays at the original figure.
   - CFO reports are wrong by the adjustment amount.

Over 57 containers (current export volume per the CFO walkthrough), even modest rate-of-variance produces material drift between reported and actual margins. This is exactly the kind of "slow leak" that stays invisible until someone reconciles against a bank statement.

---

## Fix scope for this audit's follow-up commit

The minimum fix that closes the loop without blocking on the Handoff 4 refactor:

- **Handoff 2**: `applyYieldAdjustment` creates a `SupplierAccountEntry` of type "adjustment" in the same transaction as the status flip. The new entry:
  - Same `supplierId` as the original entry (looked up via `yieldAdjustment.cuppingRecord.lot.supplierId`).
  - Same `lotId` so the link is preserved.
  - Same `facilityId` if the original entry had one.
  - `orderCode = "ADJ-{yieldAdjustmentId.slice(0,8)}"` to distinguish adjustment entries from regular receipts.
  - `pergamino = 0` (no physical pergamino moves — this is a pure price delta).
  - `precio = 0`, `total = totalAdjustment`.
  - `date = new Date()`.
  - `YieldAdjustment.supplierAccountEntryId` set to the new entry's id so the loop is bidirectionally traceable.

- **Handoff 3**: best-effort. When `applyYieldAdjustment` runs, try to resolve the chain `Lot → ContractLotAllocation → Contract → MateriaPrimaAllocation → MateriaPrima`. If the chain resolves, update the MP row's `totalMP` by the adjustment amount and re-run `recalculateShipment` for the affected shipment. If it doesn't resolve (no `ContractLotAllocation` for the lot, or the contract has no `MateriaPrimaAllocation` yet), log a WARN in the audit log and skip the MP update. The adjustment still shows up in the supplier ledger via Handoff 2; accounting can trace it.

- **Handoff 4**: **Not in scope.** Documented here and in the parked-items list as a future architectural refactor.

---

## Verification checklist for the fix

After implementing the fix above, the following must be true:

- [ ] Applying a pending `YieldAdjustment` creates exactly one new `SupplierAccountEntry` in the same transaction.
- [ ] The new entry's `total` equals the `yieldAdjustment.totalAdjustment`.
- [ ] The new entry's `supplierId` matches the original lot's supplier.
- [ ] `YieldAdjustment.supplierAccountEntryId` is set to the new entry's id (bidirectional link).
- [ ] Rejecting an adjustment does NOT create any `SupplierAccountEntry`.
- [ ] If the lot has a `ContractLotAllocation`, the linked contract's MP row `totalMP` is updated and `recalculateShipment` is called on the affected shipment.
- [ ] If the lot has NO `ContractLotAllocation`, the apply still succeeds but logs a WARN and skips the MP update.
- [ ] All three mutations (status flip, SupplierAccountEntry create, MP update) are wrapped in a single Prisma transaction so the three either all happen or all roll back.

---

*End of audit. Follow-up commit closes Handoffs 2 and 3.*
