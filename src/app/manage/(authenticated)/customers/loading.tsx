import { Skeleton } from "@/components/ui/skeleton";

export default function CustomersLoading() {
  return (
    <div className="mx-auto max-w-xl space-y-4" aria-busy="true" data-testid="customers-loading">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
