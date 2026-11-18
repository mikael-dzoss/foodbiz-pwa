import { testHooksEnabled } from "@/lib/test-hooks";
import { resetMockData } from "@/lib/repositories/mock";

/** E2E only: resets the in-memory mock data to its seed state. 404 unless `testHooksEnabled`. */
export function POST(): Response {
  if (!testHooksEnabled(process.env)) return new Response(null, { status: 404 });
  resetMockData();
  return new Response(null, { status: 204 });
}
