import type { PlaceOrderResult, PlaceOrderSuccessData } from "@/domain/checkout";

interface IdempotencyEntry {
  data: PlaceOrderSuccessData;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * In-memory idempotency cache for order placement.
 * Ensures duplicate form submissions / network retries return the exact same order result
 * without duplicating orders or decrementing product stock twice.
 * Per server instance only: a retry served by another instance (or after a restart) is not
 * recognized. Production needs a unique (business_id, idempotency_key) constraint on orders.
 * See docs/architecture.md#known-limitations-mock-data-stage.
 */
export class IdempotencyStore {
  private readonly store = new Map<string, IdempotencyEntry>();
  private readonly inFlight = new Map<string, Promise<PlaceOrderResult>>();
  private lastCleanup = Date.now();
  private readonly cleanupIntervalMs = 5 * 60 * 1000; // 5 minutes

  private makeKey(businessId: string, idempotencyKey: string): string {
    return `${businessId}::${idempotencyKey}`;
  }

  public get(businessId: string, idempotencyKey: string): PlaceOrderSuccessData | null {
    const key = this.makeKey(businessId, idempotencyKey);
    const now = Date.now();
    this.evictExpired(now);

    const entry = this.store.get(key);
    if (!entry) return null;

    if (now >= entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.data;
  }

  public set(
    businessId: string,
    idempotencyKey: string,
    data: PlaceOrderSuccessData,
    ttlMs: number = DEFAULT_TTL_MS,
  ): void {
    const key = this.makeKey(businessId, idempotencyKey);
    const now = Date.now();
    this.store.set(key, {
      data,
      expiresAt: now + ttlMs,
    });
  }

  public getInFlight(
    businessId: string,
    idempotencyKey: string,
  ): Promise<PlaceOrderResult> | undefined {
    const key = this.makeKey(businessId, idempotencyKey);
    return this.inFlight.get(key);
  }

  public setInFlight(
    businessId: string,
    idempotencyKey: string,
    promise: Promise<PlaceOrderResult>,
  ): void {
    const key = this.makeKey(businessId, idempotencyKey);
    this.inFlight.set(key, promise);
  }

  public removeInFlight(businessId: string, idempotencyKey: string): void {
    const key = this.makeKey(businessId, idempotencyKey);
    this.inFlight.delete(key);
  }

  public reset(): void {
    this.store.clear();
    this.inFlight.clear();
    this.lastCleanup = Date.now();
  }

  private evictExpired(now: number): void {
    if (now - this.lastCleanup < this.cleanupIntervalMs && this.store.size < 1000) {
      return;
    }
    this.lastCleanup = now;
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}

let globalIdempotencyStore: IdempotencyStore | null = null;

export function getGlobalIdempotencyStore(): IdempotencyStore {
  if (!globalIdempotencyStore) {
    globalIdempotencyStore = new IdempotencyStore();
  }
  return globalIdempotencyStore;
}
