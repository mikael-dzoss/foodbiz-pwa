import {
  LOOKUP_RATE_LIMIT_PHONE_MAX_REQUESTS,
  MAX_LINES_PER_ORDER,
  MAX_QUANTITY_PER_LINE,
  MAX_QUANTITY_PER_ORDER,
  RATE_LIMIT_PHONE_MAX_REQUESTS,
} from "@/domain/anti-abuse";
import { OrderRepoError, type PlaceOrderRepoInput } from "@/domain/order";
import type { Repositories } from "@/domain/repositories";
import { describe, expect, it } from "vitest";

export interface OrderPlacementContractOptions {
  /**
   * A visible product with at least MAX_QUANTITY_PER_LINE + 1 units in stock. When given, the
   * suite also proves the exact boundary is accepted (live database only: the mock fixtures
   * hold fewer units).
   */
  readonly boundaryProductId?: () => string;
}

/**
 * Storefront placement guarantees that the database enforces inside `place_order` (callers can
 * reach the RPC directly with the public key, bypassing every app-level check): idempotent
 * replay, quantity/line caps and the per-phone rate limit. The numbers come from
 * src/domain/anti-abuse.ts, so this suite fails when the database and the domain constants
 * diverge. Run it with anonymous (publicOnly) repositories: members are exempt from rate limits.
 */
export function describeOrderPlacementContract(
  getRepositories: () => Promise<Repositories> | Repositories,
  businessId: string,
  options: OrderPlacementContractOptions = {},
): void {
  const freshPhone = (): string =>
    `+3367${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
  const today = (): string => new Date().toISOString().slice(0, 10);

  const orderInput = (
    phone: string,
    items: PlaceOrderRepoInput["items"],
    extra: Partial<PlaceOrderRepoInput> = {},
  ): PlaceOrderRepoInput => ({
    guestName: "Contract Customer",
    guestPhone: phone,
    serviceType: "pickup",
    channel: "storefront",
    requestedDate: today(),
    items,
    paymentPreference: "on_handover",
    ...extra,
  });

  const stockOf = async (repos: Repositories, productId: string): Promise<number | undefined> =>
    (await repos.products.findById(businessId, productId))?.stock;

  const visibleProductIds = async (repos: Repositories): Promise<string[]> =>
    (await repos.products.list(businessId, { visibleOnly: true })).map((p) => p.id);

  /** The visible product that lets us place the most orders that satisfy the minimum order amount. */
  const pickOrderable = async (
    repos: Repositories,
  ): Promise<{ productId: string; qty: number }> => {
    const minOrder = (await repos.business.getSettings(businessId))?.minOrderAmount ?? 0;
    const ranked = (await repos.products.list(businessId, { visibleOnly: true }))
      .filter((p) => p.price > 0)
      .map((p) => {
        const qty = Math.max(1, Math.ceil(minOrder / p.price));
        return { productId: p.id, qty, ratio: p.stock / qty };
      })
      .toSorted((a, b) => b.ratio - a.ratio);
    return { productId: ranked[0].productId, qty: ranked[0].qty };
  };

  const expectRejection = async (promise: Promise<unknown>, code: string): Promise<void> => {
    const error = await promise.then(
      () => null,
      (err: unknown) => err,
    );
    expect(error).toBeInstanceOf(OrderRepoError);
    expect((error as OrderRepoError).code).toBe(code);
  };

  describe("OrderRepository storefront placement contract", () => {
    it("returns the original order for a repeated idempotency key and reserves stock once", async () => {
      const repos = await getRepositories();
      const { productId, qty } = await pickOrderable(repos);
      const before = await stockOf(repos, productId);
      const phone = freshPhone();
      const input = orderInput(phone, [{ productId, quantity: qty * 2 }], {
        idempotencyKey: crypto.randomUUID(),
      });

      const first = await repos.orders.place(businessId, input);
      const second = await repos.orders.place(businessId, input);

      expect(second.orderId).toBe(first.orderId);
      expect(second.orderNumber).toBe(first.orderNumber);
      expect(second.trackingToken).toBe(first.trackingToken);
      expect(second.totalAmount).toBe(first.totalAmount);
      expect(first.replayed).toBe(false);
      expect(second.replayed).toBe(true);
      expect(await stockOf(repos, productId)).toBe((before ?? 0) - qty * 2);
    });

    it("rejects an idempotency key replayed with a different phone", async () => {
      const repos = await getRepositories();
      const { productId, qty } = await pickOrderable(repos);
      const idempotencyKey = crypto.randomUUID();
      await repos.orders.place(
        businessId,
        orderInput(freshPhone(), [{ productId, quantity: qty }], { idempotencyKey }),
      );

      await expectRejection(
        repos.orders.place(
          businessId,
          orderInput(freshPhone(), [{ productId, quantity: qty }], { idempotencyKey }),
        ),
        "INVALID_INPUT",
      );
    });

    it(`rejects a line above MAX_QUANTITY_PER_LINE (${MAX_QUANTITY_PER_LINE}) and keeps stock`, async () => {
      const repos = await getRepositories();
      const [productId] = await visibleProductIds(repos);
      const before = await stockOf(repos, productId);

      await expectRejection(
        repos.orders.place(
          businessId,
          orderInput(freshPhone(), [{ productId, quantity: MAX_QUANTITY_PER_LINE + 1 }]),
        ),
        "ANTI_ABUSE_REJECTION",
      );
      // Duplicate lines are merged before the cap, so they cannot be used to dodge it.
      await expectRejection(
        repos.orders.place(
          businessId,
          orderInput(freshPhone(), [
            { productId, quantity: MAX_QUANTITY_PER_LINE },
            { productId, quantity: 1 },
          ]),
        ),
        "ANTI_ABUSE_REJECTION",
      );
      expect(await stockOf(repos, productId)).toBe(before);
    });

    it(`rejects a total above MAX_QUANTITY_PER_ORDER (${MAX_QUANTITY_PER_ORDER}) and keeps stock`, async () => {
      const repos = await getRepositories();
      const [a, b, c] = await visibleProductIds(repos);
      const before = await stockOf(repos, a);

      await expectRejection(
        repos.orders.place(
          businessId,
          orderInput(freshPhone(), [
            { productId: a, quantity: MAX_QUANTITY_PER_LINE },
            { productId: b, quantity: MAX_QUANTITY_PER_LINE },
            { productId: c, quantity: MAX_QUANTITY_PER_ORDER - 2 * MAX_QUANTITY_PER_LINE + 1 },
          ]),
        ),
        "ANTI_ABUSE_REJECTION",
      );
      expect(await stockOf(repos, a)).toBe(before);
    });

    it(`rejects more than MAX_LINES_PER_ORDER (${MAX_LINES_PER_ORDER}) lines`, async () => {
      const repos = await getRepositories();
      const [productId] = await visibleProductIds(repos);

      await expectRejection(
        repos.orders.place(
          businessId,
          orderInput(
            freshPhone(),
            Array.from({ length: MAX_LINES_PER_ORDER + 1 }, () => ({ productId, quantity: 1 })),
          ),
        ),
        "ANTI_ABUSE_REJECTION",
      );
    });

    it(`allows ${RATE_LIMIT_PHONE_MAX_REQUESTS} orders per phone per window, then refuses without side effects`, async () => {
      const repos = await getRepositories();
      const { productId, qty } = await pickOrderable(repos);
      const before = await stockOf(repos, productId);
      const phone = freshPhone();

      for (let i = 0; i < RATE_LIMIT_PHONE_MAX_REQUESTS; i++) {
        await repos.orders.place(businessId, orderInput(phone, [{ productId, quantity: qty }]));
      }
      await expectRejection(
        repos.orders.place(businessId, orderInput(phone, [{ productId, quantity: qty }])),
        "ANTI_ABUSE_REJECTION",
      );

      expect(await stockOf(repos, productId)).toBe(
        (before ?? 0) - RATE_LIMIT_PHONE_MAX_REQUESTS * qty,
      );
      // Another phone is not affected.
      await repos.orders.place(
        businessId,
        orderInput(freshPhone(), [{ productId, quantity: qty }]),
      );
    });

    it(`refuses an order lookup after ${LOOKUP_RATE_LIMIT_PHONE_MAX_REQUESTS} failed attempts for a phone`, async () => {
      const repos = await getRepositories();
      const { productId, qty } = await pickOrderable(repos);
      const phone = freshPhone();
      const placed = await repos.orders.place(
        businessId,
        orderInput(phone, [{ productId, quantity: qty }]),
      );
      expect(
        await repos.orders.findTrackingTokenByTicketAndPhone(businessId, placed.orderNumber, phone),
      ).toBe(placed.trackingToken);

      for (let i = 0; i < LOOKUP_RATE_LIMIT_PHONE_MAX_REQUESTS; i++) {
        expect(
          await repos.orders.findTrackingTokenByTicketAndPhone(businessId, 900_000 + i, phone),
        ).toBeNull();
      }
      // Limited whether or not the order exists: the answer is not an oracle.
      await expectRejection(
        repos.orders.findTrackingTokenByTicketAndPhone(businessId, 900_000, phone),
        "RATE_LIMITED",
      );
      await expectRejection(
        repos.orders.findTrackingTokenByTicketAndPhone(businessId, placed.orderNumber, phone),
        "RATE_LIMITED",
      );
    });

    if (options.boundaryProductId) {
      const boundaryProductId = (): string => options.boundaryProductId!();

      it(`accepts exactly MAX_QUANTITY_PER_LINE (${MAX_QUANTITY_PER_LINE}) on one line`, async () => {
        const repos = await getRepositories();
        const before = await stockOf(repos, boundaryProductId());

        await repos.orders.place(
          businessId,
          orderInput(freshPhone(), [
            { productId: boundaryProductId(), quantity: MAX_QUANTITY_PER_LINE },
          ]),
        );

        expect(await stockOf(repos, boundaryProductId())).toBe(
          (before ?? 0) - MAX_QUANTITY_PER_LINE,
        );
      });

      it(`accepts exactly MAX_LINES_PER_ORDER (${MAX_LINES_PER_ORDER}) lines`, async () => {
        const repos = await getRepositories();
        const before = await stockOf(repos, boundaryProductId());
        // 50 lines of one unit merge to 50 units: within every cap, so only the line count is probed.
        await repos.orders.place(
          businessId,
          orderInput(
            freshPhone(),
            Array.from({ length: MAX_LINES_PER_ORDER }, () => ({
              productId: boundaryProductId(),
              quantity: 1,
            })),
          ),
        );
        expect(await stockOf(repos, boundaryProductId())).toBe((before ?? 0) - MAX_LINES_PER_ORDER);
      });
    }
  });
}
