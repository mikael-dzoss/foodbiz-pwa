import type { ManagerExtras } from "../manager-types";
import { categoriesCopy } from "../areas/categories";
import { expensesCopy } from "../areas/expenses";
import { ordersCopy } from "../areas/orders";
import { productsAdminCopy } from "../areas/products-admin";
import { settingsExtraCopy } from "../areas/settings-extra";

export const managerFr: ManagerExtras = {
  manager: {
    brandRole: "Gestionnaire",
    desktopNavLabel: "Barre latérale du gestionnaire",
    mobileNavLabel: "Navigation mobile du gestionnaire",
    categories: "Catégories",
    signOut: "Se déconnecter",
    soon: "Bientôt",
    comingSoon: "bientôt disponible",
    comingSoonToast: "Bientôt disponible : nous avons noté votre intérêt",
    moreTitle: "Plus d'options",
    moreDescription: "Accédez aux sections de gestion et aux paramètres",
    moreItems: {
      categories: "Gérer les catégories de produits",
      expenses: "Enregistrer reçus et frais d'exploitation",
      customers: "Historique et clients réguliers",
      analytics: "Tendances des ventes et performances",
      settings: "Compte et profil de l'établissement",
    },
    features: {
      "settings.team": {
        title: "Droits de l'équipe",
        description: "Invitations de membres et contrôle d'accès par rôle.",
      },
      "account.devices": {
        title: "Appareils connectés",
        description: "Gérer les sessions actives et les appareils de confiance.",
      },
      "account.export_data": {
        title: "Exporter mes données",
        description: "Télécharger l'archive RGPD des commandes, dépenses et journaux.",
      },
      "account.delete": {
        title: "Supprimer le compte",
        description: "Effacer définitivement le compte gestionnaire et les données personnelles.",
      },
      "business.cover_image": {
        title: "Image de couverture de la boutique",
        description: "Photo d'en-tête affichée sur la boutique en ligne.",
      },
      "business.brand_color": {
        title: "Couleur de la marque",
        description: "Couleur d'accent personnalisée sur les reçus numériques et la boutique.",
      },
      "business.logo": {
        title: "Logo de la boutique",
        description: "Téléversez un logo carré pour la boutique et les reçus.",
      },
      "legal.terms": {
        title: "Conditions d'utilisation",
        description: "Page publique des conditions pour vos clients.",
      },
      "legal.privacy": {
        title: "Politique de confidentialité",
        description: "Page publique de confidentialité pour vos clients.",
      },
      "analytics.dashboard": {
        title: "Statistiques",
        description: "Tendances des ventes, meilleurs produits et détails.",
      },
    },
    quickAddDescriptions: {
      order: "Saisir une commande manuellement",
      product: "Ajouter un plat ou une boisson",
      expense: "Enregistrer un reçu ou un achat",
    },
  },
  login: {
    pageHeading: "Connexion gestionnaire",
    backToStorefront: "Retour à la boutique",
    portalBadge: "Espace gestionnaire",
    welcome: "Bon retour",
    intro: "Connectez-vous pour gérer votre menu, vos commandes et votre activité quotidienne.",
    developmentDivider: "ou pour le développement",
    demoSignIn: "Se connecter en tant que gestionnaire (compte démo)",
    restricted:
      "Réservé aux gestionnaires et au personnel autorisés. Contactez le support si vous avez besoin d'un accès.",
    footer: "FoodBiz Operations · Connexion chiffrée",
  },
  orders: ordersCopy.fr,
  expenses: expensesCopy.fr,
  productsAdmin: productsAdminCopy.fr,
  categories: categoriesCopy.fr,
  settingsExtra: settingsExtraCopy.fr,
  // @@END@@
};
