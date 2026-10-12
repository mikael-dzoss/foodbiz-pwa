import { requireManagerSession } from "@/lib/auth";

export const instant = false;

export default async function ManageDashboardPage() {
  await requireManagerSession();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      <p className="text-muted-foreground">Today at a glance.</p>
    </div>
  );
}
