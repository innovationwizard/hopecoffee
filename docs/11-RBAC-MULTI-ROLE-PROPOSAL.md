# HopeCoffee RBAC Architecture Proposal

> **Version:** 1.0
> **Date:** 2026-04-16
> **Status:** IMPLEMENTED — deployed to production 2026-04-20
> **Implementation log:** [../changelog/2026-04-20-rbac-multi-role-domain-system.md](../changelog/2026-04-20-rbac-multi-role-domain-system.md)
> **Migration artifacts:** [../prisma/migrations/20260420_rbac_multi_role/](../prisma/migrations/20260420_rbac_multi_role/)
> **Known open item:** José Herrera (COMPRAS) has not been interviewed. His role is inferred from what Hector and Roberto described. All COMPRAS permissions must be validated after his interview.
>
> The sections below reflect the design as proposed; minor deviations between the proposal and the implementation are captured in the implementation log.

---

## 1. Design Principles

**Permission-based, not hierarchy-based.** The current `hasPermission(role, permission)` pattern is correct. We keep it. No role inherits from another. Each role gets an explicit `Set<Permission>` — no implicit escalation paths.

**Domain isolation.** Each role sees only the data and actions its real-world operator needs. This is not a theoretical exercise — it comes directly from what each person described doing (and explicitly not doing) in the transcriptions.

**Multi-role assignment.** Users can hold multiple roles simultaneously. Octavio holds GERENCIA + FINANCIERO. Hector holds VENTAS + LAB. Roberto holds ANALISIS + CONTABILIDAD. José holds COMPRAS. The system resolves permissions as the union of all assigned roles.

**Read ≠ Write.** Every domain separates `:read` from `:write` and `:delete`. Roberto was explicit: "Yo no quiero modificar nada" — he needs full read access to compras, ventas, and trías without any write capability. This is a recurring pattern across roles.

**Audit-first.** Every mutation is logged with actor, timestamp, role used, and the previous state. Roberto specifically requested version history on purchase orders. Hector needs traceability from receipt → cupping → payment adjustment. This is non-negotiable for an export operation under OIC and fiscal compliance.

---

## 2. Role Definitions

### 2.1 MASTER

**Real person:** Developer (system owner).  
**Purpose:** Full system control. Unrestricted.

All permissions. No exceptions. This role is the only one that can manage users, assign roles, configure system parameters, execute data imports, and access audit logs. It is the superuser fallback and the only role that can grant or revoke other roles.

---

### 2.2 GERENCIA

**Real person:** Octavio Herrera (CEO).  
**Purpose:** Executive oversight. View-only dashboards with full analytical depth.

**Justification from transcriptions:** Octavio consumes reports Roberto prepares — cost averages, margins, comparatives of recibido vs. pendiente. He asks Roberto to exclude expensive OCs to see "normal" cost averages. He wants to "desligarse" from operations but still makes financial judgment calls. He does not enter data. He reads, filters, drills down, and decides.

| Permission | Rationale |
|---|---|
| `dashboard:read` | All executive dashboards: sales pipeline, purchase status, inventory, cost, margin, shipment progress |
| `contract:read` | View all sales contracts — Octavio reviews Hector's contract data alongside Roberto's financials |
| `purchase_order:read` | View all OCs — Octavio analyzes cost/margin at the OC level |
| `receipt:read` | View receipt data — needed for drill-down from OC to individual receipts |
| `cupping:read` | View cupping results — quality data feeds into his pricing decisions |
| `inventory:read` | View all inventory states: pergamino, oro, subproductos, across all beneficios |
| `milling:read` | View tría orders and results — he needs to see transformation yields |
| `shipment:read` | View shipment status, bookings, loading dates |
| `cost:read` | View cost breakdowns: materia prima, flete, custodio, seguro, sacos, comisión |
| `margin:read` | View margin analysis — his primary decision-making data |
| `payment:read` | View anticipos, payment status, saldos por productor |
| `supplier:read` | View supplier/producer data |
| `farm:read` | View farm/finca data |
| `lot:read` | View export lots (OIC-numbered) |
| `report:read` | View all generated reports |
| `market:read` | View market price data (what Hector posts every morning) |
| `crm:read` | View client/broker/importer relationships |

**Zero write permissions.** Octavio does not create, modify, or delete operational data. He directs others to do so. If he needs something changed, he tells José, Hector, or Roberto.

**Dashboard requirements (derived from transcriptions):**

Octavio's dashboards must support the following filter/drill-down/grouping axes at minimum:

- By time period (cosecha, month, week, custom range)
- By productor / proveedor
- By región / calidad (Huehuetenango, Santa Rosa, etc.)
- By beneficio (La Joya, SCL/Servicios Nacionales de Bodega, others)
- By order de compra
- By sales contract / client
- By broker vs. importer vs. final client
- By shipment / container
- By cost component (materia prima, flete, custodio, seguro)
- Exclusion toggles (e.g., exclude high-cost OCs from cost average — Roberto confirmed Octavio does this)
- Recibido vs. pendiente comparatives
- Costo promedio: real vs. projected
- Margin by contract, by client, by calidad

---

### 2.3 FINANCIERO

**Real person:** Octavio Herrera (active financial role).  
**Purpose:** Financial parameter control — exchange rates, export costs, contract financial terms.

**Justification:** Octavio wears two hats. GERENCIA is his read-only executive view. FINANCIERO is his active role where he adjusts financial parameters that affect the entire operation. The current permission set (`contract:update_financial`, `exchange_rate:write`, `export_cost:write`) covers this adequately.

| Permission | Rationale |
|---|---|
| `contract:update_financial` | Modify financial terms on sales contracts (pricing, differentials) |
| `exchange_rate:write` | Set/update exchange rates (GTQ/USD) — affects all cost and margin calculations |
| `export_cost:write` | Define/update export cost parameters |
| `cost:exclude_oc` | Mark specific OCs as excluded from standard cost average (Roberto's transcript: Octavio said "quítalas, que yo lo hago en selva") — this is a financial decision, not an analyst action |
| `margin:configure` | Configure margin calculation parameters (which costs to include/exclude, breakpoints) |

---

### 2.4 COMPRAS

**Real person:** José Herrera (Sourcing & Purchasing).  
**Purpose:** Full lifecycle management of purchase orders, supplier relationships, and receipt assignment.

**Justification from transcriptions (as described by Roberto and Hector):**

José is the origin of all cost data. Roberto: "Para mí los costos y los números que yo controlo comienzan desde la orden de compra. Yo dependo mucho del licenciado José." José creates OCs, negotiates with producers, decides delivery conditions (puesto en finca vs. puesto en beneficio), assigns receipts to OCs (including splitting receipts across multiple OCs), changes quantities and delivery points up to days before delivery, and closes or leaves OCs open for pending deliveries.

> **WARNING:** José has not been interviewed. The permissions below are inferred from Roberto's and Hector's descriptions of his work. They must be validated.

| Permission | Rationale |
|---|---|
| `purchase_order:create` | Create new OCs |
| `purchase_order:write` | Modify OCs (quantity, price, conditions, delivery beneficio) — OCs are mutable until closed |
| `purchase_order:close` | Close an OC (no more receipts accepted against it) |
| `purchase_order:read` | Read all OCs |
| `purchase_order:version_history` | Roberto requested this explicitly: "que no se vayan perdiendo las versiones" — every OC modification creates a version |
| `receipt:assign_to_oc` | Assign a receipt to an OC — this is José's core daily action |
| `receipt:split` | Split a receipt across multiple OCs (partial assignment) — Roberto: "mitad de un recibo en una OC, mitad en otra" |
| `receipt:reassign` | Move receipts between OCs after initial assignment — Roberto: "de esta OC agarro 20 y los paso para allá" |
| `receipt:read` | Read all receipts |
| `supplier:write` | Create/modify supplier/producer records |
| `supplier:read` | Read supplier data |
| `supplier_account:write` | Manage supplier accounts (banking, fiscal identity) |
| `farm:write` | Create/modify farm/finca records |
| `farm:read` | Read farm data |
| `contract:read` | Read sales contracts — José needs to know what quality/quantity is committed to make sourcing decisions |
| `cupping:read` | Read cupping results — quality data informs purchasing decisions |
| `inventory:read` | Read inventory — needs to know what's in bodega when making delivery/assignment decisions |
| `cost:read` | Read cost data for his own OCs |
| `delivery:write` | Manage delivery logistics for incoming coffee (flete, custodio, seguro decisions) |

**What José cannot do:**

- Cannot modify sales contracts, cupping data, milling orders, shipments, financial parameters, or user accounts.
- Cannot delete OCs (only close them — deletion is MASTER-only for audit integrity).
- Cannot modify receipt data itself (only the assignment of receipts to OCs). Receipt creation is triggered by beneficio intake.

---

### 2.5 VENTAS

**Real person:** Hector Gonzalez (Sales Manager).  
**Purpose:** Sales contract lifecycle, client relationship management, pricing, shipment coordination.

**Justification from transcriptions:**

Hector: "Yo vendo el precio y todo." He receives contracts from clients, reviews them, signs them, and needs the system to generate an internal correlative. He manages the broker/importer/client hierarchy (e.g., Westrade as broker, Atlas as final client, Onyx as broker for List & Weisler). He tracks sales by month, manages the sales report (reporte de ventas por mes), assigns inventory to sales contracts based on quality, and coordinates shipment logistics with Evelyn.

| Permission | Rationale |
|---|---|
| `contract:create` | Create sales contracts (with internal correlative auto-generated + client reference) |
| `contract:write` | Modify sales contract details: client, broker, importer, quality, quantity, certifications, score, price, differential, shipment month |
| `contract:change_status` | Move contracts through lifecycle states (draft → confirmed → in_progress → shipped → closed) |
| `contract:read` | Read all sales contracts |
| `contract:lot_allocate` | Assign inventory (receipts/lots) to sales contracts — Hector: "todo el café que entra en bodegas, lo asigno a mis ventas de acuerdo a la calidad" |
| `shipment:write` | Create/modify shipment records (booking, loading dates, itineraries) |
| `shipment:assign_contract` | Link shipments to contracts |
| `shipment:party_write` | Manage shipment parties (broker, importer, client, logistics contacts) |
| `shipment:read` | Read shipment data |
| `container:write` | Create/modify container records |
| `container:lot_assign` | Assign lots to containers — Hector manages which lots go into which container; a single container can hold multiple qualities from the same contract |
| `inventory:read` | Read inventory — critical for his tría planning and sales allocation decisions |
| `purchase_order:read` | Read OCs — "esto lo vemos siempre que nos vemos con Octavio o José" but he doesn't modify them |
| `receipt:read` | Read receipts — needs to see what's in bodega by proveedor, calidad, rendimiento |
| `lot:create` | Create export lots (anything with OIC number) |
| `lot:write` | Modify lot composition |
| `lot:read` | Read lot data |
| `market:write` | Post market price updates (his 4:30 AM routine — sends to Octavio via screenshots today, should go into system with timestamp) |
| `market:read` | Read market data |
| `crm:write` | Manage client records: broker, importer, final client hierarchy; contact info; communication history |
| `crm:read` | Read CRM data |
| `sack_design:approve` | Approve sack designs before sending to client (Evelyn prepares, Hector approves) |
| `report:read` | Read reports relevant to sales/inventory |

**What Hector cannot do:**

- Cannot modify purchase orders, financial parameters, exchange rates, accounting data, or user accounts.
- Cannot delete contracts (status transitions handle lifecycle; hard delete is MASTER-only).
- Does not see margin/financial data in his regular workflow. Hector explicitly stated: "Eso de cuentos en margen y todo, lo veo en un comentario cuando nos reunimos" — margin data is Octavio/Roberto territory.

---

### 2.6 LAB

**Real person:** Hector Gonzalez (Quality Lab Manager).  
**Purpose:** Coffee quality evaluation, cupping, rendimiento validation, quality-based price adjustments.

**Justification from transcriptions:**

Hector's core function. He cups blind-coded samples (Douglas assigns codes via RM — recibo de muestra). He evaluates the 10 SCA parameters. He validates that incoming coffee matches the quality and rendimiento specified in the purchase contract. If rendimiento doesn't match (e.g., contract says 1.32, lab gets 1.33), the system must trigger a price adjustment on the payment request. He also designs blend profiles for milling orders, evaluates tría results, and prepares pre-shipment samples.

| Permission | Rationale |
|---|---|
| `cupping:create` | Create cupping sessions/evaluations |
| `cupping:write` | Record cupping data: 10 SCA parameters, score, descriptors (checklist-based, not free text), defects |
| `cupping:read` | Read all cupping data |
| `sample:create` | Create sample records (RM — recibo de muestra) |
| `sample:write` | Modify sample metadata (type, linked receipt, proveedor, bodega, calidad, rendimiento) |
| `sample:read` | Read sample data |
| `yield_adjustment:create` | Trigger rendimiento-based price adjustments — Hector: "cuando yo ingrese mi catación con el número de recibo, cuando aquel genere su pago, ¡plum!, ya era el ajuste" |
| `yield_adjustment:read` | Read adjustment history |
| `milling:create` | Create milling orders (órdenes de tría) |
| `milling:write` | Modify milling orders: which receipts to include, target quality profile, destination beneficio |
| `milling:read` | Read milling order data and results |
| `milling:result_write` | Record milling results (oro produced, subproductos, merma) |
| `inventory:read` | Read inventory — Hector: "Necesito un inventario en calidad de hoy... este proveedor, esta calidad, esta bodega" — this is how he plans trías |
| `inventory:update_quality` | Update quality classification of inventory items based on cupping results |
| `receipt:read` | Read receipt data (linked to samples and cuppings) |
| `subproducto:write` | Record subproduct data from milling |
| `subproducto:read` | Read subproduct data |

**Sample types (from Hector's enumeration):**

1. Oferta de compra (purchase offer)
2. Oferta de venta (sales offer)
3. Muestra de ingreso de café (intake sample)
4. Muestra de resultado de tría (milling result sample)
5. Muestra pre-embarque (pre-shipment sample)
6. Muestra tipo (type/reference sample)

The `sample:create` permission must enforce selection of one of these types. Each type links to different parent entities (OC, contract, receipt, milling order, shipment).

---

### 2.7 ANALISIS

**Real person:** José Roberto Lopez (Analyst).  
**Purpose:** Financial analysis, cost control, inventory reconciliation (financial), margin analysis, reporting.

**Justification from transcriptions:**

Roberto: "Yo puedo tener un reporte de inventarios pero no es tu reporte de inventarios — fueron elaborados con finalidad diferente. Mi reporte es para análisis financiero." He calculates cost of coffee across the entire chain: materia prima + flete + custodio + seguro + sacos + comisión. He tracks anticipos per producer, calculates costo promedio (with and without expensive OC exclusions), projects costs for pending OCs, and produces the reports Octavio reviews. He explicitly does NOT modify operational data.

| Permission | Rationale |
|---|---|
| `purchase_order:read` | Core input for all cost analysis |
| `purchase_order:version_history` | Needs to see OC change history for audit/reconciliation |
| `receipt:read` | Needs receipt-level detail for cost calculation per tría |
| `contract:read` | Needs sales contract data for margin calculation |
| `cupping:read` | Quality data feeds into cost/value analysis |
| `milling:read` | Tría data is where cost transforms (pergamino → oro + subproductos) |
| `inventory:read` | Financial inventory view: what exists, at what cost, in what state |
| `shipment:read` | Shipment data for export cost calculation |
| `lot:read` | Lot data for per-export cost calculation |
| `cost:read` | Read all cost data |
| `cost:write` | Calculate and record cost breakdowns: assign flete, custodio, seguro, sacos to OCs/receipts — Roberto: "Yo metí el dato así a la línea" |
| `cost:prorate` | Pro-rate additional costs across receipts within an OC (currently done manually, system should automate) |
| `margin:read` | Read margin calculations |
| `margin:write` | Create margin analysis scenarios (include/exclude specific OCs, compare projections) |
| `payment:read` | Read payment data (anticipos, liquidaciones, saldos) |
| `supplier:read` | Read supplier data (cost analysis by producer) |
| `report:create` | Generate financial reports |
| `report:read` | Read all reports |
| `subproducto:read` | Read subproduct data (has cost/value implications) |
| `market:read` | Read market data for analysis |

**What Roberto cannot do:**

- Cannot create or modify purchase orders, sales contracts, cupping data, milling orders, or shipments.
- Cannot manage users, suppliers, or farms.
- Cannot modify receipt assignments (that's José's job).
- Roberto: "Yo no quiero modificar nada... las órdenes de compra y lo vendemos, no tengo por qué."

---

### 2.8 CONTABILIDAD

**Real person:** José Roberto Lopez (link to corporate accounting).  
**Purpose:** Interface between HopeCoffee operational data and Contapyme (accounting system). Journal entries, payment processing, fiscal document management.

**Justification from transcriptions:**

Roberto manages the Contapyme accounting system. He creates journal entries from operational data (one-line entries with detail/reference text). He tracks fiscal identities (razón social vs. nombre comercial — his recurring pain: "Serengeti" commercially vs. the fiscal name on invoices). He processes payments to producers, manages anticipos, and reconciles bank accounts against the operational data.

| Permission | Rationale |
|---|---|
| `payment:write` | Create/process payments to producers, manage anticipos |
| `payment:read` | Read payment history and balances |
| `payment:reconcile` | Reconcile payments against bank statements and OCs |
| `accounting:write` | Create journal entries, accounting records |
| `accounting:read` | Read accounting data |
| `fiscal_entity:write` | Manage fiscal entity records (razón social, NIT, bank accounts) — Roberto's pain: commercial names don't match fiscal names |
| `fiscal_entity:read` | Read fiscal entity data |
| `supplier:read` | Read supplier data (for payment processing) |
| `purchase_order:read` | Read OCs (payment amounts come from here) |
| `receipt:read` | Read receipts (payment details reference specific receipts) |
| `export_document:write` | Create/manage export fiscal documents (FECSA invoices, etc.) |
| `export_document:read` | Read export documents |
| `cost:read` | Read cost data (feeds into accounting entries) |
| `subproducto:read` | Read subproduct data (has accounting implications — value recognition) |

---

### 2.9 Future Roles (Defined Now, Assigned Later)

These roles should exist in the schema from day one even if no user is assigned yet. They prevent scope creep on existing roles.

#### 2.9.1 LOGISTICA

**Future person:** Evelyn (currently under Hector's supervision).  
**Purpose:** Shipment logistics, booking management, sack design coordination, loading schedules.

When Evelyn gets her own login, she should not inherit Hector's full VENTAS or LAB permissions. She needs:

| Permission | Rationale |
|---|---|
| `shipment:write` | Manage bookings, itineraries, loading dates |
| `shipment:read` | Read shipment data |
| `container:write` | Manage container records |
| `container:read` | Read container data |
| `sack_design:write` | Create/upload sack designs for approval |
| `sack_design:read` | Read sack design approvals |
| `contract:read` | Read contracts (needs shipping instructions from client) |
| `lot:read` | Read lot data (needs to know what's being shipped) |
| `booking:write` | Manage booking records specifically |
| `booking:read` | Read booking data |
| `inventory:read` | Read inventory (needs to confirm stock for loading) |

#### 2.9.2 LAB_ASISTENTE

**Future person:** Douglas (currently enters cupping data from Hector's paper forms).  
**Purpose:** Lab data entry, field quality control, sample management.

| Permission | Rationale |
|---|---|
| `sample:create` | Create sample records (RM assignments) |
| `sample:write` | Enter sample metadata |
| `sample:read` | Read sample data |
| `cupping:create` | Create cupping sessions (data entry from Hector's paper evaluations) |
| `cupping:write` | Enter cupping data |
| `cupping:read` | Read cupping data |
| `receipt:read` | Read receipt data (to link samples to receipts) |
| `inventory:read` | Read inventory (field quality control during trías) |
| `milling:read` | Read milling orders (needs to know what's being processed when at beneficio) |

---

## 3. Permission Catalog

Complete enumeration of all permissions referenced above, organized by domain.

### 3.1 Dashboard & Reports

| Permission | Description |
|---|---|
| `dashboard:read` | View executive dashboards with all filters/drilldowns |
| `report:create` | Generate reports |
| `report:read` | View reports |

### 3.2 Sales Contracts

| Permission | Description |
|---|---|
| `contract:create` | Create sales contracts |
| `contract:write` | Modify contract operational fields |
| `contract:update_financial` | Modify contract financial terms (price, differential) |
| `contract:change_status` | Transition contract through lifecycle states |
| `contract:read` | View contracts |
| `contract:lot_allocate` | Assign inventory/lots to contracts |
| `contract:delete` | Soft-delete contracts (MASTER only) |

### 3.3 Purchase Orders

| Permission | Description |
|---|---|
| `purchase_order:create` | Create OCs |
| `purchase_order:write` | Modify OC fields |
| `purchase_order:close` | Close an OC |
| `purchase_order:read` | View OCs |
| `purchase_order:delete` | Soft-delete OCs (MASTER only) |
| `purchase_order:version_history` | View OC change history |

### 3.4 Receipts (Recibos)

| Permission | Description |
|---|---|
| `receipt:create` | Create receipt records (triggered by beneficio intake) |
| `receipt:read` | View receipts |
| `receipt:assign_to_oc` | Assign receipt to an OC |
| `receipt:split` | Split receipt across multiple OCs |
| `receipt:reassign` | Move receipt assignment between OCs |

### 3.5 Quality & Lab

| Permission | Description |
|---|---|
| `cupping:create` | Create cupping sessions |
| `cupping:write` | Record cupping data (SCA parameters, descriptors, defects) |
| `cupping:read` | View cupping data |
| `sample:create` | Create sample records (RM) |
| `sample:write` | Modify sample metadata |
| `sample:read` | View sample data |
| `yield_adjustment:create` | Trigger rendimiento-based price adjustments |
| `yield_adjustment:read` | View yield adjustment history |

### 3.6 Milling (Trías)

| Permission | Description |
|---|---|
| `milling:create` | Create milling orders |
| `milling:write` | Modify milling orders |
| `milling:read` | View milling orders and results |
| `milling:result_write` | Record milling results (oro, subproductos, merma) |

### 3.7 Inventory

| Permission | Description |
|---|---|
| `inventory:read` | View inventory (scope depends on role — lab sees quality, analyst sees cost) |
| `inventory:update_quality` | Update quality classification based on cupping |

### 3.8 Lots & Containers

| Permission | Description |
|---|---|
| `lot:create` | Create export lots (OIC-numbered) |
| `lot:write` | Modify lot composition |
| `lot:read` | View lots |
| `container:write` | Create/modify containers |
| `container:lot_assign` | Assign lots to containers |
| `container:read` | View containers |

### 3.9 Shipments & Logistics

| Permission | Description |
|---|---|
| `shipment:write` | Create/modify shipments |
| `shipment:read` | View shipments |
| `shipment:assign_contract` | Link shipments to contracts |
| `shipment:party_write` | Manage shipment party records |
| `shipment:delete` | Soft-delete shipments (MASTER only) |
| `booking:write` | Manage bookings |
| `booking:read` | View bookings |
| `sack_design:write` | Upload sack designs |
| `sack_design:approve` | Approve sack designs |
| `sack_design:read` | View sack designs |

### 3.10 Financial & Cost

| Permission | Description |
|---|---|
| `cost:read` | View cost data |
| `cost:write` | Record cost breakdowns (flete, custodio, seguro, etc.) |
| `cost:prorate` | Pro-rate costs across receipts |
| `cost:exclude_oc` | Mark OCs as excluded from standard cost average |
| `margin:read` | View margin data |
| `margin:write` | Create margin analysis scenarios |
| `margin:configure` | Configure margin calculation parameters |
| `exchange_rate:write` | Set exchange rates |
| `export_cost:write` | Define export cost parameters |

### 3.11 Payments & Accounting

| Permission | Description |
|---|---|
| `payment:write` | Process payments, manage anticipos |
| `payment:read` | View payment data |
| `payment:reconcile` | Reconcile payments vs bank/OCs |
| `accounting:write` | Create journal entries |
| `accounting:read` | View accounting data |
| `export_document:write` | Create export fiscal documents |
| `export_document:read` | View export documents |

### 3.12 Entities

| Permission | Description |
|---|---|
| `supplier:write` | Create/modify suppliers |
| `supplier:read` | View suppliers |
| `supplier_account:write` | Manage supplier bank/fiscal accounts |
| `farm:write` | Create/modify farms |
| `farm:read` | View farms |
| `fiscal_entity:write` | Manage fiscal entities (razón social, NIT) |
| `fiscal_entity:read` | View fiscal entities |
| `crm:write` | Manage client/broker/importer records |
| `crm:read` | View CRM data |

### 3.13 Market

| Permission | Description |
|---|---|
| `market:write` | Post market price updates with timestamp |
| `market:read` | View market data history |

### 3.14 Delivery

| Permission | Description |
|---|---|
| `delivery:write` | Manage incoming delivery logistics |
| `delivery:read` | View delivery data |

### 3.15 System Administration

| Permission | Description |
|---|---|
| `user:manage` | Create/modify/deactivate users, assign roles |
| `audit_log:view` | View audit trail |
| `import:execute` | Execute bulk data imports |
| `facility:manage` | Manage beneficio/warehouse records |
| `system:configure` | System-level configuration |

---

## 4. Role × Permission Matrix

Summary view. ✓ = granted. Blank = denied.

| Permission | MASTER | GERENCIA | FINANCIERO | COMPRAS | VENTAS | LAB | ANALISIS | CONTABILIDAD |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `dashboard:read` | ✓ | ✓ | | | | | | |
| `report:create` | ✓ | | | | | | ✓ | |
| `report:read` | ✓ | ✓ | | | ✓ | | ✓ | |
| `contract:create` | ✓ | | | | ✓ | | | |
| `contract:write` | ✓ | | | | ✓ | | | |
| `contract:update_financial` | ✓ | | ✓ | | | | | |
| `contract:change_status` | ✓ | | | | ✓ | | | |
| `contract:read` | ✓ | ✓ | | ✓ | ✓ | | ✓ | |
| `contract:lot_allocate` | ✓ | | | | ✓ | | | |
| `contract:delete` | ✓ | | | | | | | |
| `purchase_order:create` | ✓ | | | ✓ | | | | |
| `purchase_order:write` | ✓ | | | ✓ | | | | |
| `purchase_order:close` | ✓ | | | ✓ | | | | |
| `purchase_order:read` | ✓ | ✓ | | ✓ | ✓ | | ✓ | ✓ |
| `purchase_order:delete` | ✓ | | | | | | | |
| `purchase_order:version_history` | ✓ | | | ✓ | | | ✓ | |
| `receipt:create` | ✓ | | | | | | | |
| `receipt:read` | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ | ✓ |
| `receipt:assign_to_oc` | ✓ | | | ✓ | | | | |
| `receipt:split` | ✓ | | | ✓ | | | | |
| `receipt:reassign` | ✓ | | | ✓ | | | | |
| `cupping:create` | ✓ | | | | | ✓ | | |
| `cupping:write` | ✓ | | | | | ✓ | | |
| `cupping:read` | ✓ | ✓ | | ✓ | | ✓ | ✓ | |
| `sample:create` | ✓ | | | | | ✓ | | |
| `sample:write` | ✓ | | | | | ✓ | | |
| `sample:read` | ✓ | | | | | ✓ | | |
| `yield_adjustment:create` | ✓ | | | | | ✓ | | |
| `yield_adjustment:read` | ✓ | | | | | ✓ | ✓ | |
| `milling:create` | ✓ | | | | | ✓ | | |
| `milling:write` | ✓ | | | | | ✓ | | |
| `milling:read` | ✓ | ✓ | | | | ✓ | ✓ | |
| `milling:result_write` | ✓ | | | | | ✓ | | |
| `inventory:read` | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ | |
| `inventory:update_quality` | ✓ | | | | | ✓ | | |
| `lot:create` | ✓ | | | | ✓ | | | |
| `lot:write` | ✓ | | | | ✓ | | | |
| `lot:read` | ✓ | ✓ | | | ✓ | | ✓ | |
| `container:write` | ✓ | | | | ✓ | | | |
| `container:lot_assign` | ✓ | | | | ✓ | | | |
| `container:read` | ✓ | ✓ | | | ✓ | | | |
| `shipment:write` | ✓ | | | | ✓ | | | |
| `shipment:read` | ✓ | ✓ | | | ✓ | | ✓ | |
| `shipment:assign_contract` | ✓ | | | | ✓ | | | |
| `shipment:party_write` | ✓ | | | | ✓ | | | |
| `shipment:delete` | ✓ | | | | | | | |
| `cost:read` | ✓ | ✓ | | ✓ | | | ✓ | ✓ |
| `cost:write` | ✓ | | | | | | ✓ | |
| `cost:prorate` | ✓ | | | | | | ✓ | |
| `cost:exclude_oc` | ✓ | | ✓ | | | | | |
| `margin:read` | ✓ | ✓ | | | | | ✓ | |
| `margin:write` | ✓ | | | | | | ✓ | |
| `margin:configure` | ✓ | | ✓ | | | | | |
| `exchange_rate:write` | ✓ | | ✓ | | | | | |
| `export_cost:write` | ✓ | | ✓ | | | | | |
| `payment:write` | ✓ | | | | | | | ✓ |
| `payment:read` | ✓ | ✓ | | | | | ✓ | ✓ |
| `payment:reconcile` | ✓ | | | | | | | ✓ |
| `accounting:write` | ✓ | | | | | | | ✓ |
| `accounting:read` | ✓ | | | | | | | ✓ |
| `supplier:write` | ✓ | | | ✓ | | | | |
| `supplier:read` | ✓ | ✓ | | ✓ | | | ✓ | ✓ |
| `supplier_account:write` | ✓ | | | ✓ | | | | |
| `farm:write` | ✓ | | | ✓ | | | | |
| `farm:read` | ✓ | ✓ | | ✓ | | | | |
| `fiscal_entity:write` | ✓ | | | | | | | ✓ |
| `fiscal_entity:read` | ✓ | | | | | | | ✓ |
| `crm:write` | ✓ | | | | ✓ | | | |
| `crm:read` | ✓ | ✓ | | | ✓ | | | |
| `market:write` | ✓ | | | | ✓ | | | |
| `market:read` | ✓ | ✓ | | | ✓ | ✓ | ✓ | |
| `delivery:write` | ✓ | | | ✓ | | | | |
| `user:manage` | ✓ | | | | | | | |
| `audit_log:view` | ✓ | | | | | | ✓ | ✓ |
| `import:execute` | ✓ | | | | | | | |
| `facility:manage` | ✓ | | | | | | | |
| `system:configure` | ✓ | | | | | | | |
| `export_document:write` | ✓ | | | | | | | ✓ |
| `export_document:read` | ✓ | | | | | | ✓ | ✓ |

---

## 5. User × Role Assignment

| User | Roles | Justification |
|---|---|---|
| Developer | MASTER | System owner, full control |
| Octavio Herrera | GERENCIA + FINANCIERO | CEO dashboards (read-only) + active financial parameter control |
| Hector Gonzalez | VENTAS + LAB | Sales management + quality lab — his two daily functions |
| José Herrera | COMPRAS | Sourcing and purchasing lifecycle (pending interview validation) |
| José Roberto Lopez | ANALISIS + CONTABILIDAD | Financial analysis + accounting system link |
| Evelyn (future) | LOGISTICA | Logistics and export coordination (when she gets her own login) |
| Douglas (future) | LAB_ASISTENTE | Lab data entry and field QC (when he gets his own login) |

---

## 6. Migration Path from Current RBAC

Current state → proposed state mapping:

| Current Role | Current Permissions | Proposed Mapping |
|---|---|---|
| `ADMIN` | All | `MASTER` — direct 1:1 |
| `FIELD_OPERATOR` | 11 write permissions across field domains | Split into `COMPRAS`, `VENTAS`, `LAB` depending on user. The current role was overloaded — Hector had permissions he didn't use (e.g., `purchase_order:write`), and José would need permissions Hector had (e.g., `cupping:write`) |
| `FINANCIAL_OPERATOR` | 3 financial write permissions + shared permissions | Split into `FINANCIERO` (Octavio's active financial controls) + `ANALISIS` + `CONTABILIDAD` (Roberto's analytical and accounting work) |
| `VIEWER` | None (read-only) | `GERENCIA` — Octavio's dashboard role. The current VIEWER was too restrictive (no explicit read permissions) and too generic |

**Breaking change:** The `UserRole` enum in Prisma goes from 4 values to 10 (8 active + 2 future). Every `requirePermission()` call in the 16 action files continues to work unchanged — the enforcement mechanism doesn't change, only the role→permission mappings.

**Migration steps:**

1. Update `UserRole` enum in Prisma schema.
2. Update `permissions.ts` with new role→permission mappings.
3. Assign new roles to existing users.
4. Add new permissions to server actions as new features (CRM, market, sack design, etc.) ship.
5. Audit all 16 existing action files against the new permission catalog — verify no action uses a permission string not in the catalog.

---

## 7. Open Questions

1. **José Herrera interview.** All COMPRAS permissions are inferred. Key unknowns: does he need `contract:read`? Does he interact with cupping data beyond reading? Does he manage delivery logistics himself or delegate? What is his OC numbering convention and does he want to keep it?

2. **Receipt creation trigger.** Who creates receipt records in the system? Currently unclear. Beneficios have their own systems (La Joya has a web system). Roberto wants internal receipt codes separate from beneficio codes. The `receipt:create` permission is assigned only to MASTER until this is clarified — it may need to go to COMPRAS or be an automated integration.

3. **Notification system.** Roberto's core pain is not knowing things happened. The RBAC defines who can see what — but the system also needs event-driven notifications (OC created → notify Roberto; receipt assigned → notify Roberto; tría started → notify Roberto). This is separate from RBAC but must be designed alongside it.

4. **Subproduct negotiation.** Roberto described a special case with Servicios Nacionales de Bodega where subproduct value is deducted from payment and maquila cost is added. The `cost:write` permission covers this, but the business logic is complex enough to warrant its own feature spec.

5. **Contapyme integration scope.** Roberto currently uses Contapyme for accounting and wants to migrate to Odum 19. The CONTABILIDAD role is designed around the system being the source of truth — but during transition, data may flow both ways. Integration details are TBD.

6. **Douglas and Evelyn activation timeline.** Their roles are defined but unassigned. When they get logins, do they keep accessing through Hector's workflow, or do they operate independently?
