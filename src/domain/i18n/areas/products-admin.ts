import type { SupportedLocale } from "../types";

/** Manager product list, product form sheet and stock adjustment sheet. */
export interface ProductsAdminDictionary {
  title: string;
  subtitle: string;
  menuActive: string;
  categoriesLink: string;
  addProduct: string;
  searchPlaceholder: string;
  clearSearch: string;
  filterLabel: string;
  filters: { all: string; lowStock: string; hidden: string };
  categoriesMenuTitle: string;
  categoriesBrowse: string;
  dismiss: string;
  productOne: string;
  productOther: string;
  uncategorized: string;
  cost: string;
  stockOut: string;
  stockLow: string;
  stockIn: string;
  visible: string;
  hidden: string;
  decreaseStock: string;
  increaseStock: string;
  openStockSheet: string;
  adjust: string;
  adjustStock: string;
  hide: string;
  show: string;
  edit: string;
  emptyTitle: string;
  emptyDescription: string;
  addFirst: string;
  noMatchTitle: string;
  noMatchDescription: string;
  clearFilters: string;
  footerTotals: string;
  footerActive: string;
  form: {
    titleEdit: string;
    titleNew: string;
    subtitle: string;
    photo: string;
    uploadTitle: string;
    uploadHint: string;
    changePhoto: string;
    selectPhoto: string;
    removeImage: string;
    remove: string;
    photoAlt: string;
    compressError: string;
    general: string;
    required: string;
    nameLabel: string;
    namePlaceholder: string;
    categoryLabel: string;
    descriptionLabel: string;
    descriptionPlaceholder: string;
    pricing: string;
    margin: string;
    priceLabel: string;
    unitCostLabel: string;
    stockCurrent: string;
    stockInitial: string;
    alertThreshold: string;
    decreaseStock: string;
    increaseStock: string;
    visibleHelper: string;
    visibleLabel: string;
    cancel: string;
    saveChanges: string;
    save: string;
    errors: {
      name: string;
      categoryId: string;
      description: string;
      price: string;
      unitCost: string;
      stock: string;
      allergens: string;
      imageUrl: string;
      invalid: string;
    };
  };
  stock: {
    title: string;
    stockOut: string;
    stockLow: string;
    stockIn: string;
    alertBelow: string;
    adjustQuantity: string;
    current: string;
    newTotal: string;
    exactLabel: string;
    units: string;
    difference: string;
    newStock: string;
    low: string;
    reasonLabel: string;
    reasons: { restock: string; count: string; waste: string };
    negative: string;
    note: string;
    cancel: string;
    update: string;
  };
}

const en: ProductsAdminDictionary = {
  title: "Products",
  subtitle: "Manage menu items, pricing, and stock",
  menuActive: "Menu Active",
  categoriesLink: "Categories ({count})",
  addProduct: "Add Product",
  searchPlaceholder: "Search products by name...",
  clearSearch: "Clear search",
  filterLabel: "Filter products",
  filters: { all: "All ({count})", lowStock: "Low Stock ({count})", hidden: "Hidden ({count})" },
  categoriesMenuTitle: "Categories",
  categoriesBrowse: "Browse categories",
  dismiss: "Dismiss",
  productOne: "{count} product",
  productOther: "{count} products",
  uncategorized: "Uncategorized",
  cost: "Cost: {amount}",
  stockOut: "0 in stock",
  stockLow: "{count} left",
  stockIn: "{count} in stock",
  visible: "Visible",
  hidden: "Hidden",
  decreaseStock: "Decrease stock for {name}",
  increaseStock: "Increase stock for {name}",
  openStockSheet: "{count} - Open stock sheet for {name}",
  adjust: "Adjust",
  adjustStock: "Adjust stock for {name}",
  hide: "Hide {name}",
  show: "Show {name}",
  edit: "Edit {name}",
  emptyTitle: "No products yet",
  emptyDescription: "Start building your menu by adding your first product with prices and stock.",
  addFirst: "Add your first product",
  noMatchTitle: "No matching products",
  noMatchDescription: "No products match “{query}” in the selected filter.",
  clearFilters: "Clear filters",
  footerTotals: "{products} total products across {categories} categories",
  footerActive: "{active} active · {out} out of stock",
  form: {
    titleEdit: "Edit Product",
    titleNew: "Add Product",
    subtitle: "Manage item details, pricing & stock",
    photo: "Product Photo",
    uploadTitle: "Upload & compress image",
    uploadHint: "PNG, JPG up to 5MB. Automatically resized.",
    changePhoto: "Change photo",
    selectPhoto: "Select photo",
    removeImage: "Remove image",
    remove: "Remove",
    photoAlt: "Product photo",
    compressError: "Error compressing image",
    general: "General Information",
    required: "* Required",
    nameLabel: "Product name",
    namePlaceholder: "e.g. Burger Gourmet",
    categoryLabel: "Category",
    descriptionLabel: "Description (optional)",
    descriptionPlaceholder: "Ingredients, allergens, details...",
    pricing: "Pricing & Margin",
    margin: "{percent} margin",
    priceLabel: "Selling price (€)",
    unitCostLabel: "Unit cost (€)",
    stockCurrent: "Current Stock",
    stockInitial: "Initial Stock",
    alertThreshold: "Alert threshold set at {count} units",
    decreaseStock: "Decrease stock",
    increaseStock: "Increase stock",
    visibleHelper: "Customers can see and order this item on the storefront",
    visibleLabel: "Visible on menu",
    cancel: "Cancel",
    saveChanges: "Save Changes",
    save: "Save Product",
    errors: {
      name: "Enter a product name.",
      categoryId: "Choose a category.",
      description: "This description is not valid.",
      price: "Enter a valid selling price.",
      unitCost: "Enter a valid unit cost.",
      stock: "Enter a valid stock quantity.",
      allergens: "Check the allergen selection.",
      imageUrl: "This image is not valid.",
      invalid: "Please check this field.",
    },
  },
  stock: {
    title: "Adjust Stock",
    stockOut: "0 in stock",
    stockLow: "{count} left",
    stockIn: "{count} in stock",
    alertBelow: "Alert below {count}",
    adjustQuantity: "Adjust Quantity",
    current: "Current: {count} units",
    newTotal: "New total units",
    exactLabel: "Or enter exact quantity",
    units: "units",
    difference: "Difference: {delta} units",
    newStock: "New stock: {count}",
    low: "Low",
    reasonLabel: "Reason for adjustment",
    reasons: { restock: "Restock / Delivery", count: "Inventory count", waste: "Waste / Damaged" },
    negative: "Stock cannot be set below 0.",
    note: "Stock cannot be set below 0 units. Past order history is strictly preserved.",
    cancel: "Cancel",
    update: "Update Stock",
  },
};

const fr: ProductsAdminDictionary = {
  title: "Produits",
  subtitle: "Gérez les articles du menu, les prix et le stock",
  menuActive: "Menu actif",
  categoriesLink: "Catégories ({count})",
  addProduct: "Ajouter un produit",
  searchPlaceholder: "Rechercher un produit par nom...",
  clearSearch: "Effacer la recherche",
  filterLabel: "Filtrer les produits",
  filters: {
    all: "Tous ({count})",
    lowStock: "Stock bas ({count})",
    hidden: "Masqués ({count})",
  },
  categoriesMenuTitle: "Catégories",
  categoriesBrowse: "Parcourir les catégories",
  dismiss: "Fermer",
  productOne: "{count} produit",
  productOther: "{count} produits",
  uncategorized: "Sans catégorie",
  cost: "Coût : {amount}",
  stockOut: "0 en stock",
  stockLow: "{count} restant(s)",
  stockIn: "{count} en stock",
  visible: "Visible",
  hidden: "Masqué",
  decreaseStock: "Diminuer le stock de {name}",
  increaseStock: "Augmenter le stock de {name}",
  openStockSheet: "{count} - Ouvrir la fiche de stock de {name}",
  adjust: "Ajuster",
  adjustStock: "Ajuster le stock de {name}",
  hide: "Masquer {name}",
  show: "Afficher {name}",
  edit: "Modifier {name}",
  emptyTitle: "Aucun produit pour le moment",
  emptyDescription:
    "Commencez votre menu en ajoutant un premier produit avec son prix et son stock.",
  addFirst: "Ajouter votre premier produit",
  noMatchTitle: "Aucun produit correspondant",
  noMatchDescription: "Aucun produit ne correspond à « {query} » dans le filtre sélectionné.",
  clearFilters: "Effacer les filtres",
  footerTotals: "{products} produits au total dans {categories} catégories",
  footerActive: "{active} actifs · {out} en rupture",
  form: {
    titleEdit: "Modifier le produit",
    titleNew: "Ajouter un produit",
    subtitle: "Gérez les détails, le prix et le stock",
    photo: "Photo du produit",
    uploadTitle: "Importer et compresser l'image",
    uploadHint: "PNG, JPG jusqu'à 5 Mo. Redimensionnée automatiquement.",
    changePhoto: "Changer la photo",
    selectPhoto: "Choisir une photo",
    removeImage: "Supprimer l'image",
    remove: "Supprimer",
    photoAlt: "Photo du produit",
    compressError: "Erreur lors de la compression de l'image",
    general: "Informations générales",
    required: "* Obligatoire",
    nameLabel: "Nom du produit",
    namePlaceholder: "ex. : Burger gourmet",
    categoryLabel: "Catégorie",
    descriptionLabel: "Description (facultatif)",
    descriptionPlaceholder: "Ingrédients, allergènes, détails...",
    pricing: "Prix et marge",
    margin: "marge de {percent}",
    priceLabel: "Prix de vente (€)",
    unitCostLabel: "Coût unitaire (€)",
    stockCurrent: "Stock actuel",
    stockInitial: "Stock initial",
    alertThreshold: "Seuil d'alerte fixé à {count} unités",
    decreaseStock: "Diminuer le stock",
    increaseStock: "Augmenter le stock",
    visibleHelper: "Les clients peuvent voir et commander cet article sur la boutique",
    visibleLabel: "Visible sur le menu",
    cancel: "Annuler",
    saveChanges: "Enregistrer les modifications",
    save: "Enregistrer le produit",
    errors: {
      name: "Saisissez un nom de produit.",
      categoryId: "Choisissez une catégorie.",
      description: "Cette description n'est pas valide.",
      price: "Saisissez un prix de vente valide.",
      unitCost: "Saisissez un coût unitaire valide.",
      stock: "Saisissez une quantité de stock valide.",
      allergens: "Vérifiez la sélection des allergènes.",
      imageUrl: "Cette image n'est pas valide.",
      invalid: "Vérifiez ce champ.",
    },
  },
  stock: {
    title: "Ajuster le stock",
    stockOut: "0 en stock",
    stockLow: "{count} restant(s)",
    stockIn: "{count} en stock",
    alertBelow: "Alerte sous {count}",
    adjustQuantity: "Ajuster la quantité",
    current: "Actuel : {count} unités",
    newTotal: "Nouveau total d'unités",
    exactLabel: "Ou saisissez la quantité exacte",
    units: "unités",
    difference: "Écart : {delta} unités",
    newStock: "Nouveau stock : {count}",
    low: "Bas",
    reasonLabel: "Motif de l'ajustement",
    reasons: {
      restock: "Réapprovisionnement / Livraison",
      count: "Inventaire",
      waste: "Perte / Casse",
    },
    negative: "Le stock ne peut pas être inférieur à 0.",
    note: "Le stock ne peut pas être inférieur à 0 unité. L'historique des commandes est conservé.",
    cancel: "Annuler",
    update: "Mettre à jour le stock",
  },
};

export const productsAdminCopy: Record<SupportedLocale, ProductsAdminDictionary> = { en, fr };
