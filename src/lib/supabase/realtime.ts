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
 *
 * Ordering: the channel is joined only after the session JWT has been set on the realtime
 * socket, and `SUBSCRIBED` is reported only once the server has activated the postgres_changes
 * subscription. Joining is asynchronous; failures are reported as `CHANNEL_ERROR`.
 */
export function subscribeToOrderInserts(
  client: RealtimeOrderClient,
  businessId: string,
  handlers: OrderInsertHandlers,
): OrderInsertSubscription {
  if (!isValidUuid(businessId)) {
    throw new Error(`Invalid businessId: "${businessId}" is not a valid UUID`);
  }

  let isUnsubscribed = false;
  let channel: RealtimeChannel | null = null;

  // Listen to token refresh so long-lived realtime channels maintain valid credentials
  let authSubscription: { unsubscribe: () => void } | undefined;
  try {
    authSubscription = client.auth?.onAuthStateChange?.((_event, session) => {
      if (session?.access_token) {
        void client.realtime?.setAuth?.(session.access_token)?.catch(() => {});
      }
    })?.data?.subscription;
  } catch {
    // When SupabaseClient is configured with custom accessToken option, accessing auth throws
  }

  // Sync the session JWT to the realtime socket and wait for it: a channel joined with the anon
  // token is silently filtered by RLS and would never deliver an order INSERT.
  const syncAuth = async () => {
    try {
      const { data } = (await client.auth?.getSession?.()) ?? {};
      if (data?.session?.access_token) {
        await client.realtime?.setAuth?.(data.session.access_token);
      }
    } catch {
      // Custom accessToken option (auth getter throws) or transient failure: socket keeps its token
    }
  };

  const join = async () => {
    await syncAuth();
    if (isUnsubscribed) return;

    channel = client
      // wait: hold SUBSCRIBED until the server has activated the postgres_changes subscription,
      // otherwise an INSERT committed right after SUBSCRIBED can be missed.
      .channel(`orders:business:${businessId}`, {
        config: { postgres_changes_options: { wait: true } },
      })
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
  };

  void join().catch((err: unknown) => {
    if (isUnsubscribed) return;
    handlers.onStatusChange?.("CHANNEL_ERROR", err instanceof Error ? err : new Error(String(err)));
  });

  const unsubscribe = async () => {
    if (isUnsubscribed) return;
    isUnsubscribed = true;
    authSubscription?.unsubscribe();
    // Unsubscribed before the join happened: no channel exists, so nothing leaks
    if (channel) await client.removeChannel(channel);
  };

  return Object.assign(unsubscribe, { unsubscribe }) as OrderInsertSubscription;
}
