export interface SecurityHeaderOptions {
  /** Origin-bearing Supabase URL (`NEXT_PUBLIC_SUPABASE_URL`); omitted hosts are simply not allowed. */
  supabaseUrl?: string;
  /** `next dev`: adds `'unsafe-eval'` (React debugging) and skips transport-only directives. */
  isDev: boolean;
  /** Real HTTPS deployment: adds `upgrade-insecure-requests` and HSTS. */
  secureTransport: boolean;
}

export interface HeaderEntry {
  key: string;
  value: string;
}

const GOOGLE_OAUTH_ORIGIN = "https://accounts.google.com";
const OSM_ORIGIN = "https://www.openstreetmap.org";

function supabaseOrigins(raw?: string): { http: string[]; ws: string[] } {
  if (!raw) return { http: [], ws: [] };
  try {
    const url = new URL(raw);
    const ws = `${url.protocol === "http:" ? "ws:" : "wss:"}//${url.host}`;
    return { http: [url.origin], ws: [ws] };
  } catch {
    return { http: [], ws: [] };
  }
}

/**
 * Static CSP (no nonces): nonces force dynamic rendering, which conflicts with the cached
 * shells of `cacheComponents`. Next's inline bootstrap/flight scripts and the theme script
 * therefore need `'unsafe-inline'` for scripts; see docs/architecture.md#security-headers.
 */
export function buildCsp({ supabaseUrl, isDev, secureTransport }: SecurityHeaderOptions): string {
  const supabase = supabaseOrigins(supabaseUrl);
  const directives: Array<[string, string[]]> = [
    ["default-src", ["'self'"]],
    ["script-src", ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])]],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", ...supabase.http]],
    ["font-src", ["'self'"]],
    ["connect-src", ["'self'", ...supabase.http, ...supabase.ws]],
    ["frame-src", [OSM_ORIGIN]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    // Google sign-in: the action redirects to Supabase, which redirects to Google.
    ["form-action", ["'self'", ...supabase.http, GOOGLE_OAUTH_ORIGIN]],
    ["frame-ancestors", ["'none'"]],
    ["manifest-src", ["'self'"]],
  ];
  const parts = directives.map(([name, sources]) => `${name} ${sources.join(" ")}`);
  if (secureTransport) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

export function buildSecurityHeaders(options: SecurityHeaderOptions): HeaderEntry[] {
  const headers: HeaderEntry[] = [
    { key: "Content-Security-Policy", value: buildCsp(options) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), interest-cohort=()",
    },
    { key: "X-Frame-Options", value: "DENY" },
  ];
  if (options.secureTransport) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains",
    });
  }
  return headers;
}
