export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetAt: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * In-memory fixed-window rate limiter with automatic expired entry eviction.
 * Used on mock data sources; DB-backed limiter will be introduced in E18.
 */
export class RateLimiter {
  private readonly store = new Map<string, RateLimitEntry>();
  private lastCleanup = Date.now();
  private readonly cleanupIntervalMs = 60 * 1000; // 1 minute

  public check(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    this.evictExpired(now);

    const existing = this.store.get(key);

    if (!existing || now >= existing.resetAt) {
      const resetAt = now + windowMs;
      this.store.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        remaining: limit - 1,
        resetAt,
      };
    }

    if (existing.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: existing.resetAt,
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      remaining: limit - existing.count,
      resetAt: existing.resetAt,
    };
  }

  public reset(): void {
    this.store.clear();
    this.lastCleanup = Date.now();
  }

  private evictExpired(now: number): void {
    if (now - this.lastCleanup < this.cleanupIntervalMs && this.store.size < 1000) {
      return;
    }
    this.lastCleanup = now;
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
      }
    }
  }
}

// Global singleton for server action rate limiting
let globalLimiter: RateLimiter | null = null;

export function getGlobalRateLimiter(): RateLimiter {
  if (!globalLimiter) {
    globalLimiter = new RateLimiter();
  }
  return globalLimiter;
}
