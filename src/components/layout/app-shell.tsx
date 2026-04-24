"use client";

import { useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  FileText,
  Ship,
  Package,
  Users,
  TreePine,
  BarChart3,
  Settings,
  Upload,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Sun,
  Moon,
  ScrollText,
  ShoppingCart,
  FlaskConical,
  Factory,
} from "lucide-react";
import type { Session } from "@/lib/services/auth";
import type { UserRole } from "@prisma/client";
import { hasPermission } from "@/lib/services/permissions";
import { SidebarLink } from "./sidebar-link";

const ROLE_LABELS: Record<UserRole, string> = {
  MASTER: "Master",
  GERENCIA: "Gerencia",
  FINANCIERO: "Finanzas",
  COMPRAS: "Compras",
  VENTAS: "Ventas",
  LAB: "Laboratorio",
  ANALISIS: "Analisis",
  CONTABILIDAD: "Contabilidad",
  LOGISTICA: "Logistica",
  LAB_ASISTENTE: "Lab Asistente",
};

const ALL_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contracts", label: "Contratos", icon: FileText },
  { href: "/inventory", label: "Inventario", icon: Package },
  { href: "/purchase-orders", label: "Ordenes de Compra", icon: ShoppingCart },
  { href: "/suppliers", label: "Proveedores", icon: Users },
  { href: "/quality-lab", label: "Laboratorio", icon: FlaskConical },
  { href: "/milling", label: "Trilla", icon: Factory },
  { href: "/shipments", label: "Embarques", icon: Ship },
  { href: "/farms", label: "Fincas", icon: TreePine },
  { href: "/reports", label: "Reportes", icon: BarChart3 },
];

const SETTINGS_ITEMS = [
  { href: "/settings/facilities", label: "Instalaciones" },
  { href: "/settings/export-costs", label: "Costos Exportacion" },
  { href: "/settings/exchange-rates", label: "Tipo de Cambio" },
  { href: "/settings/users", label: "Usuarios", masterOnly: true },
  { href: "/settings/password", label: "Cambiar Contraseña" },
];

/** Build a display label from all assigned roles */
function formatRoleBadge(roles: UserRole[]): string {
  if (roles.length === 0) return "Sin rol";
  return roles.map((r) => ROLE_LABELS[r] ?? r).join(" / ");
}

/** Pick badge color based on highest-priority role */
function getRoleBadgeColor(roles: UserRole[]): string {
  if (roles.includes("MASTER"))
    return "bg-orion-100 text-orion-700 dark:bg-orion-800/50 dark:text-orion-300";
  if (roles.includes("GERENCIA") || roles.includes("FINANCIERO"))
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
  if (roles.includes("VENTAS") || roles.includes("LAB"))
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (roles.includes("COMPRAS"))
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  if (roles.includes("ANALISIS") || roles.includes("CONTABILIDAD"))
    return "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
}

export function AppShell({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(
    pathname.startsWith("/settings")
  );

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const canViewAuditLog = hasPermission(session.roles, "audit_log:view");
  const canManageUsers = hasPermission(session.roles, "user:manage");
  const canImport = hasPermission(session.roles, "import:execute");

  const sidebar = (
    <nav className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-slate-200 dark:border-orion-800">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="HOPE COFFEE" width={32} height={32} className="rounded-md" />
          <div>
            <h1 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight leading-none">
              HOPE COFFEE
            </h1>
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 tracking-wider uppercase">
              Grupo Orion
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {ALL_NAV_ITEMS.map((item) => (
          <SidebarLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={pathname.startsWith(item.href)}
            onClick={() => setMobileOpen(false)}
          />
        ))}

        {/* Audit log — permission-gated */}
        {canViewAuditLog && (
          <SidebarLink
            href="/audit-log"
            label="Auditoria"
            icon={ScrollText}
            active={pathname.startsWith("/audit-log")}
            onClick={() => setMobileOpen(false)}
          />
        )}

        <div>
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              pathname.startsWith("/settings")
                ? "bg-orion-50 text-orion-700 dark:bg-orion-800/30 dark:text-orion-300"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
            }`}
          >
            <Settings className="w-5 h-5 shrink-0" />
            <span className="flex-1 text-left">Configuracion</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${settingsOpen ? "rotate-180" : ""}`}
            />
          </button>
          {settingsOpen && (
            <div className="ml-8 mt-1 space-y-0.5">
              {SETTINGS_ITEMS.filter(
                (item) => !item.masterOnly || canManageUsers
              ).map((item) => (
                <SidebarLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  active={pathname === item.href}
                  onClick={() => setMobileOpen(false)}
                />
              ))}
            </div>
          )}
        </div>

        {canImport && (
          <SidebarLink
            href="/import"
            label="Importar Excel"
            icon={Upload}
            active={pathname.startsWith("/import")}
            onClick={() => setMobileOpen(false)}
          />
        )}
      </div>

      <div className="border-t border-slate-200 dark:border-orion-800 p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-orion-600 text-white flex items-center justify-center text-sm font-bold">
            {session.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
              {session.name}
            </p>
            <span
              className={`inline-block text-[10px] font-mono px-1.5 py-0.5 rounded ${getRoleBadgeColor(session.roles)}`}
            >
              {formatRoleBadge(session.roles)}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            title="Cerrar sesion"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-orion-950">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col bg-white dark:bg-orion-900 border-r border-slate-200 dark:border-orion-800">
        {sidebar}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 bg-white dark:bg-orion-900 transform transition-transform md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 p-1 text-slate-400"
        >
          <X className="w-5 h-5" />
        </button>
        {sidebar}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-12 border-b border-slate-200 dark:border-orion-800 bg-white dark:bg-orion-900 flex items-center px-4 gap-4">
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-1.5 text-slate-500"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            title="Cambiar tema"
          >
            <Sun className="w-4 h-4 hidden dark:block" />
            <Moon className="w-4 h-4 block dark:hidden" />
          </button>
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
