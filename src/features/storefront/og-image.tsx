import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { MAX_PRODUCT_IMAGE_BYTES } from "@/domain/product-image";
import {
  isAllowedOgDataUrl,
  isAllowedRemoteOgImageUrl,
  parseLocalPublicImagePath,
  SUPPORTED_OG_IMAGE_MIMES,
  type ProductOgContent,
  type ShopOgContent,
} from "./metadata";

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const OG_IMAGE_CONTENT_TYPE = "image/png" as const;

/**
 * Light-mode palette mirrored from `docs/design/DESIGN_SYSTEM.md` §2 and `src/app/globals.css`.
 * `ImageResponse` (Satori) renders outside CSS stylesheets, so hex tokens are passed explicitly.
 */
export const OG_COLORS = {
  background: "#f9f9ff",
  foreground: "#171c22",
  card: "#ffffff",
  muted: "#e4e7ef",
  mutedForeground: "#38404d",
  border: "#dde0e8",
  primary: "#006c49",
  primaryForeground: "#ffffff",
  primarySoft: "#d3efe1",
  primarySoftForeground: "#00402a",
} as const;

const REMOTE_FETCH_TIMEOUT_MS = 3000;

export interface ResolveOgImageOptions {
  publicDir?: string;
  supabaseUrl?: string;
  fetchFn?: typeof fetch;
}

/**
 * Resolves a product photo into a data URI that Satori (`next/og`) can render reliably.
 * Supports local `public/` assets, validated inline data URLs, and configured Supabase bucket URLs.
 * Returns `null` on missing, disallowed, unsupported or unreachable images so OG routes never crash.
 */
export async function resolveOgImageSrc(
  imageUrl: string | null | undefined,
  options: ResolveOgImageOptions = {},
): Promise<string | null> {
  const trimmed = imageUrl?.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("data:")) {
    return isAllowedOgDataUrl(trimmed) ? trimmed : null;
  }

  const local = parseLocalPublicImagePath(trimmed);
  if (local) {
    const publicRoot = path.resolve(options.publicDir ?? path.join(process.cwd(), "public"));
    const targetPath = path.resolve(publicRoot, local.relativePath);
    if (!targetPath.startsWith(`${publicRoot}${path.sep}`)) return null;
    try {
      const bytes = await readFile(targetPath);
      if (bytes.byteLength === 0 || bytes.byteLength > MAX_PRODUCT_IMAGE_BYTES) return null;
      return `data:${local.mimeType};base64,${bytes.toString("base64")}`;
    } catch {
      return null;
    }
  }

  const supabaseUrl = options.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!isAllowedRemoteOgImageUrl(trimmed, supabaseUrl)) return null;

  const fetchImpl = options.fetchFn ?? fetch;
  try {
    const response = await fetchImpl(trimmed, {
      redirect: "error",
      signal: AbortSignal.timeout(REMOTE_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const rawContentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim() ?? "";
    const mimeType = rawContentType.toLowerCase();
    if (!SUPPORTED_OG_IMAGE_MIMES.has(mimeType)) return null;
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_PRODUCT_IMAGE_BYTES) return null;
    return `data:${mimeType};base64,${Buffer.from(buffer).toString("base64")}`;
  } catch {
    return null;
  }
}

/** Renders the branded storefront Open Graph image (1200 × 630 PNG). */
export function renderShopOgImage(content: ShopOgContent): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: OG_COLORS.background,
        color: OG_COLORS.foreground,
      }}
    >
      <div
        style={{
          width: "100%",
          height: 12,
          backgroundColor: OG_COLORS.primary,
          display: "flex",
        }}
      />
      <div
        style={{
          flex: 1,
          display: "flex",
          padding: 48,
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            backgroundColor: OG_COLORS.card,
            border: `1px solid ${OG_COLORS.border}`,
            borderRadius: 24,
            padding: 56,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                backgroundColor: OG_COLORS.primarySoft,
                color: OG_COLORS.primarySoftForeground,
                fontSize: 22,
                fontWeight: 600,
                padding: "10px 22px",
                borderRadius: 9999,
              }}
            >
              {content.badge}
            </div>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                backgroundColor: OG_COLORS.primary,
                color: OG_COLORS.primaryForeground,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
                fontWeight: 700,
              }}
            >
              {content.monogram}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div
              style={{
                fontSize: 64,
                fontWeight: 700,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                color: OG_COLORS.foreground,
                display: "flex",
              }}
            >
              {content.title}
            </div>
            <div
              style={{
                fontSize: 28,
                lineHeight: 1.4,
                color: OG_COLORS.mutedForeground,
                display: "flex",
              }}
            >
              {content.description}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              borderTop: `1px solid ${OG_COLORS.border}`,
              paddingTop: 24,
              fontSize: 22,
              fontWeight: 500,
              color: OG_COLORS.primary,
            }}
          >
            {content.footer}
          </div>
        </div>
      </div>
    </div>,
    { ...OG_IMAGE_SIZE },
  );
}

/** Renders a product Open Graph image (1200 × 630 PNG), with or without a product photo. */
export function renderProductOgImage(
  content: ProductOgContent,
  photoSrc: string | null,
): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: OG_COLORS.background,
        color: OG_COLORS.foreground,
      }}
    >
      <div
        style={{
          width: "100%",
          height: 12,
          backgroundColor: OG_COLORS.primary,
          display: "flex",
        }}
      />
      <div
        style={{
          flex: 1,
          display: "flex",
          padding: 44,
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "row",
            gap: 40,
            backgroundColor: OG_COLORS.card,
            border: `1px solid ${OG_COLORS.border}`,
            borderRadius: 24,
            padding: 44,
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  display: "flex",
                  backgroundColor: OG_COLORS.primarySoft,
                  color: OG_COLORS.primarySoftForeground,
                  fontSize: 20,
                  fontWeight: 600,
                  padding: "8px 18px",
                  borderRadius: 9999,
                }}
              >
                {content.badge}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 22,
                  fontWeight: 500,
                  color: OG_COLORS.mutedForeground,
                }}
              >
                {content.businessName}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  fontSize: photoSrc ? 50 : 60,
                  fontWeight: 700,
                  lineHeight: 1.12,
                  letterSpacing: "-0.02em",
                  color: OG_COLORS.foreground,
                  display: "flex",
                }}
              >
                {content.title}
              </div>
              {content.description ? (
                <div
                  style={{
                    fontSize: 24,
                    lineHeight: 1.4,
                    color: OG_COLORS.mutedForeground,
                    display: "flex",
                  }}
                >
                  {content.description}
                </div>
              ) : null}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                borderTop: `1px solid ${OG_COLORS.border}`,
                paddingTop: 22,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 48,
                  fontWeight: 700,
                  color: OG_COLORS.primary,
                }}
              >
                {content.price}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 20,
                  fontWeight: 500,
                  color: OG_COLORS.mutedForeground,
                }}
              >
                {content.footer}
              </div>
            </div>
          </div>

          {photoSrc ? (
            <div
              style={{
                width: 420,
                height: 440,
                borderRadius: 20,
                overflow: "hidden",
                border: `1px solid ${OG_COLORS.border}`,
                backgroundColor: OG_COLORS.muted,
                display: "flex",
                flexShrink: 0,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- next/og ImageResponse (Satori) requires standard <img> elements */}
              <img
                src={photoSrc}
                alt=""
                width={420}
                height={440}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    { ...OG_IMAGE_SIZE },
  );
}
