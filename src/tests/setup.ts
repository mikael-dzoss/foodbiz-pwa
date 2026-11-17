import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
}

if (typeof window !== "undefined" && window.CustomEvent) {
  globalThis.CustomEvent = window.CustomEvent;
}

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
}));

afterEach(() => {
  cleanup();
});
