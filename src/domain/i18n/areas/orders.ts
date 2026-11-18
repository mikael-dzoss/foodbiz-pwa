import type { Channel, OrderStatus, PaymentMethod, PaymentPreference } from "@/domain/order";
import type { SupportedLocale } from "../types";

/** Manager orders screens: list, detail, manual order form and live alerts. */
export interface OrdersDictionary {
  title: string;
  newOrder: string;
  statusTabsLabel: string;
  tabs: { active: string; completed: string; cancelled: string };
  searchPlaceholder: string;
  clearSearch: string;
  filters: { all: string; unpaidOnly: string; pickup: string; delivery: string };
  empty: {
    title: string;
    filtered: string;
    active: string;
    completed: string;
    cancelled: string;
    clearFilters: string;
  };
  listLabel: string;
  status: Record<OrderStatus, string>;
  payment: { paid: string; unpaid: string; refunded: string; refundDue: string };
  paymentMethods: Record<PaymentMethod, string>;
  paymentPreferences: Record<PaymentPreference, string>;
  channels: Record<Channel, string>;
  channelOrders: Record<Channel, string>;
  service: { pickup: string; delivery: string; "dine-in": string };
  pickupAt: string;
  deliveryAt: string;
  pickupAsap: string;
  deliveryAsap: string;
  daysAhead: string;
  daysLate: string;
  overdue: string;
  orderedAs: string;
  storePickup: string;
  addressPending: string;
  viewDetails: string;
  itemOne: string;
  itemOther: string;
  nextAction: {
    accept: string;
    startPreparing: string;
    markReady: string;
    payAndComplete: string;
    completeOrder: string;
    updating: string;
  };
  detail: {
    back: string;
    printTicket: string;
    printQueued: string;
    dismiss: string;
    orderTitle: string;
    createdLine: string;
    guestService: string;
    noPhone: string;
    call: string;
    whatsapp: string;
    deadline: string;
    channel: string;
    address: string;
    today: string;
    asap: string;
    dateAtTime: string;
    dateAsap: string;
    timeToday: string;
    orderItems: string;
    itemsCount: string;
    ticket: string;
    unitPrice: string;
    kitchenNote: string;
    subtotal: string;
    tax: string;
    total: string;
    paymentTitle: string;
    methodRequested: string;
    settledVia: string;
    settlement: string;
    refundedLabel: string;
    onAt: string;
    paidBeforeCancel: string;
    recordRefund: string;
    recordRefundDispute: string;
    markUnpaid: string;
    recordPayment: string;
    timelineTitle: string;
    statusLine: string;
    timeline: {
      placed: string;
      placedNote: string;
      confirmed: string;
      confirmedNote: string;
      preparing: string;
      preparingNote: string;
      readyPickup: string;
      readyPickupNote: string;
      readyDelivery: string;
      readyDeliveryNote: string;
      completed: string;
      completedNote: string;
      cancelled: string;
      done: string;
      now: string;
      upcoming: string;
    };
    nextStep: {
      confirm: string;
      startPreparing: string;
      markReady: string;
      complete: string;
    };
    paymentRequired: string;
    acceptOrder: string;
    rejectOrder: string;
    markPaidComplete: string;
    cancel: string;
    cannotCompleteUnpaid: string;
    reject: {
      title: string;
      description: string;
      reasonLabel: string;
      placeholder: string;
      required: string;
      keep: string;
      submitting: string;
      confirm: string;
    };
    cancelDialog: {
      title: string;
      description: string;
      paidWarning: string;
      paidWarningVia: string;
      reasonLabel: string;
      placeholder: string;
      keep: string;
      submitting: string;
      confirm: string;
    };
    paymentDialog: {
      titleRecord: string;
      titleShortcut: string;
      description: string;
      cancel: string;
      confirm: string;
    };
    refundDialog: {
      title: string;
      description: string;
      reasonLabel: string;
      placeholder: string;
      cancel: string;
      submitting: string;
      confirm: string;
    };
  };
  manual: {
    title: string;
    screenTag: string;
    back: string;
    cancel: string;
    step1: string;
    verified: string;
    phoneLabel: string;
    lookingUp: string;
    returningGuest: string;
    nameLabel: string;
    namePlaceholder: string;
    editName: string;
    nameEditNotice: string;
    intakeChannel: string;
    serviceType: string;
    step2: string;
    fulfillment: string;
    asap: string;
    scheduled: string;
    selectDateTime: string;
    estimate: string;
    step4: string;
    date: string;
    time: string;
    deliveryAddress: string;
    addressPlaceholder: string;
    notesLabel: string;
    notesPlaceholder: string;
    step3: string;
    selectedCount: string;
    searchPlaceholder: string;
    outOfStock: string;
    inStockLow: string;
    inStock: string;
    previewCreate: string;
    previewCreateAmount: string;
    errors: {
      noItems: string;
      invalidPhone: string;
      invalidName: string;
      noAddress: string;
    };
    preview: {
      title: string;
      description: string;
      guestChannel: string;
      noName: string;
      noPhone: string;
      via: string;
      fulfillment: string;
      asapEstimate: string;
      scheduledFor: string;
      anytime: string;
      address: string;
      noAddress: string;
      kitchenNote: string;
      selectedProducts: string;
      noItems: string;
      totalAmount: string;
      backToEdit: string;
      creating: string;
      confirm: string;
    };
  };
  alerts: { newOrder: string; from: string; view: string };
}

const en: OrdersDictionary = {
  title: "Orders",
  newOrder: "New order",
  statusTabsLabel: "Order Status Tabs",
  tabs: { active: "Active", completed: "Completed", cancelled: "Cancelled" },
  searchPlaceholder: "Search guest name, phone, or order #...",
  clearSearch: "Clear search",
  filters: {
    all: "All",
    unpaidOnly: "Unpaid only ({count})",
    pickup: "Pickup ({count})",
    delivery: "Delivery ({count})",
  },
  empty: {
    title: "No orders found",
    filtered: "Try adjusting your filters or search terms.",
    active: "No active orders at the moment.",
    completed: "No completed orders at the moment.",
    cancelled: "No cancelled orders at the moment.",
    clearFilters: "Clear filters",
  },
  listLabel: "Order triage list",
  status: {
    NEW: "New",
    CONFIRMED: "Confirmed",
    PREPARING: "Preparing",
    READY: "Ready",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  },
  payment: { paid: "Paid", unpaid: "Unpaid", refunded: "Refunded", refundDue: "Refund Due" },
  paymentMethods: { cash: "Cash", revolut: "Revolut", wero: "Wero" },
  paymentPreferences: { revolut: "Revolut", wero: "Wero", on_handover: "On handover" },
  channels: {
    storefront: "Storefront",
    phone: "Phone",
    whatsapp: "WhatsApp",
    "in-person": "In person",
  },
  channelOrders: {
    storefront: "Storefront order",
    phone: "Phone order",
    whatsapp: "WhatsApp order",
    "in-person": "In-person order",
  },
  service: { pickup: "Pickup", delivery: "Delivery", "dine-in": "Dine-in" },
  pickupAt: "Pickup at {time}",
  deliveryAt: "Delivery at {time}",
  pickupAsap: "Pickup ASAP",
  deliveryAsap: "Delivery ASAP",
  daysAhead: "(+{days}d)",
  daysLate: "(-{days}d)",
  overdue: "(overdue)",
  orderedAs: "Ordered as {name}",
  storePickup: "Store Pickup",
  addressPending: "Delivery address pending",
  viewDetails: "View order details for #{number}",
  itemOne: "{count} item",
  itemOther: "{count} items",
  nextAction: {
    accept: "Accept",
    startPreparing: "Start preparing",
    markReady: "Mark ready",
    payAndComplete: "Pay & Complete",
    completeOrder: "Complete order",
    updating: "Updating...",
  },
  detail: {
    back: "Orders",
    printTicket: "Print kitchen ticket",
    printQueued: "Kitchen ticket print job queued (mock printer).",
    dismiss: "Dismiss",
    orderTitle: "Order #{number}",
    createdLine: "Created on {date} at {time} • via {channel}",
    guestService: "Guest & Service",
    noPhone: "No phone recorded",
    call: "Call",
    whatsapp: "WhatsApp",
    deadline: "Deadline",
    channel: "Channel",
    address: "Address",
    today: "Today",
    asap: "ASAP",
    dateAtTime: "{date} at {time}",
    dateAsap: "{date} (ASAP)",
    timeToday: "Today at {time}",
    orderItems: "Order Items",
    itemsCount: "{count} items",
    ticket: "Ticket #{number}",
    unitPrice: "Unit {price}",
    kitchenNote: "Kitchen note:",
    subtotal: "Subtotal",
    tax: "Tax (incl. VAT)",
    total: "Total",
    paymentTitle: "Payment",
    methodRequested: "Method requested",
    settledVia: "Settled via",
    settlement: "Settlement",
    refundedLabel: "Refunded",
    onAt: " on {date} at {time}",
    paidBeforeCancel: "Order was paid before cancellation. Refund required.",
    recordRefund: "Record refund ({amount})",
    recordRefundDispute: "Record refund (customer dispute)",
    markUnpaid: "Mark as unpaid (undo)",
    recordPayment: "Record payment ({amount})",
    timelineTitle: "Order Timeline",
    statusLine: "Status: {status}",
    timeline: {
      placed: "Order Placed",
      placedNote: "Received via {channel}",
      confirmed: "Confirmed",
      confirmedNote: "Confirmed by kitchen",
      preparing: "Preparing",
      preparingNote: "Kitchen preparing items",
      readyPickup: "Ready for Pickup",
      readyPickupNote: "Packed at counter",
      readyDelivery: "Out for Delivery",
      readyDeliveryNote: "Dispatched with driver",
      completed: "Completed",
      completedNote: "Handed over to customer",
      cancelled: "Order Cancelled",
      done: "Completed",
      now: "Now",
      upcoming: "Upcoming",
    },
    nextStep: {
      confirm: "Confirm order",
      startPreparing: "Start preparing",
      markReady: "Mark as ready",
      complete: "Complete order",
    },
    paymentRequired: "Payment required before completing order handover",
    acceptOrder: "Accept order",
    rejectOrder: "Reject order",
    markPaidComplete: "Mark paid & complete ({amount})",
    cancel: "Cancel",
    cannotCompleteUnpaid:
      "Cannot complete order while payment is not marked as paid. Please record payment first.",
    reject: {
      title: "Reject Order #{number}",
      description:
        "Rejecting this order will cancel it and restore reserved items back to inventory. Please specify the reason for the customer.",
      reasonLabel: "Rejection Reason",
      placeholder: "e.g. Kitchen at capacity, item unavailable, outside delivery area...",
      required: "A reason is required when rejecting a new order.",
      keep: "Keep order",
      submitting: "Rejecting...",
      confirm: "Confirm rejection",
    },
    cancelDialog: {
      title: "Cancel Order #{number}",
      description:
        "Are you sure you want to cancel this order? This will release reserved stock back into inventory.",
      paidWarning:
        "This order was marked as paid ({amount}). Please remember to issue a refund manually to the customer.",
      paidWarningVia:
        "This order was marked as paid ({amount} via {method}). Please remember to issue a refund manually to the customer.",
      reasonLabel: "Cancellation Reason (optional)",
      placeholder: "e.g. Customer requested, kitchen issue...",
      keep: "Keep order",
      submitting: "Cancelling...",
      confirm: "Confirm cancellation",
    },
    paymentDialog: {
      titleRecord: "Record Payment for Order #{number}",
      titleShortcut: "Mark Paid & Complete Order #{number}",
      description: "Select payment method used for {amount}",
      cancel: "Cancel",
      confirm: "Confirm payment",
    },
    refundDialog: {
      title: "Record Refund for Order #{number}",
      description: "Confirm refund of {amount} returned to customer.",
      reasonLabel: "Refund Reason (optional)",
      placeholder: "e.g. Order cancelled, quality dispute, item missing...",
      cancel: "Cancel",
      submitting: "Recording...",
      confirm: "Confirm refund",
    },
  },
  manual: {
    title: "New Order",
    screenTag: "Screen M-30 • Manual",
    back: "Orders",
    cancel: "Cancel",
    step1: "Step 1: Guest Information",
    verified: "Verified",
    phoneLabel: "Phone number (auto-lookup)",
    lookingUp: "Checking database...",
    returningGuest: "Returning guest",
    nameLabel: "Name",
    namePlaceholder: "e.g. Jean Dupont",
    editName: "Edit guest name",
    nameEditNotice: "Editing this name will update it for all orders linked to this phone number.",
    intakeChannel: "Intake channel",
    serviceType: "Service type",
    step2: "Step 2: Service & Timing",
    fulfillment: "{service} fulfillment",
    asap: "ASAP",
    scheduled: "Scheduled",
    selectDateTime: "Select date & time",
    estimate: "Est. 20-25 min",
    step4: "Step 4: Order Summary",
    date: "Date",
    time: "Time",
    deliveryAddress: "Delivery Address",
    addressPlaceholder: "Street name, house number, floor...",
    notesLabel: "Kitchen & Handover Notes",
    notesPlaceholder: "Special requests, allergies, sauce preferences...",
    step3: "Step 3: Product Selection",
    selectedCount: "{count} selected",
    searchPlaceholder: "Search menu items...",
    outOfStock: "Out of stock",
    inStockLow: "{count} in stock (low)",
    inStock: "{count} in stock",
    previewCreate: "Preview & Create order",
    previewCreateAmount: "Preview & Create order ({amount})",
    errors: {
      noItems: "Please select at least one product with a quantity.",
      invalidPhone: "Please provide a valid phone number.",
      invalidName: "Please provide a valid guest name (2–50 characters).",
      noAddress: "Please provide a delivery address.",
    },
    preview: {
      title: "Order Preview",
      description: "Review manual order details before submission to kitchen.",
      guestChannel: "Guest & Channel",
      noName: "No guest name specified",
      noPhone: "No phone number",
      via: "{phone} • via {channel}",
      fulfillment: "Fulfillment",
      asapEstimate: "(ASAP • Est. 20-25 min)",
      scheduledFor: "(Scheduled for {date} at {time})",
      anytime: "anytime",
      address: "Address: {address}",
      noAddress: "No address provided",
      kitchenNote: "Kitchen note:",
      selectedProducts: "Selected Products ({count})",
      noItems: "No items selected yet.",
      totalAmount: "Total Amount",
      backToEdit: "Back to edit",
      creating: "Creating order...",
      confirm: "Confirm & Create order",
    },
  },
  alerts: { newOrder: "New Order", from: "from {name}", view: "View" },
};

const fr: OrdersDictionary = {
  title: "Commandes",
  newOrder: "Nouvelle commande",
  statusTabsLabel: "Onglets de statut des commandes",
  tabs: { active: "En cours", completed: "Terminées", cancelled: "Annulées" },
  searchPlaceholder: "Rechercher un nom, un téléphone ou un n° de commande...",
  clearSearch: "Effacer la recherche",
  filters: {
    all: "Toutes",
    unpaidOnly: "Impayées ({count})",
    pickup: "Retrait ({count})",
    delivery: "Livraison ({count})",
  },
  empty: {
    title: "Aucune commande trouvée",
    filtered: "Essayez de modifier vos filtres ou votre recherche.",
    active: "Aucune commande en cours pour le moment.",
    completed: "Aucune commande terminée pour le moment.",
    cancelled: "Aucune commande annulée pour le moment.",
    clearFilters: "Effacer les filtres",
  },
  listLabel: "Liste des commandes à traiter",
  status: {
    NEW: "Nouvelle",
    CONFIRMED: "Confirmée",
    PREPARING: "En préparation",
    READY: "Prête",
    COMPLETED: "Terminée",
    CANCELLED: "Annulée",
  },
  payment: { paid: "Payée", unpaid: "Impayée", refunded: "Remboursée", refundDue: "À rembourser" },
  paymentMethods: { cash: "Espèces", revolut: "Revolut", wero: "Wero" },
  paymentPreferences: { revolut: "Revolut", wero: "Wero", on_handover: "À la remise" },
  channels: {
    storefront: "Boutique en ligne",
    phone: "Téléphone",
    whatsapp: "WhatsApp",
    "in-person": "Sur place",
  },
  channelOrders: {
    storefront: "Commande en ligne",
    phone: "Commande par téléphone",
    whatsapp: "Commande WhatsApp",
    "in-person": "Commande sur place",
  },
  service: { pickup: "Retrait", delivery: "Livraison", "dine-in": "Sur place" },
  pickupAt: "Retrait à {time}",
  deliveryAt: "Livraison à {time}",
  pickupAsap: "Retrait dès que possible",
  deliveryAsap: "Livraison dès que possible",
  daysAhead: "(+{days} j)",
  daysLate: "(-{days} j)",
  overdue: "(en retard)",
  orderedAs: "Commandé sous le nom de {name}",
  storePickup: "Retrait en boutique",
  addressPending: "Adresse de livraison en attente",
  viewDetails: "Voir le détail de la commande n° {number}",
  itemOne: "{count} article",
  itemOther: "{count} articles",
  nextAction: {
    accept: "Accepter",
    startPreparing: "Lancer la préparation",
    markReady: "Marquer prête",
    payAndComplete: "Encaisser et terminer",
    completeOrder: "Terminer la commande",
    updating: "Mise à jour...",
  },
  detail: {
    back: "Commandes",
    printTicket: "Imprimer le ticket cuisine",
    printQueued: "Impression du ticket cuisine en file d'attente (imprimante fictive).",
    dismiss: "Fermer",
    orderTitle: "Commande n° {number}",
    createdLine: "Créée le {date} à {time} • via {channel}",
    guestService: "Client et service",
    noPhone: "Aucun téléphone enregistré",
    call: "Appeler",
    whatsapp: "WhatsApp",
    deadline: "Échéance",
    channel: "Canal",
    address: "Adresse",
    today: "Aujourd'hui",
    asap: "Dès que possible",
    dateAtTime: "{date} à {time}",
    dateAsap: "{date} (dès que possible)",
    timeToday: "Aujourd'hui à {time}",
    orderItems: "Articles",
    itemsCount: "{count} articles",
    ticket: "Ticket n° {number}",
    unitPrice: "Prix unitaire {price}",
    kitchenNote: "Note cuisine :",
    subtotal: "Sous-total",
    tax: "TVA incluse",
    total: "Total",
    paymentTitle: "Paiement",
    methodRequested: "Mode demandé",
    settledVia: "Réglée par",
    settlement: "Règlement",
    refundedLabel: "Remboursée",
    onAt: " le {date} à {time}",
    paidBeforeCancel: "La commande a été payée avant l'annulation. Remboursement requis.",
    recordRefund: "Enregistrer le remboursement ({amount})",
    recordRefundDispute: "Enregistrer un remboursement (litige client)",
    markUnpaid: "Marquer comme impayée (annuler)",
    recordPayment: "Enregistrer le paiement ({amount})",
    timelineTitle: "Historique de la commande",
    statusLine: "Statut : {status}",
    timeline: {
      placed: "Commande passée",
      placedNote: "Reçue via {channel}",
      confirmed: "Confirmée",
      confirmedNote: "Confirmée par la cuisine",
      preparing: "En préparation",
      preparingNote: "La cuisine prépare les articles",
      readyPickup: "Prête pour le retrait",
      readyPickupNote: "Emballée au comptoir",
      readyDelivery: "En cours de livraison",
      readyDeliveryNote: "Confiée au livreur",
      completed: "Terminée",
      completedNote: "Remise au client",
      cancelled: "Commande annulée",
      done: "Terminé",
      now: "En cours",
      upcoming: "À venir",
    },
    nextStep: {
      confirm: "Confirmer la commande",
      startPreparing: "Lancer la préparation",
      markReady: "Marquer comme prête",
      complete: "Terminer la commande",
    },
    paymentRequired: "Paiement requis avant de remettre la commande",
    acceptOrder: "Accepter la commande",
    rejectOrder: "Refuser la commande",
    markPaidComplete: "Encaisser et terminer ({amount})",
    cancel: "Annuler",
    cannotCompleteUnpaid:
      "Impossible de terminer la commande tant qu'elle n'est pas payée. Enregistrez d'abord le paiement.",
    reject: {
      title: "Refuser la commande n° {number}",
      description:
        "Refuser cette commande l'annulera et remettra les articles réservés en stock. Indiquez le motif à l'attention du client.",
      reasonLabel: "Motif du refus",
      placeholder: "ex. : cuisine saturée, article indisponible, hors zone de livraison...",
      required: "Un motif est obligatoire pour refuser une nouvelle commande.",
      keep: "Garder la commande",
      submitting: "Refus en cours...",
      confirm: "Confirmer le refus",
    },
    cancelDialog: {
      title: "Annuler la commande n° {number}",
      description:
        "Voulez-vous vraiment annuler cette commande ? Le stock réservé sera remis à disposition.",
      paidWarning:
        "Cette commande est marquée comme payée ({amount}). Pensez à rembourser le client manuellement.",
      paidWarningVia:
        "Cette commande est marquée comme payée ({amount} par {method}). Pensez à rembourser le client manuellement.",
      reasonLabel: "Motif d'annulation (facultatif)",
      placeholder: "ex. : demande du client, problème en cuisine...",
      keep: "Garder la commande",
      submitting: "Annulation...",
      confirm: "Confirmer l'annulation",
    },
    paymentDialog: {
      titleRecord: "Enregistrer le paiement de la commande n° {number}",
      titleShortcut: "Encaisser et terminer la commande n° {number}",
      description: "Choisissez le mode de paiement utilisé pour {amount}",
      cancel: "Annuler",
      confirm: "Confirmer le paiement",
    },
    refundDialog: {
      title: "Rembourser la commande n° {number}",
      description: "Confirmez le remboursement de {amount} au client.",
      reasonLabel: "Motif du remboursement (facultatif)",
      placeholder: "ex. : commande annulée, litige qualité, article manquant...",
      cancel: "Annuler",
      submitting: "Enregistrement...",
      confirm: "Confirmer le remboursement",
    },
  },
  manual: {
    title: "Nouvelle commande",
    screenTag: "Écran M-30 • Manuel",
    back: "Commandes",
    cancel: "Annuler",
    step1: "Étape 1 : Informations client",
    verified: "Vérifié",
    phoneLabel: "Téléphone (recherche automatique)",
    lookingUp: "Recherche en cours...",
    returningGuest: "Client connu",
    nameLabel: "Nom",
    namePlaceholder: "ex. : Jean Dupont",
    editName: "Modifier le nom du client",
    nameEditNotice:
      "Modifier ce nom le mettra à jour pour toutes les commandes liées à ce numéro de téléphone.",
    intakeChannel: "Canal de prise de commande",
    serviceType: "Type de service",
    step2: "Étape 2 : Service et horaire",
    fulfillment: "{service}",
    asap: "Dès que possible",
    scheduled: "Planifiée",
    selectDateTime: "Choisir date et heure",
    estimate: "Env. 20-25 min",
    step4: "Étape 4 : Récapitulatif",
    date: "Date",
    time: "Heure",
    deliveryAddress: "Adresse de livraison",
    addressPlaceholder: "Rue, numéro, étage...",
    notesLabel: "Notes cuisine et remise",
    notesPlaceholder: "Demandes spéciales, allergies, choix de sauces...",
    step3: "Étape 3 : Sélection des produits",
    selectedCount: "{count} sélectionné(s)",
    searchPlaceholder: "Rechercher un produit...",
    outOfStock: "Rupture de stock",
    inStockLow: "{count} en stock (faible)",
    inStock: "{count} en stock",
    previewCreate: "Aperçu et création",
    previewCreateAmount: "Aperçu et création ({amount})",
    errors: {
      noItems: "Sélectionnez au moins un produit avec une quantité.",
      invalidPhone: "Saisissez un numéro de téléphone valide.",
      invalidName: "Saisissez un nom de client valide (2 à 50 caractères).",
      noAddress: "Saisissez une adresse de livraison.",
    },
    preview: {
      title: "Aperçu de la commande",
      description: "Vérifiez la commande manuelle avant de l'envoyer en cuisine.",
      guestChannel: "Client et canal",
      noName: "Aucun nom de client",
      noPhone: "Aucun téléphone",
      via: "{phone} • via {channel}",
      fulfillment: "Service",
      asapEstimate: "(dès que possible • env. 20-25 min)",
      scheduledFor: "(planifiée le {date} à {time})",
      anytime: "à tout moment",
      address: "Adresse : {address}",
      noAddress: "Aucune adresse fournie",
      kitchenNote: "Note cuisine :",
      selectedProducts: "Produits sélectionnés ({count})",
      noItems: "Aucun article sélectionné pour le moment.",
      totalAmount: "Montant total",
      backToEdit: "Retour à la modification",
      creating: "Création en cours...",
      confirm: "Confirmer et créer la commande",
    },
  },
  alerts: { newOrder: "Nouvelle commande", from: "de {name}", view: "Voir" },
};

export const ordersCopy: Record<SupportedLocale, OrdersDictionary> = { en, fr };
