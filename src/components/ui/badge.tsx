import { cva, type VariantProps } from "class-variance-authority";
import { twMerge } from "tailwind-merge";

const badgeVariants = cva(
  "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
  {
    variants: {
      variant: {
        amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
        blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
        emerald: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50",
        orange: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
        purple: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800",
        gray: "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700/50",
        red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
      },
    },
    defaultVariants: {
      variant: "gray",
    },
  }
);

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span className={twMerge(badgeVariants({ variant }), className)}>
      {children}
    </span>
  );
}
