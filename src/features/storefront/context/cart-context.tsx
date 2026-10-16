"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export interface CartItem {
  productId: string;
  name: string;
  price: number; // in cents
  quantity: number;
  imageUrl?: string | null;
  maxStock: number;
}

export interface AddItemInput {
  id: string;
  name: string;
  price: number;
  stock: number;
  imageUrl?: string | null;
}

export interface CartContextValue {
  items: CartItem[];
  addItem: (product: AddItemInput, quantity?: number) => boolean;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  getItemQuantity: (productId: string) => number;
  totalCount: number;
  totalAmountInCents: number;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "foodbiz_storefront_cart";

let memoryCart: CartItem[] = [];
let isInitialized = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function resetCartStore(): void {
  memoryCart = [];
  isInitialized = false;
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage unavailable
    }
  }
  notify();
}

function getStoredCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  if (!isInitialized) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          memoryCart = parsed;
        }
      }
    } catch {
      // Storage unavailable or parse error
    }
    isInitialized = true;
  }
  return memoryCart;
}

function saveStoredCart(newItems: CartItem[]) {
  memoryCart = newItems;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newItems));
    } catch {
      // Storage error
    }
  }
  notify();
}

function subscribeCart(callback: () => void) {
  listeners.add(callback);
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      isInitialized = false;
      notify();
    }
  };
  window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", handleStorage);
  };
}

const emptyCart: CartItem[] = [];

export interface CartProviderProps {
  children: ReactNode;
  initialItems?: CartItem[];
}

export function CartProvider({ children, initialItems }: CartProviderProps) {
  const [localItems, setLocalItems] = useState<CartItem[] | null>(initialItems ?? null);

  const syncedItems = useSyncExternalStore(subscribeCart, getStoredCart, () => emptyCart);

  const items = localItems ?? syncedItems;

  const updateCartState = useCallback(
    (updater: (current: CartItem[]) => CartItem[]) => {
      if (initialItems !== undefined) {
        setLocalItems((prev) => updater(prev ?? []));
      } else {
        const updated = updater(memoryCart);
        saveStoredCart(updated);
      }
    },
    [initialItems],
  );

  const addItem = useCallback(
    (product: AddItemInput, quantityToAdd = 1): boolean => {
      // Out of stock guard (Story #82)
      if (product.stock <= 0 || quantityToAdd <= 0) {
        return false;
      }

      let success = true;

      updateCartState((currentItems) => {
        const existingIndex = currentItems.findIndex((item) => item.productId === product.id);

        if (existingIndex > -1) {
          const current = currentItems[existingIndex];
          const newQty = current.quantity + quantityToAdd;
          const cappedQty = Math.min(newQty, product.stock);

          if (current.quantity >= product.stock) {
            success = false;
            return currentItems;
          }

          const updated = [...currentItems];
          updated[existingIndex] = {
            ...current,
            quantity: cappedQty,
            maxStock: product.stock,
          };
          return updated;
        }

        const initialQty = Math.min(quantityToAdd, product.stock);
        return [
          ...currentItems,
          {
            productId: product.id,
            name: product.name,
            price: product.price,
            quantity: initialQty,
            imageUrl: product.imageUrl,
            maxStock: product.stock,
          },
        ];
      });

      return success;
    },
    [updateCartState],
  );

  const updateQuantity = useCallback(
    (productId: string, newQuantity: number) => {
      updateCartState((currentItems) => {
        if (newQuantity <= 0) {
          return currentItems.filter((item) => item.productId !== productId);
        }
        return currentItems.map((item) => {
          if (item.productId === productId) {
            const capped = Math.min(newQuantity, item.maxStock);
            return { ...item, quantity: capped };
          }
          return item;
        });
      });
    },
    [updateCartState],
  );

  const removeItem = useCallback(
    (productId: string) => {
      updateCartState((currentItems) =>
        currentItems.filter((item) => item.productId !== productId),
      );
    },
    [updateCartState],
  );

  const clearCart = useCallback(() => {
    updateCartState(() => []);
  }, [updateCartState]);

  const getItemQuantity = useCallback(
    (productId: string): number => {
      const found = items.find((item) => item.productId === productId);
      return found?.quantity ?? 0;
    },
    [items],
  );

  const totalCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  const totalAmountInCents = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity * item.price, 0),
    [items],
  );

  const value = useMemo(
    () => ({
      items,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      getItemQuantity,
      totalCount,
      totalAmountInCents,
    }),
    [
      items,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      getItemQuantity,
      totalCount,
      totalAmountInCents,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCartOptional(): CartContextValue | null {
  return useContext(CartContext);
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
