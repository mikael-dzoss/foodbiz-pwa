import { Skeleton } from "@/components/ui/skeleton";

/** Shell-level fallback (also the dashboard's): the manager nav stays, only the page area pulses. */
export default function ManageLoading() {
  return (
    <div className="mx-auto max-w-xl space-y-4" aria-busy="true" data-testid="manage-loading">
      <Skeleton className="h-10 w-48" />
      <div className="grid grid-cols-2 gap-3" aria-hidden="true">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}
