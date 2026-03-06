import { forwardRef, type InputHTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={twMerge(
            "w-full px-3 py-2 text-sm border rounded-md bg-white dark:bg-orion-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-orion-400 focus:border-orion-400 outline-none transition-colors",
            error
              ? "border-red-500 focus:ring-red-500"
              : "border-slate-300 dark:border-orion-700",
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
