"use client";

import { useEffect, useMemo } from "react";
import type { StorefrontPickupLocation } from "@/domain/pickup-location";
import { useCartOptional } from "./context/cart-context";
import {
  isPickupChoiceValid,
  resolvePickupState,
  type ResolvedPickupState,
} from "./pickup-options";

export interface UsePickupLocationResult extends ResolvedPickupState {
  /** Persists a new pickup choice (`"shop"` or relay UUID, or `null` to clear). */
  readonly selectPickupLocation: (choice: string | null) => void;
}

const NOOP = () => {};

/**
 * Resolves the persisted storefront pickup location against the current catalog and clears it
 * from storage automatically when the chosen option disappears or becomes disabled (#386).
 */
export function usePickupLocation(
  shopPickupEnabled: boolean,
  pickupLocations: readonly StorefrontPickupLocation[],
): UsePickupLocationResult {
  const cart = useCartOptional();
  const storedChoice = cart?.pickupLocationChoice ?? null;
  const setStoredChoice = cart?.setPickupLocationChoice;

  useEffect(() => {
    if (!setStoredChoice || storedChoice === null) return;
    if (!isPickupChoiceValid(storedChoice, shopPickupEnabled, pickupLocations)) {
      setStoredChoice(null);
    }
  }, [storedChoice, shopPickupEnabled, pickupLocations, setStoredChoice]);

  const resolved = useMemo(
    () => resolvePickupState(storedChoice, shopPickupEnabled, pickupLocations),
    [storedChoice, shopPickupEnabled, pickupLocations],
  );

  return useMemo(
    () => ({
      ...resolved,
      selectPickupLocation: setStoredChoice ?? NOOP,
    }),
    [resolved, setStoredChoice],
  );
}
