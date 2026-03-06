"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function CollapsibleSection({
  title,
  defaultOpen = true,
  badge,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  badge?: string | number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-slate-200 dark:border-orion-800 rounded-lg">
      <button
        type="button"
        className="flex items-center justify-between w-full px-4 py-3 text-left"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            {title}
          </span>
          {badge !== undefined && (
            <span className="px-2 py-0.5 text-xs font-mono rounded-full bg-slate-100 dark:bg-orion-800 text-slate-600 dark:text-slate-400">
              {badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-slate-200 dark:border-orion-800 pt-3">
          {children}
        </div>
      )}
    </div>
  );
}
