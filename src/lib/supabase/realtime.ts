import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type RealtimeSubscriptionStatus = "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR";

export type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

export type RealtimeOrderClient = SupabaseClient<Database>;

export interface OrderInsertHandlers {
  onInsert?: (orderId: string, row: Partial<OrderRow>) => void;
  onStatusChange?: (status: RealtimeSubscriptionStatus, error?: Error | null) => void;
}

export interface OrderInsertSubscription {
  (): Promise<void>;
  unsubscribe: () => Promise<void>;
  channel: RealtimeChannel;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}

/**
 * Subscribes to real-time order INSERT events for a specific business tenant.
 *
 * Layering: presentation/context layers never import @supabase/supabase-js directly;
 * they interact with Supabase Realtime through this typed helper.
 *
 * Security: strictly validates `businessId` format as a UUID before building the
 * subscription filter, preventing channel filter injection attacks.
 */
export function subscribeToOrderInserts(
  client: RealtimeOrderClient,
  businessId: string,
  handlers: OrderInsertHandlers,
): OrderInsertSubscription {
  if (!isValidUuid(businessId)) {
    throw new Error(`Invalid businessId: "${businessId}" is not a valid UUID`);
  }

  // Ensure client auth token is synced to realtime connection if session exists
  let authSubscription: { unsubscribe: () => void } | undefined;
  try {
    if (typeof client.realtime?.setAuth === "function") {
      client.auth
        ?.getSession?.()
        .then(({ data }) => {
          if (data?.session?.access_token && typeof client.realtime?.setAuth === "function") {
            void client.realtime.setAuth(data.session.access_token);
          }
        })
        .catch(() => {});
    }

    // Listen to token refresh so long-lived realtime channels maintain valid credentials
    authSubscription = client.auth?.onAuthStateChange?.((_event, session) => {
      if (session?.access_token && typeof client.realtime?.setAuth === "function") {
        void client.realtime.setAuth(session.access_token);
      }
    })?.data?.subscription;
  } catch {
    // When SupabaseClient is configured with custom accessToken option, accessing auth throws
  }

  const channel = client
    .channel(`orders:business:${businessId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "orders",
        filter: `business_id=eq.${businessId}`,
      },
      (payload) => {
        const row = (payload.new ?? {}) as Partial<OrderRow>;
        if (row.id) {
          handlers.onInsert?.(row.id, row);
        }
      },
    )
    .subscribe((status, err) => {
      handlers.onStatusChange?.(
        status as RealtimeSubscriptionStatus,
        err ? (err instanceof Error ? err : new Error(String(err))) : null,
      );
    });

  let isUnsubscribed = false;
  const unsubscribe = async () => {
    if (isUnsubscribed) return;
    isUnsubscribed = true;
    authSubscription?.unsubscribe();
    await client.removeChannel(channel);
  };

  const subscription = Object.assign(unsubscribe, {
    unsubscribe,
    channel,
  }) as OrderInsertSubscription;

  return subscription;
}
