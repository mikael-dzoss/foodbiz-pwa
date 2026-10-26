import { Skeleton } from "@/components/ui/skeleton";

export default function CustomerDetailLoading() {
  return (
    <div
      className="mx-auto max-w-xl space-y-4"
      aria-busy="true"
      data-testid="customer-detail-loading"
    >
      <Skeleton className="h-10 w-32" />
      <Skeleton className="h-36 w-full rounded-xl" />
      <div className="grid grid-cols-3 gap-2" aria-hidden="true">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-80 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
    </div>
  );
}
