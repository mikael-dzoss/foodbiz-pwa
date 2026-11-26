import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "--font-sans" }),
}));
import { APP_METADATA } from "@/config/app";
import { getDictionary, type SupportedLocale } from "@/domain/i18n";
import { getManagerLocale } from "@/lib/i18n/manager-locale";
import { generateMetadata as layoutMetadata } from "../layout";
import { generateMetadata as loginMetadata } from "../login/page";
import { generateMetadata as dashboardMetadata } from "../(authenticated)/page";
import { generateMetadata as ordersMetadata } from "../(authenticated)/orders/page";
import { generateMetadata as newOrderMetadata } from "../(authenticated)/orders/new/page";
import { generateMetadata as orderDetailMetadata } from "../(authenticated)/orders/[id]/page";
import { generateMetadata as productsMetadata } from "../(authenticated)/products/page";
import { generateMetadata as categoriesMetadata } from "../(authenticated)/categories/page";
import { generateMetadata as productsCategoriesMetadata } from "../(authenticated)/products/categories/page";
import { generateMetadata as expensesMetadata } from "../(authenticated)/expenses/page";
import { generateMetadata as customersMetadata } from "../(authenticated)/customers/page";
import { generateMetadata as customerDetailMetadata } from "../(authenticated)/customers/[id]/page";
import { generateMetadata as settingsMetadata } from "../(authenticated)/settings/page";
import { generateMetadata as accountSettingsMetadata } from "../(authenticated)/settings/account/page";
import { generateMetadata as businessSettingsMetadata } from "../(authenticated)/settings/business/page";
import { generateMetadata as orderingSettingsMetadata } from "../(authenticated)/settings/ordering/page";
import { generateMetadata as paymentSettingsMetadata } from "../(authenticated)/settings/payment/page";
import { generateMetadata as inventorySettingsMetadata } from "../(authenticated)/settings/inventory-finance/page";
import { generateMetadata as notificationsSettingsMetadata } from "../(authenticated)/settings/notifications/page";
import { generateMetadata as aboutSettingsMetadata } from "../(authenticated)/settings/about/page";

const mockedGetManagerLocale = vi.mocked(getManagerLocale);

function setLocale(locale: SupportedLocale) {
  mockedGetManagerLocale.mockResolvedValue(locale);
}

afterEach(() => {
  mockedGetManagerLocale.mockResolvedValue("en");
});

describe("manager layout and page metadata (EN & FR)", () => {
  it("keeps the layout title template, manager PWA metadata and translates its default description", async () => {
    for (const locale of ["en", "fr"] as const) {
      setLocale(locale);
      const dict = getDictionary(locale);
      const meta = await layoutMetadata();
      expect(meta.title).toEqual({
        default: APP_METADATA.manager.name,
        template: `%s · ${APP_METADATA.manager.name}`,
      });
      expect(meta.description).toBe(dict.manager.meta.appDescription);
      expect(meta.applicationName).toBe(APP_METADATA.manager.name);
      expect(meta.appleWebApp).toEqual({
        capable: true,
        title: APP_METADATA.manager.shortName,
        statusBarStyle: "default",
      });
      expect(meta.manifest).toBe("/manage/manifest.webmanifest");
      expect(meta.robots).toEqual({ index: false, follow: false });
    }
  });

  it("translates manager login metadata from cookie or explicit ?locale query param", async () => {
    setLocale("en");
    const enMeta = await loginMetadata();
    expect(enMeta).toEqual({
      title: getDictionary("en").login.pageHeading,
      description: getDictionary("en").login.intro,
    });

    const queryFrMeta = await loginMetadata({
      searchParams: Promise.resolve({ locale: "fr" }),
    });
    expect(queryFrMeta).toEqual({
      title: getDictionary("fr").login.pageHeading,
      description: getDictionary("fr").login.intro,
    });

    setLocale("fr");
    const cookieFrMeta = await loginMetadata();
    expect(cookieFrMeta).toEqual({
      title: getDictionary("fr").login.pageHeading,
      description: getDictionary("fr").login.intro,
    });
  });

  it("translates every authenticated manager page title and description in EN and FR", async () => {
    const cases = [
      {
        name: "dashboard",
        fn: dashboardMetadata,
        expected: (l: SupportedLocale) => ({
          title: getDictionary(l).dashboard.title,
          description: getDictionary(l).manager.meta.dashboardDescription,
        }),
      },
      {
        name: "orders",
        fn: ordersMetadata,
        expected: (l: SupportedLocale) => ({
          title: getDictionary(l).orders.title,
          description: getDictionary(l).manager.meta.ordersDescription,
        }),
      },
      {
        name: "orders/new",
        fn: newOrderMetadata,
        expected: (l: SupportedLocale) => ({
          title: getDictionary(l).orders.manual.title,
          description: getDictionary(l).manager.meta.newOrderDescription,
        }),
      },
      {
        name: "orders/[id]",
        fn: orderDetailMetadata,
        expected: (l: SupportedLocale) => ({
          title: getDictionary(l).manager.meta.orderDetailTitle,
          description: getDictionary(l).manager.meta.orderDetailDescription,
        }),
      },
      {
        name: "products",
        fn: productsMetadata,
        expected: (l: SupportedLocale) => ({
          title: getDictionary(l).productsAdmin.title,
          description: getDictionary(l).productsAdmin.subtitle,
        }),
      },
      {
        name: "categories",
        fn: categoriesMetadata,
        expected: (l: SupportedLocale) => ({
          title: getDictionary(l).categories.title,
          description: getDictionary(l).categories.subtitle,
        }),
      },
      {
        name: "products/categories",
        fn: productsCategoriesMetadata,
        expected: (l: SupportedLocale) => ({
          title: getDictionary(l).categories.title,
          description: getDictionary(l).categories.subtitle,
        }),
      },
      {
        name: "expenses",
        fn: expensesMetadata,
        expected: (l: SupportedLocale) => ({
          title: getDictionary(l).expenses.title,
          description: getDictionary(l).expenses.subtitle,
        }),
      },
      {
        name: "customers",
        fn: customersMetadata,
        expected: (l: SupportedLocale) => ({
          title: getDictionary(l).customers.title,
          description: getDictionary(l).customers.subtitle,
        }),
      },
      {
        name: "customers/[id]",
        fn: customerDetailMetadata,
        expected: (l: SupportedLocale) => ({
          title: getDictionary(l).manager.meta.customerDetailTitle,
          description: getDictionary(l).manager.meta.customerDetailDescription,
        }),
      },
      {
        name: "settings",
        fn: settingsMetadata,
        expected: (l: SupportedLocale) => ({
          title: getDictionary(l).settings.title,
          description: getDictionary(l).settings.subtitle,
        }),
      },
      {
        name: "settings/account",
        fn: accountSettingsMetadata,
        expected: (l: SupportedLocale) => ({
          title: getDictionary(l).settings.account.title,
          description: getDictionary(l).settings.account.description,
        }),
      },
      {
        name: "settings/business",
        fn: businessSettingsMetadata,
        expected: (l: SupportedLocale) => ({
          title: getDictionary(l).settings.business.title,
          description: getDictionary(l).settings.business.description,
        }),
      },
      {
        name: "settings/ordering",
        fn: orderingSettingsMetadata,
        expected: (l: SupportedLocale) => ({
          title: getDictionary(l).settings.ordering.title,
          description: getDictionary(l).settings.ordering.description,
        }),
      },
      {
        name: "settings/payment",
        fn: paymentSettingsMetadata,
        expected: (l: SupportedLocale) => ({
          title: getDictionary(l).settings.payment.title,
          description: getDictionary(l).settings.payment.description,
        }),
      },
      {
        name: "settings/inventory-finance",
        fn: inventorySettingsMetadata,
        expected: (l: SupportedLocale) => ({
          title: getDictionary(l).settings.inventoryFinance.title,
          description: getDictionary(l).settings.inventoryFinance.description,
        }),
      },
      {
        name: "settings/notifications",
        fn: notificationsSettingsMetadata,
        expected: (l: SupportedLocale) => ({
          title: getDictionary(l).settings.notifications.title,
          description: getDictionary(l).settings.notifications.description,
        }),
      },
      {
        name: "settings/about",
        fn: aboutSettingsMetadata,
        expected: (l: SupportedLocale) => ({
          title: getDictionary(l).settings.about.title,
          description: getDictionary(l).settingsExtra.about.intro,
        }),
      },
    ];

    for (const item of cases) {
      setLocale("en");
      const enMeta = await item.fn();
      expect(enMeta, `${item.name} (en)`).toEqual(item.expected("en"));

      setLocale("fr");
      const frMeta = await item.fn();
      expect(frMeta, `${item.name} (fr)`).toEqual(item.expected("fr"));
      expect(frMeta.title, `${item.name} title should differ in FR`).not.toBe(enMeta.title);
      expect(frMeta.description, `${item.name} description should differ in FR`).not.toBe(
        enMeta.description,
      );
    }
  });
});
