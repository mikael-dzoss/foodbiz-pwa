import { describe, expect, it, vi } from "vitest";
import {
  getFeature,
  getFeatureStatus,
  isFeatureSoon,
  emitFeatureInterest,
  subscribeFeatureInterest,
  FEATURE_REGISTRY,
} from "../features";

describe("Feature Registry & Soon Pattern (#33)", () => {
  it("provides typed status for known feature keys", () => {
    expect(getFeatureStatus("orders.export")).toBe("soon");
    expect(getFeatureStatus("dashboard.realtime")).toBe("available");
    expect(isFeatureSoon("settings.team")).toBe(true);
    expect(isFeatureSoon("orders.create")).toBe(false);
  });

  it("retrieves complete feature definition", () => {
    const feat = getFeature("analytics.export");
    expect(feat).toBeDefined();
    expect(feat.title).toBe("Analytics Report Export");
    expect(feat.status).toBe("soon");
  });

  it("emits feature_interest events to active subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeFeatureInterest(listener);

    emitFeatureInterest("orders.export", { source: "test" });
    expect(listener).toHaveBeenCalledWith("orders.export", { source: "test" });

    unsubscribe();
    emitFeatureInterest("orders.export");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("contains registry definitions for all registered keys", () => {
    expect(Object.keys(FEATURE_REGISTRY).length).toBeGreaterThanOrEqual(10);
  });
});
