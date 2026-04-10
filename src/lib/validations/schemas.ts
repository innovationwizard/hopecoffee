// ============================================================================
// HOPE COFFEE — Validation Schemas
// ============================================================================
// Zod schemas used at every data entry point: API routes, server actions,
// form validation, and Excel import. Single source of truth for constraints.
// ============================================================================

import { z } from "zod";

// ---------------------------------------------------------------------------
// ENUMS (mirror Prisma enums for client-side use)
// ---------------------------------------------------------------------------

export const ContractStatusEnum = z.enum([
  "NEGOCIACION",
  "CONFIRMADO",
  "FIJADO",
  "NO_FIJADO",
  "EMBARCADO",
  "LIQUIDADO",
  "CANCELADO",
]);

export const CoffeeRegionEnum = z.enum([
  "SANTA_ROSA",
  "HUEHUETENANGO",
  "ORGANICO",
  "DANILANDIA",
  "SANTA_ISABEL",
  "OTHER",
]);

export const UserRoleEnum = z.enum(["ADMIN", "FIELD_OPERATOR", "FINANCIAL_OPERATOR", "VIEWER"]);

export const TipoFacturacionEnum = z.enum([
  "LIBRAS_GUATEMALTECAS",
  "LIBRAS_ESPANOLAS",
]);

export const PosicionBolsaEnum = z.enum(["MAR", "MAY", "JUL", "SEP", "DEC"]);

export const POStatusEnum = z.enum(["PENDIENTE", "RECIBIDO", "LIQUIDADO"]);

export const ShipmentStatusEnum = z.enum(["PREPARACION", "EMBARCADO", "LIQUIDADO"]);

// ---------------------------------------------------------------------------
// CONTRACT
// ---------------------------------------------------------------------------

export const ContractCreateSchema = z.object({
  contractNumber: z
    .string()
    .min(1, "Contract number is required")
    .max(20, "Contract number too long"),
  cooContractName: z.string().max(100).optional().nullable(),
  clientId: z.string().cuid("Invalid client ID"),
  shipmentId: z.string().cuid().optional().nullable(),
  status: ContractStatusEnum.default("NEGOCIACION"),
  regions: z.array(CoffeeRegionEnum).min(1, "At least one region required"),
  puntaje: z
    .number()
    .int("Puntaje must be an integer")
    .min(60, "Puntaje minimum is 60")
    .max(100, "Puntaje maximum is 100"),
  sacos69kg: z
    .number()
    .positive("Sacos must be positive")
    .max(10000, "Exceeds maximum saco count"),
  rendimiento: z
    .number()
    .positive()
    .min(1.0)
    .max(2.0)
    .default(1.32),
  precioBolsa: z
    .number()
    .min(0, "Price cannot be negative")
    .max(10000)
    .optional()
    .nullable(),
  diferencial: z
    .number()
    .min(-500)
    .max(500)
    .optional()
    .nullable(),
  tipoFacturacion: TipoFacturacionEnum.default("LIBRAS_GUATEMALTECAS"),
  posicionBolsa: PosicionBolsaEnum.optional().nullable(),
  montoCredito: z.number().min(0).optional().nullable(),
  cfTasaAnual: z.number().min(0).max(1).optional().nullable(),
  cfMeses: z.number().int().min(0).max(60).optional().nullable(),
  // ISR — percentage (decimal, e.g. 0.06) or fixed QTZ amount
  isrRate: z.number().min(0).max(1).optional().nullable(),
  isrAmount: z.number().min(0).optional().nullable(),
  cosecha: z.string().regex(/^\d{2}\/\d{2}$/, "Formato: YY/YY").optional().nullable(),
  posicionNY: z.coerce.date().optional().nullable(),
  fechaEmbarque: z.coerce.date().optional().nullable(),
  lote: z.string().max(100).optional().nullable(),
  tipoCambio: z
    .number()
    .positive()
    .max(50)
    .optional(),
  notes: z.string().max(1000).optional().nullable(),
  // Inventory & subproducto
  precioPromedioInv: z.number().min(0).optional().nullable(),
  subproductosQty: z.number().min(0).optional().nullable(),
  precioSubproducto: z.number().min(0).optional().nullable(),
  // Export cost breakdown (per-saco components)
  gastosPerSaco: z.number().min(0).optional().nullable(),
  exportTrillaPerQQ: z.number().min(0).optional().nullable(),
  exportSacoYute: z.number().min(0).optional().nullable(),
  exportEstampado: z.number().min(0).optional().nullable(),
  exportBolsaGrainPro: z.number().min(0).optional().nullable(),
  exportFitoSanitario: z.number().min(0).optional().nullable(),
  exportImpuestoAnacafe1: z.number().min(0).optional().nullable(),
  exportImpuestoAnacafe2: z.number().min(0).optional().nullable(),
  exportInspeccionOirsa: z.number().min(0).optional().nullable(),
  exportFumigacion: z.number().min(0).optional().nullable(),
  exportEmisionDocumento: z.number().min(0).optional().nullable(),
  exportFletePuerto: z.number().min(0).optional().nullable(),
  exportSeguro: z.number().min(0).optional().nullable(),
  exportCustodio: z.number().min(0).optional().nullable(),
  exportAgenteAduanal: z.number().min(0).optional().nullable(),
  exportComisionOrganico: z.number().min(0).optional().nullable(),
});

export const ContractUpdateSchema = ContractCreateSchema.partial().extend({
  id: z.string().cuid(),
});

export const ContractFilterSchema = z.object({
  clientId: z.string().cuid().optional(),
  status: ContractStatusEnum.optional(),
  regions: z.array(CoffeeRegionEnum).optional(),
  puntajeMin: z.number().int().min(60).optional(),
  puntajeMax: z.number().int().max(100).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  cosecha: z.string().regex(/^\d{2}\/\d{2}$/).optional(),
  search: z.string().max(100).optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(10).max(100).default(50),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ---------------------------------------------------------------------------
// SHIPMENT
// ---------------------------------------------------------------------------

export const ShipmentCreateSchema = z.object({
  name: z.string().min(1).max(100),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  status: ShipmentStatusEnum.default("PREPARACION"),
  numContainers: z.number().int().min(0).max(100),
  regions: z.string().max(200).optional().nullable(),
  posicionDate: z.coerce.date().optional().nullable(),
  embarqueDate: z.coerce.date().optional().nullable(),
  exportCostConfigId: z.string().cuid().optional().nullable(),
  gastosPerSaco: z.number().min(0).max(1000).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

// ---------------------------------------------------------------------------
// MATERIA PRIMA
// ---------------------------------------------------------------------------

export const MateriaPrimaCreateSchema = z.object({
  shipmentId: z.string().cuid(),
  supplierId: z.string().cuid().optional().nullable(),
  supplierNote: z.string().max(200).optional(),
  isPurchased: z.boolean().default(false),
  punteo: z.number().int().min(60).max(100),
  oro: z.number().positive().max(10000),
  rendimiento: z.number().positive().min(1.0).max(2.0).default(1.32),
  precioPromQ: z.number().positive().max(100000),
});

// ---------------------------------------------------------------------------
// SUBPRODUCTO
// ---------------------------------------------------------------------------

export const SubproductoCreateSchema = z.object({
  shipmentId: z.string().cuid(),
  contenedores: z.number().min(0).max(100),
  oroPerCont: z.number().positive().default(25),
  precioSinIVA: z.number().positive().default(2000),
});

// ---------------------------------------------------------------------------
// PURCHASE ORDER
// ---------------------------------------------------------------------------

export const PurchaseOrderCreateSchema = z.object({
  orderNumber: z.string().min(1).max(20),
  supplierId: z.string().cuid(),
  date: z.coerce.date(),
  status: POStatusEnum.default("PENDIENTE"),
  cosecha: z.string().regex(/^\d{2}\/\d{2}$/, "Formato: YY/YY").optional().nullable(),
  quintalesPerg: z.number().positive().max(100000),
  precioPerg: z.number().positive().max(100000),
  fletePorQQ: z.number().min(0).max(1000),
  seguridad: z.number().min(0).max(100000),
  seguro: z.number().min(0).max(100000),
  cadena: z.number().min(0).default(0),
  cargas: z.number().min(0).default(0),
  descargas: z.number().min(0).default(0),
  notes: z.string().max(1000).optional().nullable(),
});

export const PurchaseOrderUpdateSchema = PurchaseOrderCreateSchema.partial().extend({
  id: z.string().cuid(),
});

// ---------------------------------------------------------------------------
// SUPPLIER ACCOUNT
// ---------------------------------------------------------------------------

export const SupplierAccountEntrySchema = z.object({
  supplierId: z.string().cuid(),
  orderCode: z.string().min(1).max(10),
  ingresoNum: z.number().int().positive(),
  date: z.coerce.date(),
  pergamino: z.number().positive(),
  precio: z.number().positive(),
});

// ---------------------------------------------------------------------------
// FARM
// ---------------------------------------------------------------------------

export const FarmCreateSchema = z.object({
  name: z.string().min(1).max(100),
  totalQuetzales: z.number().positive(),
  tipoCambio: z.number().positive(),
  aumentoPorcentaje: z.number().min(0).max(1),
  porcentajePrest: z.number().min(0).max(1),
});

// ---------------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------------

export const LoginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const UserCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(100),
  role: UserRoleEnum.default("VIEWER"),
});

// ---------------------------------------------------------------------------
// SETTINGS
// ---------------------------------------------------------------------------

export const ExchangeRateSchema = z.object({
  rate: z.number().positive().max(50),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const ExportCostConfigSchema = z.object({
  name: z.string().min(1).max(100),
  gastosPerSaco: z.number().min(0),
  trillaPerQQ: z.number().min(0),
  sacoYute: z.number().min(0),
  estampado: z.number().min(0),
  bolsaGrainPro: z.number().min(0),
  fitoSanitario: z.number().min(0),
  impuestoAnacafe1: z.number().min(0),
  impuestoAnacafe2: z.number().min(0),
  inspeccionOirsa: z.number().min(0),
  fumigacion: z.number().min(0),
  emisionDocumento: z.number().min(0),
  fletePuerto: z.number().min(0),
  seguro: z.number().min(0),
  custodio: z.number().min(0),
  agenteAduanal: z.number().min(0),
  comisionExportadorOrganico: z.number().min(0).default(0),
  isDefault: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// CONTAINER
// ---------------------------------------------------------------------------

export const ContainerCreateSchema = z.object({
  shipmentId: z.string().cuid(),
  containerNum: z.string().max(20).optional().nullable(),
  blNumber: z.string().max(50).optional().nullable(),
  sealNumber: z.string().max(50).optional().nullable(),
  weightKg: z.number().min(0).optional().nullable(),
  vessel: z.string().max(100).optional().nullable(),
  port: z.string().max(100).optional().nullable(),
  eta: z.coerce.date().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

// ---------------------------------------------------------------------------
// FACILITY
// ---------------------------------------------------------------------------

export const FacilityTypeEnum = z.enum(["BENEFICIO", "BODEGA", "PATIO"]);

export const FacilityCreateSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(10),
  type: FacilityTypeEnum,
  capacity: z.number().min(0).optional().nullable(),
  isActive: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// LOT
// ---------------------------------------------------------------------------

export const LotStageEnum = z.enum([
  "PERGAMINO_BODEGA",
  "EN_PROCESO",
  "ORO_EXPORTABLE",
  "EXPORTADO",
  "SUBPRODUCTO",
]);

export const LotCreateSchema = z.object({
  supplierId: z.string().cuid().optional().nullable(),
  facilityId: z.string().cuid().optional().nullable(),
  purchaseOrderId: z.string().cuid().optional().nullable(),
  stage: LotStageEnum.default("PERGAMINO_BODEGA"),
  quantityQQ: z.number().positive().max(100000),
  qualityGrade: z.string().max(50).optional().nullable(),
  receptionDate: z.coerce.date().optional().nullable(),
  sourceAccountEntryId: z.string().cuid().optional().nullable(),
  contractedYield: z.number().positive().min(1.0).max(2.0).optional().nullable(),
  costPerQQ: z.number().min(0).optional().nullable(),
});

// ---------------------------------------------------------------------------
// CUPPING RECORD (SCA 10-attribute protocol)
// ---------------------------------------------------------------------------

const scaScore = z.number().min(6).max(10);

export const CuppingRecordCreateSchema = z.object({
  lotId: z.string().cuid(),
  catadorUserId: z.string().cuid().optional().nullable(),
  date: z.coerce.date(),
  fragrance: scaScore,
  flavor: scaScore,
  aftertaste: scaScore,
  acidity: scaScore,
  body: scaScore,
  balance: scaScore,
  uniformity: scaScore,
  cleanCup: scaScore,
  sweetness: scaScore,
  overall: scaScore,
  moisturePercent: z.number().min(0).max(100).optional().nullable(),
  defectCount: z.number().int().min(0).optional().nullable(),
  screenSize: z.string().max(20).optional().nullable(),
  waterActivity: z.number().min(0).max(1).optional().nullable(),
  yieldMeasured: z.number().positive().min(1.0).max(2.0).optional().nullable(),
  purchaseOrderId: z.string().cuid().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

// ---------------------------------------------------------------------------
// MILLING ORDER
// ---------------------------------------------------------------------------

export const MillingOrderStatusEnum = z.enum(["PENDIENTE", "EN_PROCESO", "COMPLETADO"]);
export const MillingOutputTypeEnum = z.enum(["ORO_EXPORTABLE", "SEGUNDA", "CASCARILLA", "MERMA"]);

export const MillingOrderCreateSchema = z.object({
  facilityId: z.string().cuid().optional().nullable(),
  date: z.coerce.date(),
  operatorUserId: z.string().cuid().optional().nullable(),
  status: MillingOrderStatusEnum.default("PENDIENTE"),
  notes: z.string().max(1000).optional().nullable(),
});

export const MillingInputSchema = z.object({
  lotId: z.string().cuid(),
  quantityQQ: z.number().positive().max(100000),
});

export const MillingOutputSchema = z.object({
  lotId: z.string().cuid().optional().nullable(),
  quantityQQ: z.number().positive().max(100000),
  outputType: MillingOutputTypeEnum,
  qualityGrade: z.string().max(50).optional().nullable(),
  costPerQQ: z.number().min(0).optional().nullable(),
});

// ---------------------------------------------------------------------------
// SHIPMENT PARTY
// ---------------------------------------------------------------------------

export const ShipmentPartyRoleEnum = z.enum(["BROKER", "IMPORTER", "BUYER"]);

export const ShipmentPartyCreateSchema = z.object({
  shipmentId: z.string().cuid(),
  clientId: z.string().cuid(),
  role: ShipmentPartyRoleEnum,
  notes: z.string().max(500).optional().nullable(),
});

// ---------------------------------------------------------------------------
// CONTRACT LOT ALLOCATION
// ---------------------------------------------------------------------------

export const ContractLotAllocationSchema = z.object({
  contractId: z.string().cuid(),
  lotId: z.string().cuid(),
  quantityQQ: z.number().positive().max(100000),
});

// ---------------------------------------------------------------------------
// CONTAINER LOT
// ---------------------------------------------------------------------------

export const ContainerLotSchema = z.object({
  containerId: z.string().cuid(),
  lotId: z.string().cuid(),
  quantityQQ: z.number().positive().max(100000),
});

// ---------------------------------------------------------------------------
// YIELD ADJUSTMENT
// ---------------------------------------------------------------------------

export const YieldAdjustmentStatusEnum = z.enum(["PENDIENTE", "APLICADO", "RECHAZADO"]);

// ---------------------------------------------------------------------------
// TYPE EXPORTS (inferred from schemas)
// ---------------------------------------------------------------------------

export type ContractCreateInput = z.infer<typeof ContractCreateSchema>;
export type ContractUpdateInput = z.infer<typeof ContractUpdateSchema>;
export type ContractFilter = z.infer<typeof ContractFilterSchema>;
export type ShipmentCreateInput = z.infer<typeof ShipmentCreateSchema>;
export type MateriaPrimaCreateInput = z.infer<typeof MateriaPrimaCreateSchema>;
export type SubproductoCreateInput = z.infer<typeof SubproductoCreateSchema>;
export type PurchaseOrderCreateInput = z.infer<typeof PurchaseOrderCreateSchema>;
export type PurchaseOrderUpdateInput = z.infer<typeof PurchaseOrderUpdateSchema>;
export type FarmCreateInput = z.infer<typeof FarmCreateSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type UserCreateInput = z.infer<typeof UserCreateSchema>;
export type ExchangeRateInput = z.infer<typeof ExchangeRateSchema>;
export type ExportCostConfigInput = z.infer<typeof ExportCostConfigSchema>;
export type ContainerCreateInput = z.infer<typeof ContainerCreateSchema>;
export type FacilityCreateInput = z.infer<typeof FacilityCreateSchema>;
export type LotCreateInput = z.infer<typeof LotCreateSchema>;
export type CuppingRecordCreateInput = z.infer<typeof CuppingRecordCreateSchema>;
export type MillingOrderCreateInput = z.infer<typeof MillingOrderCreateSchema>;
export type MillingInputInput = z.infer<typeof MillingInputSchema>;
export type MillingOutputInput = z.infer<typeof MillingOutputSchema>;
export type ShipmentPartyCreateInput = z.infer<typeof ShipmentPartyCreateSchema>;
export type ContractLotAllocationInput = z.infer<typeof ContractLotAllocationSchema>;
export type ContainerLotInput = z.infer<typeof ContainerLotSchema>;
