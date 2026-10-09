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
