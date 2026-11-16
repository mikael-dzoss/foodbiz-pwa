import { describe, expect, it, vi } from "vitest";
import {
  isValidUuid,
  subscribeToOrderInserts,
  type RealtimeOrderClient,
  type RealtimeSubscriptionStatus,
} from "../realtime";

type RealtimeCallback = (payload: { new?: Record<string, unknown> }) => void;
type StatusCallback = (status: string, err?: Error | null) => void;

function createStubClient() {
  let registeredCallback: RealtimeCallback | null = null;
  let statusCallback: StatusCallback | null = null;
  let onEvent = "";
  let onFilter: Record<string, unknown> = {};

  const stubChannel = {
    on: vi.fn((event: string, filter: Record<string, unknown>, callback: RealtimeCallback) => {
      onEvent = event;
      onFilter = filter;
      registeredCallback = callback;
      return stubChannel;
    }),
    subscribe: vi.fn((cb?: StatusCallback) => {
      if (cb) statusCallback = cb;
      return stubChannel;
    }),
  };

  const authUnsubscribe = vi.fn();
  let authListenerCb: ((event: string, session: unknown) => void) | null = null;

  const stubClient = {
    channel: vi.fn(() => stubChannel),
    removeChannel: vi.fn(() => Promise.resolve("ok")),
    realtime: {
      setAuth: vi.fn(() => Promise.resolve()),
    },
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({
          data: {
            session: { access_token: "initial-jwt-token" },
          },
          error: null,
        }),
      ),
      onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
        authListenerCb = cb;
        return {
          data: {
            subscription: {
              unsubscribe: authUnsubscribe,
            },
          },
        };
      }),
    },
  } as unknown as RealtimeOrderClient;

  return {
    stubClient,
    stubChannel,
    authUnsubscribe,
    triggerInsert: (payload: { new?: Record<string, unknown> }) => registeredCallback?.(payload),
    triggerStatus: (status: string, err?: Error | null) => statusCallback?.(status, err),
    triggerAuthChange: (session: unknown) => authListenerCb?.("TOKEN_REFRESHED", session),
    getOnEvent: () => onEvent,
    getOnFilter: () => onFilter,
  };
}

// The helper joins asynchronously (auth first); wait until the channel has been subscribed
const joined = (stub: { subscribe: unknown }) =>
  vi.waitFor(() => expect(stub.subscribe).toHaveBeenCalledTimes(1));

describe("Supabase Realtime Helper — subscribeToOrderInserts (#124)", () => {
  const validUuid = "10000000-0000-0000-0000-000000000001";

  describe("UUID validation & injection defense", () => {
    it("accepts valid UUID formats", () => {
      expect(isValidUuid("10000000-0000-0000-0000-000000000001")).toBe(true);
      expect(isValidUuid("a0b1c2d3-e4f5-4a6b-8c7d-9e0f1a2b3c4d")).toBe(true);
      expect(isValidUuid("A0B1C2D3-E4F5-4A6B-8C7D-9E0F1A2B3C4D")).toBe(true);
    });

    it("rejects malicious or invalid UUID strings", () => {
      expect(isValidUuid("")).toBe(false);
      expect(isValidUuid("not-a-uuid")).toBe(false);
      expect(isValidUuid("10000000-0000-0000-0000-000000000001; drop table orders;")).toBe(false);
      expect(isValidUuid("10000000-0000-0000-0000-000000000001,business_id=eq.2")).toBe(false);
      expect(isValidUuid("10000000000000000000000000000001")).toBe(false);
    });

    it("throws an error when businessId is not a valid UUID", () => {
      const { stubClient } = createStubClient();
      expect(() => {
        subscribeToOrderInserts(stubClient, "invalid-tenant-slug", {});
      }).toThrow(/not a valid UUID/);
    });
  });

  describe("Subscription setup & filter scoping", () => {
    it("subscribes to channel orders:business:${businessId} with INSERT event and business_id filter", async () => {
      const { stubClient, stubChannel, getOnEvent, getOnFilter } = createStubClient();
      const handlers = { onInsert: vi.fn(), onStatusChange: vi.fn() };

      const sub = subscribeToOrderInserts(stubClient, validUuid, handlers);
      await joined(stubChannel);

      expect(stubClient.channel).toHaveBeenCalledWith(`orders:business:${validUuid}`, {
        config: { postgres_changes_options: { wait: true } },
      });
      expect(stubChannel.on).toHaveBeenCalledTimes(1);
      expect(getOnEvent()).toBe("postgres_changes");
      expect(getOnFilter()).toEqual({
        event: "INSERT",
        schema: "public",
        table: "orders",
        filter: `business_id=eq.${validUuid}`,
      });
      expect(stubChannel.subscribe).toHaveBeenCalledTimes(1);
      expect(typeof sub.unsubscribe).toBe("function");
    });

    it("calls onInsert with orderId and row when INSERT event payload contains valid id", async () => {
      const { stubClient, stubChannel, triggerInsert } = createStubClient();
      const onInsert = vi.fn();
      subscribeToOrderInserts(stubClient, validUuid, { onInsert });
      await joined(stubChannel);

      triggerInsert({
        new: {
          id: "ord-test-123",
          business_id: validUuid,
          order_number: 42,
          status: "NEW",
          total_amount: 1500,
        },
      });

      expect(onInsert).toHaveBeenCalledTimes(1);
      expect(onInsert).toHaveBeenCalledWith("ord-test-123", {
        id: "ord-test-123",
        business_id: validUuid,
        order_number: 42,
        status: "NEW",
        total_amount: 1500,
      });
    });

    it("ignores INSERT event payload if row or id is missing", async () => {
      const { stubClient, stubChannel, triggerInsert } = createStubClient();
      const onInsert = vi.fn();
      subscribeToOrderInserts(stubClient, validUuid, { onInsert });
      await joined(stubChannel);

      triggerInsert({});
      triggerInsert({ new: {} });
      triggerInsert({ new: { business_id: validUuid } });

      expect(onInsert).not.toHaveBeenCalled();
    });
  });

  describe("Status callback forwarding & auth synchronization", () => {
    it("forwards SUBSCRIBED, CHANNEL_ERROR, TIMED_OUT, and CLOSED statuses to onStatusChange", async () => {
      const { stubClient, stubChannel, triggerStatus } = createStubClient();
      const onStatusChange = vi.fn();
      subscribeToOrderInserts(stubClient, validUuid, { onStatusChange });
      await joined(stubChannel);

      const statuses: RealtimeSubscriptionStatus[] = [
        "SUBSCRIBED",
        "CHANNEL_ERROR",
        "TIMED_OUT",
        "CLOSED",
      ];

      for (const status of statuses) {
        triggerStatus(status);
        expect(onStatusChange).toHaveBeenLastCalledWith(status, null);
      }
    });

    it("forwards errors to onStatusChange when subscription fails", async () => {
      const { stubClient, stubChannel, triggerStatus } = createStubClient();
      const onStatusChange = vi.fn();
      subscribeToOrderInserts(stubClient, validUuid, { onStatusChange });
      await joined(stubChannel);

      const testError = new Error("Connection failed");
      triggerStatus("CHANNEL_ERROR", testError);

      expect(onStatusChange).toHaveBeenCalledWith("CHANNEL_ERROR", testError);
    });

    it("sets auth token via client.realtime.setAuth on mount and auth state change", async () => {
      const { stubClient, stubChannel, triggerAuthChange } = createStubClient();
      subscribeToOrderInserts(stubClient, validUuid, {});
      await joined(stubChannel);
      expect(stubClient.realtime.setAuth).toHaveBeenCalledWith("initial-jwt-token");

      // Trigger token refresh
      triggerAuthChange({ access_token: "refreshed-jwt-token" });
      expect(stubClient.realtime.setAuth).toHaveBeenCalledWith("refreshed-jwt-token");
    });
  });

  describe("Join ordering (auth before subscribe)", () => {
    function deferred() {
      let resolve!: () => void;
      const promise = new Promise<void>((r) => {
        resolve = r;
      });
      return { promise, resolve };
    }

    it("does not create or subscribe the channel before setAuth resolves", async () => {
      const { stubClient, stubChannel } = createStubClient();
      const authGate = deferred();
      vi.mocked(stubClient.realtime.setAuth).mockImplementation(() => authGate.promise);
      const callOrder: string[] = [];
      vi.mocked(stubClient.realtime.setAuth).mockImplementationOnce(() => {
        callOrder.push("setAuth");
        return authGate.promise;
      });
      vi.mocked(stubClient.channel).mockImplementationOnce(() => {
        callOrder.push("channel");
        return stubChannel as never;
      });

      subscribeToOrderInserts(stubClient, validUuid, {});
      await vi.waitFor(() =>
        expect(stubClient.realtime.setAuth).toHaveBeenCalledWith("initial-jwt-token"),
      );

      // setAuth is pending: the channel must not have been joined yet
      expect(stubClient.channel).not.toHaveBeenCalled();
      expect(stubChannel.subscribe).not.toHaveBeenCalled();

      authGate.resolve();
      await joined(stubChannel);
      expect(callOrder).toEqual(["setAuth", "channel"]);
    });

    it("does not leak a channel when unsubscribed before auth is ready", async () => {
      const { stubClient, stubChannel, authUnsubscribe } = createStubClient();
      const authGate = deferred();
      vi.mocked(stubClient.realtime.setAuth).mockImplementation(() => authGate.promise);

      const sub = subscribeToOrderInserts(stubClient, validUuid, {});
      await vi.waitFor(() => expect(stubClient.realtime.setAuth).toHaveBeenCalled());

      await sub.unsubscribe();
      authGate.resolve();
      await authGate.promise;
      await Promise.resolve();

      expect(stubClient.channel).not.toHaveBeenCalled();
      expect(stubChannel.subscribe).not.toHaveBeenCalled();
      expect(stubClient.removeChannel).not.toHaveBeenCalled();
      expect(authUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it("still joins when getSession rejects and reports join failures as CHANNEL_ERROR", async () => {
      const { stubClient, stubChannel } = createStubClient();
      vi.mocked(stubClient.auth.getSession).mockRejectedValueOnce(new Error("storage locked"));
      const onStatusChange = vi.fn();

      subscribeToOrderInserts(stubClient, validUuid, { onStatusChange });
      await joined(stubChannel);
      expect(stubClient.realtime.setAuth).not.toHaveBeenCalled();

      const failing = createStubClient();
      const boom = new Error("channel factory failed");
      vi.mocked(failing.stubClient.channel).mockImplementationOnce(() => {
        throw boom;
      });
      const onFailStatus = vi.fn();
      subscribeToOrderInserts(failing.stubClient, validUuid, { onStatusChange: onFailStatus });
      await vi.waitFor(() => expect(onFailStatus).toHaveBeenCalledWith("CHANNEL_ERROR", boom));
    });
  });

  describe("Unsubscribe & teardown", () => {
    it("removes channel and unhooks auth listener on unsubscribe", async () => {
      const { stubClient, stubChannel, authUnsubscribe } = createStubClient();
      const sub = subscribeToOrderInserts(stubClient, validUuid, {});
      await joined(stubChannel);

      expect(stubClient.removeChannel).not.toHaveBeenCalled();
      expect(authUnsubscribe).not.toHaveBeenCalled();

      await sub.unsubscribe();

      expect(stubClient.removeChannel).toHaveBeenCalledWith(stubChannel);
      expect(authUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it("is idempotent when unsubscribe is called multiple times", async () => {
      const { stubClient, stubChannel } = createStubClient();
      const sub = subscribeToOrderInserts(stubClient, validUuid, {});
      await joined(stubChannel);

      await sub();
      await sub.unsubscribe();

      expect(stubClient.removeChannel).toHaveBeenCalledTimes(1);
      expect(stubClient.removeChannel).toHaveBeenCalledWith(stubChannel);
    });
  });
});
