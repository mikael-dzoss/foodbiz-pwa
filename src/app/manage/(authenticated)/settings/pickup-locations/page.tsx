import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { getDictionary } from "@/domain/i18n";
import { PickupLocationsSettings } from "@/features/settings/components/pickup-locations-settings";
import { getPickupLocationsPageData } from "@/features/settings/settings-data";
import { getManagerLocale } from "@/lib/i18n/manager-locale";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getManagerLocale()).settings.pickupLocations;
  return { title: dict.title, description: dict.description };
}

export default async function PickupLocationsPage() {
  await requireManagerSession();
  const locale = await getManagerLocale();
  const data = await getPickupLocationsPageData();

  return (
    <PickupLocationsSettings
      shop={data.shop}
      shopPickupEnabled={data.shopPickupEnabled}
      pickupServiceEnabled={data.pickupServiceEnabled}
      initial={data.locations}
      locale={locale}
    />
  );
}
