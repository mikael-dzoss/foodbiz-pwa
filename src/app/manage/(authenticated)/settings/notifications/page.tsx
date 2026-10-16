import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { getDictionary, DEFAULT_LOCALE } from "@/domain/i18n";
import { getBusinessSettingsAction, NotificationsAppForm } from "@/features/settings";
import { APP_METADATA } from "@/config/app";

export const metadata: Metadata = {
  title: `Notifications & App | ${APP_METADATA.name}`,
  description: "Configure order alerts, sound chime, and PWA installation options.",
};

export const instant = false;

export default async function NotificationsPage() {
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
          revolutRevtag: "",
          weroIdentifier: "",
          paymentMethods: { cash: true, revolut: true, wero: true },
          paymentInstructionsEn: "",
          paymentInstructionsFr: "",
          inAppAlerts: true,
          soundAlerts: true,
        };

  return <NotificationsAppForm settings={settings} dict={dict.settings} />;
}
