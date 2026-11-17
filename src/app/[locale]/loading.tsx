import { Skeleton } from "@/components/ui/skeleton";

/**
 * Storefront fallback inside the shell (header/footer stay). Server component on purpose: reading
 * the locale with a client hook here would itself block the navigation.
 */
export default function LocaleLoading() {
  return (
    <div className="space-y-4" aria-busy="true" data-testid="storefront-loading">
      <Skeleton className="h-10 w-48" />
      <div className="flex gap-2" aria-hidden="true">
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
