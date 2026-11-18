import type { StandardExpenseTag } from "@/domain/expense";
import type { SupportedLocale } from "../types";

/** Manager expenses list and expense sheet. */
export interface ExpensesDictionary {
  title: string;
  screenTag: string;
  subtitle: string;
  add: string;
  periodLabel: string;
  periods: { thisMonth: string; lastMonth: string; allTime: string };
  totalSpent: string;
  countOne: string;
  countOther: string;
  allTags: string;
  fallbackTag: string;
  tags: Record<StandardExpenseTag, string>;
  empty: { title: string; none: string; filtered: string };
  sheet: {
    titleEdit: string;
    titleNew: string;
    screenTag: string;
    descriptionEdit: string;
    descriptionNew: string;
    amountLabel: string;
    descriptionLabel: string;
    descriptionPlaceholder: string;
    dateLabel: string;
    categoryLabel: string;
    ocr: string;
    categoriesGroupLabel: string;
    attachReceipt: string;
    saving: string;
    saveChanges: string;
    save: string;
    cancel: string;
    deleteTrigger: string;
    deleteTitle: string;
    deleteDescription: string;
    deleting: string;
    deleteConfirm: string;
    errors: {
      amount: string;
      description: string;
      date: string;
      tags: string;
      invalidField: string;
    };
  };
}

const en: ExpensesDictionary = {
  title: "Expenses",
  screenTag: "Screen M-50",
  subtitle: "Track business operating costs, ingredients and supplier invoices.",
  add: "Add expense",
  periodLabel: "Period",
  periods: { thisMonth: "This month", lastMonth: "Last month", allTime: "All time" },
  totalSpent: "Total Spent ({period})",
  countOne: "{count} expense",
  countOther: "{count} expenses",
  allTags: "All",
  fallbackTag: "Expenses",
  tags: {
    Ingredients: "Ingredients",
    Transport: "Transport",
    Equipment: "Equipment",
    Supplies: "Supplies",
    Utilities: "Utilities",
  },
  empty: {
    title: "No expenses found",
    none: "You haven't recorded any expenses yet. Start tracking ingredients, equipment and costs.",
    filtered: "No expenses match the current period and category filters.",
  },
  sheet: {
    titleEdit: "Edit expense",
    titleNew: "New expense",
    screenTag: "Screen M-51",
    descriptionEdit: "Update expense details, change category or delete record.",
    descriptionNew: "Record an operating cost or receipt for your food business.",
    amountLabel: "Amount (€)",
    descriptionLabel: "Description / Vendor",
    descriptionPlaceholder: "e.g. Fresh vegetables, Metro Wholesale",
    dateLabel: "Date of expense",
    categoryLabel: "Expense Category",
    ocr: "Automatic OCR receipt extraction",
    categoriesGroupLabel: "Expense categories",
    attachReceipt: "Attach receipt / invoice",
    saving: "Saving...",
    saveChanges: "Save changes",
    save: "Save expense",
    cancel: "Cancel",
    deleteTrigger: "Delete this expense",
    deleteTitle: "Delete Expense",
    deleteDescription:
      "Are you sure you want to delete this expense ({name})? This action cannot be undone.",
    deleting: "Deleting...",
    deleteConfirm: "Delete",
    errors: {
      amount: "Amount must be greater than 0",
      description: "Description is required",
      date: "Date is required",
      tags: "At least one tag is required",
      invalidField: "Please check this field.",
    },
  },
};

const fr: ExpensesDictionary = {
  title: "Dépenses",
  screenTag: "Écran M-50",
  subtitle: "Suivez vos frais d'exploitation, achats d'ingrédients et factures fournisseurs.",
  add: "Ajouter une dépense",
  periodLabel: "Période",
  periods: { thisMonth: "Ce mois-ci", lastMonth: "Mois dernier", allTime: "Tout" },
  totalSpent: "Total dépensé ({period})",
  countOne: "{count} dépense",
  countOther: "{count} dépenses",
  allTags: "Toutes",
  fallbackTag: "Dépenses",
  tags: {
    Ingredients: "Ingrédients",
    Transport: "Transport",
    Equipment: "Équipement",
    Supplies: "Fournitures",
    Utilities: "Charges",
  },
  empty: {
    title: "Aucune dépense trouvée",
    none: "Vous n'avez encore enregistré aucune dépense. Suivez vos ingrédients, équipements et frais.",
    filtered: "Aucune dépense ne correspond à la période et aux catégories sélectionnées.",
  },
  sheet: {
    titleEdit: "Modifier la dépense",
    titleNew: "Nouvelle dépense",
    screenTag: "Écran M-51",
    descriptionEdit: "Modifiez les détails, changez la catégorie ou supprimez l'enregistrement.",
    descriptionNew: "Enregistrez un frais d'exploitation ou un reçu pour votre activité.",
    amountLabel: "Montant (€)",
    descriptionLabel: "Description / Fournisseur",
    descriptionPlaceholder: "ex. : légumes frais, Metro",
    dateLabel: "Date de la dépense",
    categoryLabel: "Catégorie de dépense",
    ocr: "Lecture automatique des reçus (OCR)",
    categoriesGroupLabel: "Catégories de dépense",
    attachReceipt: "Joindre un reçu ou une facture",
    saving: "Enregistrement...",
    saveChanges: "Enregistrer les modifications",
    save: "Enregistrer la dépense",
    cancel: "Annuler",
    deleteTrigger: "Supprimer cette dépense",
    deleteTitle: "Supprimer la dépense",
    deleteDescription:
      "Voulez-vous vraiment supprimer cette dépense ({name}) ? Cette action est irréversible.",
    deleting: "Suppression...",
    deleteConfirm: "Supprimer",
    errors: {
      amount: "Le montant doit être supérieur à 0",
      description: "La description est obligatoire",
      date: "La date est obligatoire",
      tags: "Au moins une catégorie est requise",
      invalidField: "Vérifiez ce champ.",
    },
  },
};

export const expensesCopy: Record<SupportedLocale, ExpensesDictionary> = { en, fr };
