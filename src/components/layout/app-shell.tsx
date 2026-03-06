"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Ship,
  Package,
  Users,
  TreePine,
  Settings,
  Upload,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import type { Session } from "@/lib/services/auth";
import { SidebarLink } from "./sidebar-link";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contracts", label: "Contratos", icon: FileText },
  { href: "/shipments", label: "Embarques", icon: Ship },
  { href: "/inventory", label: "Inventario", icon: Package },
  { href: "/suppliers", label: "Proveedores", icon: Users },
  { href: "/farms", label: "Fincas", icon: TreePine },
];

const SETTINGS_ITEMS = [
  { href: "/settings/export-costs", label: "Costos Exportación" },
  { href: "/settings/exchange-rates", label: "Tipo de Cambio" },
  { href: "/settings/audit-log", label: "Auditoría" },
  { href: "/settings/users", label: "Usuarios", adminOnly: true },
];

export function AppShell({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(
    pathname.startsWith("/settings")
  );

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const roleBadgeColor = {
    ADMIN: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    OPERATOR: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    VIEWER: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  };

  const sidebar = (
    <nav className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">
          CafeMargen
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
        {NAV_ITEMS.map((item) => (
          <SidebarLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={pathname.startsWith(item.href)}
            onClick={() => setMobileOpen(false)}
          />
        ))}

        <div>
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              pathname.startsWith("/settings")
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            }`}
          >
            <Settings className="w-5 h-5 shrink-0" />
            <span className="flex-1 text-left">Configuración</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${settingsOpen ? "rotate-180" : ""}`}
            />
          </button>
          {settingsOpen && (
            <div className="ml-8 mt-1 space-y-1">
              {SETTINGS_ITEMS.filter(
                (item) => !item.adminOnly || session.role === "ADMIN"
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

        {session.role === "ADMIN" && (
          <SidebarLink
            href="/import"
            label="Importar Excel"
            icon={Upload}
            active={pathname.startsWith("/import")}
            onClick={() => setMobileOpen(false)}
          />
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-medium">
            {session.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {session.name}
            </p>
            <span
              className={`inline-block text-xs px-1.5 py-0.5 rounded ${roleBadgeColor[session.role]}`}
            >
              {session.role}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
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
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 transform transition-transform md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 p-1 text-gray-400"
        >
          <X className="w-5 h-5" />
        </button>
        {sidebar}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center px-4 gap-4">
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-1.5 text-gray-500"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
