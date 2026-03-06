import Link from "next/link";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  breadcrumbs?: Breadcrumb[];
  action?: React.ReactNode;
}

export function PageHeader({ title, breadcrumbs, action }: PageHeaderProps) {
  return (
    <div className="mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="text-sm text-slate-500 dark:text-slate-500 mb-2 font-mono">
          {breadcrumbs.map((crumb, i) => (
            <span key={i}>
              {i > 0 && <span className="mx-1.5 text-slate-300 dark:text-slate-600">/</span>}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="hover:text-orion-600 dark:hover:text-orion-400 transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-slate-900 dark:text-white">
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
          {title}
        </h1>
        {action}
      </div>
    </div>
  );
}
