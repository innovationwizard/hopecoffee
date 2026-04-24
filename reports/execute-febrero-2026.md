==============================================================================
 ETL Febrero 2026 — DRY RUN
==============================================================================
 Sheet hash: d5cc26b3afc0d772c07cff9105e2ca9d0e2b966e84247bacf44b5c9e3e85f87f
 Shipment:   Febrero 2026 - Bloque único
 Contracts:  2
 MP rows:    2
 Subproducto: 1 row

 ── Client resolution (strict, variant-map-based) ─────────────────────────────
  Sheet says: "SERENGETTI"   DB clients scanned: 12   Map canonicals: 12
  ✓ MATCHED via variant map: 'Serengetti' (code 'SER')
    matched variant: 'Serengetti' under canonical 'Serengetti'

 ── Contracts ─────────────────────────────────────────────────────────────────
  P40029  client=SERENGETTI  lote=Santa Rosa  regions=[SANTA_ROSA]  entity=EXPORTADORA  status=FIJADO
    sacos69=275  sacos46=412.5  puntaje=82  bolsa+dif=395  gastos/qq=14.120000000000001  TC=7.65
    montoCredito=Q970484.13  (from own MP totalMP — business rules §2.7)
  P40023  client=SERENGETTI  lote=Huehuetenango  regions=[HUEHUETENANGO]  entity=EXPORTADORA  status=FIJADO
    sacos69=275  sacos46=412.5  puntaje=83  bolsa+dif=397.75  gastos/qq=23  TC=7.65
    montoCredito=Q970484.13  (from own MP totalMP — business rules §2.7)

 ── Materia Prima ─────────────────────────────────────────────────────────────
  P40029  proveedor=Santa Rosa  punteo=82  oro=412.5  rend=1.32  pergo=544.5  promQ=1782.34  totalMP=Q970484.13
  P40023  proveedor=Huehue  punteo=83  oro=412.5  rend=1.32  pergo=544.5  promQ=1782.34  totalMP=Q970484.13

 ── Subproducto ───────────────────────────────────────────────────────────────
  contenedores=1  oroPerCont=33  totalOro=33  precioSinIVA=2049.1071428571427  totalPerga=Q67620.53571428571

 ── Computed validation vs sheet (tolerance ±0.03) ────────────────────────────
  ✓ All computed values match sheet values within tolerance.

 ── Mutations that --execute would perform ───────────────────────────────────
   1. DELETE rows WHERE month=2 year=2026:
        Subproducto → MateriaPrimaAllocation → MateriaPrima → Contract → Shipment
   2. INSERT:
        1 × Shipment "Febrero 2026 - Bloque único" (month=2 year=2026)
        2 × Contract (exportingEntity=EXPORTADORA)
        2 × MateriaPrima
        2 × MateriaPrimaAllocation (1:1)
        1 × Subproducto
   3. UPDATE each contract with calculateContract(...) derived fields.
   4. CALL recalculateShipment(shipmentId).
   5. WRITE 1 × AuditLog entry (action=ETL_MONTH, entity=Shipment).

 No writes performed in --dry-run mode. Re-run with --execute to apply.
==============================================================================
