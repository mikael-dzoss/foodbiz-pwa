import {
  LOOKUP_RATE_LIMIT_PHONE_MAX_REQUESTS,
  MAX_LINES_PER_ORDER,
  MAX_QUANTITY_PER_LINE,
  MAX_QUANTITY_PER_ORDER,
  RATE_LIMIT_PHONE_MAX_REQUESTS,
} from "@/domain/anti-abuse";
import { DAY_KEYS, type HoursException, type WeeklyHours } from "@/domain/opening-hours";
import { OrderRepoError, type PlaceOrderRepoInput } from "@/domain/order";
import { addCalendarDays, DEFAULT_TIMEZONE, getZonedDay } from "@/domain/timezone";
import type { Repositories } from "@/domain/repositories";
import { afterEach, describe, expect, it } from "vitest";

/** Sets the business's opening hours (the contract runs with anonymous repositories that cannot). */
export type OpeningHoursSetter = (hours: {
  weeklyHours: WeeklyHours | null;
  hoursExceptions: HoursException[];
}) => Promise<void>;

export interface OrderPlacementContractOptions {
  /**
   * Repositories of a manager of the business (able to create pickup locations); the relay-order
   * cases are skipped when omitted (the placement contract itself runs anonymously).
   */
  readonly managerRepositories?: () => Promise<Repositories> | Repositories;
  /** Required for the opening-hours cases; they are skipped when omitted. */
  readonly setOpeningHours?: OpeningHoursSetter;
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
  // A date relative to now in the business timezone, as place_order computes its window
  // (UTC dates can be a day behind it). Defaults to the demo timezone before settings are read.
  const today = (): string => getZonedDay(new Date(), DEFAULT_TIMEZONE);

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

    it("rejects an idempotency key replayed with a different cart", async () => {
      const repos = await getRepositories();
      const { productId, qty } = await pickOrderable(repos);
      const phone = freshPhone();
      const idempotencyKey = crypto.randomUUID();
      const before = await stockOf(repos, productId);
      await repos.orders.place(
        businessId,
        orderInput(phone, [{ productId, quantity: qty }], { idempotencyKey }),
      );

      // Same key and phone, different quantity: never reported as a success for an unplaced cart.
      await expectRejection(
        repos.orders.place(
          businessId,
          orderInput(phone, [{ productId, quantity: qty + 1 }], { idempotencyKey }),
        ),
        "INVALID_INPUT",
      );
      expect(await stockOf(repos, productId)).toBe((before ?? 0) - qty);
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

    describe.skipIf(!options.setOpeningHours)("opening-hours rules", () => {
      const ALL_DAY = [{ open: "00:00", close: "24:00" }];
      const weekdayKey = (day: string) =>
        DAY_KEYS[(new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7];
      const weekly = (
        overrides: Partial<
          Record<(typeof DAY_KEYS)[number], { open: string; close: string }[]>
        > = {},
        fallback: { open: string; close: string }[] = ALL_DAY,
      ): WeeklyHours => {
        const base = Object.fromEntries(DAY_KEYS.map((key) => [key, fallback])) as WeeklyHours;
        return { ...base, ...overrides };
      };
      const businessToday = async (repos: Repositories): Promise<string> => {
        const settings = await repos.business.getSettings(businessId);
        return getZonedDay(new Date(), settings?.timezone ?? DEFAULT_TIMEZONE);
      };
      // Leave the business without hours so other suites never depend on the time of day.
      afterEach(() => options.setOpeningHours?.({ weeklyHours: null, hoursExceptions: [] }));
      const setHours = (weeklyHours: WeeklyHours | null, hoursExceptions: HoursException[] = []) =>
        options.setOpeningHours!({ weeklyHours, hoursExceptions });

      it("accepts an ASAP order while the shop is open", async () => {
        const repos = await getRepositories();
        const { productId, qty } = await pickOrderable(repos);
        await setHours(weekly());
        const placed = await repos.orders.place(
          businessId,
          orderInput(freshPhone(), [{ productId, quantity: qty }], {
            requestedDate: await businessToday(repos),
            isAsap: true,
          }),
        );
        expect(placed.orderId).toBeDefined();
      });

      it("rejects an ASAP order while the shop is closed (closed_now)", async () => {
        const repos = await getRepositories();
        const { productId, qty } = await pickOrderable(repos);
        const before = await stockOf(repos, productId);
        await setHours(weekly({}, []));
        await expectRejection(
          repos.orders.place(
            businessId,
            orderInput(freshPhone(), [{ productId, quantity: qty }], {
              requestedDate: await businessToday(repos),
              isAsap: true,
            }),
          ),
          "SLOT_CLOSED_NOW",
        );
        expect(await stockOf(repos, productId)).toBe(before);
      });

      it("rejects a scheduled order on a closed weekday (closed_day)", async () => {
        const repos = await getRepositories();
        const { productId, qty } = await pickOrderable(repos);
        const tomorrow = addCalendarDays(await businessToday(repos), 1);
        await setHours(weekly({ [weekdayKey(tomorrow)]: [] }));
        await expectRejection(
          repos.orders.place(
            businessId,
            orderInput(freshPhone(), [{ productId, quantity: qty }], { requestedDate: tomorrow }),
          ),
          "SLOT_CLOSED_DAY",
        );
      });

      it("rejects a scheduled time outside the opening hours", async () => {
        const repos = await getRepositories();
        const { productId, qty } = await pickOrderable(repos);
        const tomorrow = addCalendarDays(await businessToday(repos), 1);
        await setHours(weekly({ [weekdayKey(tomorrow)]: [{ open: "08:00", close: "09:00" }] }));
        await expectRejection(
          repos.orders.place(
            businessId,
            orderInput(freshPhone(), [{ productId, quantity: qty }], {
              requestedDate: tomorrow,
              requestedTime: "12:00",
            }),
          ),
          "SLOT_TIME_OUTSIDE_HOURS",
        );
      });

      it("rejects a date outside [today, today + 30 days] (date_out_of_window)", async () => {
        const repos = await getRepositories();
        const { productId, qty } = await pickOrderable(repos);
        await setHours(weekly());
        const day = await businessToday(repos);
        for (const requestedDate of [addCalendarDays(day, -1), addCalendarDays(day, 31)]) {
          await expectRejection(
            repos.orders.place(
              businessId,
              orderInput(freshPhone(), [{ productId, quantity: qty }], { requestedDate }),
            ),
            "SLOT_DATE_OUT_OF_WINDOW",
          );
        }
      });

      it("applies only the date window when no opening hours are set", async () => {
        const repos = await getRepositories();
        const { productId, qty } = await pickOrderable(repos);
        await setHours(null);
        const placed = await repos.orders.place(
          businessId,
          orderInput(freshPhone(), [{ productId, quantity: qty }], {
            requestedDate: addCalendarDays(await businessToday(repos), 30),
          }),
        );
        expect(placed.orderId).toBeDefined();
      });
    });

    describe.skipIf(!options.managerRepositories)("pickup locations (#386)", () => {
      const createRelay = async (
        extra: {
          name?: string;
          feeCents?: number;
          isActive?: boolean;
          weeklyHours?: WeeklyHours | null;
        } = {},
      ) =>
        (await options.managerRepositories!()).pickupLocations.create(businessId, {
          name: "Contract Relay",
          address: "18 Rue de Dunkerque",
          postcode: "75010",
          feeCents: 150,
          ...extra,
        });
      const removeRelay = async (id: string) => {
        await (
          await options.managerRepositories!()
        ).pickupLocations
          .delete(businessId, id)
          .catch(() => undefined);
      };

      it("stores the relay and its fee, and tracking shows where to collect (relay and shop)", async () => {
        const repos = await getRepositories();
        const manager = await options.managerRepositories!();
        const { productId, qty } = await pickOrderable(repos);
        const price = (await repos.products.findById(businessId, productId))?.price ?? 0;
        const relay = await createRelay();
        try {
          const placed = await repos.orders.place(
            businessId,
            orderInput(freshPhone(), [{ productId, quantity: qty }], {
              pickupLocationId: relay.id,
            }),
          );
          expect(placed.totalAmount).toBe(price * qty + 150);
          const stored = await manager.orders.findById(businessId, placed.orderId);
          expect(stored?.pickupFeeCents).toBe(150);
          expect(stored?.pickupLocation).toEqual({
            id: relay.id,
            name: "Contract Relay",
            address: "18 Rue de Dunkerque, 75010",
          });
          const tracked = await repos.orders.findByTrackingToken(placed.trackingToken);
          expect(tracked?.pickupLocation).toEqual({
            name: "Contract Relay",
            address: "18 Rue de Dunkerque, 75010",
          });

          const shopPlaced = await repos.orders.place(
            businessId,
            orderInput(freshPhone(), [{ productId, quantity: qty }]),
          );
          const biz = await manager.business.findById(businessId);
          const shopTracked = await repos.orders.findByTrackingToken(shopPlaced.trackingToken);
          expect(shopTracked?.pickupLocation).toEqual({
            name: null,
            address: biz?.address?.trim() || null,
          });
        } finally {
          await removeRelay(relay.id);
        }
      });

      it("rejects an unknown or inactive location without touching stock", async () => {
        const repos = await getRepositories();
        const { productId, qty } = await pickOrderable(repos);
        const before = await stockOf(repos, productId);
        const inactive = await createRelay({ isActive: false });
        try {
          for (const pickupLocationId of [crypto.randomUUID(), inactive.id]) {
            await expectRejection(
              repos.orders.place(
                businessId,
                orderInput(freshPhone(), [{ productId, quantity: qty }], { pickupLocationId }),
              ),
              "PICKUP_LOCATION_INVALID",
            );
          }
          expect(await stockOf(repos, productId)).toBe(before);
        } finally {
          await removeRelay(inactive.id);
        }
      });

      it("rejects a location on a delivery order", async () => {
        const repos = await getRepositories();
        const { productId, qty } = await pickOrderable(repos);
        const relay = await createRelay();
        try {
          await expectRejection(
            repos.orders.place(
              businessId,
              orderInput(freshPhone(), [{ productId, quantity: qty }], {
                serviceType: "delivery",
                deliveryAddress: "12 Rue de Rivoli, 75001 Paris",
                pickupLocationId: relay.id,
              }),
            ),
            "PICKUP_LOCATION_INVALID",
          );
        } finally {
          await removeRelay(relay.id);
        }
      });

      it("requires a choice when several relays are offered without shop pickup, and auto-selects a lone relay", async () => {
        const repos = await getRepositories();
        const manager = await options.managerRepositories!();
        const { productId, qty } = await pickOrderable(repos);
        const price = (await repos.products.findById(businessId, productId))?.price ?? 0;
        const relayA = await createRelay({ name: "Relay A", feeCents: 150 });
        const relayB = await createRelay({ name: "Relay B", feeCents: 200 });
        try {
          await manager.business.updateSettings(businessId, { shopPickupEnabled: false });

          await expectRejection(
            repos.orders.place(
              businessId,
              orderInput(freshPhone(), [{ productId, quantity: qty }]),
            ),
            "PICKUP_LOCATION_REQUIRED",
          );

          await removeRelay(relayB.id);
          const auto = await repos.orders.place(
            businessId,
            orderInput(freshPhone(), [{ productId, quantity: qty }]),
          );
          expect(auto.totalAmount).toBe(price * qty + 150);
          const stored = await manager.orders.findById(businessId, auto.orderId);
          expect(stored?.pickupLocation?.id).toBe(relayA.id);
        } finally {
          await manager.business.updateSettings(businessId, { shopPickupEnabled: true });
          await removeRelay(relayA.id);
          await removeRelay(relayB.id);
        }
      });

      it("includes pickupLocationId in the idempotency payload", async () => {
        const repos = await getRepositories();
        const { productId, qty } = await pickOrderable(repos);
        const relay = await createRelay();
        const phone = freshPhone();
        const idempotencyKey = crypto.randomUUID();
        try {
          const first = await repos.orders.place(
            businessId,
            orderInput(phone, [{ productId, quantity: qty }], {
              idempotencyKey,
              pickupLocationId: relay.id,
            }),
          );
          const replay = await repos.orders.place(
            businessId,
            orderInput(phone, [{ productId, quantity: qty }], {
              idempotencyKey,
              pickupLocationId: relay.id,
            }),
          );
          expect(replay.orderId).toBe(first.orderId);
          expect(replay.replayed).toBe(true);

          await expectRejection(
            repos.orders.place(
              businessId,
              orderInput(phone, [{ productId, quantity: qty }], { idempotencyKey }),
            ),
            "INVALID_INPUT",
          );
        } finally {
          await removeRelay(relay.id);
        }
      });

      it.skipIf(!options.setOpeningHours)(
        "enforces relay hours and business closures on relay slots",
        async () => {
          const repos = await getRepositories();
          const { productId, qty } = await pickOrderable(repos);
          const settings = await repos.business.getSettings(businessId);
          const businessToday = getZonedDay(new Date(), settings?.timezone ?? DEFAULT_TIMEZONE);
          const tomorrow = addCalendarDays(businessToday, 1);
          const tomorrowKey = DAY_KEYS[(new Date(`${tomorrow}T12:00:00Z`).getUTCDay() + 6) % 7];
          const allDay = [{ open: "00:00", close: "24:00" }];
          const makeWeek = (
            override: Partial<
              Record<(typeof DAY_KEYS)[number], { open: string; close: string }[]>
            > = {},
          ): WeeklyHours => ({
            ...(Object.fromEntries(DAY_KEYS.map((k) => [k, allDay])) as WeeklyHours),
            ...override,
          });

          const closedRelay = await createRelay({
            name: "Closed Tomorrow Relay",
            weeklyHours: makeWeek({ [tomorrowKey]: [] }),
          });
          const openRelay = await createRelay({
            name: "Open Relay",
            weeklyHours: makeWeek(),
          });
          try {
            await options.setOpeningHours!({ weeklyHours: makeWeek(), hoursExceptions: [] });
            await expectRejection(
              repos.orders.place(
                businessId,
                orderInput(freshPhone(), [{ productId, quantity: qty }], {
                  requestedDate: tomorrow,
                  pickupLocationId: closedRelay.id,
                }),
              ),
              "SLOT_CLOSED_DAY",
            );

            await options.setOpeningHours!({
              weeklyHours: makeWeek({ [tomorrowKey]: [] }),
              hoursExceptions: [],
            });
            await expectRejection(
              repos.orders.place(
                businessId,
                orderInput(freshPhone(), [{ productId, quantity: qty }], {
                  requestedDate: tomorrow,
                  pickupLocationId: openRelay.id,
                }),
              ),
              "SLOT_CLOSED_DAY",
            );
          } finally {
            await options.setOpeningHours!({ weeklyHours: null, hoursExceptions: [] });
            await removeRelay(closedRelay.id);
            await removeRelay(openRelay.id);
          }
        },
      );
    });
  });
}
