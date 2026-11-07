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

export type StorefrontServiceMode = "delivery" | "pickup";

export interface CartContextValue {
  items: CartItem[];
  addItem: (product: AddItemInput, quantity?: number) => boolean;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  getItemQuantity: (productId: string) => number;
  syncPrices: (freshItems: Array<{ id: string; price: number; stock?: number }>) => void;
  notes: string;
  setNotes: (notes: string) => void;
  serviceMode: StorefrontServiceMode;
  setServiceMode: (mode: StorefrontServiceMode) => void;
  totalCount: number;
  totalAmountInCents: number;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "foodbiz_storefront_cart";
const NOTES_STORAGE_KEY = "foodbiz_storefront_notes";
export const SERVICE_MODE_STORAGE_KEY = "foodbiz_storefront_service_mode";

export function resolveServiceMode(
  storedMode: StorefrontServiceMode,
  serviceTypes?: { pickup: boolean; delivery: boolean } | null,
): StorefrontServiceMode {
  const deliveryEnabled = serviceTypes?.delivery ?? true;
  const pickupEnabled = serviceTypes?.pickup ?? true;
  if (storedMode === "delivery" && deliveryEnabled) return "delivery";
  if (storedMode === "pickup" && pickupEnabled) return "pickup";
  return deliveryEnabled ? "delivery" : "pickup";
}

let memoryCart: CartItem[] = [];
let memoryNotes: string = "";
let memoryServiceMode: StorefrontServiceMode = "delivery";
let isInitialized = false;
let isNotesInitialized = false;
let isServiceModeInitialized = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function resetCartStore(): void {
  memoryCart = [];
  memoryNotes = "";
  memoryServiceMode = "delivery";
  isInitialized = false;
  isNotesInitialized = false;
  isServiceModeInitialized = false;
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(NOTES_STORAGE_KEY);
      localStorage.removeItem(SERVICE_MODE_STORAGE_KEY);
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

function getStoredNotes(): string {
  if (typeof window === "undefined") return "";
  if (!isNotesInitialized) {
    try {
      const stored = localStorage.getItem(NOTES_STORAGE_KEY);
      if (typeof stored === "string") {
        memoryNotes = stored;
      }
    } catch {
      // Storage unavailable
    }
    isNotesInitialized = true;
  }
  return memoryNotes;
}

function saveStoredNotes(newNotes: string) {
  memoryNotes = newNotes;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(NOTES_STORAGE_KEY, newNotes);
    } catch {
      // Storage error
    }
  }
  notify();
}

function getStoredServiceMode(): StorefrontServiceMode {
  if (typeof window === "undefined") return "delivery";
  if (!isServiceModeInitialized) {
    try {
      const stored = localStorage.getItem(SERVICE_MODE_STORAGE_KEY);
      if (stored === "delivery" || stored === "pickup") {
        memoryServiceMode = stored;
      }
    } catch {
      // Storage unavailable
    }
    isServiceModeInitialized = true;
  }
  return memoryServiceMode;
}

function saveStoredServiceMode(newMode: StorefrontServiceMode) {
  memoryServiceMode = newMode;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(SERVICE_MODE_STORAGE_KEY, newMode);
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
    } else if (e.key === NOTES_STORAGE_KEY) {
      isNotesInitialized = false;
      notify();
    } else if (e.key === SERVICE_MODE_STORAGE_KEY) {
      isServiceModeInitialized = false;
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
  initialNotes?: string;
  initialServiceMode?: StorefrontServiceMode;
}

export function CartProvider({
  children,
  initialItems,
  initialNotes,
  initialServiceMode,
}: CartProviderProps) {
  const [localItems, setLocalItems] = useState<CartItem[] | null>(initialItems ?? null);
  const [localNotes, setLocalNotes] = useState<string | null>(initialNotes ?? null);
  const [localServiceMode, setLocalServiceMode] = useState<StorefrontServiceMode | null>(
    initialServiceMode ?? null,
  );

  const syncedItems = useSyncExternalStore(subscribeCart, getStoredCart, () => emptyCart);
  const syncedNotes = useSyncExternalStore(subscribeCart, getStoredNotes, () => "");
  const syncedServiceMode = useSyncExternalStore(
    subscribeCart,
    getStoredServiceMode,
    () => "delivery" as const,
  );

  const items = localItems ?? syncedItems;
  const notes = localNotes ?? syncedNotes;
  const serviceMode = localServiceMode ?? syncedServiceMode;

  const setNotes = useCallback(
    (newNotes: string) => {
      if (initialNotes !== undefined) {
        setLocalNotes(newNotes);
      } else {
        saveStoredNotes(newNotes);
      }
    },
    [initialNotes],
  );

  const setServiceMode = useCallback(
    (newMode: StorefrontServiceMode) => {
      if (initialServiceMode !== undefined) {
        setLocalServiceMode(newMode);
      } else {
        saveStoredServiceMode(newMode);
      }
    },
    [initialServiceMode],
  );

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
    setNotes("");
  }, [updateCartState, setNotes]);

  const getItemQuantity = useCallback(
    (productId: string): number => {
      const found = items.find((item) => item.productId === productId);
      return found?.quantity ?? 0;
    },
    [items],
  );

  const syncPrices = useCallback(
    (freshItems: Array<{ id: string; price: number; stock?: number }>) => {
      const priceMap = new Map(freshItems.map((p) => [p.id, p]));
      updateCartState((currentItems) =>
        currentItems.map((item) => {
          const fresh = priceMap.get(item.productId);
          if (fresh) {
            const newMaxStock = fresh.stock !== undefined ? fresh.stock : item.maxStock;
            return {
              ...item,
              price: fresh.price,
              maxStock: newMaxStock,
              quantity: Math.min(item.quantity, newMaxStock),
            };
          }
          return item;
        }),
      );
    },
    [updateCartState],
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
      syncPrices,
      notes,
      setNotes,
      serviceMode,
      setServiceMode,
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
      syncPrices,
      notes,
      setNotes,
      serviceMode,
      setServiceMode,
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
