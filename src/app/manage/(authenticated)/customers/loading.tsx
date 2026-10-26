import { Skeleton } from "@/components/ui/skeleton";

export default function CustomersLoading() {
  return (
    <div className="mx-auto max-w-xl space-y-4" aria-busy="true" data-testid="customers-loading">
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-4 w-48" />
      <div className="border-border bg-card divide-border divide-y overflow-hidden rounded-xl border">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="flex items-center justify-between gap-4 p-3.5"
            aria-hidden="true"
          >
            <div className="space-y-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-44" />
            </div>
            <Skeleton className="h-5 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}
