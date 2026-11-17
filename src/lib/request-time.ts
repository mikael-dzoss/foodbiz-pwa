import "server-only";
import { connection } from "next/server";

/**
 * The current instant for a request. With Cache Components, `new Date()` during prerender is an
 * error; `await connection()` defers to request time first (see "Random values and timestamps" in
 * node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md and the `connection` API
 * reference). Domain code never reads the clock: callers pass this value down.
 */
export async function getRequestNow(): Promise<Date> {
  await connection();
  return new Date();
}
