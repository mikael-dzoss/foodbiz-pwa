import { FeatureDefinition, FeatureInterestListener, FeatureKey, FeatureStatus } from "./types";

export const FEATURE_REGISTRY: Record<FeatureKey, FeatureDefinition> = {
  "orders.export": {
    key: "orders.export",
    status: "soon",
    title: "Export Orders",
    description: "Export order history to CSV/Excel format.",
  },
  "orders.filter_custom": {
    key: "orders.filter_custom",
    status: "soon",
    title: "Custom Order Filters",
    description: "Advanced date ranges and customer tags filtering.",
  },
  "analytics.export": {
    key: "analytics.export",
    status: "soon",
    title: "Analytics Report Export",
    description: "Download financial and performance summary reports.",
  },
  "settings.ordering": {
    key: "settings.ordering",
    status: "soon",
    title: "Ordering Settings",
    description: "Fulfillment modes, prep times, and order cutoffs.",
  },
  "settings.payments": {
    key: "settings.payments",
    status: "soon",
    title: "Payment Settings",
    description: "Revolut Pay, Wero, cash, and payout preferences.",
  },
  "settings.inventory": {
    key: "settings.inventory",
    status: "soon",
    title: "Inventory Settings",
    description: "Low-stock thresholds and waste tracking.",
  },
  "settings.finance": {
    key: "settings.finance",
    status: "soon",
    title: "Finance & Tax Settings",
    description: "VAT rates, accounting exports, and currency rules.",
  },
  "settings.notifications": {
    key: "settings.notifications",
    status: "soon",
    title: "Push Notifications",
    description: "Live order alerts on mobile device.",
  },
  "settings.team": {
    key: "settings.team",
    status: "soon",
    title: "Team Permissions",
    description: "Role-based member invitations and access control.",
  },
  "settings.devices": {
    key: "settings.devices",
    status: "soon",
    title: "Printer & Device Setup",
    description: "Bluetooth and thermal receipt printer connection.",
  },
  "settings.billing": {
    key: "settings.billing",
    status: "soon",
    title: "Billing & Plans",
    description: "Manage subscription and store invoices.",
  },
  "settings.app": {
    key: "settings.app",
    status: "soon",
    title: "App Configuration",
    description: "PWA caching, offline mode, and dev tools.",
  },
  "account.devices": {
    key: "account.devices",
    status: "soon",
    title: "Signed-in Devices",
    description: "Manage active sessions and trusted devices.",
  },
  "account.export_data": {
    key: "account.export_data",
    status: "soon",
    title: "Export My Data",
    description: "Download GDPR archive of orders, expenses, and logs.",
  },
  "account.delete": {
    key: "account.delete",
    status: "soon",
    title: "Delete Account",
    description: "Permanently purge manager account and personal data.",
  },
  "business.cover_image": {
    key: "business.cover_image",
    status: "soon",
    title: "Storefront Cover Image",
    description: "Hero header photo displayed on customer web storefront.",
  },
  "business.brand_color": {
    key: "business.brand_color",
    status: "soon",
    title: "Brand Theme Colour",
    description: "Custom accent colour on digital receipts and storefront.",
  },
  "products.import": {
    key: "products.import",
    status: "soon",
    title: "Bulk CSV Import",
    description: "Import products and initial stock from spreadsheet.",
  },
  "products.barcode": {
    key: "products.barcode",
    status: "soon",
    title: "Barcode Scanner",
    description: "Quick SKU lookup via device camera.",
  },
  "dashboard.realtime": {
    key: "dashboard.realtime",
    status: "available",
    title: "Real-time Metrics",
    description: "Live revenue and active order tracking.",
  },
  "orders.create": {
    key: "orders.create",
    status: "available",
    title: "Create Orders",
    description: "Manual order recording and status dispatch.",
  },
  "products.manage": {
    key: "products.manage",
    status: "available",
    title: "Manage Products",
    description: "Catalog pricing and inventory adjustments.",
  },
};

const interestListeners = new Set<FeatureInterestListener>();

export function getFeature(key: FeatureKey): FeatureDefinition {
  return FEATURE_REGISTRY[key];
}

export function getFeatureStatus(key: FeatureKey): FeatureStatus {
  return FEATURE_REGISTRY[key]?.status ?? "soon";
}

export function isFeatureSoon(key: FeatureKey): boolean {
  return getFeatureStatus(key) === "soon";
}

export function subscribeFeatureInterest(listener: FeatureInterestListener): () => void {
  interestListeners.add(listener);
  return () => {
    interestListeners.delete(listener);
  };
}

export function emitFeatureInterest(
  featureKey: FeatureKey,
  metadata?: Record<string, unknown>,
): void {
  interestListeners.forEach((listener) => {
    try {
      listener(featureKey, metadata);
    } catch {
      // Non-blocking telemetry
    }
  });
}
