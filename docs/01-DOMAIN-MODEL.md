# Guide 01 — Domain Model & Business Logic

> **Audience**: Developer building or extending CafeMargen  
> **Goal**: Understand every calculation, entity relationship, and business rule extracted from the Excel file so you never need to open it again.

---

## The Coffee Export Lifecycle

CafeMargen tracks the full lifecycle of Guatemalan specialty coffee from farm to international buyer. Understanding this flow is essential — every screen, calculation, and data relationship maps to a stage in this pipeline:

```
FARM (Finca)                    Raw coffee cherries grown at origin
    │
    ▼
PURCHASE (Compra)               Buy parchment coffee (pergamino) from farms/intermediaries
    │                           Track: supplier, quintales, price/qq, logistics costs
    ▼
PROCESSING (Beneficio)          Mill parchment → gold coffee (oro)
    │                           Key metric: RENDIMIENTO (yield factor, ~1.32)
    │                           1 quintal pergamino → ~0.758 quintales oro
    ▼
QUALITY (Catación)              Cup and score the coffee
    │                           PUNTAJE: 80-85+ specialty grade
    ▼
CONTRACT (Venta)                Sell to international buyers
    │                           Price = NY C-market (bolsa) + differential
    │                           Clients: Serengetti, Swiss Water, Opal, Onyx, Atlas, Stonex
    ▼
SHIPMENT (Embarque)             Group contracts into containers (20-ft)
    │                           ~275 sacos 69kg per container
    │                           Monthly grouping: Enero, Febrero, etc.
    ▼
EXPORT (Exportación)            Physical export with all regulatory/logistics costs
    │                           Trilla, yute, grain pro, ANACAFE, OIRSA, fumigation, etc.
    ▼
BILLING (Facturación)           Invoice buyer, convert to Quetzales
    │                           Exchange rate (tipo de cambio): ~7.65 GTQ/USD
    ▼
MARGIN (Margen)                 Calculate gross profit
                                Revenue - Raw Material - Export Costs - Commissions + By-products
```

---

## Entity Relationship Map

```
Client ──1:N──► Contract ◄──N:1── Shipment
                    │                 │
                    │                 ├──1:N──► MateriaPrima ──► Allocation
                    │                 │
                    │                 └──1:N──► Subproducto
                    │
                    └──N:1──► MateriaPrimaAllocation

Supplier ──1:N──► PurchaseOrder
Supplier ──1:N──► SupplierAccountEntry

ExportCostConfig ──1:N──► Shipment
ExchangeRate (standalone, time-ranged)
Farm (standalone)
```

---

## Calculation Reference

### 1. Contract Line Calculations

These are the core formulas that appear in every contract row across all sheets. The Excel uses columns E through Q with slight variations per sheet.

**Unit Conversion**
```
sacos_46kg = sacos_69kg × 1.5
```
A 69kg sack of parchment coffee converts to 1.5 sacks of 46kg (100 lbs) for export billing purposes. This is the fundamental unit conversion in the entire system.

**Pricing**
```
precio_bolsa_dif = precio_bolsa + diferencial
```
The sale price per 100-lb sack is the NY C-market futures price (bolsa) plus a differential that reflects the coffee's quality premium or discount. For fixed-price contracts, `precio_bolsa` is the agreed price and `diferencial = 0`.

**Billing**
```
facturacion_lbs = sacos_46kg × precio_bolsa_dif
facturacion_kgs = facturacion_lbs × 1.01411
```
The kilo conversion factor (`1.01411`) accounts for the lb-to-kg adjustment plus small contractual additions. This was reverse-engineered from the Excel — every sheet uses it consistently.

**Profit Waterfall**
```
gastos_exportacion    = gastos_per_saco × sacos_69kg
utilidad_sin_gastos   = facturacion_kgs − gastos_exportacion
costo_financiero      = (varies by contract)
utilidad_sin_costo_f  = utilidad_sin_gastos − costo_financiero
total_pago_qtz        = utilidad_sin_costo_f × tipo_cambio
```

**Financial Cost**: This varies. Some contracts compute it as a percentage of billing; others use flat amounts. The Excel is inconsistent. In CafeMargen, we store it as a computed field with an optional manual override. Default computation: `(facturacion_kgs / sacos_46kg) × (some factor per contract)`. When in doubt, allow manual entry.

### 2. Materia Prima (Raw Material Cost)

Each shipment has N materia prima entries representing the coffee lots purchased to fulfill the contracts.

```
pergamino = oro × rendimiento
total_mp  = pergamino × precio_promedio_quetzales
```

Where:
- `oro` = quantity in 46kg sacks (gold/green coffee)
- `rendimiento` = yield factor from parchment to gold (typically 1.30–1.33)
- `pergamino` = equivalent parchment quantity
- `precio_promedio_quetzales` = average purchase price per quintal of pergamino

**Supplier attribution**: Each MP entry is tagged with a supplier note like "Comprado / José David Guerra" or "Comprado / Kfinos" or "NO COMPRADO" (for future/uncommitted purchases).

### 3. Subproducto (By-Product Revenue)

When milling pergamino into gold coffee, you get by-products (low-grade beans, husks). These are sold separately.

```
total_oro       = contenedores × oro_per_contenedor    (typically 25 qq per container)
total_pergamino = total_oro × precio_sin_iva           (typically Q2,000/qq)
```

Note: `contenedores` can be fractional (e.g., 0.6545 in the Sucafina sheet), representing partial containers.

### 4. Shipment P&L (Gross Margin)

The bottom section of each monthly sheet consolidates everything into a P&L:

```
INGRESOS:
  + total_pago_qtz          (sum of all contract totals)
  + total_subproducto        (by-product revenue)

COSTOS:
  − total_materia_prima      (sum of all MP lots)
  − total_comision           (buy/sell commission)

UTILIDAD BRUTA = ingresos − costos
MARGEN BRUTO   = utilidad_bruta / total_pago_qtz
```

**Observed margins** from the Excel:
| Shipment    | Margin   | Notes                          |
| ----------- | -------- | ------------------------------ |
| SERENGETTI  | 7.13%    | 4 containers, organic          |
| Enero       | 3.50%    | 3 containers, lowest margin    |
| Febrero     | 10.90%   | 2 containers                   |
| Abril       | 8.91%    | 2 containers, Stonex           |
| Mayo (Onyx) | 9.45%    | 1 container, fixed price       |
| Onyx (sep.) | 13.70%   | 1 container, highest margin    |
| Sucafina    | 12.45%   | Under negotiation              |
| Negociacion | 5.16%    | Atlas, Danilandia              |

### 5. Purchase Orders

Raw material inventory management (Hoja3):

```
total_cafe      = quintales_pergamino × precio_por_qq
total_flete     = quintales × flete_por_qq
costo_acumulado = total_cafe + total_flete + seguridad + seguro + cadena + cargas + descargas
precio_promedio = costo_acumulado / quintales
```

### 6. Export Cost Breakdown

Per-container export costs (Hoja3, bottom section). These are itemized and sum to `gastos_exportacion`:

| Item                | Typical Value | Unit        |
| ------------------- | ------------- | ----------- |
| Trilla              | $7/qq         | Per quintal |
| Sacos yute          | Q1,300        | Per lot     |
| Estampado           | Q500          | Per lot     |
| Bolsa Grain Pro     | Q5,000        | Per lot     |
| Fito sanitario      | Q50           | Per lot     |
| Impuesto ANACAFE 1  | Q600          | Per lot     |
| Impuesto ANACAFE 2  | Q500          | Per lot     |
| Inspección OIRSA    | Q300          | Per lot     |
| Fumigación          | Q400          | Per lot     |
| Emisión documentos  | Q1,200        | Per lot     |
| Flete a puerto      | Q2,000        | Per lot     |
| Seguro              | Q230          | Per lot     |
| Custodio            | Q450          | Per lot     |
| Agente aduanal      | Q34,619       | Per lot     |

### 7. Farm Financing

Simple loan calculation for farm operations:

```
total_usd     = total_quetzales / tipo_cambio
nuevo_total   = total_usd × (1 + aumento_porcentaje)
total_prestamo = nuevo_total × porcentaje_prestamo
```

---

## Contract Status State Machine

```
NEGOCIACION ──► CONFIRMADO ──► FIJADO ──► EMBARCADO ──► LIQUIDADO
                    │                                       │
                    └──► NO_FIJADO ──► FIJADO ──────────────┘
                    │
                    └──► CANCELADO
```

- **NEGOCIACION**: Terms being discussed. No price, no commitment.
- **CONFIRMADO**: Client agreed to terms. May or may not have fixed price.
- **FIJADO**: Price locked to NY futures position. Fully committed.
- **NO_FIJADO**: Confirmed but price floating with market.
- **EMBARCADO**: Coffee physically shipped. Container on water.
- **LIQUIDADO**: Payment received. Contract closed.
- **CANCELADO**: Deal fell through. Archived.

**Business rules**:
- Only `FIJADO` contracts contribute to the P&L with real margin numbers.
- `NO_FIJADO` contracts show projected margins based on current bolsa price.
- `NEGOCIACION` contracts are included in pipeline/forecast views only.
- Status changes must be audit-logged with timestamp and user.

---

## Key Business Constants

| Constant            | Value   | Source                       | Where Used           |
| ------------------- | ------- | ---------------------------- | -------------------- |
| Saco conversion     | 1.5     | 69kg → 46kg                  | Every contract       |
| Kilo factor         | 1.01411 | Lbs → kgs billing adjustment | Every contract       |
| Rendimiento (avg)   | 1.32    | Parchment → gold yield       | Materia prima        |
| Tipo cambio         | 7.65    | GTQ/USD (manual)             | Every QTZ conversion |
| Oro per container   | 25 qq   | By-product estimate          | Subproducto          |
| Precio subproducto  | Q2,000  | By-product sale price        | Subproducto          |
| Gastos per saco     | 20–23   | Varies by shipment           | Export costs         |

---

## Decimal Precision Rules

All monetary calculations use `Decimal.js` with 20-digit precision and ROUND_HALF_UP.

**Never** use JavaScript `number` for:
- Any USD or GTQ amount
- Exchange rates
- Yield factors (rendimiento)
- Percentages used in multiplication

**Safe to use `number` for**:
- Sack counts (integer)
- Cupping scores (integer)
- Container counts (small integers or simple fractions)
- Array indices, pagination, UI state

The Prisma schema uses `@db.Decimal(14, 2)` for amounts and `@db.Decimal(10, 4)` for rates, ensuring the database also preserves precision.
