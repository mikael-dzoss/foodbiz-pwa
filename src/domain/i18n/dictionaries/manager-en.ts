import type { ManagerExtras } from "../manager-types";
import { categoriesCopy } from "../areas/categories";
import { expensesCopy } from "../areas/expenses";
import { ordersCopy } from "../areas/orders";
import { productsAdminCopy } from "../areas/products-admin";
import { settingsExtraCopy } from "../areas/settings-extra";

export const managerEn: ManagerExtras = {
  manager: {
    brandRole: "Manager",
    desktopNavLabel: "Manager desktop sidebar",
    mobileNavLabel: "Manager mobile navigation",
    categories: "Categories",
    signOut: "Sign out",
    soon: "Soon",
    comingSoon: "coming soon",
    comingSoonToast: "Coming soon — we noted your interest",
    moreTitle: "More Options",
    moreDescription: "Access management sections and settings",
    moreItems: {
      categories: "Manage product categories",
      expenses: "Log receipts and operating costs",
      customers: "Guest history and repeat diners",
      analytics: "Sales trends and performance",
      settings: "Account and business profile",
    },
    features: {
      "settings.team": {
        title: "Team Permissions",
        description: "Role-based member invitations and access control.",
      },
      "account.devices": {
        title: "Signed-in Devices",
        description: "Manage active sessions and trusted devices.",
      },
      "account.export_data": {
        title: "Export My Data",
        description: "Download GDPR archive of orders, expenses, and logs.",
      },
      "account.delete": {
        title: "Delete Account",
        description: "Permanently purge manager account and personal data.",
      },
      "business.cover_image": {
        title: "Storefront Cover Image",
        description: "Hero header photo displayed on customer web storefront.",
      },
      "business.brand_color": {
        title: "Brand Theme Colour",
        description: "Custom accent colour on digital receipts and storefront.",
      },
      "business.logo": {
        title: "Store Logo",
        description: "Upload a square logo for the storefront and receipts.",
      },
      "legal.terms": {
        title: "Terms of Service",
        description: "Public terms page for your storefront customers.",
      },
      "legal.privacy": {
        title: "Privacy Policy",
        description: "Public privacy page for your storefront customers.",
      },
      "analytics.dashboard": {
        title: "Analytics",
        description: "Sales trends, top products and breakdowns.",
      },
    },
    quickAddDescriptions: {
      order: "Take customer order manually",
      product: "Add food or beverage item",
      expense: "Log receipt or purchase",
    },
  },
  login: {
    pageHeading: "Manager Sign-in",
    backToStorefront: "Go back to storefront",
    portalBadge: "Manager Portal",
    welcome: "Welcome back",
    intro: "Sign in to manage your menu, orders, and daily operations.",
    developmentDivider: "or for development",
    demoSignIn: "Sign in as Manager (Demo Account)",
    restricted: "Authorized managers and staff only. Contact support if you need access.",
    footer: "FoodBiz Operations · Encrypted Connection",
  },
  orders: ordersCopy.en,
  expenses: expensesCopy.en,
  productsAdmin: productsAdminCopy.en,
  categories: categoriesCopy.en,
  settingsExtra: settingsExtraCopy.en,
  // @@END@@
};
