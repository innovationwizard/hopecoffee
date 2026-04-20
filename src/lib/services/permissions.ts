// ============================================================================
// HOPE COFFEE — Permission-Based Authorization
// ============================================================================
// Domain-aware permission system with multi-role support.
// Roles are peers, not ranked — permissions define access.
// Users hold multiple roles; effective permissions = union of all role grants.
//
// Reference: hopecoffee-rbac-proposal.md §3 (Permission Catalog)
// ============================================================================

import type { UserRole } from "@prisma/client";

// ── Permission Catalog ──────────────────────────────────────────────────────
// Organized by domain. Each permission maps to a specific server action guard.
// Permissions marked (★) are in active use by existing server actions.
// Permissions without ★ are defined for features shipping in future phases.

export type Permission =
  // ── Dashboard & Reports ───────────────────────────────────────────
  | "dashboard:read"
  | "report:create"
  | "report:read"

  // ── Sales Contracts ───────────────────────────────────────────────
  | "contract:create"             // ★
  | "contract:write"              // ★ (was contract:update)
  | "contract:update_financial"   // ★
  | "contract:change_status"      // ★
  | "contract:read"
  | "contract:lot_allocate"       // ★
  | "contract:delete"             // ★

  // ── Purchase Orders ───────────────────────────────────────────────
  | "purchase_order:create"
  | "purchase_order:write"        // ★
  | "purchase_order:close"
  | "purchase_order:read"
  | "purchase_order:delete"       // ★
  | "purchase_order:version_history"

  // ── Receipts (Recibos) ────────────────────────────────────────────
  | "receipt:create"
  | "receipt:read"
  | "receipt:assign_to_oc"
  | "receipt:split"
  | "receipt:reassign"

  // ── Quality & Lab ─────────────────────────────────────────────────
  | "cupping:create"
  | "cupping:write"               // ★
  | "cupping:read"
  | "sample:create"
  | "sample:write"
  | "sample:read"
  | "yield_adjustment:create"
  | "yield_adjustment:write"      // ★
  | "yield_adjustment:read"

  // ── Milling (Trías) ──────────────────────────────────────────────
  | "milling:create"
  | "milling:write"               // ★
  | "milling:read"
  | "milling:result_write"

  // ── Inventory ─────────────────────────────────────────────────────
  | "inventory:read"
  | "inventory:update_quality"

  // ── Lots & Containers ─────────────────────────────────────────────
  | "lot:create"
  | "lot:write"                   // ★
  | "lot:read"
  | "container:write"             // ★
  | "container:lot_assign"        // ★
  | "container:read"

  // ── Shipments & Logistics ─────────────────────────────────────────
  | "shipment:write"              // ★
  | "shipment:read"
  | "shipment:assign_contract"    // ★
  | "shipment:party_write"        // ★
  | "shipment:delete"             // ★
  | "booking:write"
  | "booking:read"
  | "sack_design:write"
  | "sack_design:approve"
  | "sack_design:read"

  // ── Financial & Cost ──────────────────────────────────────────────
  | "materia_prima:write"         // ★ Raw material cost entries on shipments
  | "subproducto:write"           // ★ By-product value entries
  | "cost:read"
  | "cost:write"
  | "cost:prorate"
  | "cost:exclude_oc"
  | "margin:read"
  | "margin:write"
  | "margin:configure"
  | "exchange_rate:write"         // ★
  | "export_cost:write"           // ★

  // ── Payments & Accounting ─────────────────────────────────────────
  | "payment:write"
  | "payment:read"
  | "payment:reconcile"
  | "accounting:write"
  | "accounting:read"
  | "export_document:write"
  | "export_document:read"

  // ── Entities ──────────────────────────────────────────────────────
  | "supplier:write"
  | "supplier:read"
  | "supplier_account:write"      // ★
  | "farm:write"                  // ★
  | "farm:read"
  | "fiscal_entity:write"
  | "fiscal_entity:read"
  | "crm:write"
  | "crm:read"

  // ── Market ────────────────────────────────────────────────────────
  | "market:write"
  | "market:read"

  // ── Delivery ──────────────────────────────────────────────────────
  | "delivery:write"
  | "delivery:read"

  // ── System Administration ─────────────────────────────────────────
  | "user:manage"                 // ★
  | "audit_log:view"              // ★
  | "import:execute"
  | "facility:manage"             // ★
  | "system:configure"
  ;

// ── Role → Permission Mappings ──────────────────────────────────────────────
// Source of truth: hopecoffee-rbac-proposal.md §2 (Role Definitions) & §4 (Matrix)

const GERENCIA_PERMISSIONS: Permission[] = [
  "dashboard:read",
  "report:read",
  "contract:read",
  "purchase_order:read",
  "receipt:read",
  "cupping:read",
  "inventory:read",
  "milling:read",
  "shipment:read",
  "lot:read",
  "container:read",
  "cost:read",
  "margin:read",
  "payment:read",
  "supplier:read",
  "farm:read",
  "market:read",
  "crm:read",
];

const FINANCIERO_PERMISSIONS: Permission[] = [
  "contract:update_financial",
  "exchange_rate:write",
  "export_cost:write",
  "cost:exclude_oc",
  "margin:configure",
];

// WARNING: José Herrera has NOT been interviewed. These permissions are inferred
// from Roberto's and Hector's descriptions. Must be validated after his interview.
const COMPRAS_PERMISSIONS: Permission[] = [
  "purchase_order:create",
  "purchase_order:write",
  "purchase_order:close",
  "purchase_order:read",
  "purchase_order:version_history",
  "receipt:assign_to_oc",
  "receipt:split",
  "receipt:reassign",
  "receipt:read",
  "supplier:write",
  "supplier:read",
  "supplier_account:write",
  "farm:write",
  "farm:read",
  "contract:read",
  "cupping:read",
  "inventory:read",
  "cost:read",
  "delivery:write",
];

const VENTAS_PERMISSIONS: Permission[] = [
  "contract:create",
  "contract:write",
  "contract:change_status",
  "contract:read",
  "contract:lot_allocate",
  "shipment:write",
  "shipment:read",
  "shipment:assign_contract",
  "shipment:party_write",
  "container:write",
  "container:lot_assign",
  "container:read",
  "inventory:read",
  "purchase_order:read",
  "receipt:read",
  "lot:create",
  "lot:write",
  "lot:read",
  "market:write",
  "market:read",
  "crm:write",
  "crm:read",
  "sack_design:approve",
  "report:read",
];

const LAB_PERMISSIONS: Permission[] = [
  "cupping:create",
  "cupping:write",
  "cupping:read",
  "sample:create",
  "sample:write",
  "sample:read",
  "yield_adjustment:create",
  "yield_adjustment:write",
  "yield_adjustment:read",
  "milling:create",
  "milling:write",
  "milling:read",
  "milling:result_write",
  "inventory:read",
  "inventory:update_quality",
  "receipt:read",
  "subproducto:write",
  "market:read",
];

const ANALISIS_PERMISSIONS: Permission[] = [
  "purchase_order:read",
  "purchase_order:version_history",
  "receipt:read",
  "contract:read",
  "cupping:read",
  "milling:read",
  "inventory:read",
  "shipment:read",
  "lot:read",
  "cost:read",
  "cost:write",
  "cost:prorate",
  "materia_prima:write",
  "margin:read",
  "margin:write",
  "payment:read",
  "supplier:read",
  "report:create",
  "report:read",
  "subproducto:write",
  "market:read",
  "yield_adjustment:read",
  "export_document:read",
  "audit_log:view",
];

const CONTABILIDAD_PERMISSIONS: Permission[] = [
  "payment:write",
  "payment:read",
  "payment:reconcile",
  "accounting:write",
  "accounting:read",
  "fiscal_entity:write",
  "fiscal_entity:read",
  "supplier:read",
  "purchase_order:read",
  "receipt:read",
  "export_document:write",
  "export_document:read",
  "cost:read",
  "subproducto:write",
  "audit_log:view",
];

const LOGISTICA_PERMISSIONS: Permission[] = [
  "shipment:write",
  "shipment:read",
  "container:write",
  "container:read",
  "sack_design:write",
  "sack_design:read",
  "contract:read",
  "lot:read",
  "booking:write",
  "booking:read",
  "inventory:read",
];

const LAB_ASISTENTE_PERMISSIONS: Permission[] = [
  "sample:create",
  "sample:write",
  "sample:read",
  "cupping:create",
  "cupping:write",
  "cupping:read",
  "receipt:read",
  "inventory:read",
  "milling:read",
];

// Build the complete set of all permissions for MASTER
const ALL_PERMISSIONS = new Set<Permission>();
[
  GERENCIA_PERMISSIONS, FINANCIERO_PERMISSIONS, COMPRAS_PERMISSIONS,
  VENTAS_PERMISSIONS, LAB_PERMISSIONS, ANALISIS_PERMISSIONS,
  CONTABILIDAD_PERMISSIONS, LOGISTICA_PERMISSIONS, LAB_ASISTENTE_PERMISSIONS,
].forEach(perms => perms.forEach(p => ALL_PERMISSIONS.add(p)));
// Add admin-only permissions
ALL_PERMISSIONS.add("user:manage");
ALL_PERMISSIONS.add("audit_log:view");
ALL_PERMISSIONS.add("import:execute");
ALL_PERMISSIONS.add("facility:manage");
ALL_PERMISSIONS.add("system:configure");
ALL_PERMISSIONS.add("contract:delete");
ALL_PERMISSIONS.add("purchase_order:delete");
ALL_PERMISSIONS.add("shipment:delete");
ALL_PERMISSIONS.add("receipt:create");
ALL_PERMISSIONS.add("dashboard:read");

const ROLE_PERMISSIONS: Record<UserRole, Set<Permission>> = {
  MASTER:        ALL_PERMISSIONS,
  GERENCIA:      new Set(GERENCIA_PERMISSIONS),
  FINANCIERO:    new Set(FINANCIERO_PERMISSIONS),
  COMPRAS:       new Set(COMPRAS_PERMISSIONS),
  VENTAS:        new Set(VENTAS_PERMISSIONS),
  LAB:           new Set(LAB_PERMISSIONS),
  ANALISIS:      new Set(ANALISIS_PERMISSIONS),
  CONTABILIDAD:  new Set(CONTABILIDAD_PERMISSIONS),
  LOGISTICA:     new Set(LOGISTICA_PERMISSIONS),
  LAB_ASISTENTE: new Set(LAB_ASISTENTE_PERMISSIONS),
};

/**
 * Check if any of the user's roles grants the given permission.
 * Effective permissions = union of all assigned roles.
 */
export function hasPermission(roles: UserRole[], permission: Permission): boolean {
  return roles.some(role => ROLE_PERMISSIONS[role]?.has(permission) ?? false);
}

/**
 * Single-role check — for internal use only (e.g., UI role-specific rendering).
 */
export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}
