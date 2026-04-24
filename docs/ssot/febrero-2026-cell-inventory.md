# Febrero 2026 — Cell Inventory

**Generated:** 2026-04-24T03:46:55.145Z
**Sheet:** `Febrero` (in `Mayo.xlsx`)
**Used range:** `A3:W23`
**Non-empty cells:** 137

> Scope: Febrero only (`month=2`, `year=2026`). Read-only. No DB or xlsx mutation.

## 1. Contract rows

Found 2 contract rows.

| Row | Contrato | Cliente | Lote | Puntaje | Sacos 69 | Sacos 46 | Bolsa | Dif | Bolsa+Dif | Gastos/saco | Gastos Total | Tipo Cambio | Total Pago Q |
|-----|----------|---------|------|---------|----------|----------|-------|-----|-----------|-------------|--------------|-------------|---------------|
| 7 | P40029 | SERENGETTI | Santa Rosa | 82 | 275 | 412.5 | 380 | 15 | 395 | 14.120000000000001 | 5824.5 | 7.65 | 1206569.8585875002 |
| 8 | P40023 | SERENGETTI | Huehuetenango | 83 | 275 | 412.5 | 369.75 | 28 | 397.75 | 23 | 9487.5 | 7.65 | 1187348.3755443753 |

## 2. Materia Prima rows

MP header row: 11. Found 2 MP rows.

| Row | Contrato | Proveedor | Punteo | Oro | Rendimiento | Pergo | Prom. Q | Total MP |
|-----|----------|-----------|--------|-----|-------------|-------|---------|----------|
| 12 | P40029 | Santa Rosa | 82 | 412.5 | 1.32 | 544.5 | 1782.34 | 970484.13 |
| 13 | P40023 | Huehue | 83 | 412.5 | 1.32 | 544.5 | 1782.34 | 970484.13 |

## 3. Subproducto

Header row: 15
- Contenedores: 1
- Oro × contenedor: 33
- Total Oro: 33
- Precio sin IVA: 2049.1071428571427
- Total Pergamino (revenue): 67620.53571428571

## 4. Every non-empty cell (formulas + literals)

Format: `ADDR [t]: value (f=formula)` — grouped by row.

### Row 5
- `I5` [s]: "SACOS"
- `J5` [s]: "SACOS 46 KG"
- `K5` [s]: "PRECIO POR SACO 46 KG (100 LIBRAS)"
- `N5` [s]: "FACTURACION"
- `O5` [s]: "FACTURACION "
- `P5` [s]: "GASTOS EXPORTACION"
- `Q5` [s]: "GASTOS"
- `R5` [s]: "UTILIDAD US$ SIN"
- `S5` [s]: "COSTOS"
- `T5` [s]: "UTILIDAD SIN COSTO"
- `U5` [s]: "TIPO"
- `V5` [s]: "TOTAL"

### Row 6
- `B6` [s]: "EMBARQUE"
- `C6` [s]: "POSICION"
- `D6` [s]: "CLIENTE"
- `E6` [s]: "CONTRATO"
- `F6` [s]: "ESTATUS"
- `G6` [s]: "LOTE"
- `H6` [s]: "PUNTAJE"
- `I6` [s]: "69 KGS"
- `J6` [s]: "100 LIBRAS"
- `K6` [s]: "BOLSA"
- `L6` [s]: "DIFERENCIAL"
- `M6` [s]: "BOLSA+DIF"
- `N6` [s]: "LIBRAS"
- `O6` [s]: "KILOS"
- `P6` [s]: "POR SACO"
- `Q6` [s]: "EXPORTACION"
- `R6` [s]: "GASTOS EXPORTACION"
- `S6` [s]: "FINANCIERO"
- `T6` [s]: "FINANCIERO"
- `U6` [s]: "CAMBIO"
- `V6` [s]: "PAGO"

### Row 7
- `B7` [n]: 46054
- `C7` [n]: 46082
- `D7` [s]: "SERENGETTI"
- `E7` [s]: "P40029"
- `F7` [s]: "Fijado"
- `G7` [s]: "Santa Rosa"
- `H7` [n]: 82
- `I7` [n]: 275
- `J7` [n]: 412.5 (f=`I7*1.5`)
- `K7` [n]: 380
- `L7` [n]: 15
- `M7` [n]: 395 (f=`K7+L7`)
- `N7` [n]: 162937.5 (f=`M7*J7`)
- `O7` [n]: 165237.52575000003 (f=`(I7*69*2.2046*(M7/100))`)
- `P7` [n]: 14.120000000000001 (f=`20-5.88`)
- `Q7` [n]: 5824.5 (f=`P7*J7`)
- `R7` [n]: 159413.02575000003 (f=`O7-Q7`)
- `S7` [n]: 1691.4756078431371 (f=`(((O12*0.08)/12)*2)/7.65`)
- `T7` [n]: 157721.5501421569 (f=`R7-S7`)
- `U7` [n]: 7.65
- `V7` [n]: 1206569.8585875002 (f=`T7*U7`)

### Row 8
- `B8` [n]: 46054 (f=`B7`)
- `C8` [n]: 46082 (f=`C7`)
- `D8` [s]: "SERENGETTI" (f=`D7`)
- `E8` [s]: "P40023"
- `F8` [s]: "Fijado"
- `G8` [s]: "Huehuetenango"
- `H8` [n]: 83
- `I8` [n]: 275
- `J8` [n]: 412.5 (f=`I8*1.5`)
- `K8` [n]: 369.75
- `L8` [n]: 28
- `M8` [n]: 397.75 (f=`K8+L8`)
- `N8` [n]: 164071.875 (f=`M8*J8`)
- `O8` [n]: 166387.91358750002 (f=`(I8*69*2.2046*(M8/100))`)
- `P8` [n]: 23
- `Q8` [n]: 9487.5 (f=`P8*J8`)
- `R8` [n]: 156900.41358750002 (f=`O8-Q8`)
- `S8` [n]: 1691.4756078431371 (f=`(((O13*0.08)/12)*2)/7.65`)
- `T8` [n]: 155208.93797965688 (f=`R8-S8`)
- `U8` [n]: 7.65
- `V8` [n]: 1187348.3755443753 (f=`T8*U8`)

### Row 9
- `H9` [n]: 82
- `I9` [n]: 550 (f=`SUM(I7:I8)`)
- `J9` [n]: 825 (f=`SUM(J7:J8)`)
- `N9` [n]: 327009.375 (f=`SUM(N7:N8)`)
- `O9` [n]: 331625.4393375 (f=`SUM(O7:O8)`)
- `Q9` [n]: 15312 (f=`SUM(Q7:Q8)`)
- `R9` [n]: 316313.4393375 (f=`SUM(R7:R8)`)
- `S9` [n]: 3382.9512156862743 (f=`SUM(S7:S8)`)
- `T9` [n]: 312930.48812181375 (f=`SUM(T7:T8)`)
- `U9` [n]: 7.65
- `V9` [n]: 2393918.2341318754 (f=`SUM(V7:V8)`)

### Row 11
- `G11` [s]: "CONTRATO"
- `H11` [s]: "PROVEEDOR"
- `I11` [s]: "PUNTEO"
- `J11` [s]: "ORO"
- `K11` [s]: "RENDIMIENTO"
- `L11` [s]: "PERGO"
- `M11` [s]: "PROM. Q"
- `O11` [s]: "TOTAL MP"
- `T11` [s]: "."

### Row 12
- `G12` [s]: "P40029" (f=`E7`)
- `H12` [s]: "Santa Rosa"
- `I12` [n]: 82 (f=`H7`)
- `J12` [n]: 412.5 (f=`J7`)
- `K12` [n]: 1.32
- `L12` [n]: 544.5 (f=`J12*K12`)
- `M12` [n]: 1782.34 (f=`Enero!M32`)
- `O12` [n]: 970484.13 (f=`M12*L12`)

### Row 13
- `G13` [s]: "P40023" (f=`E8`)
- `H13` [s]: "Huehue"
- `I13` [n]: 83 (f=`H8`)
- `J13` [n]: 412.5 (f=`J8`)
- `K13` [n]: 1.32
- `L13` [n]: 544.5 (f=`J13*K13`)
- `M13` [n]: 1782.34 (f=`M12`)
- `O13` [n]: 970484.13 (f=`M13*L13`)

### Row 14
- `G14` [s]: "TOTAL"
- `J14` [n]: 825 (f=`SUM(J12:J13)`)
- `L14` [n]: 1089 (f=`SUM(L12:L13)`)
- `O14` [n]: 1940968.26 (f=`SUM(O12:O13)`)
- `R14` [s]: "MATERIA PRIMA"
- `V14` [n]: -1940968.26 (f=`-O14`)

### Row 15
- `G15` [s]: "SUBPRODUCTO"

### Row 16
- `I16` [s]: "SUBPRODUCTO"
- `J16` [s]: "CONTENEDORES"
- `K16` [s]: "ORO X CONTENEDOR"
- `L16` [s]: "TOTAL ORO"
- `M16` [s]: "PRECIO SIN IVA"
- `O16` [s]: "TOTAL PERGAMINO"
- `R16` [s]: "COMISION COMPRA/VENTA"
- `V16` [n]: -18933.750000000004 (f=`-(3*U9*J9)`)

### Row 17
- `J17` [n]: 1 (f=`(J13/412.5)`)
- `K17` [n]: 33
- `L17` [n]: 33 (f=`J17*K17`)
- `M17` [n]: 2049.1071428571427 (f=`Enero!M20`)
- `O17` [n]: 67620.53571428571 (f=`M17*L17`)
- `R17` [s]: "SUBRPRODUCTOS"
- `V17` [n]: 67620.53571428571 (f=`+O17`)

### Row 18
- `R18` [n]: 0.19773342114714507 (f=`S18/O9`)
- `S18` [n]: 65573.4326596289 (f=`V18/U9`)
- `T18` [s]: "UTILIDAD BRUTA"
- `V18` [n]: 501636.7598461611 (f=`SUM(V9:V17)`)

---
*End of Febrero 2026 cell inventory.*
