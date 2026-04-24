# January 2026 — Enero-sheet vs. Prod DB divergence report

**Generated:** 2026-04-24T02:49:59.098Z
**Scope:** Jan 2026 only, read-only, flag-only.
**Directive 1 + 8:** January prod DB is frozen. This report documents differences only. **Do not apply corrections from this report via ETL** — apply via the app per user direction.

**Sheet rows detected in Enero:** 4
**DB contracts for Jan 2026:** 4
**Divergences found:** 20

## Divergences

| Contrato | Field | Sheet value | DB value | Δ (sheet − db) |
|----------|-------|-------------|----------|-----------------|
| P30172 | gastosPerSaco | 14.120000000000001 | 20 | -5.880000 |
| P30172 | gastosExport | 6142.200000000001 | 8700 | -2557.800000 |
| P30172 | costoFinanciero | 1783.3325187450982 | 1778.24 | 5.092519 |
| P30172 | utilidadSinCF | 162795.8255012549 | 160243.12 | 2552.705501 |
| P30172 | totalPagoQTZ | 1245388.0650846001 | 1225859.86 | 19528.205085 |
| P40022 | gastosPerSaco | 23 | 20 | 3.000000 |
| P40022 | gastosExport | 9487.5 | 8250 | 1237.500000 |
| P40022 | costoFinanciero | 1691.4756078431371 | 1686.65 | 4.825608 |
| P40022 | utilidadSinCF | 150293.64449215686 | 151535.98 | -1242.335508 |
| P40022 | totalPagoQTZ | 1149746.380365 | 1159250.21 | -9503.829635 |
| P40028 | gastosPerSaco | 14.120000000000001 | 20 | -5.880000 |
| P40028 | gastosExport | 5824.5 | 8250 | -2425.500000 |
| P40028 | costoFinanciero | 1697.25365124183 | 1692.4 | 4.853651 |
| P40028 | utilidadSinCF | 148512.66939875818 | 146092.03 | 2420.639399 |
| P40028 | totalPagoQTZ | 1136121.9209005001 | 1117604.01 | 18517.910901 |
| P40129 | gastosPerSaco | 17.12 | 23 | -5.880000 |
| P40129 | gastosExport | 7062 | 9487.5 | -2425.500000 |
| P40129 | costoFinanciero | 1694.7995360348584 | 1689.97 | 4.829536 |
| P40129 | utilidadSinCF | 162843.20046396513 | 160422.53 | 2420.670464 |
| P40129 | totalPagoQTZ | 1245750.4835493332 | 1227232.38 | 18518.103549 |

## Field-coverage note

This report compares the per-contract row fields that are read directly from the Enero sheet contract table (B:V). It does **not** yet compare:
- MateriaPrima per-row details (rendimiento, pergamino, prom. Q, total MP) — the Jan sheet MP block sits outside this scan's scope.
- Subproducto rows.
- Shipment-aggregate fields (utilidadBruta, margenBruto).

If you need deeper coverage, extend this script. The intentional minimalism matches directive 9 (flag and wait) — the user or CFO decides next steps after reviewing.

## Sheet rows extracted

| Row | Contrato | Cliente | Lote | Gastos/saco | Bolsa+Dif | Facturación Kgs | Total pago Q |
|-----|----------|---------|------|-------------|-----------|------------------|---------------|
| 7 | P30172 | Swiss Water | Danilandia | 14.120000000000001 | 387 | 170721.35802 | 1245388.0650846001 |
| 8 | P40028 | Serengetti | Santa Rosa | 14.120000000000001 | 373 | 156034.42305 | 1136121.9209005001 |
| 9 | P40022 | Serengetti | Huehue | 23 | 386 | 161472.6201 | 1149746.380365 |
| 28 | P40129 | Serengetti | Organico | 17.12 | 416 | 171600 | 1245750.4835493332 |

---
*End of divergence report.*
