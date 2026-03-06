export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 mb-3">
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className="h-6 bg-gray-100 dark:bg-gray-800 rounded flex-1"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="animate-pulse bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-3" />
      <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded w-1/2 mb-2" />
      <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/3" />
    </div>
  );
}
