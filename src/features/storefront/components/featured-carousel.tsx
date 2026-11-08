import Link from "next/link";
import Image from "next/image";
import { UtensilsCrossed } from "lucide-react";
import { formatMoney } from "@/domain/formatting/money";
import type { SupportedLocale, StorefrontDictionary } from "@/domain/i18n";
import type { Product } from "@/domain/product";
import { ProductAddButton } from "./product-add-button";

export function FeaturedCarousel({
  products,
  locale,
  dict,
  disabled = false,
  headingRef,
}: {
  products: readonly Product[];
  locale: SupportedLocale;
  dict: StorefrontDictionary;
  disabled?: boolean;
  headingRef?: (node: HTMLElement | null) => void;
}) {
  if (products.length === 0) return null;
  return (
    <section id="featured" data-testid="featured-section">
      <div
        ref={headingRef}
        data-testid={headingRef ? "category-nav-sentinel" : undefined}
        className="mb-2 flex min-h-11 items-center justify-between gap-2"
      >
        <h2
          id="category-heading-featured"
          tabIndex={-1}
          className="text-foreground scroll-mt-28 text-base font-semibold tracking-tight focus:outline-hidden"
        >
          {dict.featuredItems}
        </h2>
        <span className="text-muted-foreground text-xs font-medium tabular-nums">
          {products.length} {products.length === 1 ? dict.item : dict.items}
        </span>
      </div>
      <div
        role="region"
        aria-label={dict.featuredItems}
        tabIndex={0}
        data-testid="featured-carousel"
        className="focus-visible:ring-ring flex snap-x snap-mandatory gap-3 overflow-x-auto rounded-lg pb-2 focus-visible:ring-2 focus-visible:outline-hidden"
      >
        {products.map((product, index) => (
          <article
            key={product.id}
            data-testid={`featured-item-${product.id}`}
            className="relative w-40 shrink-0 snap-start"
          >
            <div className="border-border bg-muted relative aspect-square overflow-hidden rounded-lg border">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  sizes="160px"
                  loading={index < 2 ? "eager" : "lazy"}
                  unoptimized={product.imageUrl.startsWith("data:")}
                  className="object-cover"
                />
              ) : (
                <div
                  data-testid={`featured-image-placeholder-${product.id}`}
                  className="text-muted-foreground flex h-full w-full items-center justify-center"
                >
                  <UtensilsCrossed className="h-6 w-6" aria-hidden="true" />
                </div>
              )}
              {index < 3 && (
                <span className="border-border bg-card text-card-foreground absolute top-2 left-2 rounded-full border px-2 py-1 text-xs font-medium">
                  #{index + 1} {dict.mostOrdered}
                </span>
              )}
              <ProductAddButton
                product={product}
                dict={dict}
                disabled={disabled}
                data-testid={`featured-add-to-cart-${product.id}`}
              />
            </div>
            <h3 className="text-foreground mt-2 text-sm font-semibold">
              <Link
                href={`/${locale}/p/${product.id}`}
                data-testid={`featured-product-link-${product.id}`}
                className="hover:text-primary focus-visible:ring-ring block min-h-11 rounded-xs after:absolute after:inset-0 focus-visible:ring-2 focus-visible:outline-hidden active:opacity-80"
              >
                {product.name}
              </Link>
            </h3>
            <p className="text-primary text-sm font-semibold tabular-nums">
              {formatMoney(product.price, locale)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
