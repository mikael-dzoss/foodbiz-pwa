import type { Business, BusinessMember, BusinessMemberRole, BusinessSettings } from "../business";
import type { ProductQuantity, ProductQuantityFilter } from "../featured";
import type { Expense } from "../expense";
import type { Guest } from "../guest";
import type {
  CancelOrderResult,
  Order,
  OrderPaymentInput,
  OrderStatus,
  OrderStatusTransitionInput,
  PlaceOrderRepoInput,
  PlacedOrderSummary,
  PublicOrder,
  ReplaceOrderItemInput,
} from "../order";
import type { Product, ProductCategory } from "../product";

export type { CancelOrderResult, PlaceOrderRepoInput, PlacedOrderSummary } from "../order";
export { OrderRepoError } from "../order";

export interface CreateProductInput {
  readonly id?: string;
  readonly categoryId: string;
  readonly name: string;
  readonly description?: string | null;
  readonly price: number;
  readonly unitCost?: number;
  readonly stock?: number;
  readonly visible?: boolean;
  readonly allergens?: Product["allergens"];
  readonly suggestAddOns?: boolean;
  readonly imageUrl?: string | null;
}

export type UpdateProductInput = Partial<Omit<CreateProductInput, "id">>;

export interface ProductFilter {
  readonly categoryId?: string;
  readonly visibleOnly?: boolean;
}

export interface ProductRepository {
  findById(businessId: string, id: string): Promise<Product | null>;
  list(businessId: string, filter?: ProductFilter): Promise<Product[]>;
  create(businessId: string, input: CreateProductInput): Promise<Product>;
  update(businessId: string, id: string, input: UpdateProductInput): Promise<Product>;
  softDelete(businessId: string, id: string): Promise<Product>;
}

export interface CreateCategoryInput {
  readonly id?: string;
  readonly name: string;
  readonly sortOrder?: number;
  readonly role?: ProductCategory["role"];
}

export type UpdateCategoryInput = Partial<Omit<CreateCategoryInput, "id">>;

export interface CategoryRepository {
  findById(businessId: string, id: string): Promise<ProductCategory | null>;
  list(businessId: string): Promise<ProductCategory[]>;
  create(businessId: string, input: CreateCategoryInput): Promise<ProductCategory>;
  update(businessId: string, id: string, input: UpdateCategoryInput): Promise<ProductCategory>;
  delete(businessId: string, id: string): Promise<void>;
}

export interface OrderFilter {
  readonly status?: OrderStatus;
  readonly guestId?: string;
  readonly fromDate?: string;
  readonly toDate?: string;
}

export interface OrderRepository {
  /** Public aggregate-only read; always excludes cancelled/refunded orders. Inclusive createdAt bounds. */
  sumQuantitiesByProduct(
    businessId: string,
    filter: ProductQuantityFilter,
  ): Promise<ProductQuantity[]>;
  findById(businessId: string, id: string): Promise<Order | null>;
  findByTrackingToken(trackingToken: string): Promise<PublicOrder | null>;
  /** Public lookup (#230): returns only the tracking token when ticket n° and guest phone match. */
  findTrackingTokenByTicketAndPhone(
    businessId: string,
    orderNumber: number,
    phone: string,
  ): Promise<string | null>;
  list(businessId: string, filter?: OrderFilter): Promise<Order[]>;
  /** Atomically validates stock, decrements stock, resolves guest, and places the order. */
  place(businessId: string, input: PlaceOrderRepoInput): Promise<PlacedOrderSummary>;
  /** Atomically cancels an order, restores product inventory stock and records the history entry. */
  cancel(businessId: string, orderId: string, reason?: string | null): Promise<CancelOrderResult>;
  /**
   * Moves an order along the lifecycle (`ALLOWED_ORDER_TRANSITIONS`), appending to its history in the
   * same step. Throws `OrderRepoError` `ORDER_STATE_CONFLICT` when the current status is not
   * `expectedStatus`, `INVALID_INPUT` when the transition or its preconditions are not allowed.
   */
  transition(
    businessId: string,
    orderId: string,
    input: OrderStatusTransitionInput,
  ): Promise<Order>;
  /** Records payment (never on a cancelled or refunded order); `markCompleted` also completes a READY order. */
  recordPayment(businessId: string, orderId: string, input: OrderPaymentInput): Promise<Order>;
  /** Undoes a payment (not on a completed, refunded or unpaid order). */
  markUnpaid(businessId: string, orderId: string): Promise<Order>;
  /** Refunds a paid order. */
  recordRefund(businessId: string, orderId: string, reason?: string | null): Promise<Order>;
  /**
   * Replaces the order lines. Names and prices come from the catalog (existing lines keep their
   * snapshot), stock moves by the delta and the order total is recomputed. Refused once the order is
   * completed, cancelled or refunded.
   */
  replaceItems(
    businessId: string,
    orderId: string,
    items: readonly ReplaceOrderItemInput[],
  ): Promise<Order>;
}

export interface CreateGuestInput {
  readonly id?: string;
  readonly name: string;
  readonly phone?: string | null;
  readonly email?: string | null;
  readonly address?: string | null;
  readonly notes?: string | null;
}

export type UpdateGuestInput = Partial<Omit<CreateGuestInput, "id">>;

export interface GuestRepository {
  findById(businessId: string, id: string): Promise<Guest | null>;
  findByPhone(businessId: string, phone: string): Promise<Guest | null>;
  list(businessId: string): Promise<Guest[]>;
  create(businessId: string, input: CreateGuestInput): Promise<Guest>;
  update(businessId: string, id: string, input: UpdateGuestInput): Promise<Guest>;
}

export interface CreateExpenseInput {
  readonly id?: string;
  readonly amount: number;
  readonly date: string;
  readonly description: string;
  readonly tags?: string[];
}

export type UpdateExpenseInput = Partial<Omit<CreateExpenseInput, "id">>;

export interface ExpenseFilter {
  readonly tag?: string;
  readonly fromDate?: string;
  readonly toDate?: string;
}

export interface ExpenseRepository {
  findById(businessId: string, id: string): Promise<Expense | null>;
  list(businessId: string, filter?: ExpenseFilter): Promise<Expense[]>;
  create(businessId: string, input: CreateExpenseInput): Promise<Expense>;
  update(businessId: string, id: string, input: UpdateExpenseInput): Promise<Expense>;
  delete(businessId: string, id: string): Promise<void>;
}

export interface CreateBusinessInput {
  readonly id?: string;
  readonly name: string;
  readonly slug: string;
  readonly currency?: Business["currency"];
  readonly description?: string;
  readonly phone?: string;
  readonly email?: string;
  readonly whatsappNumber?: string;
  readonly instagramUrl?: string;
  readonly facebookUrl?: string;
  readonly tiktokUrl?: string;
  readonly address?: string;
  readonly latitude?: number | null;
  readonly longitude?: number | null;
  readonly logoUrl?: string | null;
}

export type UpdateBusinessInput = Partial<Omit<CreateBusinessInput, "id">>;

export type UpdateSettingsInput = Partial<Omit<BusinessSettings, "businessId" | "id">>;

export interface BusinessRepository {
  findById(id: string): Promise<Business | null>;
  findBySlug(slug: string): Promise<Business | null>;
  create(input: CreateBusinessInput): Promise<Business>;
  update(id: string, input: UpdateBusinessInput): Promise<Business>;
  getSettings(businessId: string): Promise<BusinessSettings | null>;
  updateSettings(businessId: string, input: UpdateSettingsInput): Promise<BusinessSettings>;
}

export interface CreateMemberInput {
  readonly id?: string;
  readonly userId: string;
  readonly role: BusinessMemberRole;
}

export interface UserMembershipSummary {
  readonly member: {
    readonly id: string;
    readonly businessId: string;
    readonly role: BusinessMemberRole;
  };
  readonly business: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly currency: "EUR";
  };
}

export interface MemberRepository {
  list(businessId: string): Promise<BusinessMember[]>;
  findById(businessId: string, id: string): Promise<BusinessMember | null>;
  findByUserId(businessId: string, userId: string): Promise<BusinessMember | null>;
  /**
   * Deterministically finds the earliest created membership and business summary for a user.
   * Single-business-per-user assumption: FoodBiz currently models exactly one active business per manager.
   * If a user has multiple memberships, ordered by created_at asc, id asc to deterministically select the oldest.
   */
  findMembershipForUser(userId: string): Promise<UserMembershipSummary | null>;
  add(businessId: string, input: CreateMemberInput): Promise<BusinessMember>;
  updateRole(businessId: string, id: string, role: BusinessMemberRole): Promise<BusinessMember>;
  remove(businessId: string, id: string): Promise<void>;
}

export interface Repositories {
  readonly products: ProductRepository;
  readonly categories: CategoryRepository;
  readonly orders: OrderRepository;
  readonly guests: GuestRepository;
  readonly expenses: ExpenseRepository;
  readonly business: BusinessRepository;
  readonly members: MemberRepository;
}
