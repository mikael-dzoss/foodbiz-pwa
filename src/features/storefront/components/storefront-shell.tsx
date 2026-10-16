import type { ReactNode } from "react";
import type { StorefrontDictionary, SupportedLocale } from "@/domain/i18n";
import { StorefrontHeader } from "./storefront-header";
import { StorefrontFooter } from "./storefront-footer";
import { CartProvider } from "../context/cart-context";

export interface StorefrontShellProps {
  children: ReactNode;
  locale: SupportedLocale;
  dict: StorefrontDictionary;
  cartCount?: number;
}

export function StorefrontShell({ children, locale, dict, cartCount }: StorefrontShellProps) {
  return (
    <CartProvider>
      <div className="bg-background text-foreground flex min-h-screen flex-col">
        <StorefrontHeader locale={locale} dict={dict} cartCount={cartCount} />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6">{children}</main>
        <StorefrontFooter locale={locale} dict={dict} />
      </div>
    </CartProvider>
  );
}
