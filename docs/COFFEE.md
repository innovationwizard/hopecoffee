# MegaEstrategia CAFÉ — Requerimientos de Sistema

> Transcripción limpia de reunión de levantamiento de requerimientos para reemplazar todos los Excel de la operación cafetalera con una aplicación web.

---

## 1. Modelo de Negocio (Contexto)

La empresa vende contenedores completos de café de exportación. Cada contenedor se costea como un **centro de costo individual**. La venta es **F.O.B.** (Free On Board — hasta el barco). El objetivo financiero es mantener un **margen bruto ponderado del 12%** sobre todas las exportaciones.

Los costos operativos anuales rondan los **Q2.5M**. Todo lo que exceda ese monto en utilidad bruta acumulada es ganancia neta. El break-even es alcanzar Q2.5M de utilidad bruta en el año.

---

## 2. Estructura del P&L por Exportación

```
Ventas (facturación)
  − Costo de Ventas
      ├── Materia Prima (finca → beneficio seco) = "Sourcing"
      └── Gastos de Exportación (beneficio seco → barco)
  = UTILIDAD BRUTA  ← objetivo: ≥12%
  − Gastos Operativos (Q2.5M anuales)
      ├── Gastos Administrativos
      ├── Gastos de Venta
      ├── Gastos Financieros
      └── Otros Ingresos/Gastos
  = UTILIDAD ANTES DE IMPUESTOS
```

---

## 3. Módulos del Sistema (Reemplazan Excel)

### 3.1 Módulo de Contratos (Ventas y Margen)

**Propósito:** Reemplazar el Excel principal. Controlar ventas, costo de ventas y utilidad bruta por contrato/contenedor.

**Campos por contrato:**

- **Cliente** (nuevo o existente)
- **Número de contrato** (correlativo)
- **Estatus**: Negociación → Confirmado → Fijado
- **Fecha de embarque**
- **Posición de bolsa** (mes de futuros: marzo, mayo, julio, septiembre, diciembre)
- **Lote**: tipo de café (orgánico, convencional), origen (Santa Rosa, Antigua, etc.), puntuación (ej. 82 puntos)
- **Cantidad en sacos de 69 kg** (lo que va en el contenedor, máximo 290)
- **Cantidad en quintales de 100 lb** (sacos × 1.5 — para facturación)
- **Precio de bolsa fijado** (USD/quintal 100 lb)
- **Diferencial sobre bolsa** (ej. +37 USD)
- **Precio total** (bolsa + diferencial)
- **Tipo de facturación**: libras guatemaltecas o libras españolas (fórmula: `sacos × 69 kg × 2.2046 × (precio / 100)`)
- **Total facturado** (USD)
- **Gastos de exportación** (USD/quintal, estándar ~20-23 USD, referencia del módulo de exportación)
- **Gastos financieros** (calculado: `monto crédito × 8% anual / 12 × 2 meses / tipo de cambio`)
- **Costo de materia prima** (referencia del módulo de inventario, promedio ponderado)
- **Comisiones de venta y compra** (3 USD/quintal total, 1.50 cada uno)
- **Subproductos** (ingreso por venta de subproductos si aplica)
- **Utilidad bruta** (en quetzales y USD)
- **Margen bruto %** (`utilidad USD / facturación USD`)

**Reglas de negocio:**

- La posición de bolsa siempre es **mínimo 2 meses adelante** del mes de embarque. Enero → Marzo. Marzo → Mayo. Mayo → Julio. Etc.
- Las posiciones existen solo en meses alternos: marzo, mayo, julio, septiembre, diciembre.
- No se puede usar la posición del mismo mes ni un mes adelante.
- No se fija venta sin haber fijado compra (si no, es especulación).
- Cuando el estatus es "Fijado", el precio queda congelado en el reporte.
- Cuando el estatus es "Negociación", el sistema debe mostrar el **precio en vivo de la bolsa** para esa posición.

**Reportes requeridos:**

- Resumen por mes (ej. "¿cómo voy en enero?")
- Filtro por cliente
- Margen ponderado acumulado a la fecha
- Alerta si el margen acumulado baja del 12% → "hay que recuperar en los siguientes contratos"
- Cuántos contenedores faltan para cubrir costos operativos

**Integración con bolsa de valores:**

- Al seleccionar una posición (ej. julio), el sistema debe traer automáticamente el precio actual de la bolsa ICE para café arábica en esa posición.
- Esto elimina la necesidad de consultar manualmente la bolsa. El Excel no puede hacer esto; el programa web sí.

---

### 3.2 Módulo de Inventario / Materia Prima

**Propósito:** Llevar el costo promedio ponderado de las compras de café para alimentar el módulo de contratos.

**Campos por orden de compra:**

- **Número de OC** (formato: `OC-[cosecha]-[correlativo]`, ej. `OC-2526-01`)
- **Proveedor**
- **Puntuación del lote** (ej. 82 puntos)
- **Quintales pergamino comprados**
- **Precio por quintal pergamino** (sin IVA)
- **Rendimiento** (factor de conversión pergamino → oro, ej. 1.31 — varía por lote)
- **Quintales oro resultantes** (`pergamino / rendimiento`)
- **Flete** (~Q15/quintal)
- **Seguro** (0.25% del valor del café)
- **Cadena** (peaje comunitario, variable)
- **Cargas y descargas**
- **Otros gastos**
- **Costo total de la OC** (café + flete + seguro + otros)

**Cálculos automáticos:**

- **Costo total acumulado** (suma de todas las OC)
- **Quintales totales acumulados**
- **Precio promedio ponderado** (`costo total acumulado / quintales totales acumulados`)
- Se actualiza con cada nueva OC

**Regla clave:** No se sale a comprar si no hay venta confirmada. La venta define qué y cuánto comprar.

---

### 3.3 Módulo de Gastos de Exportación

**Propósito:** Desglosar y controlar los gastos desde el beneficio seco hasta el barco. Alimenta la segunda capa del costo de ventas.

**Campos por exportación:**

| Concepto | Ejemplo |
|---|---|
| Tría (proceso a oro) | 7 USD/quintal |
| Sacos de yute | Q1,300 |
| Estampado de sacos | Q500 |
| Bolsa Grain Pro | variable |
| Fito sanitario | Q50 |
| Impuesto ANACAFÉ 1 | Q600 |
| Impuesto ANACAFÉ 2 | Q500 |
| Inspección OIRSA | Q300 |
| Fumigación | Q400-500 |
| Emisión de BL (documentos) | Q1,200 |
| Flete a puerto | variable |
| Seguro de transporte | variable |
| Custodia | variable |
| Honorarios agente aduanal | Q600 |
| Comisión exportador orgánico (si aplica) | variable |

**Regla de control:** El costo de exportación estándar no debería superar ~23 USD/quintal. Si se pasa, algo está mal.

**Inputs:** Recibo de ingreso del beneficio (fecha, cantidad pergamino, rendimiento).

---

## 4. Mecánica de Precios y Facturación

### Facturación en Libras Guatemaltecas
```
quintales_100lb × precio_USD = total_factura_USD
```

### Facturación en Libras Españolas (genera ~2,000 USD más por contenedor)
```
(sacos_69kg × 69 × 2.2046) × (precio_USD / 100) = total_factura_USD
```

### Costo Financiero
```
monto_crédito_GTQ × (8% / 12) × 2_meses / tipo_de_cambio = costo_financiero_USD
```
El financiamiento típico dura 2 meses (ciclo de exportación).

### Comisiones
- Compra: 1.50 USD/quintal
- Venta: 1.50 USD/quintal
- Total: 3.00 USD/quintal de 100 lb exportado

---

## 5. Decisiones Tecnológicas

| Tema | Decisión |
|---|---|
| Contabilidad | Se queda en **Contapime** (por ahora). Están cómodos. |
| Módulos operativos (contratos, inventario, exportación) | **App web custom** (reemplaza Excel). |
| ERP/CRM a futuro | **Odoo** evaluándose como partner oficial. |
| Contabilidad para bancos | Sale de Odoo o del sistema, se ajusta externamente. **Nunca en Excel.** |
| Migración contable | Saldos al 31/dic/2025 se ingresan a Odoo. Enero 2026 en adelante en Odoo. Paralelo con Contapime hasta estabilizar. |
| Presupuesto operativo | Módulo en Odoo (ya identificado como necesidad). |

---

## 6. Roadmap

### Fase 1 — Ordenar (Prioridad inmediata)
Reemplazar Excel con sistema de apps:
1. Módulo de Contratos (ventas + margen)
2. Módulo de Inventario / Materia Prima (costo promedio ponderado)
3. Módulo de Gastos de Exportación

### Fase 2 — Integración contable
- Conectar con ERP (Odoo)
- CRM
- Contabilidad integrada
- Todo en un solo lugar

### Fase 3 — Innovación
- Integración con bolsa de valores ICE (histórico + tiempo real)
- **Forecast estadístico:** Leer historial de bolsa (5+ años) y generar alertas cuando el precio se sale de rangos normales.
- Alertas tipo: "La bolsa bajó 30 puntos hoy → según el histórico, esto no es sostenible, va a rebotar → oportunidad de compra."
- Análisis de estacionalidad interanual del café.
- Factores externos (noticias) combinados con datos de bolsa para recomendaciones de decisión.

**Input necesario para Fase 3:** Historial de Excel desde 2019 + historial de bolsa de valores.

---

## 7. Módulos de Finca (Secundario)

**Prioridad:** Inventario de finca primero (es donde más tiempo se pierde).

Requerimientos identificados:
- **Control de inventario** de café en finca
- **Planillas y cortes:** Registro de corte por persona, cálculo de pago, listado, carga y pago.
- **Trazabilidad:** Desde el corte hasta el despacho. QR por lote. Saber en todo momento: qué café, cuándo se cortó, de dónde, quién, dónde está ahora.
- **Traslados en tiempo real:** Finca → beneficio → puerto → barco.
- **Blockchain:** Evaluado pero descartado por ahora (no son 100% orgánicos, no es prioridad). Plan piloto a futuro.

**Siguiente paso:** Reunión entre Roberto, Luis Castellanos, Luis Arimán y Luis para definir módulos 1 y 2 de finca. Pregunta clave: *"¿En qué estás perdiendo más tiempo? Eso se automatiza primero."*

---

## 8. Otros Proyectos Mencionados

**App inmobiliaria** (proyecto existente en desarrollo): Listing interactivo de propiedades para Guatemala, modelo B2B con inmobiliarias + B2C con usuarios directos. Diferenciador: interactividad, geolocalización, filtros por tipo (alquiler/compra, con/sin intermediario). Pendiente de afinación.

---

## 9. Datos Entregables Pendientes

- [ ] Excel de contratos/ventas de enero en adelante (ya enviado por correo)
- [ ] Historial de Excel desde 2019 (para estacionalidad y forecast)
- [ ] Logo de Grupo Reón Backoffice (para registro como partner Odoo)
- [ ] Descripción corta y larga de Grupo Reón Backoffice
- [ ] Links de páginas web y redes sociales (contactar a Delfa)
- [ ] Propuesta integral de servicios (para presentar ~15 de marzo)
- [ ] Reunión lunes 10am post-comité con equipo completo
