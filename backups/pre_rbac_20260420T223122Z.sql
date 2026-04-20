--
-- PostgreSQL database dump
--

\restrict K3oDpIwxnhpqeFdmVc5cuD4yflorPTzFDPDiNm6CPr800beZhX9hX3E3SLIxDsQ

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: CoffeeRegion; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CoffeeRegion" AS ENUM (
    'SANTA_ROSA',
    'HUEHUETENANGO',
    'ORGANICO',
    'DANILANDIA',
    'SANTA_ISABEL',
    'OTHER'
);


--
-- Name: ContractStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ContractStatus" AS ENUM (
    'NEGOCIACION',
    'CONFIRMADO',
    'FIJADO',
    'NO_FIJADO',
    'EMBARCADO',
    'LIQUIDADO',
    'CANCELADO'
);


--
-- Name: ExportingEntity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ExportingEntity" AS ENUM (
    'EXPORTADORA',
    'FINCA_DANILANDIA',
    'STOCK_LOCK'
);


--
-- Name: FacilityType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."FacilityType" AS ENUM (
    'BENEFICIO',
    'BODEGA',
    'PATIO'
);


--
-- Name: LotStage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LotStage" AS ENUM (
    'PERGAMINO_BODEGA',
    'EN_PROCESO',
    'ORO_EXPORTABLE',
    'EXPORTADO',
    'SUBPRODUCTO'
);


--
-- Name: MillingOrderStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MillingOrderStatus" AS ENUM (
    'PENDIENTE',
    'EN_PROCESO',
    'COMPLETADO'
);


--
-- Name: MillingOutputType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MillingOutputType" AS ENUM (
    'ORO_EXPORTABLE',
    'SEGUNDA',
    'CASCARILLA',
    'MERMA'
);


--
-- Name: POStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."POStatus" AS ENUM (
    'PENDIENTE',
    'RECIBIDO',
    'LIQUIDADO'
);


--
-- Name: PosicionBolsa; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PosicionBolsa" AS ENUM (
    'MAR',
    'MAY',
    'JUL',
    'SEP',
    'DEC'
);


--
-- Name: ShipmentPartyRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ShipmentPartyRole" AS ENUM (
    'BROKER',
    'IMPORTER',
    'BUYER'
);


--
-- Name: ShipmentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ShipmentStatus" AS ENUM (
    'PREPARACION',
    'EMBARCADO',
    'LIQUIDADO'
);


--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."UserRole" AS ENUM (
    'ADMIN',
    'FIELD_OPERATOR',
    'FINANCIAL_OPERATOR',
    'VIEWER'
);


--
-- Name: YieldAdjustmentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."YieldAdjustmentStatus" AS ENUM (
    'PENDIENTE',
    'APLICADO',
    'RECHAZADO'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    "userId" text NOT NULL,
    action text NOT NULL,
    entity text NOT NULL,
    "entityId" text NOT NULL,
    "oldValue" jsonb,
    "newValue" jsonb,
    "ipAddress" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    country text,
    contact text,
    email text,
    phone text,
    notes text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: container_lots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.container_lots (
    id text NOT NULL,
    "containerId" text NOT NULL,
    "lotId" text NOT NULL,
    "quantityQQ" numeric(10,2) NOT NULL
);


--
-- Name: containers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.containers (
    id text NOT NULL,
    "shipmentId" text NOT NULL,
    "containerNum" text,
    "blNumber" text,
    "sealNumber" text,
    "weightKg" numeric(10,2),
    vessel text,
    port text,
    eta timestamp(3) without time zone,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: contract_lot_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_lot_allocations (
    id text NOT NULL,
    "contractId" text NOT NULL,
    "lotId" text NOT NULL,
    "quantityQQ" numeric(10,2) NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: contract_price_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_price_snapshots (
    id text NOT NULL,
    "contractId" text NOT NULL,
    "precioBolsa" numeric(10,2),
    diferencial numeric(10,2),
    "tipoCambio" numeric(10,4),
    "posicionBolsa" public."PosicionBolsa",
    status public."ContractStatus" NOT NULL,
    "triggeredBy" text,
    reason text,
    "snapshotAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contracts (
    id text NOT NULL,
    "contractNumber" text NOT NULL,
    "clientId" text NOT NULL,
    "shipmentId" text,
    status public."ContractStatus" DEFAULT 'NEGOCIACION'::public."ContractStatus" NOT NULL,
    regions public."CoffeeRegion"[],
    puntaje integer NOT NULL,
    sacos69kg numeric(10,2) NOT NULL,
    sacos46kg numeric(10,2) NOT NULL,
    "precioBolsa" numeric(10,2),
    diferencial numeric(10,2),
    "precioBolsaDif" numeric(10,2),
    "comisionCompra" numeric(10,2),
    "comisionVenta" numeric(10,2),
    "montoCredito" numeric(14,2),
    cosecha text,
    "posicionBolsa" public."PosicionBolsa",
    "posicionNY" timestamp(3) without time zone,
    "fechaEmbarque" timestamp(3) without time zone,
    lote text,
    "facturacionLbs" numeric(14,2),
    "facturacionKgs" numeric(14,2),
    "gastosExport" numeric(14,2),
    "utilidadSinGE" numeric(14,2),
    "costoFinanciero" numeric(14,2),
    "utilidadSinCF" numeric(14,2),
    "tipoCambio" numeric(10,4),
    "totalPagoQTZ" numeric(14,2),
    notes text,
    "computedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "exportCostConfigId" text,
    "gastosPerSaco" numeric(10,2),
    "exportTrillaPerQQ" numeric(10,2),
    "exportSacoYute" numeric(10,2),
    "exportEstampado" numeric(10,2),
    "exportBolsaGrainPro" numeric(10,2),
    "exportFitoSanitario" numeric(10,2),
    "exportImpuestoAnacafe1" numeric(10,2),
    "exportImpuestoAnacafe2" numeric(10,2),
    "exportInspeccionOirsa" numeric(10,2),
    "exportFumigacion" numeric(10,2),
    "exportEmisionDocumento" numeric(10,2),
    "exportFletePuerto" numeric(10,2),
    "exportSeguro" numeric(10,2),
    "exportCustodio" numeric(10,2),
    "exportAgenteAduanal" numeric(10,2),
    "exportComisionOrganico" numeric(10,2),
    "cfTasaAnual" numeric(6,4),
    "cfMeses" integer,
    "precioPromedioInv" numeric(10,2),
    subproductos numeric(10,2),
    "precioSubproducto" numeric(10,2),
    "cooContractName" text,
    "officialCorrelative" text,
    "isrAmount" numeric(14,2),
    "isrRate" numeric(6,4),
    "exportingEntity" public."ExportingEntity" DEFAULT 'EXPORTADORA'::public."ExportingEntity" NOT NULL,
    "facturacionKgsOverride" numeric(14,2),
    "overrideReason" text
);


--
-- Name: cupping_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cupping_records (
    id text NOT NULL,
    "lotId" text NOT NULL,
    "catadorUserId" text,
    date timestamp(3) without time zone NOT NULL,
    fragrance numeric(4,2) NOT NULL,
    flavor numeric(4,2) NOT NULL,
    aftertaste numeric(4,2) NOT NULL,
    acidity numeric(4,2) NOT NULL,
    body numeric(4,2) NOT NULL,
    balance numeric(4,2) NOT NULL,
    uniformity numeric(4,2) NOT NULL,
    "cleanCup" numeric(4,2) NOT NULL,
    sweetness numeric(4,2) NOT NULL,
    overall numeric(4,2) NOT NULL,
    "totalScore" numeric(5,2) NOT NULL,
    "moisturePercent" numeric(4,2),
    "defectCount" integer,
    "screenSize" text,
    "waterActivity" numeric(3,2),
    "yieldMeasured" numeric(8,6),
    "purchaseOrderId" text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: exchange_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exchange_rates (
    id text NOT NULL,
    rate numeric(10,4) NOT NULL,
    "validFrom" timestamp(3) without time zone NOT NULL,
    "validTo" timestamp(3) without time zone,
    "isActive" boolean DEFAULT true NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: export_cost_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.export_cost_configs (
    id text NOT NULL,
    name text NOT NULL,
    "gastosPerSaco" numeric(10,2) NOT NULL,
    "trillaPerQQ" numeric(10,2) NOT NULL,
    "sacoYute" numeric(10,2) NOT NULL,
    estampado numeric(10,2) NOT NULL,
    "bolsaGrainPro" numeric(10,2) NOT NULL,
    "fitoSanitario" numeric(10,2) NOT NULL,
    "impuestoAnacafe1" numeric(10,2) NOT NULL,
    "impuestoAnacafe2" numeric(10,2) NOT NULL,
    "inspeccionOirsa" numeric(10,2) NOT NULL,
    fumigacion numeric(10,2) NOT NULL,
    "emisionDocumento" numeric(10,2) NOT NULL,
    "fletePuerto" numeric(10,2) NOT NULL,
    seguro numeric(10,2) NOT NULL,
    custodio numeric(10,2) NOT NULL,
    "agenteAduanal" numeric(10,2) NOT NULL,
    "comisionExportadorOrganico" numeric(10,2) DEFAULT 0 NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: facilities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.facilities (
    id text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    type public."FacilityType" NOT NULL,
    capacity numeric(10,2),
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: farms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.farms (
    id text NOT NULL,
    name text NOT NULL,
    "totalQuetzales" numeric(14,2) NOT NULL,
    "tipoCambio" numeric(10,4) NOT NULL,
    "totalUSD" numeric(14,2) NOT NULL,
    porcentaje numeric(8,6) NOT NULL,
    "aumentoPorcentaje" numeric(8,4) NOT NULL,
    "nuevoTotal" numeric(14,2) NOT NULL,
    "porcentajePrest" numeric(6,4) NOT NULL,
    "totalPrestamo" numeric(14,2) NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: lots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lots (
    id text NOT NULL,
    "lotNumber" text NOT NULL,
    "supplierId" text,
    "facilityId" text,
    "purchaseOrderId" text,
    stage public."LotStage" DEFAULT 'PERGAMINO_BODEGA'::public."LotStage" NOT NULL,
    "quantityQQ" numeric(10,2) NOT NULL,
    "qualityGrade" text,
    "cuppingScore" numeric(5,2),
    "receptionDate" timestamp(3) without time zone,
    "sourceAccountEntryId" text,
    "contractedYield" numeric(8,6),
    "actualYield" numeric(8,6),
    "costPerQQ" numeric(10,2),
    "parentLotId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: materia_prima; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.materia_prima (
    id text NOT NULL,
    "shipmentId" text NOT NULL,
    "supplierId" text,
    "supplierNote" text,
    "isPurchased" boolean DEFAULT false NOT NULL,
    punteo integer NOT NULL,
    oro numeric(10,2) NOT NULL,
    rendimiento numeric(8,6) NOT NULL,
    pergamino numeric(10,2) NOT NULL,
    "precioPromQ" numeric(10,2) NOT NULL,
    "totalMP" numeric(14,2) NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: materia_prima_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.materia_prima_allocations (
    id text NOT NULL,
    "materiaPrimaId" text NOT NULL,
    "contractId" text NOT NULL,
    "quintalesAllocated" numeric(10,2)
);


--
-- Name: milling_inputs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.milling_inputs (
    id text NOT NULL,
    "millingOrderId" text NOT NULL,
    "lotId" text NOT NULL,
    "quantityQQ" numeric(10,2) NOT NULL
);


--
-- Name: milling_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.milling_orders (
    id text NOT NULL,
    "orderNumber" text NOT NULL,
    "facilityId" text,
    date timestamp(3) without time zone NOT NULL,
    "operatorUserId" text,
    status public."MillingOrderStatus" DEFAULT 'PENDIENTE'::public."MillingOrderStatus" NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: milling_outputs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.milling_outputs (
    id text NOT NULL,
    "millingOrderId" text NOT NULL,
    "lotId" text,
    "quantityQQ" numeric(10,2) NOT NULL,
    "outputType" public."MillingOutputType" NOT NULL,
    "qualityGrade" text,
    "costPerQQ" numeric(10,2)
);


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_orders (
    id text NOT NULL,
    "orderNumber" text NOT NULL,
    "supplierId" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    status public."POStatus" DEFAULT 'PENDIENTE'::public."POStatus" NOT NULL,
    cosecha text,
    "quintalesPerg" numeric(10,2) NOT NULL,
    "precioPerg" numeric(10,2) NOT NULL,
    "totalCafe" numeric(14,2) NOT NULL,
    "fletePorQQ" numeric(10,2) NOT NULL,
    "totalFlete" numeric(14,2) NOT NULL,
    seguridad numeric(10,2) NOT NULL,
    seguro numeric(10,2) NOT NULL,
    cadena numeric(10,2) DEFAULT 0 NOT NULL,
    cargas numeric(10,2) DEFAULT 0 NOT NULL,
    descargas numeric(10,2) DEFAULT 0 NOT NULL,
    "costoTotalAccum" numeric(14,2) NOT NULL,
    "precioPromedio" numeric(10,4) NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: shipment_parties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipment_parties (
    id text NOT NULL,
    "shipmentId" text NOT NULL,
    "clientId" text NOT NULL,
    role public."ShipmentPartyRole" NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: shipments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipments (
    id text NOT NULL,
    name text NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    status public."ShipmentStatus" DEFAULT 'PREPARACION'::public."ShipmentStatus" NOT NULL,
    "numContainers" integer NOT NULL,
    regions text,
    "posicionDate" timestamp(3) without time zone,
    "embarqueDate" timestamp(3) without time zone,
    "exportCostConfigId" text,
    "gastosPerSaco" numeric(10,2),
    "totalSacos69" numeric(10,2),
    "totalSacos46" numeric(10,2),
    "totalFacturacionLbs" numeric(14,2),
    "totalFacturacionKgs" numeric(14,2),
    "totalGastosExport" numeric(14,2),
    "totalUtilidadSinGE" numeric(14,2),
    "totalCostoFinanc" numeric(14,2),
    "totalUtilidadSinCF" numeric(14,2),
    "totalPagoQTZ" numeric(14,2),
    "totalMateriaPrima" numeric(14,2),
    "totalComision" numeric(14,2),
    "totalSubproducto" numeric(14,2),
    "utilidadBruta" numeric(14,2),
    "margenBruto" numeric(8,6),
    notes text,
    "aggregatedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "totalFacturacionQTZ" numeric(14,2),
    "totalISR" numeric(14,2)
);


--
-- Name: subproductos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subproductos (
    id text NOT NULL,
    "shipmentId" text NOT NULL,
    contenedores numeric(10,4) NOT NULL,
    "oroPerCont" numeric(10,2) NOT NULL,
    "totalOro" numeric(10,2) NOT NULL,
    "precioSinIVA" numeric(10,2) NOT NULL,
    "totalPerga" numeric(14,2) NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: supplier_account_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_account_entries (
    id text NOT NULL,
    "supplierId" text NOT NULL,
    "orderCode" text NOT NULL,
    "ingresoNum" integer NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    pergamino numeric(10,2) NOT NULL,
    precio numeric(10,2) NOT NULL,
    total numeric(14,2) NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "facilityId" text,
    "lotId" text,
    "qualityGrade" text
);


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    contact text,
    email text,
    phone text,
    notes text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    "passwordHash" text NOT NULL,
    role public."UserRole" DEFAULT 'VIEWER'::public."UserRole" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "lastLoginAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: yield_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.yield_adjustments (
    id text NOT NULL,
    "cuppingRecordId" text NOT NULL,
    "supplierAccountEntryId" text,
    "contractedYield" numeric(8,6) NOT NULL,
    "actualYield" numeric(8,6) NOT NULL,
    "toleranceApplied" numeric(8,6) NOT NULL,
    "priceAdjustmentPerQQ" numeric(10,2) NOT NULL,
    "totalAdjustment" numeric(14,2) NOT NULL,
    status public."YieldAdjustmentStatus" DEFAULT 'PENDIENTE'::public."YieldAdjustmentStatus" NOT NULL,
    "appliedAt" timestamp(3) without time zone,
    "appliedByUserId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: yield_tolerance_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.yield_tolerance_config (
    id text NOT NULL,
    "toleranceValue" numeric(8,6) DEFAULT 0.01 NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "updatedByUserId" text
);


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_logs (id, "userId", action, entity, "entityId", "oldValue", "newValue", "ipAddress", "createdAt") FROM stdin;
cmns4nopi0003jk047sbjomik	cmmfcf92000003q4vl76vg9gy	CREATE	Contract	cmns4nonn0001jk04t4xkspfq	\N	{"id": "cmns4nonn0001jk04t4xkspfq", "lote": "Santa Rosa", "notes": "", "status": "FIJADO", "cosecha": "25/26", "puntaje": 82, "regions": ["SANTA_ROSA"], "clientId": "cmmfcf9op00013q4vhfulmklk", "createdAt": "2026-04-09T23:48:00.275Z", "sacos46kg": "412.5", "sacos69kg": "275", "updatedAt": "2026-04-09T23:48:00.275Z", "computedAt": "2026-04-09T23:48:00.121Z", "posicionNY": null, "shipmentId": null, "tipoCambio": "7.65", "diferencial": "15", "precioBolsa": "380", "rendimiento": "1.32", "gastosExport": "6325", "montoCredito": "0", "totalPagoQTZ": "1233516.81", "comisionVenta": "618.75", "fechaEmbarque": null, "posicionBolsa": "MAR", "utilidadSinCF": "161244.03", "utilidadSinGE": "161244.03", "comisionCompra": "618.75", "contractNumber": "P40029", "facturacionKgs": "167569.03", "facturacionLbs": "165237.53", "precioBolsaDif": "395", "costoFinanciero": "0", "tipoFacturacion": "LIBRAS_ESPANOLAS", "exportCostConfigId": "cmmfcfec4000c3q4ve2kznkuw"}	\N	2026-04-09 23:48:00.342
\.


--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.clients (id, name, code, country, contact, email, phone, notes, "isActive", "createdAt", "updatedAt") FROM stdin;
cmmfcf9op00013q4vhfulmklk	Serengetti	SER	USA	\N	\N	\N	\N	t	2026-03-06 20:24:41.929	2026-03-06 20:24:41.929
cmmfcfabo00023q4vxp69c328	Swiss Water	SWP	Canada	\N	\N	\N	\N	t	2026-03-06 20:24:42.756	2026-03-06 20:24:42.756
cmmfcfapt00033q4vycf8l3wx	Opal	OPL	USA	\N	\N	\N	\N	t	2026-03-06 20:24:43.265	2026-03-06 20:24:43.265
cmmfcfb3x00043q4vgwgtmpq2	Onyx	ONX	USA	\N	\N	\N	\N	t	2026-03-06 20:24:43.774	2026-03-06 20:24:43.774
cmmfcfbj000053q4vyc9knz9z	Atlas	ATL	USA	\N	\N	\N	\N	t	2026-03-06 20:24:44.316	2026-03-06 20:24:44.316
cmmfcfbx500063q4vphmakpu2	Stonex	STX	USA	\N	\N	\N	\N	t	2026-03-06 20:24:44.826	2026-03-06 20:24:44.826
cmmfcfcd100073q4vt1ynedsm	Sucafina Specialty	SUC	Switzerland	\N	\N	\N	\N	t	2026-03-06 20:24:45.398	2026-03-06 20:24:45.398
cmmfkl6rj00003q8rc5ic2275	Florina	FLO	\N	\N	\N	\N	\N	t	2026-03-07 00:13:15.008	2026-03-07 00:13:15.008
cmmfkl6z600013q8r3gswc03k	LM	LMC	\N	\N	\N	\N	\N	t	2026-03-07 00:13:15.283	2026-03-07 00:13:15.283
cmmfkl74x00023q8rdtwqlzsr	Walker	WLK	\N	\N	\N	\N	\N	t	2026-03-07 00:13:15.489	2026-03-07 00:13:15.489
cmmfkl78n00033q8r5i9gqjfh	Margaro	MAR	\N	\N	\N	\N	\N	t	2026-03-07 00:13:15.624	2026-03-07 00:13:15.624
cmmfmlo7d00003qnzunef0nev	Sopex	SPX	\N	\N	\N	\N	\N	t	2026-03-07 01:09:36.84	2026-03-07 01:09:36.84
\.


--
-- Data for Name: container_lots; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.container_lots (id, "containerId", "lotId", "quantityQQ") FROM stdin;
\.


--
-- Data for Name: containers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.containers (id, "shipmentId", "containerNum", "blNumber", "sealNumber", "weightKg", vessel, port, eta, notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: contract_lot_allocations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.contract_lot_allocations (id, "contractId", "lotId", "quantityQQ", "createdAt") FROM stdin;
\.


--
-- Data for Name: contract_price_snapshots; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.contract_price_snapshots (id, "contractId", "precioBolsa", diferencial, "tipoCambio", "posicionBolsa", status, "triggeredBy", reason, "snapshotAt") FROM stdin;
\.


--
-- Data for Name: contracts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.contracts (id, "contractNumber", "clientId", "shipmentId", status, regions, puntaje, sacos69kg, sacos46kg, "precioBolsa", diferencial, "precioBolsaDif", "comisionCompra", "comisionVenta", "montoCredito", cosecha, "posicionBolsa", "posicionNY", "fechaEmbarque", lote, "facturacionLbs", "facturacionKgs", "gastosExport", "utilidadSinGE", "costoFinanciero", "utilidadSinCF", "tipoCambio", "totalPagoQTZ", notes, "computedAt", "createdAt", "updatedAt", "exportCostConfigId", "gastosPerSaco", "exportTrillaPerQQ", "exportSacoYute", "exportEstampado", "exportBolsaGrainPro", "exportFitoSanitario", "exportImpuestoAnacafe1", "exportImpuestoAnacafe2", "exportInspeccionOirsa", "exportFumigacion", "exportEmisionDocumento", "exportFletePuerto", "exportSeguro", "exportCustodio", "exportAgenteAduanal", "exportComisionOrganico", "cfTasaAnual", "cfMeses", "precioPromedioInv", subproductos, "precioSubproducto", "cooContractName", "officialCorrelative", "isrAmount", "isrRate", "exportingEntity", "facturacionKgsOverride", "overrideReason") FROM stdin;
cmmfmmjsl000l3qcucfnjqiz2	P40129	cmmfcf9op00013q4vhfulmklk	cmmfmmjqe000j3qcuiom5iqyc	FIJADO	{}	82	275.00	412.50	376.00	40.00	416.00	618.75	618.75	\N	25/26	\N	\N	\N	Organico	171600.00	171600.00	9487.50	162112.50	1689.97	160422.53	7.6500	1227232.38	\N	2026-04-15 16:11:45.529	2026-03-07 01:10:17.782	2026-04-15 16:11:45.529	cmmfcfec4000c3q4ve2kznkuw	23.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2003.26	\N	\N	\N	HC-2026-0004	65764.16	\N	FINCA_DANILANDIA	171600.00	Legal contract drafted at libras value; kg uplift not applied. January 2026.
cmmfmmlcw001p3qcu3rjnmtgz	PEND-MAR-0-5	cmmfcf9op00013q4vhfulmklk	cmmfmmlas001n3qcuql8q2fca	NO_FIJADO	{SANTA_ROSA,HUEHUETENANGO,ORGANICO}	82	275.00	412.50	302.00	15.00	317.00	618.75	618.75	\N	25/26	\N	\N	\N	\N	130762.50	132607.56	6325.00	126282.56	0.00	126282.56	7.6500	966061.58	\N	2026-03-07 01:35:57.321	2026-03-07 01:10:19.808	2026-03-07 01:35:57.322	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0005	\N	\N	EXPORTADORA	\N	\N
cmmfmmj0l00033qcuki9vycf5	P30172	cmmfcfabo00023q4vxp69c328	cmmfmmiwl00013qcu4cgz88dq	FIJADO	{}	82	290.00	435.00	350.00	37.00	387.00	652.50	652.50	\N	25/26	\N	\N	\N	Danilandia	168345.00	170721.36	8700.00	162021.36	1778.24	160243.12	7.6500	1225859.86	\N	2026-04-15 16:11:41.907	2026-03-07 01:10:16.773	2026-04-15 16:11:41.908	cmmfcfec4000c3q4ve2kznkuw	20.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1777.25	\N	\N	\N	HC-2026-0001	\N	\N	EXPORTADORA	\N	\N
cmmfmmj5e00053qcuvgeqly5l	P40028	cmmfcf9op00013q4vhfulmklk	cmmfmmiwl00013qcu4cgz88dq	FIJADO	{}	82	275.00	412.50	358.00	15.00	373.00	618.75	618.75	\N	25/26	\N	\N	\N	Santa Rosa	153862.50	156034.42	8250.00	147784.42	1692.40	146092.03	7.6500	1117604.01	\N	2026-04-15 16:11:43.089	2026-03-07 01:10:16.946	2026-04-15 16:11:43.09	cmmfcfec4000c3q4ve2kznkuw	20.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1777.25	\N	\N	\N	HC-2026-0002	\N	\N	EXPORTADORA	\N	\N
cmmfmmj7e00073qcuifl4anzh	P40022	cmmfcf9op00013q4vhfulmklk	cmmfmmiwl00013qcu4cgz88dq	FIJADO	{}	83	275.00	412.50	358.00	28.00	386.00	618.75	618.75	\N	25/26	\N	\N	\N	Huehue	159225.00	161472.62	8250.00	153222.62	1686.65	151535.98	7.6500	1159250.21	\N	2026-04-15 16:11:44.333	2026-03-07 01:10:17.018	2026-04-15 16:11:44.333	cmmfcfec4000c3q4ve2kznkuw	20.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1777.25	\N	\N	\N	HC-2026-0003	\N	\N	EXPORTADORA	\N	\N
cmmfmmlfy001r3qcu9nctpsa8	PEND-MAR-0-6	cmmfcf9op00013q4vhfulmklk	cmmfmmlas001n3qcuql8q2fca	NO_FIJADO	{SANTA_ROSA,HUEHUETENANGO,ORGANICO}	83	275.00	412.50	302.00	28.00	330.00	618.75	618.75	\N	25/26	\N	\N	\N	\N	136125.00	138045.72	6325.00	131720.72	0.00	131720.72	7.6500	1007663.54	\N	2026-03-07 01:35:57.417	2026-03-07 01:10:19.918	2026-03-07 01:35:57.419	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0006	\N	\N	EXPORTADORA	\N	\N
cmmfmmlic001t3qcuoa1keyq8	PEND-MAR-0-7	cmmfcfapt00033q4vycf8l3wx	cmmfmmlas001n3qcuql8q2fca	NO_FIJADO	{SANTA_ROSA,HUEHUETENANGO,ORGANICO}	83	275.00	412.50	302.00	40.00	342.00	618.75	618.75	\N	25/26	\N	\N	\N	\N	141075.00	143065.57	6325.00	136740.57	0.00	136740.57	7.6500	1046065.35	\N	2026-03-07 01:35:57.513	2026-03-07 01:10:20.004	2026-03-07 01:35:57.514	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0007	\N	\N	EXPORTADORA	\N	\N
cmmfmmlkm001v3qcu4x2nced3	PEND-MAR-0-8	cmmfcfapt00033q4vycf8l3wx	cmmfmmlas001n3qcuql8q2fca	NO_FIJADO	{SANTA_ROSA,HUEHUETENANGO,ORGANICO}	83	100.00	150.00	302.00	50.00	352.00	225.00	225.00	\N	25/26	\N	\N	\N	\N	52800.00	53545.01	2300.00	51245.01	0.00	51245.01	7.6500	392024.31	\N	2026-03-07 01:35:57.608	2026-03-07 01:10:20.086	2026-03-07 01:35:57.609	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0008	\N	\N	EXPORTADORA	\N	\N
cmmfmmlmn001x3qcuiue07mma	PEND-MAR-0-9	cmmfcfapt00033q4vycf8l3wx	cmmfmmlas001n3qcuql8q2fca	NO_FIJADO	{SANTA_ROSA,HUEHUETENANGO,ORGANICO}	83	175.00	262.50	302.00	38.00	340.00	393.75	393.75	\N	25/26	\N	\N	\N	\N	89250.00	90509.32	4025.00	86484.32	0.00	86484.32	7.6500	661605.03	\N	2026-03-07 01:35:57.702	2026-03-07 01:10:20.159	2026-03-07 01:35:57.703	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0009	\N	\N	EXPORTADORA	\N	\N
cmmfmmlop001z3qcu2hvhp40o	PEND-MAR-0-10	cmmfcfb3x00043q4vgwgtmpq2	cmmfmmlas001n3qcuql8q2fca	FIJADO	{SANTA_ROSA,HUEHUETENANGO,ORGANICO}	81	275.00	412.50	302.00	40.00	342.00	618.75	618.75	\N	25/26	\N	\N	\N	\N	141075.00	143065.57	6325.00	136740.57	0.00	136740.57	7.6500	1046065.35	\N	2026-03-07 01:35:57.795	2026-03-07 01:10:20.233	2026-03-07 01:35:57.796	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0010	\N	\N	EXPORTADORA	\N	\N
cmmfmmmhg002j3qcuh6dvpp9c	PEND-MAR-1-33	cmmfcfb3x00043q4vgwgtmpq2	cmmfmmmfe002h3qcuv7bnz9kx	NO_FIJADO	{OTHER}	82	150.00	225.00	285.15	80.00	365.15	337.50	337.50	\N	25/26	\N	\N	\N	\N	82158.75	83318.01	3450.00	79868.01	0.00	79868.01	7.6500	610990.28	\N	2026-03-07 01:35:58.078	2026-03-07 01:10:21.268	2026-03-07 01:35:58.079	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0011	\N	\N	EXPORTADORA	\N	\N
cmmfmmmjj002l3qcue3a08yzr	PEND-MAR-1-34	cmmfcfb3x00043q4vgwgtmpq2	cmmfmmmfe002h3qcuv7bnz9kx	NO_FIJADO	{OTHER}	83	125.00	187.50	285.15	90.00	375.15	281.25	281.25	\N	25/26	\N	\N	\N	\N	70340.63	71333.13	2875.00	68458.13	0.00	68458.13	7.6500	523704.70	\N	2026-03-07 01:35:58.171	2026-03-07 01:10:21.344	2026-03-07 01:35:58.172	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0012	\N	\N	EXPORTADORA	\N	\N
cmmfmmmw9002v3qcun417vhvw	PEND-MAR-2-53	cmmfcf9op00013q4vhfulmklk	cmmfmmmtw002t3qcugep2il9o	NO_FIJADO	{HUEHUETENANGO}	83	275.00	412.50	285.60	40.00	325.60	618.75	618.75	\N	25/26	\N	\N	\N	\N	134310.00	136205.11	6325.00	129880.11	0.00	129880.11	7.6500	993582.87	\N	2026-03-07 01:35:58.454	2026-03-07 01:10:21.801	2026-03-07 01:35:58.455	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0013	\N	\N	EXPORTADORA	\N	\N
cmmfmmn7b00333qcuwj1inznz	PEND-MAR-3-91	cmmfkl6rj00003q8rc5ic2275	cmmfmmn4700313qcu8jkbr1g9	NO_FIJADO	{HUEHUETENANGO}	84	275.00	412.50	302.00	58.70	360.70	618.75	618.75	\N	25/26	\N	\N	\N	\N	148788.75	150888.16	6325.00	144563.16	0.00	144563.16	7.6500	1105908.17	\N	2026-03-07 01:35:58.739	2026-03-07 01:10:22.199	2026-03-07 01:35:58.74	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0014	\N	\N	EXPORTADORA	\N	\N
cmmfmmnhi003b3qcu4kwispsl	PEND-MAR-4-120	cmmfcf9op00013q4vhfulmklk	cmmfmmnfi00393qcu1rwdm9br	NO_FIJADO	{ORGANICO}	82	275.00	412.50	281.70	45.00	326.70	618.75	618.75	\N	25/26	\N	\N	\N	\N	134763.75	136665.27	6325.00	130340.27	0.00	130340.27	7.6500	997103.04	\N	2026-03-07 01:35:59.023	2026-03-07 01:10:22.566	2026-03-07 01:35:59.025	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0015	\N	\N	EXPORTADORA	\N	\N
cmmfmmnjj003d3qcue7lfog2g	PEND-MAR-4-121	cmmfcf9op00013q4vhfulmklk	cmmfmmnfi00393qcu1rwdm9br	NO_FIJADO	{ORGANICO}	82	275.00	412.50	281.70	45.00	326.70	618.75	618.75	\N	25/26	\N	\N	\N	\N	134763.75	136665.27	6325.00	130340.27	0.00	130340.27	7.6500	997103.04	\N	2026-03-07 01:35:59.118	2026-03-07 01:10:22.639	2026-03-07 01:35:59.12	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0016	\N	\N	EXPORTADORA	\N	\N
cmmfmmnlk003f3qcuw8oc90rk	PEND-MAR-4-122	cmmfcf9op00013q4vhfulmklk	cmmfmmnfi00393qcu1rwdm9br	NO_FIJADO	{ORGANICO}	82	275.00	412.50	281.70	45.00	326.70	618.75	618.75	\N	25/26	\N	\N	\N	\N	134763.75	136665.27	6325.00	130340.27	0.00	130340.27	7.6500	997103.04	\N	2026-03-07 01:35:59.215	2026-03-07 01:10:22.712	2026-03-07 01:35:59.217	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0017	\N	\N	EXPORTADORA	\N	\N
cmmfmmnnp003h3qcuwe5k3fu9	PEND-MAR-4-123	cmmfcf9op00013q4vhfulmklk	cmmfmmnfi00393qcu1rwdm9br	NO_FIJADO	{ORGANICO}	82	275.00	412.50	281.70	45.00	326.70	618.75	618.75	\N	25/26	\N	\N	\N	\N	134763.75	136665.27	6325.00	130340.27	0.00	130340.27	7.6500	997103.04	\N	2026-03-07 01:35:59.31	2026-03-07 01:10:22.79	2026-03-07 01:35:59.311	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0018	\N	\N	EXPORTADORA	\N	\N
cmmfmmnpu003j3qcuuuo377fh	PEND-MAR-4-124	cmmfcf9op00013q4vhfulmklk	cmmfmmnfi00393qcu1rwdm9br	NO_FIJADO	{ORGANICO}	82	275.00	412.50	281.70	45.00	326.70	618.75	618.75	\N	25/26	\N	\N	\N	\N	134763.75	136665.27	6325.00	130340.27	0.00	130340.27	7.6500	997103.04	\N	2026-03-07 01:35:59.404	2026-03-07 01:10:22.866	2026-03-07 01:35:59.406	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0019	\N	\N	EXPORTADORA	\N	\N
cmmfmmo7j003z3qcuwatm4shm	PEND-ABR-0-5	cmmfcfbx500063q4vphmakpu2	cmmfmmo5l003x3qcu8rd77f5z	NO_FIJADO	{SANTA_ROSA,HUEHUETENANGO}	82	40.00	60.00	286.35	40.00	326.35	90.00	90.00	\N	25/26	\N	\N	\N	\N	19581.00	19857.29	920.00	18937.29	0.00	18937.29	7.6500	144870.25	\N	2026-03-07 01:35:59.691	2026-03-07 01:10:23.504	2026-03-07 01:35:59.693	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0020	\N	\N	EXPORTADORA	\N	\N
cmmfmmo9i00413qcubpztq5dd	PEND-ABR-0-6	cmmfcfbx500063q4vphmakpu2	cmmfmmo5l003x3qcu8rd77f5z	NO_FIJADO	{SANTA_ROSA,HUEHUETENANGO}	84	235.00	352.50	286.35	45.00	331.35	528.75	528.75	\N	25/26	\N	\N	\N	\N	116800.88	118448.94	5405.00	113043.94	0.00	113043.94	7.6500	864786.11	\N	2026-03-07 01:35:59.787	2026-03-07 01:10:23.574	2026-03-07 01:35:59.788	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0021	\N	\N	EXPORTADORA	\N	\N
cmmfmmolq004b3qcujnvcb9dn	PEND-MAY-0-5	cmmfcfb3x00043q4vgwgtmpq2	cmmfmmojo00493qcudvj9ep1z	FIJADO	{HUEHUETENANGO}	84	275.00	412.50	410.00	\N	410.00	618.75	618.75	\N	25/26	\N	\N	\N	\N	169125.00	171511.35	6325.00	165186.35	0.00	165186.35	7.6500	1263675.61	\N	2026-03-07 01:36:00.074	2026-03-07 01:10:24.014	2026-03-07 01:36:00.075	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0022	\N	\N	EXPORTADORA	\N	\N
cmmfmmovs004j3qcu253zieky	P0US00003754	cmmfcfapt00033q4vycf8l3wx	cmmfmmotr004h3qcudkq9uwbp	NO_FIJADO	{HUEHUETENANGO,ORGANICO}	83	50.00	75.00	288.60	50.00	338.60	112.50	112.50	\N	25/26	\N	\N	\N	\N	25395.00	25753.32	1150.00	24603.32	0.00	24603.32	7.6500	188215.42	\N	2026-03-07 01:36:00.354	2026-03-07 01:10:24.376	2026-03-07 01:36:00.355	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0023	\N	\N	EXPORTADORA	\N	\N
cmmfmmoxs004l3qcun4czzw7k	P0US00003754-MAY2	cmmfcfapt00033q4vycf8l3wx	cmmfmmotr004h3qcudkq9uwbp	NO_FIJADO	{HUEHUETENANGO,ORGANICO}	84	225.00	337.50	288.60	38.00	326.60	506.25	506.25	\N	25/26	\N	\N	\N	\N	110227.50	111782.81	5175.00	106607.81	0.00	106607.81	7.6500	815549.75	\N	2026-03-07 01:36:00.451	2026-03-07 01:10:24.448	2026-03-07 01:36:00.452	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0024	\N	\N	EXPORTADORA	\N	\N
cmmfmmp9v004v3qcug6gd37cj	PEND-MAY-2-44	cmmfcfb3x00043q4vgwgtmpq2	cmmfmmp7t004t3qcu9ae48206	NO_FIJADO	{OTHER}	84	150.00	225.00	285.00	86.00	371.00	337.50	337.50	\N	25/26	\N	\N	\N	\N	83475.00	84652.83	3450.00	81202.83	0.00	81202.83	7.6500	621201.67	\N	2026-03-07 01:36:00.732	2026-03-07 01:10:24.883	2026-03-07 01:36:00.733	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0025	\N	\N	EXPORTADORA	\N	\N
cmmfmmpbu004x3qcuhau2umhe	PEND-MAY-2-45	cmmfcfb3x00043q4vgwgtmpq2	cmmfmmp7t004t3qcu9ae48206	NO_FIJADO	{OTHER}	85	125.00	187.50	285.00	86.00	371.00	281.25	281.25	\N	25/26	\N	\N	\N	\N	69562.50	70544.03	2875.00	67669.03	0.00	67669.03	7.6500	517668.06	\N	2026-03-07 01:36:00.828	2026-03-07 01:10:24.954	2026-03-07 01:36:00.829	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0026	\N	\N	EXPORTADORA	\N	\N
cmmfmmpnx00573qcus4602e1e	PEND-MAY-3-64	cmmfcfb3x00043q4vgwgtmpq2	cmmfmmplz00553qcucs6h9qhf	NO_FIJADO	{OTHER}	84	275.00	412.50	280.75	55.00	335.75	618.75	618.75	\N	25/26	\N	\N	\N	\N	138496.88	140451.07	6325.00	134126.07	0.00	134126.07	7.6500	1026064.40	\N	2026-03-07 01:36:01.111	2026-03-07 01:10:25.39	2026-03-07 01:36:01.112	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0027	\N	\N	EXPORTADORA	\N	\N
cmmfmmpxy005f3qcuegctsebo	PEND-MAY-4-82	cmmfkl6z600013q8r3gswc03k	cmmfmmpvx005d3qcum9mtkxzf	NO_FIJADO	{SANTA_ROSA}	82	275.00	412.50	285.95	40.00	325.95	618.75	618.75	\N	25/26	\N	\N	\N	\N	134454.38	136351.53	6325.00	130026.53	0.00	130026.53	7.6500	994702.93	\N	2026-03-07 01:36:01.394	2026-03-07 01:10:25.75	2026-03-07 01:36:01.395	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0028	\N	\N	EXPORTADORA	\N	\N
cmmfmmq7s005n3qcue8fu5qpj	PEND-NEG-0-5	cmmfcfbj000053q4vyc9knz9z	cmmfmmq5u005l3qcu8pasw10i	FIJADO	{DANILANDIA}	83	275.00	412.50	326.60	38.00	364.60	618.75	618.75	\N	25/26	\N	\N	\N	\N	150397.50	152519.61	6325.00	146194.61	0.00	146194.61	7.6500	1118388.76	\N	2026-03-07 01:36:01.676	2026-03-07 01:10:26.105	2026-03-07 01:36:01.677	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0029	\N	\N	EXPORTADORA	\N	\N
cmmfmmq9u005p3qcua4o5fdfn	PEND-NEG-0-6	cmmfcfbj000053q4vyc9knz9z	cmmfmmq5u005l3qcu8pasw10i	FIJADO	{DANILANDIA}	83	275.00	412.50	320.75	38.00	358.75	618.75	618.75	\N	25/26	\N	\N	\N	\N	147984.38	150072.43	6325.00	143747.43	0.00	143747.43	7.6500	1099667.87	\N	2026-03-07 01:36:01.773	2026-03-07 01:10:26.179	2026-03-07 01:36:01.775	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0030	\N	\N	EXPORTADORA	\N	\N
cmmfmmqml005z3qcu3u5t2wks	PEND-NEG-1-26	cmmfkl74x00023q8rdtwqlzsr	cmmfmmqkl005x3qcurcql6yf2	FIJADO	{DANILANDIA}	83	275.00	412.50	332.80	34.00	366.80	618.75	618.75	\N	25/26	\N	\N	\N	\N	151305.00	153439.91	6325.00	147114.91	0.00	147114.91	7.6500	1125429.09	\N	2026-03-07 01:36:02.08	2026-03-07 01:10:26.637	2026-03-07 01:36:02.081	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0031	\N	\N	EXPORTADORA	\N	\N
cmmfmmqot00613qcu1w0ords9	PEND-NEG-1-27	cmmfkl74x00023q8rdtwqlzsr	cmmfmmqkl005x3qcurcql6yf2	FIJADO	{DANILANDIA}	83	275.00	412.50	326.60	34.00	360.60	618.75	618.75	\N	25/26	\N	\N	\N	\N	148747.50	150846.33	6325.00	144521.33	0.00	144521.33	7.6500	1105588.15	\N	2026-03-07 01:36:02.175	2026-03-07 01:10:26.717	2026-03-07 01:36:02.176	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0032	\N	\N	EXPORTADORA	\N	\N
cmmfmmqqu00633qcug18yr3bo	PEND-NEG-1-28	cmmfkl74x00023q8rdtwqlzsr	cmmfmmqkl005x3qcurcql6yf2	FIJADO	{DANILANDIA}	83	275.00	412.50	326.60	34.00	360.60	618.75	618.75	\N	25/26	\N	\N	\N	\N	148747.50	150846.33	6325.00	144521.33	0.00	144521.33	7.6500	1105588.15	\N	2026-03-07 01:36:02.27	2026-03-07 01:10:26.79	2026-03-07 01:36:02.271	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0033	\N	\N	EXPORTADORA	\N	\N
cmmfmmqsr00653qcu1g6cksgb	PEND-NEG-1-29	cmmfkl74x00023q8rdtwqlzsr	cmmfmmqkl005x3qcurcql6yf2	FIJADO	{DANILANDIA}	83	275.00	412.50	326.60	34.00	360.60	618.75	618.75	\N	25/26	\N	\N	\N	\N	148747.50	150846.33	6325.00	144521.33	0.00	144521.33	7.6500	1105588.15	\N	2026-03-07 01:36:02.364	2026-03-07 01:10:26.86	2026-03-07 01:36:02.365	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0034	\N	\N	EXPORTADORA	\N	\N
cmmfmmrak006j3qcurvkjci3u	PEND-NEG-2-51	cmmfcfb3x00043q4vgwgtmpq2	cmmfmmr8k006h3qcuhjftnhpx	FIJADO	{OTHER}	83	275.00	412.50	\N	\N	0.00	618.75	618.75	\N	25/26	\N	\N	\N	\N	0.00	0.00	6325.00	-6325.00	0.00	-6325.00	7.6500	-48386.25	\N	2026-03-07 01:36:02.647	2026-03-07 01:10:27.499	2026-03-07 01:36:02.648	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0035	\N	\N	EXPORTADORA	\N	\N
cmmfmmrkm006r3qcug9ftcy40	PEND-NEG-3-71	cmmfkl78n00033q8r5i9gqjfh	cmmfmmril006p3qcugawd2w5f	FIJADO	{DANILANDIA}	82	275.00	412.50	308.65	41.00	349.65	618.75	618.75	\N	25/26	\N	\N	\N	\N	144230.63	146265.72	6325.00	139940.72	0.00	139940.72	7.6500	1070546.50	\N	2026-03-07 01:36:02.929	2026-03-07 01:10:27.862	2026-03-07 01:36:02.93	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0036	\N	\N	EXPORTADORA	\N	\N
cmmfmms9m007b3qcu27toxpmb	PEND-SER-1-29	cmmfcf9op00013q4vhfulmklk	cmmfmms7b00793qcuumy1guvr	CONFIRMADO	{HUEHUETENANGO}	83	550.00	825.00	374.00	28.00	402.00	1237.50	1237.50	\N	25/26	\N	\N	\N	\N	331650.00	336329.58	12650.00	323679.58	0.00	323679.58	7.6500	2476148.80	\N	2026-03-07 01:36:03.397	2026-03-07 01:10:28.763	2026-03-07 01:36:03.397	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0037	\N	\N	EXPORTADORA	\N	\N
cmmfmmsbo007d3qcuekufir7j	PEND-SER-1-30	cmmfcf9op00013q4vhfulmklk	cmmfmms7b00793qcuumy1guvr	CONFIRMADO	{HUEHUETENANGO}	83	550.00	825.00	356.50	28.00	384.50	1237.50	1237.50	\N	25/26	\N	\N	\N	\N	317212.50	321688.37	12650.00	309038.37	0.00	309038.37	7.6500	2364143.52	\N	2026-03-07 01:36:03.49	2026-03-07 01:10:28.836	2026-03-07 01:36:03.491	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0038	\N	\N	EXPORTADORA	\N	\N
cmmfmmsdt007f3qcuxnwvs2pv	PEND-SER-1-31	cmmfcf9op00013q4vhfulmklk	cmmfmms7b00793qcuumy1guvr	CONFIRMADO	{HUEHUETENANGO}	83	550.00	825.00	341.86	28.00	369.86	1237.50	1237.50	\N	25/26	\N	\N	\N	\N	305134.50	309439.95	12650.00	296789.95	0.00	296789.95	7.6500	2270443.10	\N	2026-03-07 01:36:03.584	2026-03-07 01:10:28.914	2026-03-07 01:36:03.585	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0039	\N	\N	EXPORTADORA	\N	\N
cmmfmmsry007r3qcuxofky1c4	PEND-SER-2-51	cmmfcf9op00013q4vhfulmklk	cmmfmmspw007p3qcuocvwi9fd	NEGOCIACION	{HUEHUETENANGO,ORGANICO}	82	275.00	412.50	376.00	40.00	416.00	618.75	618.75	\N	25/26	\N	\N	\N	\N	171600.00	174021.28	6325.00	167696.28	0.00	167696.28	7.6500	1282876.51	\N	2026-03-07 01:36:03.87	2026-03-07 01:10:29.422	2026-03-07 01:36:03.871	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0040	\N	\N	EXPORTADORA	\N	\N
cmmfmmt25007z3qcunhkkdsqt	PEND-SUC-0-5	cmmfcfcd100073q4vt1ynedsm	cmmfmmt01007x3qcuee2bev0c	NEGOCIACION	{SANTA_ISABEL}	85	180.00	270.00	425.00	\N	425.00	405.00	405.00	\N	25/26	\N	\N	\N	\N	114750.00	116369.12	4140.00	112229.12	0.00	112229.12	7.6500	858552.79	\N	2026-03-07 01:36:04.157	2026-03-07 01:10:29.789	2026-03-07 01:36:04.159	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0041	\N	\N	EXPORTADORA	\N	\N
cmns4nonn0001jk04t4xkspfq	P40029	cmmfcf9op00013q4vhfulmklk	\N	FIJADO	{SANTA_ROSA}	82	275.00	412.50	380.00	15.00	395.00	618.75	618.75	0.00	25/26	MAR	\N	\N	Santa Rosa	165237.53	167569.03	6325.00	161244.03	0.00	161244.03	7.6500	1233516.81		2026-04-09 23:48:00.121	2026-04-09 23:48:00.275	2026-04-09 23:48:00.275	cmmfcfec4000c3q4ve2kznkuw	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	HC-2026-0042	\N	\N	EXPORTADORA	\N	\N
\.


--
-- Data for Name: cupping_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cupping_records (id, "lotId", "catadorUserId", date, fragrance, flavor, aftertaste, acidity, body, balance, uniformity, "cleanCup", sweetness, overall, "totalScore", "moisturePercent", "defectCount", "screenSize", "waterActivity", "yieldMeasured", "purchaseOrderId", notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: exchange_rates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.exchange_rates (id, rate, "validFrom", "validTo", "isActive", notes, "createdAt") FROM stdin;
cmmfcfe6b000b3q4vs4avghq4	7.6500	2025-01-01 00:00:00	2026-12-31 00:00:00	t	Default rate from Excel workbook	2026-03-06 20:24:47.748
\.


--
-- Data for Name: export_cost_configs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.export_cost_configs (id, name, "gastosPerSaco", "trillaPerQQ", "sacoYute", estampado, "bolsaGrainPro", "fitoSanitario", "impuestoAnacafe1", "impuestoAnacafe2", "inspeccionOirsa", fumigacion, "emisionDocumento", "fletePuerto", seguro, custodio, "agenteAduanal", "comisionExportadorOrganico", "isDefault", "createdAt", "updatedAt") FROM stdin;
cmmfcfec4000c3q4ve2kznkuw	Default 2025-2026	23.00	7.00	1300.00	500.00	5000.00	50.00	600.00	500.00	300.00	400.00	1200.00	2000.00	230.00	450.00	34619.00	0.00	t	2026-03-06 20:24:47.957	2026-03-06 20:24:47.957
\.


--
-- Data for Name: facilities; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.facilities (id, name, code, type, capacity, "isActive", "createdAt", "updatedAt") FROM stdin;
6de007f7-8922-495c-9e7f-c70a9c718a88	Beneficio	BEN	BENEFICIO	\N	t	2026-04-10 18:21:44.9	2026-04-10 18:21:44.9
0dc049cd-cd35-476f-8687-fc5d0c9fb37a	Bodega	BOD	BODEGA	\N	t	2026-04-10 18:21:44.9	2026-04-10 18:21:44.9
af5f5e35-1485-4d70-b296-9da19e9ef9fb	Patio	PAT	PATIO	\N	t	2026-04-10 18:21:44.9	2026-04-10 18:21:44.9
\.


--
-- Data for Name: farms; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.farms (id, name, "totalQuetzales", "tipoCambio", "totalUSD", porcentaje, "aumentoPorcentaje", "nuevoTotal", "porcentajePrest", "totalPrestamo", "createdAt", "updatedAt") FROM stdin;
cmmfcfehu000d3q4vd9og6j56	BRISAS	9909581.76	7.6500	1295370.16	0.820000	0.2000	1554444.20	0.7000	1088110.94	2026-03-06 20:24:48.163	2026-03-06 20:24:48.163
cmmfcff4l000e3q4vs1qzpqxu	SAN EMILIANO	2175040.00	7.6500	284318.95	0.180000	0.2000	341182.75	0.7000	238827.92	2026-03-06 20:24:48.981	2026-03-06 20:24:48.981
\.


--
-- Data for Name: lots; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.lots (id, "lotNumber", "supplierId", "facilityId", "purchaseOrderId", stage, "quantityQQ", "qualityGrade", "cuppingScore", "receptionDate", "sourceAccountEntryId", "contractedYield", "actualYield", "costPerQQ", "parentLotId", "createdAt", "updatedAt") FROM stdin;
cmnt9ad7l00013qwjq2t6zdra	LOT-MIGR-0001	\N	\N	\N	SUBPRODUCTO	33.00	\N	\N	\N	\N	\N	\N	2049.11	\N	2026-04-10 18:45:23.169	2026-04-10 18:45:23.169
cmnt9adw700053qwj2i6vepjj	LOT-MIGR-0002	\N	\N	\N	SUBPRODUCTO	0.00	\N	\N	\N	\N	\N	\N	0.00	\N	2026-04-10 18:45:24.056	2026-04-10 18:45:24.056
cmnt9aeeh00093qwjitbmdkqi	LOT-MIGR-0003	\N	\N	\N	SUBPRODUCTO	124.99	\N	\N	\N	\N	\N	\N	2000.00	\N	2026-04-10 18:45:24.714	2026-04-10 18:45:24.714
cmnt9aerv000d3qwjhjyghcx6	LOT-MIGR-0004	\N	\N	\N	SUBPRODUCTO	25.00	\N	\N	\N	\N	\N	\N	2000.00	\N	2026-04-10 18:45:25.196	2026-04-10 18:45:25.196
cmnt9af8p000h3qwje3pr3aqm	LOT-MIGR-0005	\N	\N	\N	SUBPRODUCTO	25.00	\N	\N	\N	\N	\N	\N	2000.00	\N	2026-04-10 18:45:25.802	2026-04-10 18:45:25.802
cmnt9afmd000l3qwjeztmcs8r	LOT-MIGR-0006	\N	\N	\N	SUBPRODUCTO	25.00	\N	\N	\N	\N	\N	\N	2000.00	\N	2026-04-10 18:45:26.293	2026-04-10 18:45:26.293
cmnt9ag2t000p3qwj9qhhrm07	LOT-MIGR-0007	\N	\N	\N	SUBPRODUCTO	125.00	\N	\N	\N	\N	\N	\N	2000.00	\N	2026-04-10 18:45:26.885	2026-04-10 18:45:26.885
cmnt9aggt000t3qwjltkajnkr	LOT-MIGR-0008	\N	\N	\N	SUBPRODUCTO	25.00	\N	\N	\N	\N	\N	\N	2000.00	\N	2026-04-10 18:45:27.39	2026-04-10 18:45:27.39
cmnt9agxd000x3qwj60hqz3xa	LOT-MIGR-0009	\N	\N	\N	SUBPRODUCTO	25.00	\N	\N	\N	\N	\N	\N	2000.00	\N	2026-04-10 18:45:27.986	2026-04-10 18:45:27.986
cmnt9ahj600113qwjn1qb1z34	LOT-MIGR-0010	\N	\N	\N	SUBPRODUCTO	25.00	\N	\N	\N	\N	\N	\N	2000.00	\N	2026-04-10 18:45:28.77	2026-04-10 18:45:28.77
cmnt9ahxq00153qwj0e55stn1	LOT-MIGR-0011	\N	\N	\N	SUBPRODUCTO	25.00	\N	\N	\N	\N	\N	\N	2000.00	\N	2026-04-10 18:45:29.295	2026-04-10 18:45:29.295
cmnt9aici00193qwj3xvn6lm0	LOT-MIGR-0012	\N	\N	\N	SUBPRODUCTO	25.00	\N	\N	\N	\N	\N	\N	2000.00	\N	2026-04-10 18:45:29.827	2026-04-10 18:45:29.827
cmnt9air3001d3qwjmyly68vx	LOT-MIGR-0013	\N	\N	\N	SUBPRODUCTO	25.00	\N	\N	\N	\N	\N	\N	2000.00	\N	2026-04-10 18:45:30.351	2026-04-10 18:45:30.351
cmnt9aj5l001h3qwjoolguox5	LOT-MIGR-0014	\N	\N	\N	SUBPRODUCTO	50.00	\N	\N	\N	\N	\N	\N	2000.00	\N	2026-04-10 18:45:30.873	2026-04-10 18:45:30.873
cmnt9ajib001l3qwj456hip6g	LOT-MIGR-0015	\N	\N	\N	SUBPRODUCTO	100.00	\N	\N	\N	\N	\N	\N	2000.00	\N	2026-04-10 18:45:31.332	2026-04-10 18:45:31.332
cmnt9ajtz001p3qwj9truspdj	LOT-MIGR-0016	\N	\N	\N	SUBPRODUCTO	25.00	\N	\N	\N	\N	\N	\N	2000.00	\N	2026-04-10 18:45:31.751	2026-04-10 18:45:31.751
cmnt9ak63001t3qwjjax6938b	LOT-MIGR-0017	\N	\N	\N	SUBPRODUCTO	25.00	\N	\N	\N	\N	\N	\N	2000.00	\N	2026-04-10 18:45:32.188	2026-04-10 18:45:32.188
cmnt9akim001x3qwjhslze04w	LOT-MIGR-0018	\N	\N	\N	SUBPRODUCTO	100.00	\N	\N	\N	\N	\N	\N	2000.00	\N	2026-04-10 18:45:32.638	2026-04-10 18:45:32.638
cmnt9akvc00213qwjtu4px07i	LOT-MIGR-0019	\N	\N	\N	SUBPRODUCTO	150.00	\N	\N	\N	\N	\N	\N	1900.00	\N	2026-04-10 18:45:33.096	2026-04-10 18:45:33.096
cmnt9albp00253qwjbo3xlcio	LOT-MIGR-0020	\N	\N	\N	SUBPRODUCTO	25.00	\N	\N	\N	\N	\N	\N	1900.00	\N	2026-04-10 18:45:33.686	2026-04-10 18:45:33.686
cmnt9aloh00293qwj6m4w3wxf	LOT-MIGR-0021	\N	\N	\N	SUBPRODUCTO	16.36	\N	\N	\N	\N	\N	\N	2000.00	\N	2026-04-10 18:45:34.146	2026-04-10 18:45:34.146
cmnt9alzg002d3qwj0vgezlk9	LOT-MIGR-0022	\N	\N	\N	SUBPRODUCTO	25.00	\N	\N	\N	\N	\N	\N	2000.00	\N	2026-04-10 18:45:34.54	2026-04-10 18:45:34.54
\.


--
-- Data for Name: materia_prima; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.materia_prima (id, "shipmentId", "supplierId", "supplierNote", "isPurchased", punteo, oro, rendimiento, pergamino, "precioPromQ", "totalMP", "createdAt", "updatedAt") FROM stdin;
cmmfmmlqs00213qcu8zi46d0e	cmmfmmlas001n3qcuql8q2fca	cmmfcfde900093q4vilsul5fd	Comprado / Jose David Guerra	t	82	412.50	1.320000	544.50	1675.00	912037.50	2026-03-07 01:10:20.308	2026-03-07 01:10:20.308
cmmfmmlst00233qcusrmor2so	cmmfmmlas001n3qcuql8q2fca	cmmfcfcrg00083q4vqsiyo6of	Comprado / Kfinos	t	83	412.50	1.320000	544.50	1715.00	933817.50	2026-03-07 01:10:20.381	2026-03-07 01:10:20.381
cmmfmmlur00253qcu1fa8frv0	cmmfmmlas001n3qcuql8q2fca	cmmfcfdsd000a3q4v7j7dh4nc	comprado / walco	t	83	189.39	1.320000	250.00	1710.00	427500.00	2026-03-07 01:10:20.451	2026-03-07 01:10:20.451
cmmfmmlwq00273qcu379py9qg	cmmfmmlas001n3qcuql8q2fca	cmmfcfcrg00083q4vqsiyo6of	Comprado / Kfinos	t	83	223.01	1.320000	294.37	1690.00	497481.92	2026-03-07 01:10:20.522	2026-03-07 01:10:20.522
cmmfmmlyp00293qcu6tist9h5	cmmfmmlas001n3qcuql8q2fca	cmmfcfcrg00083q4vqsiyo6of	Comprado / Kfinos	t	83	151.52	1.320000	200.00	1730.00	346000.00	2026-03-07 01:10:20.593	2026-03-07 01:10:20.593
cmmfmmm0z002b3qcu2xyh2mnl	cmmfmmlas001n3qcuql8q2fca	cmmfcfcrg00083q4vqsiyo6of	Comprado / Kfinos	t	83	260.98	1.320000	344.50	1715.00	590817.50	2026-03-07 01:10:20.675	2026-03-07 01:10:20.675
cmmfmmm8k002d3qcudku8j270	cmmfmmlas001n3qcuql8q2fca	cmmfcfde900093q4vilsul5fd	Comprado / Jose David Guerra	t	81	412.50	1.320000	544.50	1675.00	912037.50	2026-03-07 01:10:20.947	2026-03-07 01:10:20.947
cmmfmmmlj002n3qcudh83eojh	cmmfmmmfe002h3qcuv7bnz9kx	cmmfcfde900093q4vilsul5fd	Comprado / Jose David Guerra	t	84	225.00	1.320000	297.00	1715.00	509355.00	2026-03-07 01:10:21.415	2026-03-07 01:10:21.415
cmmfmmmo2002p3qcuvsjr818w	cmmfmmmfe002h3qcuv7bnz9kx	cmmfcfcrg00083q4vqsiyo6of	Comprado / Kfinos	t	84	187.50	1.320000	247.50	1800.00	445500.00	2026-03-07 01:10:21.506	2026-03-07 01:10:21.506
cmmfmmmyd002x3qcu59sos8gx	cmmfmmmtw002t3qcugep2il9o	cmmfcfde900093q4vilsul5fd	No comprado / Jose David Guerra	f	83	412.50	1.320000	544.50	1685.00	917482.50	2026-03-07 01:10:21.878	2026-03-07 01:10:21.878
cmmfmmn9h00353qcux924kzws	cmmfmmn4700313qcu8jkbr1g9	cmmfcfde900093q4vilsul5fd	No comprado / Jose David Guerra	f	84	412.50	1.320000	544.50	1715.00	933817.50	2026-03-07 01:10:22.277	2026-03-07 01:10:22.277
cmmfmmnru003l3qcuk6ix2kxs	cmmfmmnfi00393qcu1rwdm9br	cmmfcfcrg00083q4vqsiyo6of	No comprado / kfinos	f	82	412.50	1.320000	544.50	1650.00	898425.00	2026-03-07 01:10:22.938	2026-03-07 01:10:22.938
cmmfmmntt003n3qcu88thwf0z	cmmfmmnfi00393qcu1rwdm9br	cmmfcfcrg00083q4vqsiyo6of	No comprado / kfinos	f	82	412.50	1.320000	544.50	1650.00	898425.00	2026-03-07 01:10:23.009	2026-03-07 01:10:23.009
cmmfmmnvs003p3qculwbneoru	cmmfmmnfi00393qcu1rwdm9br	cmmfcfcrg00083q4vqsiyo6of	No comprado / kfinos	f	82	412.50	1.320000	544.50	1650.00	898425.00	2026-03-07 01:10:23.08	2026-03-07 01:10:23.08
cmmfmmnxq003r3qcu971cv3m3	cmmfmmnfi00393qcu1rwdm9br	cmmfcfcrg00083q4vqsiyo6of	No comprado / kfinos	f	82	412.50	1.320000	544.50	1650.00	898425.00	2026-03-07 01:10:23.151	2026-03-07 01:10:23.151
cmmfmmnzp003t3qcun945jwxl	cmmfmmnfi00393qcu1rwdm9br	cmmfcfcrg00083q4vqsiyo6of	No comprado / kfinos	f	82	412.50	1.320000	544.50	1650.00	898425.00	2026-03-07 01:10:23.221	2026-03-07 01:10:23.221
cmmfmmobh00433qcunmcdvoqg	cmmfmmo5l003x3qcu8rd77f5z	cmmfcfde900093q4vilsul5fd	No Comprado / Jose David	f	82	60.00	1.320000	79.20	1660.00	131472.00	2026-03-07 01:10:23.645	2026-03-07 01:10:23.645
cmmfmmodi00453qculywjlztm	cmmfmmo5l003x3qcu8rd77f5z	cmmfcfcrg00083q4vqsiyo6of	No Comprado / Kfinos	f	84	352.50	1.320000	465.30	1660.00	772398.00	2026-03-07 01:10:23.718	2026-03-07 01:10:23.718
cmmfmmonr004d3qcul3zcizoq	cmmfmmojo00493qcudvj9ep1z	\N	Comprado	t	84	412.50	1.320000	544.50	2065.00	1124392.50	2026-03-07 01:10:24.087	2026-03-07 01:10:24.087
cmmfmmozr004n3qcucm4nepkz	cmmfmmotr004h3qcudkq9uwbp	cmmfcfcrg00083q4vqsiyo6of	COMPRADO / kfinos	t	83	75.00	1.320000	99.00	1775.00	175725.00	2026-03-07 01:10:24.52	2026-03-07 01:10:24.52
cmmfmmp1p004p3qcu46937lvg	cmmfmmotr004h3qcudkq9uwbp	cmmfcfcrg00083q4vqsiyo6of	COMPRADO / kfinos	t	84	337.50	1.320000	445.50	1735.00	772942.50	2026-03-07 01:10:24.59	2026-03-07 01:10:24.59
cmmfmmpdx004z3qcu3oekdjmg	cmmfmmp7t004t3qcu9ae48206	cmmfcfde900093q4vilsul5fd	No Comprado / Jose David	f	84	225.00	1.320000	297.00	1684.00	500148.00	2026-03-07 01:10:25.03	2026-03-07 01:10:25.03
cmmfmmpfw00513qcunfqjjfd1	cmmfmmp7t004t3qcu9ae48206	cmmfcfcrg00083q4vqsiyo6of	No Comprado / Kfinos	f	85	187.50	1.320000	247.50	1900.00	470250.00	2026-03-07 01:10:25.101	2026-03-07 01:10:25.101
cmmfmmppv00593qcu5qvsph31	cmmfmmplz00553qcucs6h9qhf	\N	No Comprado	f	84	412.50	1.320000	544.50	1684.00	916938.00	2026-03-07 01:10:25.459	2026-03-07 01:10:25.459
cmmfmmpzx005h3qcu647r7q7q	cmmfmmpvx005d3qcum9mtkxzf	\N	No Comprado	f	82	412.50	1.320000	544.50	1685.00	917482.50	2026-03-07 01:10:25.821	2026-03-07 01:10:25.821
cmmfmmqbw005r3qcutz1wfdba	cmmfmmq5u005l3qcu8pasw10i	\N	NO COMPRADO	f	83	412.50	1.320000	544.50	1900.00	1034550.00	2026-03-07 01:10:26.252	2026-03-07 01:10:26.252
cmmfmmqe0005t3qcuuxagrlt5	cmmfmmq5u005l3qcu8pasw10i	\N	NO COMPRADO	f	83	412.50	1.320000	544.50	1900.00	1034550.00	2026-03-07 01:10:26.328	2026-03-07 01:10:26.328
cmmfmmquy00673qcumyq0x5sg	cmmfmmqkl005x3qcurcql6yf2	\N	NO COMPRADO	f	83	412.50	1.320000	544.50	1900.00	1034550.00	2026-03-07 01:10:26.938	2026-03-07 01:10:26.938
cmmfmmqwy00693qcuns3u0d4y	cmmfmmqkl005x3qcurcql6yf2	\N	NO COMPRADO	f	83	412.50	1.320000	544.50	1900.00	1034550.00	2026-03-07 01:10:27.01	2026-03-07 01:10:27.01
cmmfmmqzn006b3qcutui5lkrv	cmmfmmqkl005x3qcurcql6yf2	\N	NO COMPRADO	f	83	412.50	1.320000	544.50	1900.00	1034550.00	2026-03-07 01:10:27.107	2026-03-07 01:10:27.107
cmmfmmr1p006d3qcub4xpvu5r	cmmfmmqkl005x3qcurcql6yf2	\N	NO COMPRADO	f	83	412.50	1.320000	544.50	1900.00	1034550.00	2026-03-07 01:10:27.181	2026-03-07 01:10:27.181
cmmfmmrck006l3qcuwmzz0ohu	cmmfmmr8k006h3qcuhjftnhpx	\N	NO COMPRADO	f	83	412.50	1.320000	544.50	2000.00	1089000.00	2026-03-07 01:10:27.572	2026-03-07 01:10:27.572
cmmfmmrmn006t3qcuhgnc34w5	cmmfmmril006p3qcugawd2w5f	\N	NO COMPRADO	f	82	412.50	1.320000	544.50	1700.00	925650.00	2026-03-07 01:10:27.936	2026-03-07 01:10:27.936
cmmfmmruq006z3qcugf1an167	cmmfmmrsn006x3qcuyy62tc20	\N	\N	f	82	412.50	1.320000	544.50	2125.00	1157062.50	2026-03-07 01:10:28.226	2026-03-07 01:10:28.226
cmmfmmrwt00713qcu8513eq7f	cmmfmmrsn006x3qcuyy62tc20	\N	\N	f	82	412.50	1.320000	544.50	2000.00	1089000.00	2026-03-07 01:10:28.301	2026-03-07 01:10:28.301
cmmfmmryu00733qcu4no0mhdx	cmmfmmrsn006x3qcuyy62tc20	\N	\N	f	82	412.50	1.320000	544.50	2000.00	1089000.00	2026-03-07 01:10:28.375	2026-03-07 01:10:28.375
cmmfmms0z00753qcuctbxows2	cmmfmmrsn006x3qcuyy62tc20	\N	\N	f	82	412.50	1.300000	536.25	2000.00	1072500.00	2026-03-07 01:10:28.451	2026-03-07 01:10:28.451
cmmfmmsfr007h3qcuk9f5c21a	cmmfmms7b00793qcuumy1guvr	\N	\N	f	83	825.00	1.300000	1072.50	2100.00	2252250.00	2026-03-07 01:10:28.984	2026-03-07 01:10:28.984
cmmfmmshq007j3qcumeine98s	cmmfmms7b00793qcuumy1guvr	\N	\N	f	83	825.00	1.300000	1072.50	2100.00	2252250.00	2026-03-07 01:10:29.055	2026-03-07 01:10:29.055
cmmfmmsjs007l3qcuzpwwcvc6	cmmfmms7b00793qcuumy1guvr	\N	\N	f	83	825.00	1.300000	1072.50	2100.00	2252250.00	2026-03-07 01:10:29.128	2026-03-07 01:10:29.128
cmmfmmstw007t3qcuusc07p86	cmmfmmspw007p3qcuocvwi9fd	\N	\N	f	82	412.50	1.320000	544.50	2125.00	1157062.50	2026-03-07 01:10:29.493	2026-03-07 01:10:29.493
cmmfmmt6800813qcuou9pcymu	cmmfmmt01007x3qcuee2bev0c	\N	\N	f	85	270.00	1.320000	356.40	2100.00	748440.00	2026-03-07 01:10:29.863	2026-03-07 01:10:29.863
cmmfmmte600873qcuh4o95gh1	cmmfmmtc400853qcuyyt8bol0	\N	Parcialmente Comprado	t	83	412.50	1.320000	544.50	1950.00	1061775.00	2026-03-07 01:10:30.223	2026-03-07 01:10:30.223
cmmfmmja700093qcunyzihtj8	cmmfmmiwl00013qcu4cgz88dq	cmmfcfde900093q4vilsul5fd	Comprado / José David	t	82	435.00	1.319700	574.07	1777.25	1020265.02	2026-03-07 01:10:17.119	2026-04-15 16:11:41.385
cmmfmmjga000d3qcu8qz18msu	cmmfmmiwl00013qcu4cgz88dq	cmmfcfde900093q4vilsul5fd	Comprado / José David	t	82	412.50	1.324500	546.36	1777.25	971011.65	2026-03-07 01:10:17.338	2026-04-15 16:11:42.567
cmmfmmjia000f3qcuyo8kfysz	cmmfmmiwl00013qcu4cgz88dq	cmmfcfcrg00083q4vqsiyo6of	K-finos	t	83	412.50	1.320000	544.50	1777.25	967712.63	2026-03-07 01:10:17.41	2026-04-15 16:11:43.811
cmmfmmjuq000n3qcubc9cohdf	cmmfmmjqe000j3qcuiom5iqyc	cmmfcfde900093q4vilsul5fd	Comprado / José David Guerra	t	82	412.50	1.322600	545.57	1777.25	969618.73	2026-03-07 01:10:17.859	2026-04-15 16:11:45.055
\.


--
-- Data for Name: materia_prima_allocations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.materia_prima_allocations (id, "materiaPrimaId", "contractId", "quintalesAllocated") FROM stdin;
cmo08m7pn00013qm5w51w8kf7	cmmfmmja700093qcunyzihtj8	cmmfmmj0l00033qcuki9vycf5	\N
cmo08m8tp00033qm5w0p7d0ts	cmmfmmjga000d3qcu8qz18msu	cmmfmmj5e00053qcuvgeqly5l	\N
cmo08m9yo00053qm5r40mu2bq	cmmfmmjia000f3qcuyo8kfysz	cmmfmmj7e00073qcuifl4anzh	\N
cmo08mb2000073qm5mlsezu27	cmmfmmjuq000n3qcubc9cohdf	cmmfmmjsl000l3qcucfnjqiz2	\N
\.


--
-- Data for Name: milling_inputs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.milling_inputs (id, "millingOrderId", "lotId", "quantityQQ") FROM stdin;
\.


--
-- Data for Name: milling_orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.milling_orders (id, "orderNumber", "facilityId", date, "operatorUserId", status, notes, "createdAt", "updatedAt") FROM stdin;
cmnt9ad3o00003qwjob1kcl3p	TRIA-MIGR-0001	\N	2026-03-07 01:10:17.491	\N	COMPLETADO	Migrado de Subproducto (shipmentId: cmmfmmiwl00013qcu4cgz88dq)	2026-04-10 18:45:23.029	2026-04-10 18:45:23.029
cmnt9adu900043qwjfq2ivtaf	TRIA-MIGR-0002	\N	2026-03-07 01:10:17.929	\N	COMPLETADO	Migrado de Subproducto (shipmentId: cmmfmmjqe000j3qcuiom5iqyc)	2026-04-10 18:45:23.986	2026-04-10 18:45:23.986
cmnt9aec400083qwjvjcnemsq	TRIA-MIGR-0003	\N	2026-03-07 01:10:21.039	\N	COMPLETADO	Migrado de Subproducto (shipmentId: cmmfmmlas001n3qcuql8q2fca)	2026-04-10 18:45:24.628	2026-04-10 18:45:24.628
cmnt9aepy000c3qwjavfk3pey	TRIA-MIGR-0004	\N	2026-03-07 01:10:21.576	\N	COMPLETADO	Migrado de Subproducto (shipmentId: cmmfmmmfe002h3qcuv7bnz9kx)	2026-04-10 18:45:25.126	2026-04-10 18:45:25.126
cmnt9af5y000g3qwjbolw6phc	TRIA-MIGR-0005	\N	2026-03-07 01:10:21.948	\N	COMPLETADO	Migrado de Subproducto (shipmentId: cmmfmmmtw002t3qcugep2il9o)	2026-04-10 18:45:25.702	2026-04-10 18:45:25.702
cmnt9afke000k3qwje62gt2ij	TRIA-MIGR-0006	\N	2026-03-07 01:10:22.348	\N	COMPLETADO	Migrado de Subproducto (shipmentId: cmmfmmn4700313qcu8jkbr1g9)	2026-04-10 18:45:26.222	2026-04-10 18:45:26.222
cmnt9afzv000o3qwj4ref0q2o	TRIA-MIGR-0007	\N	2026-03-07 01:10:23.291	\N	COMPLETADO	Migrado de Subproducto (shipmentId: cmmfmmnfi00393qcu1rwdm9br)	2026-04-10 18:45:26.779	2026-04-10 18:45:26.779
cmnt9agen000s3qwj1g7u23si	TRIA-MIGR-0008	\N	2026-03-07 01:10:23.792	\N	COMPLETADO	Migrado de Subproducto (shipmentId: cmmfmmo5l003x3qcu8rd77f5z)	2026-04-10 18:45:27.311	2026-04-10 18:45:27.311
cmnt9agv9000w3qwjh7mscwr4	TRIA-MIGR-0009	\N	2026-03-07 01:10:24.16	\N	COMPLETADO	Migrado de Subproducto (shipmentId: cmmfmmojo00493qcudvj9ep1z)	2026-04-10 18:45:27.909	2026-04-10 18:45:27.909
cmnt9ahay00103qwjf4bgqkty	TRIA-MIGR-0010	\N	2026-03-07 01:10:24.663	\N	COMPLETADO	Migrado de Subproducto (shipmentId: cmmfmmotr004h3qcudkq9uwbp)	2026-04-10 18:45:28.474	2026-04-10 18:45:28.474
cmnt9ahr300143qwjtg41avkg	TRIA-MIGR-0011	\N	2026-03-07 01:10:25.172	\N	COMPLETADO	Migrado de Subproducto (shipmentId: cmmfmmp7t004t3qcu9ae48206)	2026-04-10 18:45:29.055	2026-04-10 18:45:29.055
cmnt9aiai00183qwjp3g8wqft	TRIA-MIGR-0012	\N	2026-03-07 01:10:25.531	\N	COMPLETADO	Migrado de Subproducto (shipmentId: cmmfmmplz00553qcucs6h9qhf)	2026-04-10 18:45:29.755	2026-04-10 18:45:29.755
cmnt9aip0001c3qwj1sdof1yy	TRIA-MIGR-0013	\N	2026-03-07 01:10:25.892	\N	COMPLETADO	Migrado de Subproducto (shipmentId: cmmfmmpvx005d3qcum9mtkxzf)	2026-04-10 18:45:30.276	2026-04-10 18:45:30.276
cmnt9aj3m001g3qwjcfnub8wl	TRIA-MIGR-0014	\N	2026-03-07 01:10:26.406	\N	COMPLETADO	Migrado de Subproducto (shipmentId: cmmfmmq5u005l3qcu8pasw10i)	2026-04-10 18:45:30.803	2026-04-10 18:45:30.803
cmnt9ajdn001k3qwjsjwdv6xf	TRIA-MIGR-0015	\N	2026-03-07 01:10:27.28	\N	COMPLETADO	Migrado de Subproducto (shipmentId: cmmfmmqkl005x3qcurcql6yf2)	2026-04-10 18:45:31.163	2026-04-10 18:45:31.163
cmnt9ajs0001o3qwjgy3p2l7r	TRIA-MIGR-0016	\N	2026-03-07 01:10:27.643	\N	COMPLETADO	Migrado de Subproducto (shipmentId: cmmfmmr8k006h3qcuhjftnhpx)	2026-04-10 18:45:31.68	2026-04-10 18:45:31.68
cmnt9ak47001s3qwjv28p612x	TRIA-MIGR-0017	\N	2026-03-07 01:10:28.008	\N	COMPLETADO	Migrado de Subproducto (shipmentId: cmmfmmril006p3qcugawd2w5f)	2026-04-10 18:45:32.119	2026-04-10 18:45:32.119
cmnt9akgp001w3qwjoz90770r	TRIA-MIGR-0018	\N	2026-03-07 01:10:28.526	\N	COMPLETADO	Migrado de Subproducto (shipmentId: cmmfmmrsn006x3qcuyy62tc20)	2026-04-10 18:45:32.57	2026-04-10 18:45:32.57
cmnt9akrq00203qwjc4g4667r	TRIA-MIGR-0019	\N	2026-03-07 01:10:29.203	\N	COMPLETADO	Migrado de Subproducto (shipmentId: cmmfmms7b00793qcuumy1guvr)	2026-04-10 18:45:32.967	2026-04-10 18:45:32.967
cmnt9al7s00243qwjsw5dufcq	TRIA-MIGR-0020	\N	2026-03-07 01:10:29.571	\N	COMPLETADO	Migrado de Subproducto (shipmentId: cmmfmmspw007p3qcuocvwi9fd)	2026-04-10 18:45:33.545	2026-04-10 18:45:33.545
cmnt9all000283qwj1cru8t0e	TRIA-MIGR-0021	\N	2026-03-07 01:10:30.006	\N	COMPLETADO	Migrado de Subproducto (shipmentId: cmmfmmt01007x3qcuee2bev0c)	2026-04-10 18:45:34.02	2026-04-10 18:45:34.02
cmnt9alxi002c3qwjw1uv55ft	TRIA-MIGR-0022	\N	2026-03-07 01:10:30.295	\N	COMPLETADO	Migrado de Subproducto (shipmentId: cmmfmmtc400853qcuyyt8bol0)	2026-04-10 18:45:34.47	2026-04-10 18:45:34.47
\.


--
-- Data for Name: milling_outputs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.milling_outputs (id, "millingOrderId", "lotId", "quantityQQ", "outputType", "qualityGrade", "costPerQQ") FROM stdin;
cmnt9adho00033qwj2cbk1ufx	cmnt9ad3o00003qwjob1kcl3p	cmnt9ad7l00013qwjq2t6zdra	33.00	SEGUNDA	\N	2049.11
cmnt9adyu00073qwjb9vutab8	cmnt9adu900043qwjfq2ivtaf	cmnt9adw700053qwj2i6vepjj	0.00	SEGUNDA	\N	0.00
cmnt9aege000b3qwjvfuwgrsv	cmnt9aec400083qwjvjcnemsq	cmnt9aeeh00093qwjitbmdkqi	124.99	SEGUNDA	\N	2000.00
cmnt9aeu4000f3qwj1am2zxmq	cmnt9aepy000c3qwjavfk3pey	cmnt9aerv000d3qwjhjyghcx6	25.00	SEGUNDA	\N	2000.00
cmnt9afap000j3qwj9b3m5ij5	cmnt9af5y000g3qwjbolw6phc	cmnt9af8p000h3qwje3pr3aqm	25.00	SEGUNDA	\N	2000.00
cmnt9afod000n3qwjc7c37x5l	cmnt9afke000k3qwje62gt2ij	cmnt9afmd000l3qwjeztmcs8r	25.00	SEGUNDA	\N	2000.00
cmnt9ag56000r3qwj3v63xf0r	cmnt9afzv000o3qwj4ref0q2o	cmnt9ag2t000p3qwj9qhhrm07	125.00	SEGUNDA	\N	2000.00
cmnt9agob000v3qwj059mdk4m	cmnt9agen000s3qwj1g7u23si	cmnt9aggt000t3qwjltkajnkr	25.00	SEGUNDA	\N	2000.00
cmnt9ah4n000z3qwj6v10ueey	cmnt9agv9000w3qwjh7mscwr4	cmnt9agxd000x3qwj60hqz3xa	25.00	SEGUNDA	\N	2000.00
cmnt9ahl700133qwj1f2jfbhn	cmnt9ahay00103qwjf4bgqkty	cmnt9ahj600113qwjn1qb1z34	25.00	SEGUNDA	\N	2000.00
cmnt9ahzr00173qwj3tzq0aax	cmnt9ahr300143qwjtg41avkg	cmnt9ahxq00153qwj0e55stn1	25.00	SEGUNDA	\N	2000.00
cmnt9aiem001b3qwjfagefhx0	cmnt9aiai00183qwjp3g8wqft	cmnt9aici00193qwj3xvn6lm0	25.00	SEGUNDA	\N	2000.00
cmnt9aisy001f3qwjs0tc83ol	cmnt9aip0001c3qwj1sdof1yy	cmnt9air3001d3qwjmyly68vx	25.00	SEGUNDA	\N	2000.00
cmnt9aj7k001j3qwj8rnrtkl0	cmnt9aj3m001g3qwjcfnub8wl	cmnt9aj5l001h3qwjoolguox5	50.00	SEGUNDA	\N	2000.00
cmnt9ajkv001n3qwjbsyhrukm	cmnt9ajdn001k3qwjsjwdv6xf	cmnt9ajib001l3qwj456hip6g	100.00	SEGUNDA	\N	2000.00
cmnt9ajwv001r3qwjnfpxa3xp	cmnt9ajs0001o3qwjgy3p2l7r	cmnt9ajtz001p3qwj9truspdj	25.00	SEGUNDA	\N	2000.00
cmnt9ak7z001v3qwjpz99u39g	cmnt9ak47001s3qwjv28p612x	cmnt9ak63001t3qwjjax6938b	25.00	SEGUNDA	\N	2000.00
cmnt9akko001z3qwjg9g3wb07	cmnt9akgp001w3qwjoz90770r	cmnt9akim001x3qwjhslze04w	100.00	SEGUNDA	\N	2000.00
cmnt9aky300233qwjvcdhx0uc	cmnt9akrq00203qwjc4g4667r	cmnt9akvc00213qwjtu4px07i	150.00	SEGUNDA	\N	1900.00
cmnt9aldl00273qwjh1w2reyx	cmnt9al7s00243qwjsw5dufcq	cmnt9albp00253qwjbo3xlcio	25.00	SEGUNDA	\N	1900.00
cmnt9alqn002b3qwjrteqzq9h	cmnt9all000283qwj1cru8t0e	cmnt9aloh00293qwj6m4w3wxf	16.36	SEGUNDA	\N	2000.00
cmnt9am30002f3qwj9hxbsj85	cmnt9alxi002c3qwjw1uv55ft	cmnt9alzg002d3qwj0vgezlk9	25.00	SEGUNDA	\N	2000.00
\.


--
-- Data for Name: purchase_orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_orders (id, "orderNumber", "supplierId", date, status, cosecha, "quintalesPerg", "precioPerg", "totalCafe", "fletePorQQ", "totalFlete", seguridad, seguro, cadena, cargas, descargas, "costoTotalAccum", "precioPromedio", notes, "createdAt", "updatedAt") FROM stdin;
cmmfmmtm6008b3qcuqvx4f8wy	OC-2526-01	cmmfcfde900093q4vilsul5fd	2025-12-01 00:00:00	RECIBIDO	25/26	544.50	1675.00	912037.50	15.00	8167.50	650.00	2280.09	0.00	0.00	0.00	923135.09	1695.3813	\N	2026-03-07 01:10:30.511	2026-03-07 01:10:30.511
cmmfmmts5008d3qcu862ff4i8	OC-2526-02	cmmfcfde900093q4vilsul5fd	2025-12-01 00:00:00	RECIBIDO	25/26	450.00	1635.00	735750.00	15.00	6750.00	650.00	1839.38	0.00	0.00	0.00	744989.38	1655.5319	\N	2026-03-07 01:10:30.725	2026-03-07 01:10:30.725
\.


--
-- Data for Name: shipment_parties; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.shipment_parties (id, "shipmentId", "clientId", role, notes, "createdAt") FROM stdin;
\.


--
-- Data for Name: shipments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.shipments (id, name, month, year, status, "numContainers", regions, "posicionDate", "embarqueDate", "exportCostConfigId", "gastosPerSaco", "totalSacos69", "totalSacos46", "totalFacturacionLbs", "totalFacturacionKgs", "totalGastosExport", "totalUtilidadSinGE", "totalCostoFinanc", "totalUtilidadSinCF", "totalPagoQTZ", "totalMateriaPrima", "totalComision", "totalSubproducto", "utilidadBruta", "margenBruto", notes, "aggregatedAt", "createdAt", "updatedAt", "totalFacturacionQTZ", "totalISR") FROM stdin;
cmmfmms7b00793qcuumy1guvr	SERENGETTI - Bloque 2	1	2025	PREPARACION	6	HUEHUE	2026-03-01 00:00:00	\N	cmmfcfec4000c3q4ve2kznkuw	23.00	1650.00	2475.00	953997.00	967457.90	37950.00	929507.90	0.00	929507.90	7110735.42	6756750.00	56801.25	285000.00	176779.17	0.023886	\N	2026-04-10 20:10:54.973	2026-03-07 01:10:28.679	2026-04-10 20:10:54.974	7401052.94	405405.00
cmmfmmtc400853qcuyyt8bol0	onyx	2	2025	PREPARACION	2	Huehuetenango	2026-02-01 00:00:00	\N	cmmfcfec4000c3q4ve2kznkuw	23.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	1061775.00	0.00	50000.00	-1075481.50	0.000000	\N	2026-04-10 20:10:59.467	2026-03-07 01:10:30.148	2026-04-10 20:10:59.468	0.00	63706.50
cmmfmmt01007x3qcuee2bev0c	SUCAFINA SPECIALTY	3	2025	PREPARACION	1	Danilianda / Santa Isabel	\N	\N	cmmfcfec4000c3q4ve2kznkuw	23.00	180.00	270.00	114750.00	116369.12	4140.00	112229.12	0.00	112229.12	858552.79	748440.00	6196.50	32727.27	91737.16	0.103050	\N	2026-04-10 20:11:02.54	2026-03-07 01:10:29.713	2026-04-10 20:11:02.541	890223.77	44906.40
cmmfmmiwl00013qcu4cgz88dq	Enero 2026 - Bloque 1	1	2026	PREPARACION	3	\N	2026-03-01 00:00:00	\N	cmmfcfec4000c3q4ve2kznkuw	20.00	840.00	1260.00	481432.50	488228.40	25200.00	463028.40	5157.29	457871.13	3502714.08	2958989.30	28917.00	67620.54	582428.32	0.155940	\N	2026-04-15 16:11:47.829	2026-03-07 01:10:16.629	2026-04-15 16:11:47.829	3734947.26	0.00
cmmfmmnfi00393qcu1rwdm9br	Marzo 2026 - Bloque 5	3	2026	PREPARACION	10	Organico	2026-05-01 00:00:00	2026-03-01 00:00:00	cmmfcfec4000c3q4ve2kznkuw	23.00	1375.00	2062.50	673818.75	683326.35	31625.00	651701.35	0.00	651701.35	4985515.20	4492125.00	47334.38	250000.00	426528.33	0.081594	\N	2026-04-10 20:11:14.134	2026-03-07 01:10:22.494	2026-04-10 20:11:14.135	5227446.58	269527.50
cmmfmmmtw002t3qcugep2il9o	Marzo 2026 - Bloque 3	3	2026	PREPARACION	2	Huheue	2026-05-01 00:00:00	2026-03-01 00:00:00	cmmfcfec4000c3q4ve2kznkuw	23.00	275.00	412.50	134310.00	136205.11	6325.00	129880.11	0.00	129880.11	993582.87	917482.50	9466.88	50000.00	61584.55	0.059104	\N	2026-04-10 20:11:17.953	2026-03-07 01:10:21.717	2026-04-10 20:11:17.957	1041969.09	55048.95
cmmfmmotr004h3qcudkq9uwbp	Mayo 2026 - Bloque 2	5	2026	PREPARACION	1	ORGANICO HUEHUE/ HUEHUE	2026-07-01 00:00:00	2026-05-01 00:00:00	cmmfcfec4000c3q4ve2kznkuw	23.00	275.00	412.50	135622.50	137536.13	6325.00	131211.13	0.00	131211.13	1003765.17	948667.50	9466.88	50000.00	38710.75	0.036792	\N	2026-04-10 20:11:22.669	2026-03-07 01:10:24.303	2026-04-10 20:11:22.67	1052151.39	56920.05
cmmfmmp7t004t3qcu9ae48206	Mayo 2026 - Bloque 3	5	2026	PREPARACION	2	Regalito / Vista Al bosque	2026-07-01 00:00:00	2026-05-01 00:00:00	cmmfcfec4000c3q4ve2kznkuw	23.00	275.00	412.50	153037.50	155196.86	6325.00	148871.86	0.00	148871.86	1138869.73	970398.00	9466.88	50000.00	150780.98	0.127000	\N	2026-04-10 20:11:30.754	2026-03-07 01:10:24.809	2026-04-10 20:11:30.755	1187255.98	58223.88
cmmfmmq5u005l3qcu8pasw10i	Negociacion 2026 - Bloque 1	6	2026	PREPARACION	2	Danilandia	2026-07-01 00:00:00	2026-05-01 00:00:00	cmmfcfec4000c3q4ve2kznkuw	23.00	550.00	825.00	298381.88	302592.04	12650.00	289942.04	0.00	289942.04	2218056.63	2069100.00	18933.75	100000.00	105876.88	0.045739	\N	2026-04-10 20:11:32.95	2026-03-07 01:10:26.034	2026-04-10 20:11:32.95	2314829.11	124146.00
cmmfmmr8k006h3qcuhjftnhpx	Negociacion 2026 - Bloque 3	6	2026	PREPARACION	1	Rain Forest A.	2026-03-01 00:00:00	2026-02-01 00:00:00	cmmfcfec4000c3q4ve2kznkuw	23.00	275.00	412.50	0.00	0.00	6325.00	-6325.00	0.00	-6325.00	-48386.25	1089000.00	9466.88	50000.00	-1162193.13	0.000000	\N	2026-04-10 20:11:35.035	2026-03-07 01:10:27.428	2026-04-10 20:11:35.037	0.00	65340.00
cmmfmmqkl005x3qcurcql6yf2	Negociacion 2026 - Bloque 2	6	2026	PREPARACION	1	DANILANDIA	\N	\N	cmmfcfec4000c3q4ve2kznkuw	23.00	1100.00	1650.00	597547.50	605978.90	25300.00	580678.90	0.00	580678.90	4442193.54	4138200.00	37867.50	200000.00	217834.04	0.046990	\N	2026-04-10 20:11:37.344	2026-03-07 01:10:26.565	2026-04-10 20:11:37.345	4635738.59	248292.00
cmmfmmpvx005d3qcum9mtkxzf	Mayo 2026 - Bloque 5	5	2026	PREPARACION	2	Santa Rosa	2026-05-01 00:00:00	2026-04-01 00:00:00	cmmfcfec4000c3q4ve2kznkuw	23.00	275.00	412.50	134454.38	136351.53	6325.00	130026.53	0.00	130026.53	994702.93	917482.50	9466.88	50000.00	62704.61	0.060114	\N	2026-04-10 20:11:26.748	2026-03-07 01:10:25.677	2026-04-10 20:11:26.749	1043089.20	55048.95
cmmfmmjqe000j3qcuiom5iqyc	Enero 2026 - Bloque 2	1	2026	PREPARACION	4	\N	2026-03-01 00:00:00	\N	cmmfcfec4000c3q4ve2kznkuw	23.00	275.00	412.50	171600.00	171600.00	9487.50	162112.50	1689.97	160422.53	1227232.38	969618.73	9466.88	0.00	182382.62	0.138933	\N	2026-04-15 16:11:49.816	2026-03-07 01:10:17.702	2026-04-15 16:11:49.825	1312740.00	65764.16
cmmfmmplz00553qcucs6h9qhf	Mayo 2026 - Bloque 4	5	2026	PREPARACION	2	Regalito	2026-07-01 00:00:00	2026-05-01 00:00:00	cmmfcfec4000c3q4ve2kznkuw	23.00	275.00	412.50	138496.88	140451.07	6325.00	134126.07	0.00	134126.07	1026064.40	916938.00	9466.88	50000.00	94643.25	0.088085	\N	2026-04-10 20:11:28.659	2026-03-07 01:10:25.319	2026-04-10 20:11:28.66	1074450.69	55016.28
cmmfmmril006p3qcugawd2w5f	Negociacion 2026 - Bloque 4	6	2026	PREPARACION	1	Danilandia	\N	\N	cmmfcfec4000c3q4ve2kznkuw	23.00	275.00	412.50	144230.63	146265.72	6325.00	139940.72	0.00	139940.72	1070546.50	925650.00	9466.88	50000.00	129890.63	0.116084	\N	2026-04-10 20:11:39.528	2026-03-07 01:10:27.789	2026-04-10 20:11:39.529	1118932.76	55539.00
cmmfmmrsn006x3qcuyy62tc20	SERENGETTI - Bloque 1	1	2025	PREPARACION	3	Organico /Santa Rosa/Huehue	2026-03-01 00:00:00	\N	cmmfcfec4000c3q4ve2kznkuw	23.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	4407562.50	0.00	200000.00	-4472016.25	0.000000	\N	2026-04-10 20:10:56.908	2026-03-07 01:10:28.151	2026-04-10 20:10:56.91	0.00	264453.75
cmmfmmspw007p3qcuocvwi9fd	SERENGETTI - Bloque 3	1	2025	PREPARACION	1	organico Huehue	2026-03-01 00:00:00	\N	cmmfcfec4000c3q4ve2kznkuw	23.00	275.00	412.50	171600.00	174021.28	6325.00	167696.28	0.00	167696.28	1282876.51	1157062.50	9466.88	47500.00	94423.38	0.070928	\N	2026-04-10 20:10:52.717	2026-03-07 01:10:29.349	2026-04-10 20:10:52.719	1331262.79	69423.75
cmmfmmn4700313qcu8jkbr1g9	Marzo 2026 - Bloque 4	3	2026	PREPARACION	2	HUEHUETENANGO	2026-05-01 00:00:00	2026-03-01 00:00:00	cmmfcfec4000c3q4ve2kznkuw	23.00	275.00	412.50	148788.75	150888.16	6325.00	144563.16	0.00	144563.16	1105908.17	933817.50	9466.88	50000.00	156594.75	0.135663	\N	2026-04-10 20:11:10.309	2026-03-07 01:10:22.087	2026-04-10 20:11:10.31	1154294.42	56029.05
cmmfmmmfe002h3qcuv7bnz9kx	Marzo 2026 - Bloque 2	3	2026	PREPARACION	2	Regalito / Vista el Bosque	2026-07-01 00:00:00	2026-05-01 00:00:00	cmmfcfec4000c3q4ve2kznkuw	23.00	275.00	412.50	152499.38	154651.14	6325.00	148326.14	0.00	148326.14	1134694.98	954855.00	9466.88	50000.00	163081.81	0.137845	\N	2026-04-10 20:11:12.188	2026-03-07 01:10:21.194	2026-04-10 20:11:12.189	1183081.22	57291.30
cmmfmmlas001n3qcuql8q2fca	Marzo 2026 - Bloque 1	3	2026	PREPARACION	2	Santa R. / Huehue / Huehue / Huehue/ Organico/Huehue/Santa Rosq	2026-05-01 00:00:00	2026-03-01 00:00:00	cmmfcfec4000c3q4ve2kznkuw	23.00	1375.00	2062.50	691087.50	700838.75	31625.00	669213.75	0.00	669213.75	5119485.16	4619691.92	47334.38	249987.88	425265.23	0.079320	\N	2026-04-10 20:11:16.077	2026-03-07 01:10:19.732	2026-04-10 20:11:16.078	5361416.44	277181.52
cmmfmmo5l003x3qcu8rd77f5z	Abril 2026	4	2026	PREPARACION	2	Santa Rosa. / Huehue	2026-05-01 00:00:00	2026-04-01 00:00:00	cmmfcfec4000c3q4ve2kznkuw	23.00	275.00	412.50	136381.88	138306.23	6325.00	131981.23	0.00	131981.23	1009656.36	903870.00	9466.88	50000.00	92087.29	0.087036	\N	2026-04-10 20:11:20.365	2026-03-07 01:10:23.433	2026-04-10 20:11:20.367	1058042.66	54232.20
cmmfmmojo00493qcudvj9ep1z	Mayo 2026 - Bloque 1	5	2026	PREPARACION	4	Hueue	\N	\N	cmmfcfec4000c3q4ve2kznkuw	23.00	275.00	412.50	169125.00	171511.35	6325.00	165186.35	0.00	165186.35	1263675.61	1124392.50	9466.88	50000.00	112352.69	0.085631	\N	2026-04-10 20:11:24.626	2026-03-07 01:10:23.94	2026-04-10 20:11:24.627	1312061.83	67463.55
\.


--
-- Data for Name: subproductos; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.subproductos (id, "shipmentId", contenedores, "oroPerCont", "totalOro", "precioSinIVA", "totalPerga", "createdAt", "updatedAt") FROM stdin;
cmmfmmmb3002f3qcuosyae6al	cmmfmmlas001n3qcuql8q2fca	4.9998	25.00	124.99	2000.00	249987.88	2026-03-07 01:10:21.039	2026-03-07 01:10:21.039
cmmfmmmq0002r3qcud3j5ctb6	cmmfmmmfe002h3qcuv7bnz9kx	1.0000	25.00	25.00	2000.00	50000.00	2026-03-07 01:10:21.576	2026-03-07 01:10:21.576
cmmfmmn0b002z3qcuwks9aull	cmmfmmmtw002t3qcugep2il9o	1.0000	25.00	25.00	2000.00	50000.00	2026-03-07 01:10:21.948	2026-03-07 01:10:21.948
cmmfmmnbf00373qcuos0x4mhf	cmmfmmn4700313qcu8jkbr1g9	1.0000	25.00	25.00	2000.00	50000.00	2026-03-07 01:10:22.348	2026-03-07 01:10:22.348
cmmfmmo1n003v3qcuj3025lcp	cmmfmmnfi00393qcu1rwdm9br	5.0000	25.00	125.00	2000.00	250000.00	2026-03-07 01:10:23.291	2026-03-07 01:10:23.291
cmmfmmofk00473qcuxrhol43l	cmmfmmo5l003x3qcu8rd77f5z	1.0000	25.00	25.00	2000.00	50000.00	2026-03-07 01:10:23.792	2026-03-07 01:10:23.792
cmmfmmops004f3qcuu2hb6eeo	cmmfmmojo00493qcudvj9ep1z	1.0000	25.00	25.00	2000.00	50000.00	2026-03-07 01:10:24.16	2026-03-07 01:10:24.16
cmmfmmp3r004r3qcuhsyzxyyq	cmmfmmotr004h3qcudkq9uwbp	1.0000	25.00	25.00	2000.00	50000.00	2026-03-07 01:10:24.663	2026-03-07 01:10:24.663
cmmfmmphw00533qcun2c00o47	cmmfmmp7t004t3qcu9ae48206	1.0000	25.00	25.00	2000.00	50000.00	2026-03-07 01:10:25.172	2026-03-07 01:10:25.172
cmmfmmprv005b3qcuwxoviv7s	cmmfmmplz00553qcucs6h9qhf	1.0000	25.00	25.00	2000.00	50000.00	2026-03-07 01:10:25.531	2026-03-07 01:10:25.531
cmmfmmq1w005j3qcuz2m5mj6d	cmmfmmpvx005d3qcum9mtkxzf	1.0000	25.00	25.00	2000.00	50000.00	2026-03-07 01:10:25.892	2026-03-07 01:10:25.892
cmmfmmqg6005v3qcuipol2ct7	cmmfmmq5u005l3qcu8pasw10i	2.0000	25.00	50.00	2000.00	100000.00	2026-03-07 01:10:26.406	2026-03-07 01:10:26.406
cmmfmmr4f006f3qcuqylbepwy	cmmfmmqkl005x3qcurcql6yf2	4.0000	25.00	100.00	2000.00	200000.00	2026-03-07 01:10:27.28	2026-03-07 01:10:27.28
cmmfmmrej006n3qcuuzzz3m85	cmmfmmr8k006h3qcuhjftnhpx	1.0000	25.00	25.00	2000.00	50000.00	2026-03-07 01:10:27.643	2026-03-07 01:10:27.643
cmmfmmron006v3qcuncx0aq45	cmmfmmril006p3qcugawd2w5f	1.0000	25.00	25.00	2000.00	50000.00	2026-03-07 01:10:28.008	2026-03-07 01:10:28.008
cmmfmms3200773qcuqhoek8c8	cmmfmmrsn006x3qcuyy62tc20	4.0000	25.00	100.00	2000.00	200000.00	2026-03-07 01:10:28.526	2026-03-07 01:10:28.526
cmmfmmslu007n3qcuz1vxz3eb	cmmfmms7b00793qcuumy1guvr	6.0000	25.00	150.00	1900.00	285000.00	2026-03-07 01:10:29.203	2026-03-07 01:10:29.203
cmmfmmsw2007v3qcu6gmbx9dr	cmmfmmspw007p3qcuocvwi9fd	1.0000	25.00	25.00	1900.00	47500.00	2026-03-07 01:10:29.571	2026-03-07 01:10:29.571
cmmfmmt8500833qcubry1lnzm	cmmfmmt01007x3qcuee2bev0c	0.6545	25.00	16.36	2000.00	32727.27	2026-03-07 01:10:30.006	2026-03-07 01:10:30.006
cmmfmmtg700893qcuwo2e1rik	cmmfmmtc400853qcuyyt8bol0	1.0000	25.00	25.00	2000.00	50000.00	2026-03-07 01:10:30.295	2026-03-07 01:10:30.295
cmmfmmjkj000h3qcum4363jaa	cmmfmmiwl00013qcu4cgz88dq	1.0000	33.00	33.00	2049.11	67620.54	2026-03-07 01:10:17.491	2026-04-09 23:28:05.836
cmmfmmjwp000p3qcu1ddurdjx	cmmfmmjqe000j3qcuiom5iqyc	0.0000	33.00	0.00	2049.11	0.00	2026-03-07 01:10:17.929	2026-04-09 23:28:05.836
\.


--
-- Data for Name: supplier_account_entries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.supplier_account_entries (id, "supplierId", "orderCode", "ingresoNum", date, pergamino, precio, total, "createdAt", "facilityId", "lotId", "qualityGrade") FROM stdin;
cmmfmmtu4008f3qcudun7opcu	cmmfcfcrg00083q4vqsiyo6of	OC4	568	2026-01-06 00:00:00	29.59	2065.00	61103.35	2026-03-07 01:10:30.797	\N	\N	\N
cmmfmmty5008h3qculxua1eel	cmmfcfcrg00083q4vqsiyo6of	OC5	587	2026-01-06 00:00:00	29.45	2065.00	60814.25	2026-03-07 01:10:30.941	\N	\N	\N
cmmfmmu06008j3qcugrcl7fb5	cmmfcfcrg00083q4vqsiyo6of	OC6	642	2025-01-23 00:00:00	29.97	2065.00	61888.05	2026-03-07 01:10:31.014	\N	\N	\N
cmmfmmu25008l3qcunn41i06c	cmmfcfcrg00083q4vqsiyo6of	OC4	569	2026-01-06 00:00:00	30.88	2065.00	63767.20	2026-03-07 01:10:31.086	\N	\N	\N
cmmfmmu46008n3qcuwml1welg	cmmfcfcrg00083q4vqsiyo6of	OC5	588	2026-01-06 00:00:00	29.65	2065.00	61227.25	2026-03-07 01:10:31.158	\N	\N	\N
cmmfmmu67008p3qcugyv7w6r5	cmmfcfcrg00083q4vqsiyo6of	OC6	643	2025-01-23 00:00:00	29.96	2065.00	61867.40	2026-03-07 01:10:31.231	\N	\N	\N
cmmfmmu87008r3qcu41tij1l0	cmmfcfcrg00083q4vqsiyo6of	OC4	570	2026-01-06 00:00:00	31.01	2065.00	64035.65	2026-03-07 01:10:31.304	\N	\N	\N
cmmfmmua9008t3qcuwjtzrzxz	cmmfcfcrg00083q4vqsiyo6of	OC5	589	2026-01-06 00:00:00	30.65	2065.00	63292.25	2026-03-07 01:10:31.377	\N	\N	\N
cmmfmmuck008v3qcung6jafey	cmmfcfcrg00083q4vqsiyo6of	OC6	644	2025-01-23 00:00:00	29.52	2065.00	60958.80	2026-03-07 01:10:31.461	\N	\N	\N
cmmfmmuf0008x3qcug7mggeoe	cmmfcfcrg00083q4vqsiyo6of	OC4	571	2026-01-06 00:00:00	30.53	2065.00	63044.45	2026-03-07 01:10:31.548	\N	\N	\N
cmmfmmuh0008z3qcut1wjgpxj	cmmfcfcrg00083q4vqsiyo6of	OC5	590	2026-01-06 00:00:00	28.48	2065.00	58811.20	2026-03-07 01:10:31.621	\N	\N	\N
cmmfmmujr00913qcu4myoe4qu	cmmfcfcrg00083q4vqsiyo6of	OC6	645	2025-01-23 00:00:00	30.19	2065.00	62342.35	2026-03-07 01:10:31.72	\N	\N	\N
cmmfmmulz00933qcu0dhuh5jy	cmmfcfcrg00083q4vqsiyo6of	OC4	572	2026-01-06 00:00:00	30.60	2065.00	63189.00	2026-03-07 01:10:31.799	\N	\N	\N
cmmfmmuo200953qcuv9uiouls	cmmfcfcrg00083q4vqsiyo6of	OC5	591	2026-01-06 00:00:00	29.47	2065.00	60855.55	2026-03-07 01:10:31.874	\N	\N	\N
cmmfmmuq200973qcu27ehpni3	cmmfcfcrg00083q4vqsiyo6of	OC6	646	2025-01-23 00:00:00	30.74	2065.00	63478.10	2026-03-07 01:10:31.946	\N	\N	\N
cmmfmmusa00993qcunb7fttmx	cmmfcfcrg00083q4vqsiyo6of	OC4	573	2026-01-06 00:00:00	30.38	2065.00	62734.70	2026-03-07 01:10:32.026	\N	\N	\N
cmmfmmuui009b3qcuud6pzyik	cmmfcfcrg00083q4vqsiyo6of	OC5	592	2026-01-06 00:00:00	29.31	2065.00	60525.15	2026-03-07 01:10:32.106	\N	\N	\N
cmmfmmuwz009d3qcukhp0ewz7	cmmfcfcrg00083q4vqsiyo6of	OC6	647	2025-01-23 00:00:00	30.21	2065.00	62383.65	2026-03-07 01:10:32.196	\N	\N	\N
cmmfmmuz1009f3qcuxojmqe8u	cmmfcfcrg00083q4vqsiyo6of	OC4	574	2026-01-06 00:00:00	30.34	2065.00	62652.10	2026-03-07 01:10:32.269	\N	\N	\N
cmmfmmv1i009h3qcu67icdhm3	cmmfcfcrg00083q4vqsiyo6of	OC5	593	2026-01-06 00:00:00	29.14	2065.00	60174.10	2026-03-07 01:10:32.358	\N	\N	\N
cmmfmmv3x009j3qcuhyomwayk	cmmfcfcrg00083q4vqsiyo6of	OC6	648	2025-01-23 00:00:00	31.54	2065.00	65130.10	2026-03-07 01:10:32.445	\N	\N	\N
cmmfmmv6y009l3qcuzbf575qj	cmmfcfcrg00083q4vqsiyo6of	OC4	575	2026-01-06 00:00:00	31.16	2065.00	64345.40	2026-03-07 01:10:32.554	\N	\N	\N
cmmfmmv8x009n3qcuaa0alvua	cmmfcfcrg00083q4vqsiyo6of	OC5	594	2026-01-06 00:00:00	29.06	2065.00	60008.90	2026-03-07 01:10:32.625	\N	\N	\N
cmmfmmvax009p3qcuprsx0ty4	cmmfcfcrg00083q4vqsiyo6of	OC6	649	2025-01-23 00:00:00	30.19	2065.00	62342.35	2026-03-07 01:10:32.698	\N	\N	\N
cmmfmmvdd009r3qcu465wbs6y	cmmfcfcrg00083q4vqsiyo6of	OC4	576	2026-01-06 00:00:00	29.94	2065.00	61826.10	2026-03-07 01:10:32.785	\N	\N	\N
cmmfmmvff009t3qcupiimg2rl	cmmfcfcrg00083q4vqsiyo6of	OC5	595	2026-01-06 00:00:00	27.53	2065.00	56849.45	2026-03-07 01:10:32.86	\N	\N	\N
cmmfmmvhg009v3qcuqgeuqstw	cmmfcfcrg00083q4vqsiyo6of	OC6	650	2025-01-23 00:00:00	31.69	2065.00	65439.85	2026-03-07 01:10:32.932	\N	\N	\N
cmmfmmvjf009x3qcu6eiw9619	cmmfcfcrg00083q4vqsiyo6of	OC4	577	2026-01-06 00:00:00	28.89	2065.00	59657.85	2026-03-07 01:10:33.004	\N	\N	\N
cmmfmmvlf009z3qcuitr7ktnr	cmmfcfcrg00083q4vqsiyo6of	OC5	596	2026-01-06 00:00:00	28.98	2065.00	59843.70	2026-03-07 01:10:33.075	\N	\N	\N
cmmfmmvne00a13qcuz7m6mrea	cmmfcfcrg00083q4vqsiyo6of	OC6	651	2025-01-23 00:00:00	30.27	2065.00	62507.55	2026-03-07 01:10:33.147	\N	\N	\N
cmmfmmvpe00a33qcugu4a1wgd	cmmfcfcrg00083q4vqsiyo6of	OC4	578	2026-01-06 00:00:00	29.15	2065.00	60194.75	2026-03-07 01:10:33.218	\N	\N	\N
cmmfmmvri00a53qcukd85z1sc	cmmfcfcrg00083q4vqsiyo6of	OC5	597	2026-01-06 00:00:00	27.56	2065.00	56911.40	2026-03-07 01:10:33.294	\N	\N	\N
cmmfmmvtg00a73qcuw1wcc8go	cmmfcfcrg00083q4vqsiyo6of	OC6	652	2025-01-23 00:00:00	31.31	2065.00	64655.15	2026-03-07 01:10:33.364	\N	\N	\N
cmmfmmvve00a93qcuul3eesws	cmmfcfcrg00083q4vqsiyo6of	OC4	579	2026-01-06 00:00:00	29.26	2065.00	60421.90	2026-03-07 01:10:33.434	\N	\N	\N
cmmfmmvxd00ab3qcu73rsjcln	cmmfcfcrg00083q4vqsiyo6of	OC5	598	2026-01-06 00:00:00	28.25	2065.00	58336.25	2026-03-07 01:10:33.505	\N	\N	\N
cmmfmmvzc00ad3qcu6njfmrsv	cmmfcfcrg00083q4vqsiyo6of	OC6	653	2025-01-23 00:00:00	30.18	2065.00	62321.70	2026-03-07 01:10:33.576	\N	\N	\N
cmmfmmw1b00af3qcuxzeuxa45	cmmfcfcrg00083q4vqsiyo6of	OC4	580	2026-01-06 00:00:00	29.06	2065.00	60008.90	2026-03-07 01:10:33.647	\N	\N	\N
cmmfmmw3c00ah3qcuh78ktjyd	cmmfcfcrg00083q4vqsiyo6of	OC5	599	2026-01-06 00:00:00	29.27	2065.00	60442.55	2026-03-07 01:10:33.72	\N	\N	\N
cmmfmmw5r00aj3qcu2ilntoyj	cmmfcfcrg00083q4vqsiyo6of	OC6	654	2025-01-23 00:00:00	31.15	2065.00	64324.75	2026-03-07 01:10:33.807	\N	\N	\N
cmmfmmw7v00al3qcuevaxy694	cmmfcfcrg00083q4vqsiyo6of	OC4	581	2026-01-06 00:00:00	30.23	2065.00	62424.95	2026-03-07 01:10:33.883	\N	\N	\N
cmmfmmw9t00an3qcucawsvuat	cmmfcfcrg00083q4vqsiyo6of	OC5	600	2026-01-06 00:00:00	29.37	2065.00	60649.05	2026-03-07 01:10:33.953	\N	\N	\N
cmmfmmwbr00ap3qcu4ldawllg	cmmfcfcrg00083q4vqsiyo6of	OC6	655	2025-01-23 00:00:00	21.61	2065.00	44624.65	2026-03-07 01:10:34.023	\N	\N	\N
cmmfmmwe700ar3qcuu8iy8t9h	cmmfcfcrg00083q4vqsiyo6of	OC4	582	2026-01-06 00:00:00	30.00	2065.00	61950.00	2026-03-07 01:10:34.111	\N	\N	\N
cmmfmmwg700at3qcugt4vfloz	cmmfcfcrg00083q4vqsiyo6of	OC5	601	2026-01-06 00:00:00	29.57	2065.00	61062.05	2026-03-07 01:10:34.184	\N	\N	\N
cmmfmmwi800av3qcuhhijok8z	cmmfcfcrg00083q4vqsiyo6of	OC8	655	2025-01-23 00:00:00	8.54	1965.00	16781.10	2026-03-07 01:10:34.256	\N	\N	\N
cmmfmmwk700ax3qcucbgggnyq	cmmfcfcrg00083q4vqsiyo6of	OC4	583	2026-01-06 00:00:00	30.76	2065.00	63519.40	2026-03-07 01:10:34.327	\N	\N	\N
cmmfmmwmc00az3qcup1d0fagv	cmmfcfcrg00083q4vqsiyo6of	OC5	602	2026-01-06 00:00:00	27.24	2065.00	56250.60	2026-03-07 01:10:34.405	\N	\N	\N
cmmfmmwoe00b13qcuhs5fftoc	cmmfcfcrg00083q4vqsiyo6of	OC8	656	2025-01-23 00:00:00	30.33	1965.00	59598.45	2026-03-07 01:10:34.478	\N	\N	\N
cmmfmmwqd00b33qcuewdhytn3	cmmfcfcrg00083q4vqsiyo6of	OC4	584	2026-01-06 00:00:00	30.69	2065.00	63374.85	2026-03-07 01:10:34.55	\N	\N	\N
cmmfmmwse00b53qcu4rz02qlr	cmmfcfcrg00083q4vqsiyo6of	OC5	603	2026-01-06 00:00:00	27.47	2065.00	56725.55	2026-03-07 01:10:34.623	\N	\N	\N
cmmfmmwue00b73qcujqmskjfj	cmmfcfcrg00083q4vqsiyo6of	OC8	657	2025-01-23 00:00:00	30.79	1965.00	60502.35	2026-03-07 01:10:34.694	\N	\N	\N
cmmfmmwwc00b93qcu3433y8j5	cmmfcfcrg00083q4vqsiyo6of	OC4	585	2026-01-06 00:00:00	31.52	2065.00	65088.80	2026-03-07 01:10:34.765	\N	\N	\N
cmmfmmwyb00bb3qcudp4pi11b	cmmfcfcrg00083q4vqsiyo6of	OC5	604	2026-01-06 00:00:00	29.35	2065.00	60607.75	2026-03-07 01:10:34.835	\N	\N	\N
cmmfmmx0900bd3qcu1hqf63wy	cmmfcfcrg00083q4vqsiyo6of	OC8	658	2025-01-23 00:00:00	29.63	1965.00	58222.95	2026-03-07 01:10:34.905	\N	\N	\N
cmmfmmx2700bf3qcuh3ugskt7	cmmfcfcrg00083q4vqsiyo6of	OC4	586	2026-01-06 00:00:00	21.00	2065.00	43365.00	2026-03-07 01:10:34.975	\N	\N	\N
cmmfmmx4500bh3qcupln6fibq	cmmfcfcrg00083q4vqsiyo6of	OC5	605	2026-01-06 00:00:00	30.11	2065.00	62177.15	2026-03-07 01:10:35.045	\N	\N	\N
cmmfmmx6400bj3qcu8qk7g2q1	cmmfcfcrg00083q4vqsiyo6of	OC8	659	2025-01-23 00:00:00	24.18	1965.00	47513.70	2026-03-07 01:10:35.116	\N	\N	\N
cmmfmmx8300bl3qcuji5fo7u5	cmmfcfcrg00083q4vqsiyo6of	OC5	606	2026-01-06 00:00:00	29.12	2065.00	60132.80	2026-03-07 01:10:35.187	\N	\N	\N
cmmfmmxa500bn3qcuewliwdlf	cmmfcfcrg00083q4vqsiyo6of	OC5	607	2026-01-06 00:00:00	31.05	2065.00	64118.25	2026-03-07 01:10:35.261	\N	\N	\N
cmmfmmxc600bp3qcuzaraxcvc	cmmfcfcrg00083q4vqsiyo6of	OC5	608	2026-01-06 00:00:00	30.53	2065.00	63044.45	2026-03-07 01:10:35.335	\N	\N	\N
cmmfmmxe600br3qcus87smpvl	cmmfcfcrg00083q4vqsiyo6of	OC5	609	2026-01-06 00:00:00	10.87	2065.00	22446.55	2026-03-07 01:10:35.406	\N	\N	\N
\.


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.suppliers (id, name, code, contact, email, phone, notes, "isActive", "createdAt", "updatedAt") FROM stdin;
cmmfcfcrg00083q4vqsiyo6of	K-Finos	KFI	\N	\N	\N	\N	t	2026-03-06 20:24:45.916	2026-03-06 20:24:45.916
cmmfcfde900093q4vilsul5fd	José David Guerra	JDG	\N	\N	\N	\N	t	2026-03-06 20:24:46.738	2026-03-06 20:24:46.738
cmmfcfdsd000a3q4v7j7dh4nc	Walco	WAL	\N	\N	\N	\N	t	2026-03-06 20:24:47.245	2026-03-06 20:24:47.245
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, name, "passwordHash", role, "isActive", "lastLoginAt", "createdAt", "updatedAt") FROM stdin;
8fa3456d-4e1e-4f31-a54b-7286afccedfb	hector@hopecoffee.com	Hector	$2a$12$nov4Ri92doKhFTe8sLxbY.0m/G6tjLnHhPG58H1K9JmAj0sytnYRK	FIELD_OPERATOR	t	\N	2026-04-10 17:58:02.867	2026-04-10 17:58:02.867
cmmfcf92000003q4vl76vg9gy	octavio@hopecoffee.com	Administrador	$2a$12$vGS8SZUGGsi3kPWGvlZmXe8Vf09JtFnuUnt92clVVZ6WomN/x6RsC	FINANCIAL_OPERATOR	t	2026-04-16 17:04:07.616	2026-03-06 20:24:41.112	2026-04-16 17:04:07.617
\.


--
-- Data for Name: yield_adjustments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.yield_adjustments (id, "cuppingRecordId", "supplierAccountEntryId", "contractedYield", "actualYield", "toleranceApplied", "priceAdjustmentPerQQ", "totalAdjustment", status, "appliedAt", "appliedByUserId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: yield_tolerance_config; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.yield_tolerance_config (id, "toleranceValue", "updatedAt", "updatedByUserId") FROM stdin;
28f69c94-88a2-40b8-977a-33c1cab4d26e	0.010000	2026-04-10 18:21:44.9	\N
\.


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: container_lots container_lots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.container_lots
    ADD CONSTRAINT container_lots_pkey PRIMARY KEY (id);


--
-- Name: containers containers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.containers
    ADD CONSTRAINT containers_pkey PRIMARY KEY (id);


--
-- Name: contract_lot_allocations contract_lot_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_lot_allocations
    ADD CONSTRAINT contract_lot_allocations_pkey PRIMARY KEY (id);


--
-- Name: contract_price_snapshots contract_price_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_price_snapshots
    ADD CONSTRAINT contract_price_snapshots_pkey PRIMARY KEY (id);


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);


--
-- Name: cupping_records cupping_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cupping_records
    ADD CONSTRAINT cupping_records_pkey PRIMARY KEY (id);


--
-- Name: exchange_rates exchange_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_pkey PRIMARY KEY (id);


--
-- Name: export_cost_configs export_cost_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.export_cost_configs
    ADD CONSTRAINT export_cost_configs_pkey PRIMARY KEY (id);


--
-- Name: facilities facilities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facilities
    ADD CONSTRAINT facilities_pkey PRIMARY KEY (id);


--
-- Name: farms farms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farms
    ADD CONSTRAINT farms_pkey PRIMARY KEY (id);


--
-- Name: lots lots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lots
    ADD CONSTRAINT lots_pkey PRIMARY KEY (id);


--
-- Name: materia_prima_allocations materia_prima_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materia_prima_allocations
    ADD CONSTRAINT materia_prima_allocations_pkey PRIMARY KEY (id);


--
-- Name: materia_prima materia_prima_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materia_prima
    ADD CONSTRAINT materia_prima_pkey PRIMARY KEY (id);


--
-- Name: milling_inputs milling_inputs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.milling_inputs
    ADD CONSTRAINT milling_inputs_pkey PRIMARY KEY (id);


--
-- Name: milling_orders milling_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.milling_orders
    ADD CONSTRAINT milling_orders_pkey PRIMARY KEY (id);


--
-- Name: milling_outputs milling_outputs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.milling_outputs
    ADD CONSTRAINT milling_outputs_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: shipment_parties shipment_parties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_parties
    ADD CONSTRAINT shipment_parties_pkey PRIMARY KEY (id);


--
-- Name: shipments shipments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_pkey PRIMARY KEY (id);


--
-- Name: subproductos subproductos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subproductos
    ADD CONSTRAINT subproductos_pkey PRIMARY KEY (id);


--
-- Name: supplier_account_entries supplier_account_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_account_entries
    ADD CONSTRAINT supplier_account_entries_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: yield_adjustments yield_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.yield_adjustments
    ADD CONSTRAINT yield_adjustments_pkey PRIMARY KEY (id);


--
-- Name: yield_tolerance_config yield_tolerance_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.yield_tolerance_config
    ADD CONSTRAINT yield_tolerance_config_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_entity_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "audit_logs_entity_entityId_idx" ON public.audit_logs USING btree (entity, "entityId");


--
-- Name: audit_logs_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "audit_logs_userId_createdAt_idx" ON public.audit_logs USING btree ("userId", "createdAt");


--
-- Name: clients_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX clients_code_key ON public.clients USING btree (code);


--
-- Name: clients_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX clients_name_key ON public.clients USING btree (name);


--
-- Name: container_lots_containerId_lotId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "container_lots_containerId_lotId_key" ON public.container_lots USING btree ("containerId", "lotId");


--
-- Name: containers_shipmentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "containers_shipmentId_idx" ON public.containers USING btree ("shipmentId");


--
-- Name: contract_lot_allocations_contractId_lotId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "contract_lot_allocations_contractId_lotId_key" ON public.contract_lot_allocations USING btree ("contractId", "lotId");


--
-- Name: contract_price_snapshots_contractId_snapshotAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "contract_price_snapshots_contractId_snapshotAt_idx" ON public.contract_price_snapshots USING btree ("contractId", "snapshotAt");


--
-- Name: contracts_clientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "contracts_clientId_idx" ON public.contracts USING btree ("clientId");


--
-- Name: contracts_contractNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "contracts_contractNumber_key" ON public.contracts USING btree ("contractNumber");


--
-- Name: contracts_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "contracts_createdAt_idx" ON public.contracts USING btree ("createdAt");


--
-- Name: contracts_fechaEmbarque_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "contracts_fechaEmbarque_idx" ON public.contracts USING btree ("fechaEmbarque");


--
-- Name: contracts_officialCorrelative_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "contracts_officialCorrelative_key" ON public.contracts USING btree ("officialCorrelative");


--
-- Name: contracts_shipmentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "contracts_shipmentId_idx" ON public.contracts USING btree ("shipmentId");


--
-- Name: contracts_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "contracts_status_createdAt_idx" ON public.contracts USING btree (status, "createdAt");


--
-- Name: cupping_records_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cupping_records_date_idx ON public.cupping_records USING btree (date);


--
-- Name: cupping_records_lotId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "cupping_records_lotId_idx" ON public.cupping_records USING btree ("lotId");


--
-- Name: exchange_rates_validFrom_validTo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "exchange_rates_validFrom_validTo_idx" ON public.exchange_rates USING btree ("validFrom", "validTo");


--
-- Name: facilities_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX facilities_code_key ON public.facilities USING btree (code);


--
-- Name: facilities_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX facilities_name_key ON public.facilities USING btree (name);


--
-- Name: farms_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX farms_name_key ON public.farms USING btree (name);


--
-- Name: lots_facilityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "lots_facilityId_idx" ON public.lots USING btree ("facilityId");


--
-- Name: lots_lotNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "lots_lotNumber_key" ON public.lots USING btree ("lotNumber");


--
-- Name: lots_receptionDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "lots_receptionDate_idx" ON public.lots USING btree ("receptionDate");


--
-- Name: lots_stage_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lots_stage_idx ON public.lots USING btree (stage);


--
-- Name: lots_supplierId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "lots_supplierId_idx" ON public.lots USING btree ("supplierId");


--
-- Name: materia_prima_allocations_materiaPrimaId_contractId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "materia_prima_allocations_materiaPrimaId_contractId_key" ON public.materia_prima_allocations USING btree ("materiaPrimaId", "contractId");


--
-- Name: materia_prima_shipmentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "materia_prima_shipmentId_idx" ON public.materia_prima USING btree ("shipmentId");


--
-- Name: milling_inputs_millingOrderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "milling_inputs_millingOrderId_idx" ON public.milling_inputs USING btree ("millingOrderId");


--
-- Name: milling_orders_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX milling_orders_date_idx ON public.milling_orders USING btree (date);


--
-- Name: milling_orders_orderNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "milling_orders_orderNumber_key" ON public.milling_orders USING btree ("orderNumber");


--
-- Name: milling_orders_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX milling_orders_status_idx ON public.milling_orders USING btree (status);


--
-- Name: milling_outputs_millingOrderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "milling_outputs_millingOrderId_idx" ON public.milling_outputs USING btree ("millingOrderId");


--
-- Name: milling_outputs_outputType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "milling_outputs_outputType_idx" ON public.milling_outputs USING btree ("outputType");


--
-- Name: purchase_orders_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchase_orders_date_idx ON public.purchase_orders USING btree (date);


--
-- Name: purchase_orders_orderNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "purchase_orders_orderNumber_key" ON public.purchase_orders USING btree ("orderNumber");


--
-- Name: purchase_orders_supplierId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "purchase_orders_supplierId_idx" ON public.purchase_orders USING btree ("supplierId");


--
-- Name: shipment_parties_shipmentId_clientId_role_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "shipment_parties_shipmentId_clientId_role_key" ON public.shipment_parties USING btree ("shipmentId", "clientId", role);


--
-- Name: shipment_parties_shipmentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "shipment_parties_shipmentId_idx" ON public.shipment_parties USING btree ("shipmentId");


--
-- Name: shipments_month_year_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX shipments_month_year_name_key ON public.shipments USING btree (month, year, name);


--
-- Name: shipments_year_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shipments_year_month_idx ON public.shipments USING btree (year, month);


--
-- Name: subproductos_shipmentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "subproductos_shipmentId_idx" ON public.subproductos USING btree ("shipmentId");


--
-- Name: supplier_account_entries_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supplier_account_entries_date_idx ON public.supplier_account_entries USING btree (date);


--
-- Name: supplier_account_entries_supplierId_orderCode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "supplier_account_entries_supplierId_orderCode_idx" ON public.supplier_account_entries USING btree ("supplierId", "orderCode");


--
-- Name: suppliers_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX suppliers_code_key ON public.suppliers USING btree (code);


--
-- Name: suppliers_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX suppliers_name_key ON public.suppliers USING btree (name);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: yield_adjustments_cuppingRecordId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "yield_adjustments_cuppingRecordId_idx" ON public.yield_adjustments USING btree ("cuppingRecordId");


--
-- Name: yield_adjustments_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX yield_adjustments_status_idx ON public.yield_adjustments USING btree (status);


--
-- Name: audit_logs audit_logs_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: container_lots container_lots_containerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.container_lots
    ADD CONSTRAINT "container_lots_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES public.containers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: container_lots container_lots_lotId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.container_lots
    ADD CONSTRAINT "container_lots_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES public.lots(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: containers containers_shipmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.containers
    ADD CONSTRAINT "containers_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES public.shipments(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: contract_lot_allocations contract_lot_allocations_contractId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_lot_allocations
    ADD CONSTRAINT "contract_lot_allocations_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES public.contracts(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: contract_lot_allocations contract_lot_allocations_lotId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_lot_allocations
    ADD CONSTRAINT "contract_lot_allocations_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES public.lots(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: contract_price_snapshots contract_price_snapshots_contractId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_price_snapshots
    ADD CONSTRAINT "contract_price_snapshots_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES public.contracts(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: contracts contracts_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT "contracts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public.clients(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: contracts contracts_exportCostConfigId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT "contracts_exportCostConfigId_fkey" FOREIGN KEY ("exportCostConfigId") REFERENCES public.export_cost_configs(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: contracts contracts_shipmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT "contracts_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES public.shipments(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: cupping_records cupping_records_lotId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cupping_records
    ADD CONSTRAINT "cupping_records_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES public.lots(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: lots lots_facilityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lots
    ADD CONSTRAINT "lots_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES public.facilities(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: lots lots_parentLotId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lots
    ADD CONSTRAINT "lots_parentLotId_fkey" FOREIGN KEY ("parentLotId") REFERENCES public.lots(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: lots lots_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lots
    ADD CONSTRAINT "lots_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: materia_prima_allocations materia_prima_allocations_contractId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materia_prima_allocations
    ADD CONSTRAINT "materia_prima_allocations_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES public.contracts(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: materia_prima_allocations materia_prima_allocations_materiaPrimaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materia_prima_allocations
    ADD CONSTRAINT "materia_prima_allocations_materiaPrimaId_fkey" FOREIGN KEY ("materiaPrimaId") REFERENCES public.materia_prima(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: materia_prima materia_prima_shipmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materia_prima
    ADD CONSTRAINT "materia_prima_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES public.shipments(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: milling_inputs milling_inputs_lotId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.milling_inputs
    ADD CONSTRAINT "milling_inputs_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES public.lots(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: milling_inputs milling_inputs_millingOrderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.milling_inputs
    ADD CONSTRAINT "milling_inputs_millingOrderId_fkey" FOREIGN KEY ("millingOrderId") REFERENCES public.milling_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: milling_orders milling_orders_facilityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.milling_orders
    ADD CONSTRAINT "milling_orders_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES public.facilities(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: milling_outputs milling_outputs_lotId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.milling_outputs
    ADD CONSTRAINT "milling_outputs_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES public.lots(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: milling_outputs milling_outputs_millingOrderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.milling_outputs
    ADD CONSTRAINT "milling_outputs_millingOrderId_fkey" FOREIGN KEY ("millingOrderId") REFERENCES public.milling_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: shipment_parties shipment_parties_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_parties
    ADD CONSTRAINT "shipment_parties_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public.clients(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: shipment_parties shipment_parties_shipmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_parties
    ADD CONSTRAINT "shipment_parties_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES public.shipments(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: shipments shipments_exportCostConfigId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT "shipments_exportCostConfigId_fkey" FOREIGN KEY ("exportCostConfigId") REFERENCES public.export_cost_configs(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: subproductos subproductos_shipmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subproductos
    ADD CONSTRAINT "subproductos_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES public.shipments(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: supplier_account_entries supplier_account_entries_facilityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_account_entries
    ADD CONSTRAINT "supplier_account_entries_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES public.facilities(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: supplier_account_entries supplier_account_entries_lotId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_account_entries
    ADD CONSTRAINT "supplier_account_entries_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES public.lots(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: supplier_account_entries supplier_account_entries_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_account_entries
    ADD CONSTRAINT "supplier_account_entries_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: yield_adjustments yield_adjustments_cuppingRecordId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.yield_adjustments
    ADD CONSTRAINT "yield_adjustments_cuppingRecordId_fkey" FOREIGN KEY ("cuppingRecordId") REFERENCES public.cupping_records(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict K3oDpIwxnhpqeFdmVc5cuD4yflorPTzFDPDiNm6CPr800beZhX9hX3E3SLIxDsQ

