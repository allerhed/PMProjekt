interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded ${className}`}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <div className="animate-pulse space-y-4">
        <div className="bg-gray-200 rounded h-4 w-3/4" />
        <div className="bg-gray-200 rounded h-3 w-full" />
        <div className="bg-gray-200 rounded h-3 w-5/6" />
        <div className="flex gap-2 pt-2">
          <div className="bg-gray-200 rounded h-6 w-16" />
          <div className="bg-gray-200 rounded h-6 w-20" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
        <div className="animate-pulse flex gap-4">
          <div className="bg-gray-200 rounded h-3 w-24" />
          <div className="bg-gray-200 rounded h-3 w-32" />
          <div className="bg-gray-200 rounded h-3 w-20" />
          <div className="bg-gray-200 rounded h-3 w-16" />
        </div>
      </div>
      {/* Rows */}
      <div className="divide-y divide-gray-200">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-3">
            <div className="animate-pulse flex gap-4">
              <div className="bg-gray-200 rounded h-4 w-28" />
              <div className="bg-gray-200 rounded h-4 w-40" />
              <div className="bg-gray-200 rounded h-4 w-16" />
              <div className="bg-gray-200 rounded h-4 w-14" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
