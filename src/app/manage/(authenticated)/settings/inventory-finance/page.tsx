import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { getDictionary, DEFAULT_LOCALE } from "@/domain/i18n";
import { getBusinessSettingsAction, InventoryFinanceForm } from "@/features/settings";
import { APP_METADATA } from "@/config/app";

export const metadata: Metadata = {
  title: `Inventory & Finance | ${APP_METADATA.name}`,
  description: "Configure stock warning thresholds, currency, and sales tax rate.",
};

export const instant = false;

export default async function InventoryFinancePage() {
  const session = await requireManagerSession();
  const dict = getDictionary(DEFAULT_LOCALE);
  const res = await getBusinessSettingsAction();

  const settings =
    res.success && res.data
      ? res.data
      : {
          businessId: session.business.id,
          currency: "EUR" as const,
          dateFormat: "DD/MM/YYYY" as const,
          lowStockThreshold: 5,
          taxPercentage: 0,
          notifications: true,
          acceptingOrders: true,
          serviceTypes: { pickup: true, delivery: true, dineIn: true },
          openingHours: "",
          orderTimingAsap: true,
          orderTimingScheduled: true,
          orderTimingTimeOptional: true,
          deliveryFee: 0,
          minOrderAmount: 0,
          leadTimeValue: 1,
          leadTimeUnit: "business_days" as const,
          leadTimeNoteEn: "",
          leadTimeNoteFr: "",
          revolutRevtag: "",
          weroIdentifier: "",
          paymentMethods: { cash: true, revolut: true, wero: true },
          paymentInstructionsEn: "",
          paymentInstructionsFr: "",
          inAppAlerts: true,
          soundAlerts: true,
        };

  return <InventoryFinanceForm settings={settings} dict={dict.settings} />;
}
