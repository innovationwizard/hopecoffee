"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface SidebarLinkProps {
  href: string;
  label: string;
  icon?: LucideIcon;
  active?: boolean;
  onClick?: () => void;
}

export function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: SidebarLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        active
          ? "bg-orion-50 text-orion-700 dark:bg-orion-800/30 dark:text-orion-300"
          : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
      }`}
    >
      {Icon && <Icon className="w-5 h-5 shrink-0" />}
      <span>{label}</span>
    </Link>
  );
}
