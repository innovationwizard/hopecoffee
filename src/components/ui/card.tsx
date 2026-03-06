import { twMerge } from "tailwind-merge";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={twMerge(
        "bg-white dark:bg-orion-900 border border-slate-200 dark:border-orion-800 rounded-lg shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: CardProps) {
  return (
    <div
      className={twMerge(
        "px-4 py-3 border-b border-slate-200 dark:border-orion-800",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardContent({ children, className }: CardProps) {
  return <div className={twMerge("p-4", className)}>{children}</div>;
}
