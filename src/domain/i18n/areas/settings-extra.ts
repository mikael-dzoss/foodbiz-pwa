import type { SupportedLocale } from "../types";

/** Manager settings copy not covered by `settings` (toasts, "coming soon" rows, about page, hints). */
export interface SettingsExtraDictionary {
  discarded: string;
  atLeastOneMode: string;
  roleOwner: string;
  roleManager: string;
  pwaInstalled: string;
  urlCopied: string;
  logoHint: string;
  copyUrl: string;
  languageEnglish: string;
  languageFrench: string;
  languageUpdated: string;
  aboutVersionLine: string;
  posLine: string;
  activeOfThree: string;
  hoursPlaceholder: string;
  hoursEmptyHint: string;
  euro: string;
  isoLine: string;
  slugPlaceholder: string;
  emailPlaceholder: string;
  addressPlaceholder: string;
  instructionsPlaceholderEn: string;
  instructionsPlaceholderFr: string;
  soon: {
    categoriesReorder: string;
    multiCurrencyTitle: string;
    multiCurrencyDesc: string;
    customTagsTitle: string;
    customTagsDesc: string;
    csvExportTitle: string;
    csvExportDesc: string;
    sizesComboTitle: string;
    sizesComboDesc: string;
    emailConfirmTitle: string;
    emailConfirmDesc: string;
    pushTitle: string;
    pushDesc: string;
    teamTitle: string;
    teamDesc: string;
    zonesTitle: string;
    zonesDesc: string;
    slotsTitle: string;
    slotsDesc: string;
    stripeTitle: string;
    stripeDesc: string;
  };
  about: {
    intro: string;
    versionBuild: string;
    builtWith: string;
    forBusinesses: string;
  };
}

const en: SettingsExtraDictionary = {
  discarded: "Changes discarded",
  atLeastOneMode: "At least one fulfillment mode must be enabled",
  roleOwner: "Owner & Manager",
  roleManager: "Manager",
  pwaInstalled: "FoodBiz Manager installed",
  urlCopied: "Store URL copied to clipboard",
  logoHint: "PNG, JPG or WebP (square 1:1)",
  copyUrl: "Copy storefront URL",
  languageEnglish: "English (EN)",
  languageFrench: "Français (FR)",
  languageUpdated: "Language updated to English",
  aboutVersionLine: "Version {version} • Legal terms, support contacts & license",
  posLine: "{name} POS & Operations {version}",
  activeOfThree: "{count} of 3 active",
  hoursPlaceholder: "e.g. Mon-Sat: 08:00 - 19:30, Sun: Closed",
  hoursEmptyHint: "Leave empty for continuous dark kitchen or on-demand delivery operations.",
  euro: "Euro (€)",
  isoLine: "ISO 4217: EUR",
  slugPlaceholder: "les-saveurs-du-continent",
  emailPlaceholder: "commandes@example.com",
  addressPlaceholder: "52 Quai de la Rapée, 75012 Paris, France",
  instructionsPlaceholderEn:
    "e.g. Please show your order confirmation on pickup. Revolut or cash accepted.",
  instructionsPlaceholderFr:
    "ex. Merci de présenter votre confirmation au comptoir. Espèces ou Revolut acceptés.",
  soon: {
    categoriesReorder: "Reorder and organize storefront menu categories",
    multiCurrencyTitle: "Multi-Currency Support",
    multiCurrencyDesc: "Accept GBP, USD and Swiss Francs",
    customTagsTitle: "Custom Expense Tags",
    customTagsDesc: "Create custom accounting allocation buckets",
    csvExportTitle: "CSV Product & Order Export",
    csvExportDesc: "Spreadsheet dumps for accounting and inventory audits",
    sizesComboTitle: "Product Sizes & Combo Menus",
    sizesComboDesc: "Variants, formulas and bundle pricing",
    emailConfirmTitle: "Email Order Confirmations",
    emailConfirmDesc: "Instant email copies sent on customer checkout",
    pushTitle: "Mobile Push Notifications",
    pushDesc: "Background Web Push even when the browser is closed",
    teamTitle: "Invite Staff & Team Permissions",
    teamDesc: "Cashier, kitchen display, and manager access controls",
    zonesTitle: "Delivery Zones & Postcode Limits",
    zonesDesc: "Radius or postal code geo-fencing for dispatch",
    slotsTitle: "Time Slots & Hourly Kitchen Capacity",
    slotsDesc: "Throttle peak orders per 15-minute fulfillment slot",
    stripeTitle: "Online Card Payments (Stripe & Apple Pay)",
    stripeDesc: "Automated card authorization directly on web storefront",
  },
  about: {
    intro: "Food business operations and mobile point-of-sale platform.",
    versionBuild: "Version {version}",
    builtWith: "Built with",
    forBusinesses: "for modern artisanal food businesses",
  },
};

const fr: SettingsExtraDictionary = {
  discarded: "Modifications annulées",
  atLeastOneMode: "Activez au moins un mode de service",
  roleOwner: "Propriétaire et gestionnaire",
  roleManager: "Gestionnaire",
  pwaInstalled: "L'application FoodBiz Manager a bien été installée",
  urlCopied: "Adresse de la boutique copiée dans le presse-papiers",
  logoHint: "PNG, JPG ou WebP (carré 1:1)",
  copyUrl: "Copier l'adresse de la boutique",
  languageEnglish: "English (EN)",
  languageFrench: "Français (FR)",
  languageUpdated: "Langue mise à jour en français",
  aboutVersionLine: "Version {version} • Conditions légales, contacts du support et licence",
  posLine: "{name} Caisse et exploitation {version}",
  activeOfThree: "{count} sur 3 actifs",
  hoursPlaceholder: "ex. : Lun-Sam : 08:00 - 19:30, Dim : fermé",
  hoursEmptyHint: "Laissez vide pour une cuisine ouverte en continu ou une livraison à la demande.",
  euro: "Euro (€)",
  isoLine: "ISO 4217 : EUR",
  slugPlaceholder: "les-saveurs-du-continent",
  emailPlaceholder: "commandes@example.com",
  addressPlaceholder: "52 Quai de la Rapée, 75012 Paris, France",
  instructionsPlaceholderEn:
    "e.g. Please show your order confirmation on pickup. Revolut or cash accepted.",
  instructionsPlaceholderFr:
    "ex. Merci de présenter votre confirmation au comptoir. Espèces ou Revolut acceptés.",
  soon: {
    categoriesReorder: "Réordonner et organiser les catégories du menu de la boutique",
    multiCurrencyTitle: "Multi-devises",
    multiCurrencyDesc: "Accepter les livres sterling, dollars et francs suisses",
    customTagsTitle: "Catégories de dépenses personnalisées",
    customTagsDesc: "Créer vos propres postes de ventilation comptable",
    csvExportTitle: "Export CSV des produits et commandes",
    csvExportDesc: "Fichiers tableur pour la comptabilité et les audits de stock",
    sizesComboTitle: "Tailles de produits et menus composés",
    sizesComboDesc: "Variantes, formules et prix de lots",
    emailConfirmTitle: "Confirmations de commande par e-mail",
    emailConfirmDesc: "Copie envoyée instantanément par e-mail lors de la commande",
    pushTitle: "Notifications push mobiles",
    pushDesc: "Notifications web en arrière-plan, même navigateur fermé",
    teamTitle: "Inviter le personnel et gérer les droits",
    teamDesc: "Accès caisse, affichage cuisine et gestionnaire",
    zonesTitle: "Zones de livraison et codes postaux",
    zonesDesc: "Périmètre par rayon ou code postal pour les livraisons",
    slotsTitle: "Créneaux horaires et capacité de la cuisine",
    slotsDesc: "Limiter les commandes de pointe par créneau de 15 minutes",
    stripeTitle: "Paiement par carte en ligne (Stripe et Apple Pay)",
    stripeDesc: "Autorisation automatique des cartes directement sur la boutique",
  },
  about: {
    intro: "Plateforme de gestion et de caisse mobile pour les professionnels de la restauration.",
    versionBuild: "Version {version}",
    builtWith: "Conçu avec",
    forBusinesses: "pour les entreprises artisanales de restauration",
  },
};

export const settingsExtraCopy: Record<SupportedLocale, SettingsExtraDictionary> = { en, fr };
