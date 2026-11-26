import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireManagerSession } from "@/lib/auth";
import { getDictionary } from "@/domain/i18n";
import { PickupLocationHoursSettings } from "@/features/settings/components/pickup-location-hours-settings";
import { getPickupLocation } from "@/features/settings/settings-data";
import { getManagerLocale } from "@/lib/i18n/manager-locale";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getManagerLocale()).settings.pickupLocations;
  return { title: dict.hoursTitle, description: dict.hoursDescription };
}

export default async function PickupLocationHoursPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireManagerSession();
  const { id } = await params;
  const location = await getPickupLocation(id);
  if (!location) notFound();
  const locale = await getManagerLocale();

  return (
    <PickupLocationHoursSettings
      locationId={location.id}
      locationName={location.name}
      initial={location.weeklyHours}
      locale={locale}
    />
  );
}
