import { Skeleton } from "@/components/ui/skeleton";

export default function OrderDetailLoading() {
  return (
    <div className="mx-auto max-w-xl space-y-4" aria-busy="true" data-testid="order-detail-loading">
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}
