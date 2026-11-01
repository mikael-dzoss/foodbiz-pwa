import type { Business, BusinessMember, BusinessMemberRole, BusinessSettings } from "../business";
import type { ProductQuantity, ProductQuantityFilter } from "../featured";
import type { Expense } from "../expense";
import type { FindOrCreateGuestResult, Guest } from "../guest";
import type { Order, OrderStatus, PublicOrder } from "../order";
import type { Product, ProductCategory } from "../product";

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

export interface CreateOrderInput {
  readonly id?: string;
  readonly orderNumber?: number;
  readonly guestId: string;
  readonly submittedName?: string | null;
  readonly serviceType: Order["serviceType"];
  readonly channel: Order["channel"];
  readonly status: OrderStatus;
  readonly paid: Order["paid"];
  readonly paymentPreference: Order["paymentPreference"];
  readonly paymentMethod?: Order["paymentMethod"];
  readonly paidAt?: string | null;
  readonly refundedAt?: string | null;
  readonly requestedDate: string;
  readonly requestedTime?: string | null;
  readonly items: Order["items"];
  readonly totalAmount: number;
  readonly trackingToken?: string;
  readonly cancellationReason?: string | null;
  readonly notes?: string | null;
  readonly deliveryAddress?: string | null;
  readonly statusHistory?: Order["statusHistory"];
}

export type UpdateOrderInput = Partial<Omit<CreateOrderInput, "id">>;

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
  findByTicketAndPhone(
    businessId: string,
    orderNumber: number,
    phone: string,
  ): Promise<PublicOrder | null>;
  list(businessId: string, filter?: OrderFilter): Promise<Order[]>;
  create(businessId: string, input: CreateOrderInput): Promise<Order>;
  update(businessId: string, id: string, input: UpdateOrderInput): Promise<Order>;
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

export interface FindOrCreateGuestRepoInput {
  readonly name: string;
  readonly phone: string;
  /** Used only when a new guest is created; never overwrites a matched guest. */
  readonly address?: string | null;
  /** Overwrite a matched guest's stored name. Authenticated managers only, on explicit intent. */
  readonly allowRename?: boolean;
}

export interface GuestRepository {
  findById(businessId: string, id: string): Promise<Guest | null>;
  findByPhone(businessId: string, phone: string): Promise<Guest | null>;
  list(businessId: string): Promise<Guest[]>;
  create(businessId: string, input: CreateGuestInput): Promise<Guest>;
  update(businessId: string, id: string, input: UpdateGuestInput): Promise<Guest>;
  /** Blind find-or-create by (businessId, normalised phone); never returns stored guest data. */
  findOrCreate(
    businessId: string,
    input: FindOrCreateGuestRepoInput,
  ): Promise<FindOrCreateGuestResult>;
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

export interface MemberRepository {
  list(businessId: string): Promise<BusinessMember[]>;
  findById(businessId: string, id: string): Promise<BusinessMember | null>;
  findByUserId(businessId: string, userId: string): Promise<BusinessMember | null>;
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
