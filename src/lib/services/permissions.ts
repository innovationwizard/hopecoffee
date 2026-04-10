// ============================================================================
// HOPE COFFEE — Permission-Based Authorization
// ============================================================================
// Replaces the linear ROLE_HIERARCHY with a domain-aware permission system.
// Two operator roles are peers, not ranked — permissions define access.
// ============================================================================

import type { UserRole } from "@prisma/client";

export type Permission =
  // ── Field Domain (FIELD_OPERATOR primary) ──────────────────────
  | "contract:create"
  | "materia_prima:write"
  | "subproducto:write"
  | "container:write"
  | "purchase_order:write"
  | "supplier_account:write"
  | "farm:write"
  | "lot:write"
  | "cupping:write"
  | "milling:write"
  | "yield_adjustment:write"

  // ── Financial Domain (FINANCIAL_OPERATOR primary) ──────────────
  | "contract:update_financial"
  | "exchange_rate:write"
  | "export_cost:write"

  // ── Shared Domain (both operators) ─────────────────────────────
  | "contract:update"
  | "contract:change_status"
  | "contract:delete"
  | "shipment:write"
  | "shipment:delete"
  | "shipment:assign_contract"
  | "shipment:party_write"
  | "purchase_order:delete"
  | "contract:lot_allocate"
  | "container:lot_assign"

  // ── Admin Domain ───────────────────────────────────────────────
  | "user:manage"
  | "audit_log:view"
  | "import:execute"
  | "facility:manage"
  ;

const ALL_PERMISSIONS: Permission[] = [
  "contract:create",
  "materia_prima:write",
  "subproducto:write",
  "container:write",
  "purchase_order:write",
  "supplier_account:write",
  "farm:write",
  "lot:write",
  "cupping:write",
  "milling:write",
  "yield_adjustment:write",
  "contract:update_financial",
  "exchange_rate:write",
  "export_cost:write",
  "contract:update",
  "contract:change_status",
  "contract:delete",
  "shipment:write",
  "shipment:delete",
  "shipment:assign_contract",
  "shipment:party_write",
  "purchase_order:delete",
  "contract:lot_allocate",
  "container:lot_assign",
  "user:manage",
  "audit_log:view",
  "import:execute",
  "facility:manage",
];

const ROLE_PERMISSIONS: Record<UserRole, Set<Permission>> = {
  ADMIN: new Set(ALL_PERMISSIONS),

  FIELD_OPERATOR: new Set<Permission>([
    // Field domain — full write
    "contract:create",
    "materia_prima:write",
    "subproducto:write",
    "container:write",
    "purchase_order:write",
    "supplier_account:write",
    "farm:write",
    "lot:write",
    "cupping:write",
    "milling:write",
    "yield_adjustment:write",
    // Shared domain
    "contract:update",
    "contract:change_status",
    "shipment:write",
    "shipment:assign_contract",
    "shipment:party_write",
    "contract:lot_allocate",
    "container:lot_assign",
    // Visibility
    "audit_log:view",
  ]),

  FINANCIAL_OPERATOR: new Set<Permission>([
    // Financial domain — full write
    "contract:update_financial",
    "exchange_rate:write",
    "export_cost:write",
    // Shared domain
    "contract:update",
    "contract:change_status",
    "shipment:write",
    "shipment:assign_contract",
    "shipment:party_write",
    // Visibility
    "audit_log:view",
  ]),

  VIEWER: new Set<Permission>([
    // Read-only — no write permissions
  ]),
};

/**
 * Pure, synchronous permission check. Safe for both server and client contexts.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}
