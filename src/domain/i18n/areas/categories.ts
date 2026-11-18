import type { SupportedLocale } from "../types";

/** Manager category management screen. */
export interface CategoriesDictionary {
  title: string;
  subtitle: string;
  backToDashboard: string;
  menuActive: string;
  addTitle: string;
  nameLabel: string;
  nameHint: string;
  namePlaceholder: string;
  newNameLabel: string;
  addButton: string;
  dismiss: string;
  allCategories: string;
  categoriesCount: string;
  dragToReorder: string;
  empty: string;
  editNameLabel: string;
  saveNameLabel: string;
  save: string;
  cancelEditing: string;
  reorder: string;
  productOne: string;
  productOther: string;
  inCatalog: string;
  unassigned: string;
  rename: string;
  edit: string;
  delete: string;
  deleteInUse: string;
  inUseTitle: string;
  categoryOne: string;
  categoryOther: string;
  productsTotal: string;
  tipLabel: string;
  tip: string;
}

const en: CategoriesDictionary = {
  title: "Categories",
  subtitle: "Organise your menu and products",
  backToDashboard: "Back to dashboard",
  menuActive: "Menu Active",
  addTitle: "Add New Category",
  nameLabel: "Category name",
  nameHint: "Visible in ordering menu and kitchen tickets",
  namePlaceholder: "e.g. Desserts, Drinks...",
  newNameLabel: "New category name",
  addButton: "Add Category",
  dismiss: "Dismiss",
  allCategories: "All Categories",
  categoriesCount: "Categories ({count})",
  dragToReorder: "Drag to reorder",
  empty: "No categories yet. Create your first category above.",
  editNameLabel: "Edit category name",
  saveNameLabel: "Save category name",
  save: "Save",
  cancelEditing: "Cancel editing",
  reorder: "Reorder {name}",
  productOne: "{count} product",
  productOther: "{count} products",
  inCatalog: "In catalog",
  unassigned: "Unassigned",
  rename: "Rename {name}",
  edit: "Edit",
  delete: "Delete {name}",
  deleteInUse: "Delete {name} (in use by {count} items)",
  inUseTitle: "In use by {count} item(s)",
  categoryOne: "{count} category",
  categoryOther: "{count} categories",
  productsTotal: "{count} products total",
  tipLabel: "Pro tip:",
  tip: "Categories with active products cannot be removed directly to prevent orphaned items in your store.",
};

const fr: CategoriesDictionary = {
  title: "Catégories",
  subtitle: "Organisez votre menu et vos produits",
  backToDashboard: "Retour au tableau de bord",
  menuActive: "Menu actif",
  addTitle: "Ajouter une catégorie",
  nameLabel: "Nom de la catégorie",
  nameHint: "Visible dans le menu de commande et sur les tickets cuisine",
  namePlaceholder: "ex. : Desserts, Boissons...",
  newNameLabel: "Nom de la nouvelle catégorie",
  addButton: "Ajouter la catégorie",
  dismiss: "Fermer",
  allCategories: "Toutes les catégories",
  categoriesCount: "Catégories ({count})",
  dragToReorder: "Glisser pour réordonner",
  empty: "Aucune catégorie pour le moment. Créez votre première catégorie ci-dessus.",
  editNameLabel: "Modifier le nom de la catégorie",
  saveNameLabel: "Enregistrer le nom de la catégorie",
  save: "Enregistrer",
  cancelEditing: "Annuler la modification",
  reorder: "Déplacer {name}",
  productOne: "{count} produit",
  productOther: "{count} produits",
  inCatalog: "Au catalogue",
  unassigned: "Non assignée",
  rename: "Renommer {name}",
  edit: "Modifier",
  delete: "Supprimer {name}",
  deleteInUse: "Supprimer {name} (utilisée par {count} articles)",
  inUseTitle: "Utilisée par {count} article(s)",
  categoryOne: "{count} catégorie",
  categoryOther: "{count} catégories",
  productsTotal: "{count} produits au total",
  tipLabel: "Astuce :",
  tip: "Une catégorie contenant des produits actifs ne peut pas être supprimée directement, afin d'éviter des articles orphelins dans votre boutique.",
};

export const categoriesCopy: Record<SupportedLocale, CategoriesDictionary> = { en, fr };
