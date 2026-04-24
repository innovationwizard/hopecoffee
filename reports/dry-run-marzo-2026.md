==============================================================================
 ETL Marzo 2026 — DRY RUN
==============================================================================
 Sheet hash: d5cc26b3afc0d772c07cff9105e2ca9d0e2b966e84247bacf44b5c9e3e85f87f
 Shipment:   Marzo 2026 - Bloque único
 Contracts:  6 (3 clients)
 MP rows:    6
 Subproducto: 1 row

 ── Client resolution (strict, variant-map-based) ─────────────────────────────
  DB clients scanned: 12   Map canonicals: 12
  ✓ 'Serengetti' → 'Serengetti' [SER] via 'Serengetti'
  ✓ 'Opal' → 'Opal' [OPL] via 'Opal'
  ✓ 'Onyx' → 'Onyx' [ONX] via 'Onyx'

 ── Contracts ─────────────────────────────────────────────────────────────────
  P40030  client=Serengetti  lote=Santa Rosa  regions=[SANTA_ROSA]  status=FIJADO
    sacos69=275  sacos46=412.5  puntaje=82  bolsa+dif=308  dif=15  gastos/qq=14.120000000000001  TC=7.65  pos=May-26→MAY
    montoCredito=Q970484.13
  P40024  client=Serengetti  lote=Huehue  regions=[HUEHUETENANGO]  status=FIJADO
    sacos69=275  sacos46=412.5  puntaje=83  bolsa+dif=322.55  dif=28  gastos/qq=23  TC=7.65  pos=May-26→MAY
    montoCredito=Q970484.13
  POUS-00003748  client=Opal  lote=Huehue  regions=[HUEHUETENANGO]  status=FIJADO
    sacos69=275  sacos46=412.5  puntaje=83  bolsa+dif=354.1  dif=40  gastos/qq=20  TC=7.65  pos=May-26→MAY
    montoCredito=Q970484.13
  POUS-00003761-01 (SUFFIXED from 'POUS-00003761')  client=Opal  lote=Orgnaico  regions=[ORGANICO]  status=FIJADO
    sacos69=100  sacos46=150  puntaje=83  bolsa+dif=364.1  dif=50  gastos/qq=23  TC=7.65  pos=May-26→MAY
    montoCredito=Q352903.32
  POUS-00003761-02 (SUFFIXED from 'POUS-00003761')  client=Opal  lote=Huehue  regions=[HUEHUETENANGO]  status=FIJADO
    sacos69=175  sacos46=262.5  puntaje=83  bolsa+dif=352.1  dif=38  gastos/qq=23  TC=7.65  pos=May-26→MAY
    montoCredito=Q617580.81
  1002605  client=Onyx  lote=Santa Rosa  regions=[SANTA_ROSA]  status=FIJADO
    sacos69=275  sacos46=412.5  puntaje=81  bolsa+dif=340.8  dif=40  gastos/qq=14.120000000000001  TC=7.65  pos=May-26→MAY
    montoCredito=Q970484.13

 ── Materia Prima ─────────────────────────────────────────────────────────────
  P40030  proveedor=Comprado Jose David  oro=412.5  rend=1.32  pergo=544.5  promQ=1782.34  totalMP=Q970484.13
  P40024  proveedor=Comprado / Huehue  oro=412.5  rend=1.32  pergo=544.5  promQ=1782.34  totalMP=Q970484.13
  POUS-00003748  proveedor=Comprado / Huehue  oro=412.5  rend=1.32  pergo=544.5  promQ=1782.34  totalMP=Q970484.13
  POUS-00003761 → links to POUS-00003761-01  proveedor=Organico  oro=150  rend=1.32  pergo=198  promQ=1782.34  totalMP=Q352903.32
  POUS-00003761 → links to POUS-00003761-02  proveedor=Comprado / Huehue  oro=262.5  rend=1.32  pergo=346.5  promQ=1782.34  totalMP=Q617580.8099999999
  1002605  proveedor=Comprado Jose David  oro=412.5  rend=1.32  pergo=544.5  promQ=1782.34  totalMP=Q970484.13

 ── Subproducto ───────────────────────────────────────────────────────────────
  contenedores=3  oroPerCont=33  totalOro=99  precioSinIVA=2049.1071428571427  totalPerga=Q202861.60714285713

 ── Computed validation vs sheet (tolerance ±0.03) ────────────────────────────
  ✓ All computed values match sheet values within tolerance.

 ── Mutations that --execute would perform ───────────────────────────────────
   1a. DELETE existing Contract(s) by final contractNumber (with Jan guard)
   1b. DELETE any Mar 2026 shipments cascade (Subproducto → MPA → MP → Contract → Shipment)
   2.  INSERT 1 × Shipment "Marzo 2026 - Bloque único"
        6 × Contract (exportingEntity=EXPORTADORA)
        6 × MateriaPrima
        6 × MateriaPrimaAllocation (1:1)
        1 × Subproducto
   3.  UPDATE each contract via calculateContract(...).
   4.  CALL recalculateShipment(shipmentId).
   5.  WRITE 1 × AuditLog entry (action=ETL_MONTH).

 No writes performed in --dry-run mode.
==============================================================================
