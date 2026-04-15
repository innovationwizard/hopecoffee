// ============================================================================
// Phase C — January SSOT ↔ DB reconciliation (one-shot, idempotent)
// ============================================================================
// Updates the four January contracts + their MP rows + allocations so the DB
// matches Enero.xlsx cell-for-cell. Safe to run multiple times.
//
// What it does:
//   1. Updates each January MP row's (pergamino, totalMP) to the post-Friday /
//      post-Q3 SSOT values.
//   2. Creates the missing MateriaPrimaAllocation rows linking each contract
//      to its MP row (1:1 for January).
//   3. Sets Contract.exportingEntity:
//        Bloque 1 (P30172 / P40028 / P40022) → EXPORTADORA
//        Bloque 2 (P40129)                   → FINCA_DANILANDIA
//   4. Sets Contract.facturacionKgsOverride = 171600 + overrideReason on P40129
//      (legal-document exception per RECONCILIATION_PLAN §9.3).
//   5. Sets Contract.isrAmount = 65764.16 on P40129 (SSOT V33 literal).
//   6. Syncs Contract.rendimiento with MateriaPrima.rendimiento (deprecated
//      column, kept for display consistency until a future cleanup).
//   7. Recomputes each contract's derived fields (facturacionLbs/Kgs,
//      gastosExport, utilidadSinGE, costoFinanciero, utilidadSinCF,
//      totalPagoQTZ) by calling calculateContract with the per-contract
//      montoCredito = own MP totalMP (matches SSOT S_i formula).
//   8. Calls recalculateShipment() on both January shipments.
//
// Usage:  npx tsx scripts/phase-c-january-reconcile.ts
// ============================================================================

import Decimal from "decimal.js";
import { PrismaClient, Prisma } from "@prisma/client";
import { calculateContract } from "../src/lib/services/calculations";
import { recalculateShipment } from "../src/lib/services/shipment-aggregation";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// SSOT targets — matches MP rows by (shipmentName, punteo, supplierNote substring)
// because the existing MP rows do not carry an explicit contract FK yet.
// ---------------------------------------------------------------------------

type Target = {
  contractNumber: string;
  shipmentName: string;
  exportingEntity: "EXPORTADORA" | "FINCA_DANILANDIA";
  /**
   * Per-contract export cost rate (USD per quintal/100lb/46kg saco).
   * SSOT: Block 1 = $20/qq, Block 2 (P40129) = $23/qq.
   * Persisted as Contract.gastosPerSaco (overrides the shipment's
   * exportCostConfig which defaults to 23).
   */
  gastosPerSaco: string;
  isrAmount: string | null; // QTZ
  facturacionKgsOverride: string | null;
  overrideReason: string | null;
  mp: {
    matchPunteo: number;
    matchSupplierContains: string;
    oro: string;
    rendimiento: string;
    pergamino: string;
    precioPromQ: string;
    totalMP: string;
  };
};

const TARGETS: Target[] = [
  {
    contractNumber: "P30172",
    shipmentName: "Enero 2026 - Bloque 1",
    exportingEntity: "EXPORTADORA",
    gastosPerSaco: "20",
    isrAmount: null,
    facturacionKgsOverride: null,
    overrideReason: null,
    mp: {
      matchPunteo: 82,
      matchSupplierContains: "José David",
      oro: "435",
      rendimiento: "1.3197",
      pergamino: "574.0695",
      precioPromQ: "1777.25",
      totalMP: "1020265.0170375",
    },
  },
  {
    contractNumber: "P40028",
    shipmentName: "Enero 2026 - Bloque 1",
    exportingEntity: "EXPORTADORA",
    gastosPerSaco: "20",
    isrAmount: null,
    facturacionKgsOverride: null,
    overrideReason: null,
    mp: {
      matchPunteo: 82,
      matchSupplierContains: "José David",
      oro: "412.5",
      rendimiento: "1.3245",
      pergamino: "546.35625",
      precioPromQ: "1777.25",
      totalMP: "971011.6517",
    },
  },
  {
    contractNumber: "P40022",
    shipmentName: "Enero 2026 - Bloque 1",
    exportingEntity: "EXPORTADORA",
    gastosPerSaco: "20",
    isrAmount: null,
    facturacionKgsOverride: null,
    overrideReason: null,
    mp: {
      matchPunteo: 83,
      matchSupplierContains: "finos",
      oro: "412.5",
      rendimiento: "1.3200",
      pergamino: "544.5",
      precioPromQ: "1777.25",
      totalMP: "967712.625",
    },
  },
  {
    contractNumber: "P40129",
    shipmentName: "Enero 2026 - Bloque 2",
    exportingEntity: "FINCA_DANILANDIA",
    gastosPerSaco: "23",
    isrAmount: "65764.16",
    facturacionKgsOverride: "171600.00",
    overrideReason:
      "Legal contract drafted at libras value; kg uplift not applied. January 2026.",
    mp: {
      matchPunteo: 82,
      matchSupplierContains: "José David",
      oro: "412.5",
      rendimiento: "1.3226",
      pergamino: "545.5725",
      precioPromQ: "1777.25",
      totalMP: "969618.725625",
    },
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=".repeat(80));
  console.log(" Phase C — January reconciliation");
  console.log("=".repeat(80));

  const shipmentIdsToRecalculate = new Set<string>();
  let mutations = 0;

  await prisma.$transaction(
    async (tx) => {
      for (const t of TARGETS) {
        console.log(`\n— ${t.contractNumber}`);

        const shipment = await tx.shipment.findFirstOrThrow({
          where: { name: t.shipmentName, year: 2026, month: 1 },
        });
        shipmentIdsToRecalculate.add(shipment.id);

        const contract = await tx.contract.findUniqueOrThrow({
          where: { contractNumber: t.contractNumber },
        });

        // Find the matching MP row (by punteo + supplier substring).
        const mpCandidates = await tx.materiaPrima.findMany({
          where: {
            shipmentId: shipment.id,
            punteo: t.mp.matchPunteo,
          },
        });
        const mpRow = mpCandidates.find((m) =>
          (m.supplierNote ?? "").includes(t.mp.matchSupplierContains)
        );
        if (!mpRow) {
          throw new Error(
            `No MP row matched for ${t.contractNumber} ` +
              `(punteo=${t.mp.matchPunteo}, supplier~="${t.mp.matchSupplierContains}") ` +
              `in ${t.shipmentName}. Candidates: ${mpCandidates
                .map((m) => `#${m.id} punteo=${m.punteo} note="${m.supplierNote}"`)
                .join(" | ")}`
          );
        }

        // Disambiguate the two "José David" rows in Bloque 1 by oro.
        if (
          t.mp.matchSupplierContains === "José David" &&
          mpCandidates.filter((m) =>
            (m.supplierNote ?? "").includes("José David")
          ).length > 1
        ) {
          const byOro = mpCandidates
            .filter((m) => (m.supplierNote ?? "").includes("José David"))
            .find((m) => new Decimal(m.oro.toString()).eq(t.mp.oro));
          if (!byOro) {
            throw new Error(
              `Multiple "José David" MP rows for ${t.contractNumber}; none with oro=${t.mp.oro}`
            );
          }
          Object.assign(mpRow, byOro); // rebind to disambiguated row
          (mpRow as { id: string }).id = byOro.id;
        }

        // 1. Update MP row values
        const mpBefore = {
          pergamino: mpRow.pergamino.toString(),
          totalMP: mpRow.totalMP.toString(),
          rendimiento: mpRow.rendimiento.toString(),
        };
        await tx.materiaPrima.update({
          where: { id: mpRow.id },
          data: {
            rendimiento: new Prisma.Decimal(t.mp.rendimiento),
            pergamino: new Prisma.Decimal(t.mp.pergamino),
            precioPromQ: new Prisma.Decimal(t.mp.precioPromQ),
            totalMP: new Prisma.Decimal(t.mp.totalMP),
          },
        });
        console.log(
          `  MP row ${mpRow.id.slice(0, 8)}…  pergamino ${mpBefore.pergamino}→${t.mp.pergamino}  totalMP ${mpBefore.totalMP}→${t.mp.totalMP}`
        );
        mutations++;

        // 2. Upsert MateriaPrimaAllocation (1:1 for January)
        const alloc = await tx.materiaPrimaAllocation.findFirst({
          where: { materiaPrimaId: mpRow.id, contractId: contract.id },
        });
        if (!alloc) {
          await tx.materiaPrimaAllocation.create({
            data: {
              materiaPrimaId: mpRow.id,
              contractId: contract.id,
              quintalesAllocated: null, // null = full allocation
            },
          });
          console.log(`  allocation created  ${contract.id.slice(0, 8)}… ↔ MP`);
          mutations++;
        } else {
          console.log(`  allocation exists (idempotent)`);
        }

        // 3-5. Update contract scalar fields
        const contractScalarUpdate: Prisma.ContractUpdateInput = {
          exportingEntity: t.exportingEntity,
          rendimiento: new Prisma.Decimal(t.mp.rendimiento),
          gastosPerSaco: new Prisma.Decimal(t.gastosPerSaco),
        };
        if (t.facturacionKgsOverride != null) {
          contractScalarUpdate.facturacionKgsOverride = new Prisma.Decimal(
            t.facturacionKgsOverride
          );
          contractScalarUpdate.overrideReason = t.overrideReason;
        } else {
          contractScalarUpdate.facturacionKgsOverride = null;
          contractScalarUpdate.overrideReason = null;
        }
        if (t.isrAmount != null) {
          contractScalarUpdate.isrAmount = new Prisma.Decimal(t.isrAmount);
        }
        await tx.contract.update({
          where: { id: contract.id },
          data: contractScalarUpdate,
        });
        console.log(
          `  contract entity=${t.exportingEntity}` +
            (t.facturacionKgsOverride ? `  override=${t.facturacionKgsOverride}` : "") +
            (t.isrAmount ? `  isrAmount=${t.isrAmount}` : "")
        );
        mutations++;

        // 6-7. Recompute and persist contract-level derived fields.
        // Use per-contract montoCredito = own MP totalMP so S_i matches SSOT:
        //   S_i = ((totalMP_i × 0.08 / 12) × 2) / tipoCambio
        const tc = Number(contract.tipoCambio) || 7.65;

        const calc = calculateContract({
          sacos69kg: Number(contract.sacos69kg),
          puntaje: contract.puntaje,
          precioBolsa: Number(contract.precioBolsa ?? 0),
          diferencial: Number(contract.diferencial ?? 0),
          gastosExportPerSaco: Number(t.gastosPerSaco),
          tipoCambio: tc,
          montoCredito: Number(t.mp.totalMP),
          facturacionKgsOverride: t.facturacionKgsOverride
            ? Number(t.facturacionKgsOverride)
            : undefined,
        });

        await tx.contract.update({
          where: { id: contract.id },
          data: {
            facturacionLbs: calc.facturacionLbs.toNumber(),
            facturacionKgs: calc.facturacionKgs.toNumber(),
            gastosExport: calc.gastosExportacion.toNumber(),
            utilidadSinGE: calc.utilidadSinGastosExport.toNumber(),
            costoFinanciero: calc.costoFinanciero.toNumber(),
            utilidadSinCF: calc.utilidadSinCostoFinanciero.toNumber(),
            totalPagoQTZ: calc.totalPagoQTZ.toNumber(),
            computedAt: new Date(),
          },
        });
        console.log(
          `  derived:  O=${calc.facturacionKgs.toFixed(2)}  S=${calc.costoFinanciero.toFixed(2)}  V=${calc.totalPagoQTZ.toFixed(2)}`
        );
        mutations++;
      }
    },
    { timeout: 60_000 }
  );

  // 8. Recompute shipment aggregates (outside tx — uses global prisma client)
  console.log("\n— Shipment re-aggregation");
  for (const sid of shipmentIdsToRecalculate) {
    await recalculateShipment(sid);
    console.log(`  ${sid.slice(0, 8)}… ✓`);
  }

  console.log("\n" + "=".repeat(80));
  console.log(` Done. ${mutations} mutations across ${TARGETS.length} contracts.`);
  console.log("=".repeat(80));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
