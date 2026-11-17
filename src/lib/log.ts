export type LogLevel = "error" | "warn" | "info";

/** Flat, JSON-serialisable fields. Never pass headers, cookies, bodies, query strings or PII. */
export type LogFields = Readonly<Record<string, string | number | boolean | undefined>>;

/**
 * One JSON line per server event, so hosted logs (Vercel captures stdout/stderr) can be
 * filtered by `event` and correlated by `digest`. Undefined fields are dropped.
 */
export function logEvent(level: LogLevel, event: string, fields: LogFields = {}): void {
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    event,
    appEnv: process.env.APP_ENV,
    ...fields,
  });
  console[level](line);
}
