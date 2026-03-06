import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { twMerge } from "tailwind-merge";

const buttonVariants = cva(
  "inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "bg-orion-600 text-white hover:bg-orion-700 focus:ring-orion-400 dark:bg-orion-500 dark:hover:bg-orion-600",
        secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200 focus:ring-slate-400 dark:bg-orion-800 dark:text-slate-100 dark:hover:bg-orion-700",
        outline: "border border-slate-300 text-slate-700 hover:bg-slate-50 focus:ring-slate-400 dark:border-orion-700 dark:text-slate-300 dark:hover:bg-white/5",
        ghost: "text-slate-600 hover:bg-slate-100 focus:ring-slate-400 dark:text-slate-400 dark:hover:bg-white/5",
        danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
      },
      size: {
        sm: "text-xs px-2.5 py-1.5 gap-1.5",
        md: "text-sm px-3 py-2 gap-2",
        lg: "text-base px-4 py-2.5 gap-2",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={twMerge(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
