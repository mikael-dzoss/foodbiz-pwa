import type { Allergen } from "@/domain/allergen";
import type { CategoryRole } from "@/domain/category";
import type { InstallGuideDictionary } from "./areas/install-guide";
import type { ManagerExtras } from "./manager-types";

export type { InstallGuideDictionary };

export const SUPPORTED_LOCALES = ["en", "fr"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = "en";
/** Cookie holding the signed-in manager's UI language (set from Account settings). */
export const LOCALE_COOKIE = "foodbiz_locale";

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
  /** Label of the skip link at the top of every shell. */
  skipToContent: string;
}

export interface StorefrontDictionary {
  /** Label of the skip link at the top of the storefront shell. */
  skipToContent: string;
  /** "{count} available" next to the in-stock label. */
  stockAvailable: string;
  /** "Currently in your cart: {count}". */
  inCartNow: string;
  purchaseActions: string;
  honeypotLabel: string;
  promoPlaceholder: string;
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
  installAppTitle: string;
  installAppSubtitle: string;
  installAppButton: string;
  installAppDone: string;
  footerShopInformation: string;
  footerContactUs: string;
  footerOpeningHours: string;
  footerLocation: string;
  footerOrderingPolicy: string;
  menuOpen: string;
  menuDrawerTitle: string;
  menuTrackOrder: string;
  orderHistory: string;
  shareShopLink: string;
  aboutBusiness: string;
  linkCopied: string;
  trackTitle: string;
  metaDescription: string;
  metaInfoDescription: string;
  metaCartDescription: string;
  metaCheckoutDescription: string;
  metaTrackDescription: string;
  metaOrderTrackingDescription: string;
  ogShopBadge: string;
  ogShopFooter: string;
  ogProductBadge: string;
  ogOrderFrom: string;
  trackIntro: string;
  trackPhoneLabel: string;
  trackOrderNumberLabel: string;
  trackSubmit: string;
  trackSubmitting: string;
  trackPrivacyNote: string;
  trackErrorNotFound: string;
  trackErrorInvalid: string;
  trackErrorRateLimited: string;
  orderingDetailsTitle: string;
  orderingDetailsOpen: string;
  detailsDeliveryFee: string;
  detailsMinOrder: string;
  detailsNoMinimum: string;
  detailsPickupAddress: string;
  detailsHours: string;
  detailsLeadTime: string;
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
  deliveryPolicy: string;
  policyMinOrder: string;
  policyDeliveryFee: string;
  policyEstTime: string;
  acceptedPayments: string;
  cashOnPickup: string;
  today: string;
  returnToCatalog: string;
  share: string;
  allRightsReserved: string;
  socialOnInstagram: string;
  socialOnFacebook: string;
  socialOnTikTok: string;
  shopInfoCta: string;
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
  checkoutClosedScheduleNotice: string;
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
  weroDescription: string;
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
  /** Customer-facing place-order failure messages, one per PlaceOrderReason / action code (never raw server text). */
  orderErrorValidation: string;
  orderErrorAntiAbuse: string;
  orderErrorStoreClosed: string;
  orderErrorServiceDisabled: string;
  orderErrorMinimum: string;
  orderErrorStock: string;
  orderErrorInternal: string;
  orderErrorSlotClosedNow: string;
  orderErrorSlotClosedDay: string;
  orderErrorSlotDateOutOfWindow: string;
  orderErrorSlotTimeOutsideHours: string;
  orderErrorSlotTimeInPast: string;
  orderErrorPickupLocationInvalid: string;
  orderErrorPickupLocationRequired: string;
  orderErrorPickupNotAvailable: string;
  checkoutDateTomorrow: string;
  checkoutChooseDate: string;
  checkoutChooseTime: string;
  scheduledTimeRequired: string;
  checkoutTimeRequired: string;
  /** "{day} at {time}" */
  checkoutSlotAt: string;
  /** "{value} (unavailable)" for a stale pick kept in a list */
  checkoutSlotUnavailable: string;
  checkoutClosedNextOpening: string;
  checkoutBlockedNotAccepting: string;
  checkoutNoSlots: string;
  checkoutDayNote: string;
  pageErrorTitle: string;
  pageErrorMessage: string;
  pageErrorRetry: string;
  pageErrorHome: string;
  notFoundTitle: string;
  notFoundMessage: string;
  notFoundHome: string;
  viewConfirmation: string;
  trackOrder: string;
  nameRequiredError: string;
  nameTooLongError: string;
  phoneRequiredError: string;
  phoneInvalidError: string;
  addressRequiredError: string;
  addressTooLongError: string;
  dateRequiredError: string;
  dateInvalidError: string;
  timeInvalidError: string;
  notesTooLongError: string;
  fieldInvalidError: string;
  formValidationSummary: string;
  // Handover payment option variants (#377)
  payOnHandoverCash: string;
  payOnHandoverCashSubtext: string;
  payOnHandoverCard: string;
  payOnHandoverCardSubtext: string;
  cardOnPickup: string;
  walletTapSoon: string;

  // Structured opening hours (#372, #375)
  opensOnDayAt: string;
  upcomingExceptionsTitle: string;
  todayExceptionLabel: string;
  todayExceptionClosed: string;
  todayExceptionOpen: string;
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
  periods: {
    today: string;
    last_7_days: string;
    last_30_days: string;
    this_month: string;
  };
  kpiRegionLabel: string;
  periodPickerLabel: string;
  kpi: {
    revenue: string;
    costs: string;
    profit: string;
    orders: string;
    averageOrderValue: string;
    vsPreviousPeriod: string;
    vsYesterday: string;
    /** Screen-reader words for a KPI delta: direction of the change, then whether it is favourable. */
    delta: { up: string; down: string; flat: string; good: string; bad: string };
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
    itemsCount: string;
    dueAt: string;
    inPrep: string;
    newOrder: string;
    awaitingOne: string;
    awaitingMany: string;
    onlyLeft: string;
    outOfStock: string;
    restock: string;
  };
  activity: {
    sectionTitle: string;
    viewAll: string;
    empty: string;
    recentCount: string;
    paid: string;
    unpaid: string;
    expense: string;
    confirmed: string;
    preparing: string;
    cancelled: string;
    orderTitle: string;
    orderTitleGuest: string;
    guestStatus: string;
    guestPaidVia: string;
  };
}

export interface CommonDictionary {
  /** Root not-found (a URL outside the localized storefront and the manager). */
  pageNotFound: { title: string; message: string };
  decreaseQuantity: string;
  increaseQuantity: string;
  tryAgain: string;
  backToHome: string;
  genericError: string;
  close: string;
  save: string;
  cancel: string;
  loading: string;
  error: string;
  retry: string;
  back: string;
  /** Shown next to a control that only the shop owner may use (disabled with explanation). */
  ownerOnlyNotice: string;
  /** Generic message per Server Action failure code (see `actionErrorMessage`). */
  actionErrors: {
    VALIDATION: string;
    UNAUTHENTICATED: string;
    FORBIDDEN: string;
    NOT_FOUND: string;
    CONFLICT: string;
    RATE_LIMITED: string;
    INTERNAL: string;
  };
  /** Specific copy for known domain reasons, preferred over the per-code message. */
  actionReasons: {
    STOCK_ERROR: string;
    ORDER_STATE_CONFLICT: string;
    LAST_PICKUP_OPTION: string;
    PICKUP_LOCATIONS_LIMIT: string;
  };
  /** Manager area error boundary (a page read failed). */
  pageError: {
    title: string;
    message: string;
    reference: string;
    backToDashboard: string;
  };
  /** Manager area not-found (a record or page does not exist). */
  notFound: {
    title: string;
    message: string;
    backToDashboard: string;
    backToOrders: string;
  };
}

export interface SettingsDictionary {
  title: string;
  subtitle: string;
  /** Label of a pending Save button. */
  saving: string;
  coreSection: string;
  operationsSection: string;
  systemSection: string;
  account: {
    title: string;
    description: string;
    profileTitle: string;
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
    nameLabel: string;
    namePlaceholder: string;
    descLabel: string;
    descPlaceholder: string;
    slugLabel: string;
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
    leadTimeSection: string;
    leadTimeLabel: string;
    leadTimeHelper: string;
    leadTimeUnitLabel: string;
    leadTimeUnitMinutes: string;
    leadTimeUnitHours: string;
    leadTimeUnitBusinessDays: string;
    timezoneSection: string;
    timezoneLabel: string;
    timezoneHelper: string;
    leadTimePreview: string;
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
    // Card on handover toggle (#377)
    cardLabel: string;
    cardDesc: string;
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
    aboutLinkText: string;
    soonSection: string;
    saveButton: string;
    saveSuccess: string;
    discardButton: string;
  };

  // Opening hours (#372)
  openingHours: {
    title: string;
    description: string;
    navDescription: string;
    overviewSummarySection: string;
    optionsSection: string;
    regularTitle: string;
    regularDescription: string;
    regularConfigured: string;
    regularNotSet: string;
    closed: string;
    open: string;
    emptyTitle: string;
    emptyHint: string;
    legacyTextLabel: string;
    upcomingExceptionsTitle: string;
    manageStructuredLink: string;
    structuredActiveHint: string;
    presetLabel: string;
    presetEveryDay: string;
    presetWeekdaysWeekend: string;
    presetCustom: string;
    groupEveryDay: string;
    groupWeekdays: string;
    groupWeekend: string;
    openTimeLabel: string;
    closeTimeLabel: string;
    addRange: string;
    removeRangeAria: string;
    toggleDayAria: string;
    rangeAria: string;
    overnightHint: string;
    errorCloseAfterOpen: string;
    errorRangeOverlap: string;
    errorMaxRanges: string;
    errorInvalidTime: string;
    errorFixBeforeSave: string;
    saveButton: string;
    discardButton: string;
    saveSuccess: string;
    clearButton: string;
    clearConfirmTitle: string;
    clearConfirmDescription: string;
    clearConfirmAction: string;
    clearSuccess: string;
  };
  hoursExceptions: {
    title: string;
    description: string;
    rowNone: string;
    rowUpcoming: string;
    upcomingSection: string;
    pastSection: string;
    showPast: string;
    hidePast: string;
    emptyTitle: string;
    emptyHint: string;
    addButton: string;
    editAria: string;
    sheetAddTitle: string;
    sheetEditTitle: string;
    sheetDescription: string;
    startDateLabel: string;
    endDateLabel: string;
    endDateHint: string;
    statusLabel: string;
    statusClosed: string;
    statusCustom: string;
    customHoursGroup: string;
    noteLabel: string;
    notePlaceholder: string;
    noteCounter: string;
    saveButton: string;
    cancelButton: string;
    deleteButton: string;
    saveSuccess: string;
    deleteSuccess: string;
    deleteConfirmTitle: string;
    deleteConfirmDescription: string;
    errorFixBeforeSave: string;
    errorDateRequired: string;
    errorEndBeforeStart: string;
    errorSpan: string;
    errorOverlap: string;
    errorNoteTooLong: string;
    errorTooMany: string;
    errorNoRanges: string;
  };
  pickupLocations: {
    title: string;
    description: string;
    navDescription: string;
    shopName: string;
    shopHint: string;
    shopPickupLabel: string;
    relaySection: string;
    addButton: string;
    emptyTitle: string;
    emptyHint: string;
    free: string;
    sameAsShopHours: string;
    inactive: string;
    editAria: string;
    moveUpAria: string;
    moveDownAria: string;
    sheetAddTitle: string;
    sheetEditTitle: string;
    sheetDescription: string;
    nameLabel: string;
    descriptionLabel: string;
    addressLabel: string;
    postcodeLabel: string;
    postcodeHint: string;
    feeLabel: string;
    feeHint: string;
    activeLabel: string;
    activeHint: string;
    hoursSection: string;
    editHoursRow: string;
    editHoursNewHint: string;
    saveButton: string;
    cancelButton: string;
    deleteButton: string;
    saveSuccess: string;
    deleteSuccess: string;
    deleteConfirmTitle: string;
    deleteConfirmDescription: string;
    errorName: string;
    errorAddress: string;
    errorPostcode: string;
    errorFee: string;
    backToLocations: string;
    hoursTitle: string;
    hoursDescription: string;
    hoursFooterNote: string;
    clearButton: string;
    clearConfirmTitle: string;
    clearConfirmDescription: string;
    clearConfirmAction: string;
    clearSuccess: string;
    manageLink: string;
    movedAnnouncement: string;
    limitHint: string;
    pickupOffNotice: string;
    pickupOffHint: string;
  };
}

export interface OrderConfirmationDictionary {
  title: string;
  awaiting: string;
  receivedHelp: string;
  paymentTitle: string;
  revtag: string;
  weroIdentifier: string;
  amount: string;
  paymentReference: string;
  handoverPrepare: string;
  paymentDisclaimer: string;
  unavailable: string;
  copy: string;
  copied: string;
  copyFailed: string;
  noPaymentNeeded: string;
  nextSteps: string;
  // Handover payment variants (#377)
  handoverCash: string;
  handoverCard: string;
  handoverCashCard: string;
  handoverPrepareCard: string;
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
  deliveryTo: string;
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

export interface AuthDictionary {
  continueWithGoogle: string;
  errors: {
    cancelled: string;
    denied: string;
    no_access: string;
    auth_failed: string;
  };
}

export interface Dictionary extends ManagerExtras {
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
  auth: AuthDictionary;
  installGuide: InstallGuideDictionary;
}

export * from "./manager-types";
