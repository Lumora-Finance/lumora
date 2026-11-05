import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Each is shaped like what it stands in for, so nothing jumps when the real thing arrives. */

export function RowsSkeleton({ rows = 4, label = "Loading", className }: { rows?: number; label?: string; className?: string }) {
  return (
    <div role="status" aria-label={label} className={cn("divide-y divide-line", className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 py-3.5">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-4 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function CardsSkeleton({ cards = 3, label = "Loading", columns = false, className }: { cards?: number; label?: string; columns?: boolean; className?: string }) {
  return (
    <div role="status" aria-label={label} className={cn("grid gap-4", columns && "md:grid-cols-2 xl:grid-cols-3", className)}>
      {Array.from({ length: cards }, (_, index) => (
        <div key={index} className="rounded-[20px] border border-line bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="mt-4 h-12 w-full rounded-2xl" />
          <Skeleton className="mt-3 h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ label = "Loading the chart" }: { label?: string }) {
  const heights = [52, 66, 44, 74, 82, 100];
  return (
    <div role="status" aria-label={label}>
      <div className="flex h-52 items-end gap-1.5 sm:h-56 sm:gap-2.5">
        {heights.map((height, index) => (
          <Skeleton key={index} className="flex-1 rounded-t-xl rounded-b-sm" style={{ height: `${height}%` }} />
        ))}
      </div>
      <div className="mt-2 flex gap-1.5 sm:gap-2.5">
        {heights.map((_, index) => (
          <Skeleton key={index} className="h-4 flex-1" />
        ))}
      </div>
    </div>
  );
}

export function DetailSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="mx-auto w-full max-w-[720px] space-y-4 px-4 py-6 md:px-6">
      <div className="rounded-[20px] border border-line bg-white p-5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-3 h-6 w-2/3" />
        <Skeleton className="mt-2 h-4 w-1/2" />
        <div className="mt-5 grid grid-cols-5 gap-1">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-1.5" />
          ))}
        </div>
      </div>
      <div className="rounded-[20px] border border-line bg-white p-5">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="mt-2 h-3 w-3/4" />
        <Skeleton className="mt-4 h-12 w-40 rounded-2xl" />
      </div>
    </div>
  );
}

/** A whole dashboard page, while the route itself is on its way. */
export function PageSkeleton({ label = "Loading the page" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="mx-auto w-full max-w-[1120px] space-y-4 px-4 py-5 md:px-6 lg:px-8 lg:py-7">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <Skeleton className="h-40 w-full rounded-[20px]" />
      <CardsSkeleton cards={2} columns />
    </div>
  );
}
