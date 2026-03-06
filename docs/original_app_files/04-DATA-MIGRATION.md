# Guide 04 — Data Migration & Verification

> **Goal**: Import every row from `Control_Contratos_y_Margenes.xlsx` into HOPE COFFEE with zero data loss, then verify every computed field matches the Excel output exactly.

---

## Migration Strategy

The Excel file is not a clean database export — it's a working spreadsheet with merged cells, formatting-as-data, inconsistent column offsets per sheet, and manual overrides. The import must be surgical.

### Approach: Hybrid (Automated + Manual Verification)

1. **Automated import** handles the 80% — structured contract rows, materia prima tables, supplier accounts, farm data.
2. **Manual review** handles the 20% — edge cases, overrides, broken references, notes embedded in formatting.
3. **Reconciliation report** compares imported totals against Excel sheet totals.

---

## Sheet-by-Sheet Import Plan

### Tier 1: Direct Import (Structured Data)

| Sheet                 | Records | Strategy                                    |
| --------------------- | ------- | ------------------------------------------- |
| SERENGETTI            | 4       | Parse contract rows 8–11, MP rows 14–17     |
| SUCAFINA SPECIALTY    | 1       | Parse contract row 8, MP row 11             |
| onyx                  | 1       | Parse contract row 8, MP row 12             |
| Enero                 | 3+4     | Parse contracts rows 8–10, MP rows 14–17    |
| Febrero               | 2+2     | Parse contracts rows 8–9, MP rows 13–14     |
| Marzo                 | 6+7     | Parse contracts rows 8–13, MP rows 17–23    |
| Abril                 | 2+2     | Parse contracts rows 8–9, MP rows 13–14     |
| Mayo                  | 1+1     | Parse contract row 8, MP row 12 (section 1) |
| Negociacion           | 2+2     | Parse contracts rows 10–11, MP rows 15–16   |
| ESTADO CUENTA KFINOS  | ~60     | Parse 3 parallel column blocks              |
| Hoja3 (Inventario)    | 2       | Parse PO rows 4–5                           |
| Hoja1 (Órdenes)       | 4       | Parse rows 4–7                              |
| Hoja2 (Fincas)        | 2       | Parse rows 6–7                              |

### Tier 2: Skip (Broken or Computed)

| Sheet    | Reason                                                   |
| -------- | -------------------------------------------------------- |
| PROMEDIO | All `#REF!` errors — will be auto-computed in dashboard  |

### Tier 3: Partial Import (Multiple Sections)

Mayo and Negociacion have multiple sub-sections (confirmed + negotiation). Each section is essentially a separate shipment.

---

## Column Mapping Reference

Each sheet has slightly different column offsets. This reference documents the EXACT column indices (0-based) for each sheet.

### Client Sheets (SERENGETTI, SUCAFINA, onyx)

**SERENGETTI** (18 cols):
```
Col  1: CLIENTE
Col  2: CONTRATO
Col  3: PUNTAJE
Col  4: SACOS 69KG
Col  5: SACOS 46KG (computed)
Col  6: BOLSA
Col  7: DIFERENCIAL
Col  8: BOLSA+DIF (computed)
Col  9: FACTURACION LIBRAS (computed)
Col 10: FACTURACION KILOS (computed)
Col 11: GASTOS EXPORTACION
Col 12: UTILIDAD SIN GE (computed)
Col 13: COSTO FINANCIERO
Col 14: UTILIDAD SIN CF (computed)
Col 15: TIPO CAMBIO
Col 16: TOTAL PAGO (computed)
```

**SUCAFINA** — Same structure but offset by -1 (no CLIENTE column, just CONTRATO at col 1).

### Monthly Sheets (Enero–Mayo)

**Enero** (23 cols, wider):
```
Col  1: CLIENTE
Col  2: CONTRATO
Col  3: ESTATUS
Col  4: POSICION NY
Col  5: EMBARQUE
Col  6: LOTE
Col  7: PUNTAJE
Col  8: SACOS 69KG
Col  9: SACOS 46KG
Col 10: BOLSA
Col 11: DIFERENCIAL
Col 12: BOLSA+DIF
Col 13: FACTURACION LBS
Col 14: FACTURACION KGS
Col 15: GASTOS EXPORT PER SACO
Col 16: GASTOS EXPORTACION
Col 17: UTILIDAD SIN GE
Col 18: COSTO FINANCIERO
Col 19: UTILIDAD SIN CF
Col 20: TIPO CAMBIO
Col 21: TOTAL PAGO
```

**Febrero–Negociacion** (19 cols):
```
Col  1: CLIENTE
Col  2: ESTATUS
Col  3: CONTRATO
Col  4: PUNTAJE
Col  5: SACOS 69KG
Col  6: SACOS 46KG
Col  7: BOLSA
Col  8: DIFERENCIAL
Col  9: BOLSA+DIF
Col 10: FACTURACION LBS
Col 11: FACTURACION KGS
Col 12: GASTOS EXPORTACION
Col 13: UTILIDAD SIN GE
Col 14: COSTO FINANCIERO
Col 15: UTILIDAD SIN CF
Col 16: TIPO CAMBIO
Col 17: TOTAL PAGO
```

> **Lesson**: Column indices vary per sheet. The import service must use per-sheet config objects, not a universal parser.

---

## Verification Protocol

After import, run this verification against each sheet's known totals.

### Step 1: Row Count Verification

```sql
-- Expected counts from Excel analysis
SELECT 
  'contracts' as entity, COUNT(*) as actual,
  CASE 
    WHEN COUNT(*) >= 22 THEN '✅ PASS'  -- ~22 unique contract rows
    ELSE '❌ FAIL'
  END as status
FROM contracts

UNION ALL

SELECT 
  'materia_prima', COUNT(*),
  CASE WHEN COUNT(*) >= 20 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM materia_prima

UNION ALL

SELECT 
  'supplier_entries', COUNT(*),
  CASE WHEN COUNT(*) >= 55 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM supplier_account_entries

UNION ALL

SELECT
  'purchase_orders', COUNT(*),
  CASE WHEN COUNT(*) >= 2 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM purchase_orders;
```

### Step 2: Aggregate Verification

Compare key totals against Excel known values:

| Metric                          | Excel Value      | SQL Query                                           |
| ------------------------------- | ---------------- | --------------------------------------------------- |
| SERENGETTI total pago QTZ       | Q4,598,377.51    | `SUM(total_pago_qtz) WHERE shipment='SERENGETTI'`   |
| Enero utilidad bruta QTZ        | Q130,624.99      | Shipment margin calc for Enero                       |
| Febrero utilidad bruta QTZ      | Q276,459.46      | Shipment margin calc for Febrero                     |
| K-Finos OC4 total               | Q1,166,704.35    | `SUM(total) WHERE supplier='KFI' AND order='OC4'`   |
| Brisas total préstamo           | Q1,088,110.94    | Farm record for BRISAS                               |
| Total pergamino (Hoja1)         | 2,725 qq         | `SUM(quintales) FROM purchase_orders`                |

### Step 3: Cell-Level Spot Checks

Pick 5 random contract rows and verify EVERY computed field:

```typescript
// Verification script (run as: npx tsx scripts/verify-import.ts)
import { prisma } from "../src/lib/db";
import { calculateContract } from "../src/lib/services/calculations";

async function verify() {
  const contracts = await prisma.contract.findMany({
    where: { contractNumber: { in: ["P40129", "P40028", "P30172", "P40022"] } },
  });

  const expected = {
    P40129: { facturacionLbs: 171600, totalPagoQTZ: 1243263.76 },
    P40028: { facturacionLbs: 150562.5, totalPagoQTZ: 1080962.60 },
    P30172: { facturacionLbs: 159637.5, totalPagoQTZ: 1151366.34 },
    P40022: { facturacionLbs: 155925, totalPagoQTZ: 1122784.81 },
  };

  for (const contract of contracts) {
    const exp = expected[contract.contractNumber as keyof typeof expected];
    if (!exp) continue;

    const actual = contract.facturacionLbs?.toNumber() ?? 0;
    const diff = Math.abs(actual - exp.facturacionLbs);
    
    console.log(
      `${contract.contractNumber}: ` +
      `facturacionLbs expected=${exp.facturacionLbs} actual=${actual} ` +
      `diff=${diff.toFixed(2)} ${diff < 1 ? "✅" : "❌"}`
    );
  }
}

verify().then(() => process.exit(0));
```

### Step 4: Margin Reconciliation

For each shipment, compare computed margin against Excel's stated margin:

| Shipment        | Excel Margin | Tolerance | Notes                        |
| --------------- | ------------ | --------- | ---------------------------- |
| SERENGETTI      | 7.13%        | ±0.05%    | 4 contracts, clean data      |
| Enero           | 3.50%        | ±0.05%    | 3 contracts                  |
| Febrero         | 10.90%       | ±0.10%    | Some cells may have overrides|
| Marzo           | varies       | ±0.10%    | 6 contracts, most complex    |
| Abril           | 8.91%        | ±0.05%    | 2 contracts                  |
| Mayo (section1) | 9.45%        | ±0.05%    | 1 contract                   |
| Onyx            | 13.70%       | ±0.05%    | 1 contract                   |
| Sucafina        | 12.45%       | ±0.10%    | Under negotiation            |
| Negociacion     | 5.16%        | ±0.10%    | Atlas, projected             |

> **Tolerance**: Small discrepancies (<0.1%) are expected due to Excel's floating-point arithmetic vs. our Decimal.js precision. Anything >0.5% indicates a formula mismatch that needs investigation.

---

## Known Data Quirks

Issues discovered during Excel analysis that the import must handle:

1. **Contract "No asignado"**: Marzo and Abril have contracts with "No asigando" (typo in Excel) as the contract number. Generate synthetic IDs: `MAR-2026-01`, `ABR-2026-01`, etc.

2. **Fractional containers**: Sucafina has 0.6545 containers in the subproducto section. This is valid — it represents a partial container's worth of by-product.

3. **Mixed sections in Mayo**: The sheet has two separate shipment blocks (rows 3–16 and rows 21+). Import as two separate shipments: "Mayo 2026 (Onyx)" and "Mayo 2026 (Orgánico)".

4. **PROMEDIO #REF! errors**: Skip entirely. The dashboard will auto-compute these from live data.

5. **K-Finos OC8 price difference**: OC8 entries use Q1,965/qq while OC4/OC5 use Q2,065/qq. This is intentional — different quality/grade.

6. **Financial cost inconsistency**: Some contract rows show 0 for costo_financiero while the shipment totals show a non-zero aggregate. The shipment-level cost is computed differently (possibly amortized across contracts).

7. **Hoja3 export cost total (Q34,619.375 for agente aduanal)**: This seems like a bundled total, not a per-item cost. Verify with the business user whether this is a single line item or needs to be broken down.

---

## Rollback Plan

If the import produces incorrect data:

```bash
# Nuclear option: reset DB and re-import
npx prisma migrate reset

# Surgical option: delete imported data only
npx tsx scripts/rollback-import.ts
```

The rollback script should delete in reverse dependency order:
1. `supplier_account_entries`
2. `materia_prima_allocations`
3. `subproductos`
4. `materia_prima`
5. `contracts`
6. `shipments`
7. `purchase_orders`
8. `farms`
9. Keep: `users`, `exchange_rates`, `export_cost_configs`, `clients`, `suppliers`
