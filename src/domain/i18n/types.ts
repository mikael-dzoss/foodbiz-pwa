import type { Allergen } from "@/domain/allergen";
import type { CategoryRole } from "@/domain/category";

export const SUPPORTED_LOCALES = ["en", "fr"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = "en";

export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale);
}

export interface NavigationDictionary {
  dashboard: string;
  orders: string;
  add: string;
  products: string;
  expenses: string;
  customers: string;
  analytics: string;
  settings: string;
  more: string;
}

export interface StorefrontDictionary {
  cart: string;
  cartEmpty: string;
  item: string;
  items: string;
  switchLanguage: string;
  contact: string;
  legal: string;
  terms: string;
  privacy: string;
  openHours: string;

  // Catalog & Navigation (#80, #200, #203, #204)
  featuredItems: string;
  mostOrdered: string;
  allCategories: string;
  menu: string;
  dismiss: string;
  browseCategories: string;
  searchMenu: string;
  searchPlaceholder: string;
  clearSearch: string;
  closeSearch: string;
  searchInitialHint: string;
  searchResultSingular: string;
  searchResultPlural: string;
  searchNoResultsFor: string;
  noProductsFound: string;
  noProductsInCategory: string;
  addToCart: string;
  addedToCart: string;
  viewCart: string;
  backToCatalog: string;

  // Availability & Status (#82)
  inStock: string;
  lowStock: string;
  unitsLeft: string;
  outOfStock: string;
  storeClosedBanner: string;
  notAcceptingOrdersBanner: string;
  storeOpenBadge: string;
  storeClosedBadge: string;
  scheduledOnlyNotice: string;
  openAcceptingOrders: string;
  closedOrdersQueued: string;
  closesAt: string;
  opensAt: string;
  orderReadyTime: string;
  pickupReadyTime: string;
  pickupAndDelivery: string;
  deliveryToggleLabel: string;
  pickupToggleLabel: string;
  noFees: string;
  deliveryFeeShort: string;
  minOrderShort: string;
  notAcceptingOrdersShort: string;
  pickupUnavailableToast: string;
  deliveryUnavailableToast: string;

  // Product Detail (#81, #202, #206, #207)
  productNotFound: string;
  productUnavailable: string;
  quantity: string;
  total: string;
  cooksRecommendation: string;
  cooksTip: string;
  perPiece: string;
  freshlyPreparedToday: string;
  addQuantityToCart: string;
  addOnsDrinksTitle: string;
  addOnsAccompanimentsTitle: string;
  addOnsSubtitle: string;
  addOnsOptionalBadge: string;

  // Shop Information (#83)
  shopInfo: string;
  storeInfo: string;
  aboutBadge: string;
  services: string;
  address: string;
  chatOnWhatsApp: string;
  fastReply: string;
  callShop: string;
  emailShop: string;
  getDirections: string;
  servicePickup: string;
  serviceDelivery: string;
  serviceDineIn: string;
  serviceAvailable: string;
  serviceFree: string;
  servicePaid: string;
  minimumOrder: string;
  deliveryFee: string;
  freeDelivery: string;
  weeklyOpeningHours: string;
  holidayScheduleTitle: string;
  holidayScheduleNotice: string;
  deliveryPolicy: string;
  acceptedPayments: string;
  cashOnPickup: string;
  today: string;
  returnToCatalog: string;
  share: string;
  allRightsReserved: string;
  socialOnInstagram: string;
  socialOnFacebook: string;
  socialOnTikTok: string;
  bakeryInfo: string;
  mapEmbedTitle: string;
  osmAttribution: string;

  // Cart (#85)
  yourCart: string;
  proceedToCheckout: string;
  clearCart: string;
  emptyCartTitle: string;
  emptyCartMessage: string;
  minimumOrderProgress: string;
  minimumOrderReached: string;
  addMoreForMinimum: string;
  maxStockReached: string;
  subtotal: string;
  estimatedTax: string;
  orderTotal: string;
  discountCode: string;
  haveVoucher: string;
  applyDiscount: string;
  voucherUnavailableNotice: string;
  soon: string;
  addKitchenNote: string;
  orderThresholdNotice: string;

  // Checkout (#86)
  checkoutTitle: string;
  guestCheckoutBadge: string;
  customerContact: string;
  guestModeBadge: string;
  fullName: string;
  fullNamePlaceholder: string;
  phone: string;
  phonePlaceholder: string;
  phoneHelper: string;
  savedNameNotice: string;
  editName: string;
  fulfillmentMode: string;
  pickupFree: string;
  deliveryPaid: string;
  pickupLocation: string;
  inStore: string;
  pickupExpressNotice: string;
  deliveryAddress: string;
  deliveryAddressPlaceholder: string;
  orderTiming: string;
  asap: string;
  asapEstimatedReady: string;
  recommended: string;
  scheduleLater: string;
  scheduleLaterSubtext: string;
  selectDateTime: string;
  scheduledDate: string;
  scheduledTime: string;
  optionalTime: string;
  paymentMethod: string;
  secured: string;
  revolutPay: string;
  revolutSubtext: string;
  weroPay: string;
  weroSubtext: string;
  payOnHandover: string;
  payOnHandoverSubtext: string;
  cashBadge: string;
  contactlessBadge: string;
  orderNotes: string;
  notesPlaceholder: string;
  orderSummary: string;
  placeOrder: string;
  placingOrder: string;
  securityNotice: string;
  orderPolicyNotice: string;
  pickupPolicyNotice: string;
  orderPlacedTitle: string;
  redirectingToTracking: string;
  viewConfirmation: string;
  trackOrder: string;
  nameRequiredError: string;
  phoneRequiredError: string;
  addressRequiredError: string;
  dateRequiredError: string;
}

export interface QuickAddDictionary {
  title: string;
  description: string;
  newOrder: string;
  newProduct: string;
  newExpense: string;
}

export interface DashboardDictionary {
  title: string;
  subtitle: string;
  activeStatus: string;
  periods: {
    today: string;
    last_7_days: string;
    last_30_days: string;
    this_month: string;
  };
  kpi: {
    revenue: string;
    costs: string;
    profit: string;
    orders: string;
    averageOrderValue: string;
    vsPreviousPeriod: string;
    vsYesterday: string;
  };
  triage: {
    sectionTitle: string;
    realtimeAlerts: string;
    toPrepare: string;
    toPrepareCount: string;
    viewAllPrepOrders: string;
    noOrdersToPrepare: string;
    unpaidOrders: string;
    unpaidOrdersCount: string;
    reviewUnpaidOrders: string;
    noUnpaidOrders: string;
    lowStockAlert: string;
    lowStockCount: string;
    manageInventory: string;
    allStockHealthy: string;
    unitsLeft: string;
  };
  activity: {
    sectionTitle: string;
    viewAll: string;
    empty: string;
    paid: string;
    unpaid: string;
    expense: string;
  };
}

export interface CommonDictionary {
  close: string;
  save: string;
  cancel: string;
  loading: string;
  error: string;
  retry: string;
  back: string;
}

export interface SettingsDictionary {
  title: string;
  subtitle: string;
  coreSection: string;
  operationsSection: string;
  systemSection: string;
  account: {
    title: string;
    description: string;
    profileTitle: string;
    managedViaGoogle: string;
    preferencesTitle: string;
    languageLabel: string;
    themeLabel: string;
    themeSystem: string;
    themeLight: string;
    themeDark: string;
    securityTitle: string;
    signOut: string;
  };
  business: {
    title: string;
    description: string;
    identitySection: string;
    logoLabel: string;
    uploadLogo: string;
    nameLabel: string;
    namePlaceholder: string;
    descLabel: string;
    descPlaceholder: string;
    slugLabel: string;
    slugHelper: string;
    activeBadge: string;
    contactSection: string;
    socialSection: string;
    instagramLabel: string;
    facebookLabel: string;
    tiktokLabel: string;
    phoneLabel: string;
    emailLabel: string;
    whatsappLabel: string;
    addressLabel: string;
    latitudeLabel: string;
    longitudeLabel: string;
    coordinatesHelper: string;
    brandingSection: string;
    saveButton: string;
    saveSuccess: string;
    discardButton: string;
  };
  about: {
    title: string;
    version: string;
    legal: string;
    support: string;
  };
  ordering: {
    title: string;
    description: string;
    statusSection: string;
    acceptingOrdersLabel: string;
    acceptingOrdersDesc: string;
    serviceTypesSection: string;
    pickupLabel: string;
    pickupDesc: string;
    deliveryLabel: string;
    deliveryDesc: string;
    dineInLabel: string;
    dineInDesc: string;
    hoursSection: string;
    hoursLabel: string;
    hoursHelper: string;
    timingSection: string;
    asapLabel: string;
    asapDesc: string;
    scheduledLabel: string;
    scheduledDesc: string;
    timeOptionalLabel: string;
    timeOptionalDesc: string;
    deliverySection: string;
    deliveryFeeLabel: string;
    deliveryFeeHelper: string;
    minOrderLabel: string;
    minOrderHelper: string;
    soonSection: string;
    saveButton: string;
    saveSuccess: string;
    discardButton: string;
  };
  payment: {
    title: string;
    description: string;
    identifiersSection: string;
    revolutLabel: string;
    revolutPlaceholder: string;
    revolutHelper: string;
    weroLabel: string;
    weroPlaceholder: string;
    weroHelper: string;
    methodsSection: string;
    methodsHelper: string;
    cashLabel: string;
    cashDesc: string;
    revolutMethodLabel: string;
    revolutMethodDesc: string;
    weroMethodLabel: string;
    weroMethodDesc: string;
    instructionsSection: string;
    instructionsEnLabel: string;
    instructionsFrLabel: string;
    instructionsHelper: string;
    soonSection: string;
    saveButton: string;
    saveSuccess: string;
    discardButton: string;
    atLeastOneMethodError: string;
  };
  inventoryFinance: {
    title: string;
    description: string;
    inventorySection: string;
    lowStockLabel: string;
    lowStockHelper: string;
    manageCategoriesButton: string;
    financeSection: string;
    currencyLabel: string;
    currencyHelper: string;
    currencyReadOnlyBadge: string;
    taxLabel: string;
    taxHelper: string;
    soonSection: string;
    saveButton: string;
    saveSuccess: string;
    discardButton: string;
  };
  notifications: {
    title: string;
    description: string;
    alertsSection: string;
    inAppAlertsLabel: string;
    inAppAlertsDesc: string;
    soundAlertsLabel: string;
    soundAlertsDesc: string;
    appSection: string;
    installAppTitle: string;
    installAppDesc: string;
    installAppButton: string;
    installedBadge: string;
    aboutLinkText: string;
    soonSection: string;
    saveButton: string;
    saveSuccess: string;
    discardButton: string;
  };
}

export interface OrderConfirmationDictionary {
  title: string;
  awaiting: string;
  receivedHelp: string;
  paymentTitle: string;
  handover: string;
  revtag: string;
  weroIdentifier: string;
  amount: string;
  paymentHelp: string;
  unavailable: string;
  copy: string;
  copied: string;
  copyFailed: string;
  noPaymentNeeded: string;
  nextSteps: string;
}

export interface OrderTrackingDictionary {
  orderLabel: string;
  pickup: string;
  delivery: string;
  deliveryTime: string;
  asap: string;
  refreshHint: string;
  refundedBadge: string;
  cancelledPaymentHelp: string;
  title: string;
  orderReference: string;
  placedAt: string;
  orderNotFound: string;
  orderNotFoundDesc: string;
  backToCatalog: string;
  liveOrderProgress: string;
  updatingLive: string;
  currentStatus: string;
  fulfillmentDetails: string;
  pickupWindow: string;
  deliveryAddress: string;
  directions: string;
  orderSummary: string;
  subtotal: string;
  taxIncluded: string;
  totalAmount: string;
  paidBadge: string;
  unpaidBadge: string;
  contactShop: string;
  contactShopDesc: string;
  orderCancelledTitle: string;
  rejectionReasonLabel: string;
  readyInApprox: string;
  statuses: {
    NEW: string;
    CONFIRMED: string;
    PREPARING: string;
    READY: string;
    COMPLETED: string;
    CANCELLED: string;
  };
  stepNotes: {
    placed: string;
    confirmed: string;
    preparing: string;
    readyPickup: string;
    readyDelivery: string;
    completed: string;
    cancelled: string;
  };
}

export interface CustomersDictionary {
  title: string;
  subtitle: string;
  listedSingular: string;
  listedPlural: string;
  sortedByRecent: string;
  order: string;
  last: string;
  lifetime: string;
  paidOrders: string;
  internal: string;
  newestFirst: string;
  viewOrder: string;
  item: string;
  items: string;
  search: string;
  empty: string;
  noResults: string;
  orders: string;
  totalSpent: string;
  spentHint: string;
  lastOrder: string;
  neverOrdered: string;
  back: string;
  call: string;
  whatsapp: string;
  noPhone: string;
  edit: string;
  name: string;
  nameHint: string;
  notes: string;
  notesHint: string;
  save: string;
  saved: string;
  invalid: string;
  notFound: string;
  saveFailed: string;
  history: string;
  noOrders: string;
  orderedAs: string;
  showMore: string;
  paid: string;
  unpaid: string;
  refunded: string;
  loadFailed: string;
  retry: string;
}

export interface ProductsDictionary {
  categoryRoleLabel: string;
  categoryRoles: Record<CategoryRole, string>;
  suggestAddOnsLabel: string;
  suggestAddOnsHelper: string;
  allergensLabel: string;
  allergenLabels: Record<Allergen, string>;
}

export interface Dictionary {
  locale: SupportedLocale;
  nav: NavigationDictionary;
  dashboard: DashboardDictionary;
  storefront: StorefrontDictionary;
  orderTracking: OrderTrackingDictionary;
  orderConfirmation: OrderConfirmationDictionary;
  quickAdd: QuickAddDictionary;
  settings: SettingsDictionary;
  common: CommonDictionary;
  customers: CustomersDictionary;
  products: ProductsDictionary;
}
