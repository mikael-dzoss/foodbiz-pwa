// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { DEMO_PRODUCT, demoBusiness, demoCategories } from "@/lib/repositories/mock/fixtures";
import { buildProductOgContent, buildShopOgContent } from "../metadata";
import { renderProductOgImage, renderShopOgImage, resolveOgImageSrc } from "../og-image";

const PNG_MAGIC = "89504e470d0a1a0a";

async function expectValidPng(response: Response) {
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("image/png");
  const buffer = Buffer.from(await response.arrayBuffer());
  expect(buffer.subarray(0, 8).toString("hex")).toBe(PNG_MAGIC);
  expect(buffer.byteLength).toBeGreaterThan(1000);
}

describe("storefront OG image helpers", () => {
  it("resolves local public assets into base64 data URIs and rejects missing/traversal paths", async () => {
    const src = await resolveOgImageSrc("/images/baguette.jpg");
    expect(src).toMatch(/^data:image\/jpeg;base64,/);

    expect(await resolveOgImageSrc(null)).toBeNull();
    expect(await resolveOgImageSrc("")).toBeNull();
    expect(await resolveOgImageSrc("/images/does-not-exist.jpg")).toBeNull();
    expect(await resolveOgImageSrc("/../package.json")).toBeNull();
  });

  it("validates inline data URLs", async () => {
    const valid = "data:image/png;base64,iVBORw0KGgo=";
    expect(await resolveOgImageSrc(valid)).toBe(valid);
    expect(await resolveOgImageSrc("data:image/avif;base64,AAAA")).toBeNull();
  });

  it("fetches allowed Supabase product-images URLs and safely ignores disallowed or failing URLs", async () => {
    const supabaseUrl = "https://project.supabase.co";
    const allowedUrl =
      "https://project.supabase.co/storage/v1/object/public/product-images/biz-1/item.png";

    const okFetch = vi.fn(
      async () =>
        new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
          status: 200,
          headers: { "content-type": "image/png; charset=utf-8" },
        }),
    );
    const resolved = await resolveOgImageSrc(allowedUrl, {
      supabaseUrl,
      fetchFn: okFetch as unknown as typeof fetch,
    });
    expect(okFetch).toHaveBeenCalledOnce();
    expect(resolved).toBe("data:image/png;base64,iVBORw==");

    // Disallowed host must never be fetched (SSRF protection)
    const blockedFetch = vi.fn();
    expect(
      await resolveOgImageSrc("https://internal.local/secret.png", {
        supabaseUrl,
        fetchFn: blockedFetch as unknown as typeof fetch,
      }),
    ).toBeNull();
    expect(blockedFetch).not.toHaveBeenCalled();

    // Non-200 response
    expect(
      await resolveOgImageSrc(allowedUrl, {
        supabaseUrl,
        fetchFn: vi.fn(async () => new Response(null, { status: 404 })) as unknown as typeof fetch,
      }),
    ).toBeNull();

    // Unsupported MIME (AVIF)
    expect(
      await resolveOgImageSrc(allowedUrl, {
        supabaseUrl,
        fetchFn: vi.fn(
          async () =>
            new Response(new Uint8Array([1, 2, 3]), {
              status: 200,
              headers: { "content-type": "image/avif" },
            }),
        ) as unknown as typeof fetch,
      }),
    ).toBeNull();

    // Network failure
    expect(
      await resolveOgImageSrc(allowedUrl, {
        supabaseUrl,
        fetchFn: vi.fn(async () => {
          throw new Error("timeout");
        }) as unknown as typeof fetch,
      }),
    ).toBeNull();
  });

  const TINY_PNG_DATA_URL =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

  it("renders valid PNG Open Graph images for shop and product (with and without photo)", async () => {
    const shopRes = renderShopOgImage(
      buildShopOgContent({
        businessName: demoBusiness.name,
        description: demoBusiness.description,
        address: demoBusiness.address,
        locale: "fr",
      }),
    );
    await expectValidPng(shopRes);

    const productWithPhotoRes = renderProductOgImage(
      buildProductOgContent({
        productName: DEMO_PRODUCT.pouletBraise.name,
        productDescription: DEMO_PRODUCT.pouletBraise.description,
        priceCents: DEMO_PRODUCT.pouletBraise.price,
        categoryName: demoCategories[0].name,
        businessName: demoBusiness.name,
        locale: "fr",
      }),
      TINY_PNG_DATA_URL,
    );
    await expectValidPng(productWithPhotoRes);

    const productTextOnlyRes = renderProductOgImage(
      buildProductOgContent({
        productName: DEMO_PRODUCT.chaudChaudNoyaux.name,
        productDescription: null,
        priceCents: DEMO_PRODUCT.chaudChaudNoyaux.price,
        categoryName: demoCategories[0].name,
        businessName: demoBusiness.name,
        locale: "en",
      }),
      null,
    );
    await expectValidPng(productTextOnlyRes);
  }, 15_000);
});
