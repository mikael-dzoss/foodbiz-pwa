export type FeatureStatus = "available" | "soon";

export type FeatureKey =
  | "orders.export"
  | "orders.filter_custom"
  | "analytics.export"
  | "settings.ordering"
  | "settings.payments"
  | "settings.inventory"
  | "settings.finance"
  | "settings.notifications"
  | "settings.team"
  | "settings.devices"
  | "settings.billing"
  | "settings.app"
  | "account.devices"
  | "account.export_data"
  | "account.delete"
  | "business.cover_image"
  | "business.brand_color"
  | "products.import"
  | "products.barcode"
  | "dashboard.realtime"
  | "orders.create"
  | "products.manage";

export interface FeatureDefinition {
  key: FeatureKey;
  status: FeatureStatus;
  title: string;
  description: string;
}

export type FeatureInterestListener = (
  featureKey: FeatureKey,
  metadata?: Record<string, unknown>,
) => void;
