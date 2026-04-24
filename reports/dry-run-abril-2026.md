==============================================================================
 ETL Abril 2026 — DRY RUN
==============================================================================
 Sheet hash: d5cc26b3afc0d772c07cff9105e2ca9d0e2b966e84247bacf44b5c9e3e85f87f
 Shipments:  2 (Abril 2026 - Bloque 1 + Abril 2026 - Bloque 2)
 Contracts:  9 (7 Exp + 2 Stock Lock)
 MP rows:    7 (Exportadora only)
 Subproducto: 1 row (Exportadora)

 ── Client resolution (strict, variant-map-based) ─────────────────────────────
  DB clients scanned: 14   Map canonicals: 14
  ✓ 'Serengetti' → 'Serengetti' [SER] via 'Serengetti' (existing DB row)
  ✓ 'Stonex' → 'Stonex' [STX] via 'Stonex' (existing DB row)
  ✓ 'Westrade' → 'Westrade' [WST] via 'Westrade' (existing DB row)
  ✓ 'Plateau Harvest' → 'Plateau Harvest' [PLH] via 'Plateau Harvest' (existing DB row)

 ── Exportadora contracts → Abril 2026 - Bloque 1 ───────────────────────────────────────
  P40031  client=Serengetti  entity=EXPORTADORA  lote=Santa Rosa  status=FIJADO
    sacos69=275  sacos46=412.5  puntaje=82  bolsa+dif=325.35  dif=15  gastos/qq=14.120000000000001  TC=7.65  pos=May-26→MAY
    montoCredito=Q970484.13
  P40025  client=Serengetti  entity=EXPORTADORA  lote=Huehue  status=FIJADO
    sacos69=275  sacos46=412.5  puntaje=83  bolsa+dif=338.35  dif=28  gastos/qq=23  TC=7.65  pos=May-26→MAY
    montoCredito=Q970484.13
  SCS_177612  client=Stonex  entity=EXPORTADORA  lote=Huehue  status=NO_FIJADO
    sacos69=206  sacos46=309  puntaje=83  bolsa+dif=348.35  dif=48  gastos/qq=20  TC=7.65  pos=Jul-26→JUL
    montoCredito=Q726980.84
  SCS_177617  client=Stonex  entity=EXPORTADORA  lote=Santa Rosa  status=NO_FIJADO
    sacos69=75  sacos46=112.5  puntaje=83  bolsa+dif=347.35  dif=47  gastos/qq=14.120000000000001  TC=7.65  pos=Jul-26→JUL
    montoCredito=Q264677.49
  W26342-GT  client=Westrade  entity=EXPORTADORA  lote=Huehue  status=FIJADO
    sacos69=275  sacos46=412.5  puntaje=84  bolsa+dif=346.9  dif=47  gastos/qq=23  TC=7.65  pos=May-26→MAY
    montoCredito=Q970484.13
  W26350-GT-01 (SUFFIXED from 'W26350-GT')  client=Westrade  entity=EXPORTADORA  lote=Huehue  status=FIJADO
    sacos69=275  sacos46=412.5  puntaje=83  bolsa+dif=351.25  dif=40  gastos/qq=23  TC=7.65  pos=May-26→MAY
    montoCredito=Q970484.13
  W26350-GT-02 (SUFFIXED from 'W26350-GT')  client=Westrade  entity=EXPORTADORA  lote=Huehue  status=FIJADO
    sacos69=550  sacos46=825  puntaje=83  bolsa+dif=351.45  dif=40  gastos/qq=23  TC=7.65  pos=May-26→MAY
    montoCredito=Q1940968.26

 ── Stock-lock contracts → Abril 2026 - Bloque 2 ───────────────────────────────────────
  GT260360-01 (SUFFIXED from 'GT260360')  client=Plateau Harvest  entity=STOCK_LOCK  lote=Stocklot  status=NO_FIJADO
    sacos69=275  sacos46=412.5  puntaje=null  bolsa+dif=265  dif=-37  gastos/qq=23  TC=7.65  pos=May-26→MAY
    montoCredito=Q0.00 (stock-lock, no MP)
  GT260360-02 (SUFFIXED from 'GT260360')  client=Plateau Harvest  entity=STOCK_LOCK  lote=Stocklot  status=NO_FIJADO
    sacos69=275  sacos46=412.5  puntaje=null  bolsa+dif=250  dif=-52  gastos/qq=23  TC=7.65  pos=May-26→MAY
    montoCredito=Q0.00 (stock-lock, no MP)

 ── Materia Prima (Exportadora only) ──────────────────────────────────────────
  P40031  proveedor=Compradro Jose David  oro=412.5  rend=1.32  pergo=544.5  promQ=1782.34  totalMP=Q970484.13
  P40025  proveedor=Huehue  oro=412.5  rend=1.32  pergo=544.5  promQ=1782.34  totalMP=Q970484.13
  SCS_177612  proveedor=Huehue  oro=309  rend=1.32  pergo=407.88  promQ=1782.34  totalMP=Q726980.8391999999
  SCS_177617  proveedor=Compradro Jose David  oro=112.5  rend=1.32  pergo=148.5  promQ=1782.34  totalMP=Q264677.49
  W26342-GT  proveedor=Huehue  oro=412.5  rend=1.32  pergo=544.5  promQ=1782.34  totalMP=Q970484.13
  W26350-GT → links to W26350-GT-01  proveedor=Huehue  oro=412.5  rend=1.32  pergo=544.5  promQ=1782.34  totalMP=Q970484.13
  W26350-GT → links to W26350-GT-02  proveedor=Huehue  oro=825  rend=1.32  pergo=1089  promQ=1782.34  totalMP=Q1940968.26

 ── Subproducto (Exportadora) ─────────────────────────────────────────────────
  contenedores=5.749090909090909  oroPerCont=33  totalOro=189.72  precioSinIVA=2049.1071428571427  totalPerga=Q388756.6071428571

 ── Computed validation vs sheet (Exportadora only, ±0.03) ────────────────────
  ✓ All computed Exportadora values match sheet within tolerance.
  (Stock-lock rows excluded — sheet carries #REF! per user directive 3.)

 ── Mutations that --execute would perform ───────────────────────────────────
   1a. DELETE existing Contract(s) by final contractNumber (Jan guard applies).
   1b. DELETE Abril 2026 shipments cascade.
   1c. CREATE DB Client rows for needs-create canonicals (Westrade, Plateau Harvest).
   2.  INSERT 2 × Shipment ("Abril 2026 - Bloque 1", "Abril 2026 - Bloque 2")
        7 × Contract on Bloque 1 (EXPORTADORA)
        2 × Contract on Bloque 2 (STOCK_LOCK, montoCredito=0)
        7 × MateriaPrima on Bloque 1
        7 × MateriaPrimaAllocation on Bloque 1 (1:1)
        1 × Subproducto on Bloque 1
   3.  UPDATE each contract via calculateContract(...).
   4.  CALL recalculateShipment() on both shipments.
   5.  WRITE 1 × AuditLog entry.

==============================================================================
