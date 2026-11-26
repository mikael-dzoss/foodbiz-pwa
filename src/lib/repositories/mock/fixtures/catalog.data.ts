/**
 * Owner-approved demo catalog (#113): "Les Saveurs du Continent".
 *
 * EN fields (`descriptionEn`, `nameEn`) are reference translations for the future
 * bilingual catalog and are not part of the domain types or the generated seed.
 */
import type { Allergen } from "@/domain/allergen";
import type { DateFormat } from "@/domain/business";
import type { CategoryRole } from "@/domain/category";
import type { StandardExpenseTag } from "@/domain/expense";
import type { LeadTimeUnit } from "@/domain/lead-time";
import type { WeeklyHours } from "@/domain/opening-hours";

export type DemoCategoryKey = "meatFish" | "traditional" | "fritters" | "drinks";

export interface DemoCatalogBusiness {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly currency: "EUR";
  readonly description: string;
  readonly descriptionEn: string;
  readonly phone: string;
  readonly email: string;
  readonly whatsappNumber: string;
  readonly instagramUrl: string;
  readonly facebookUrl: string;
  readonly tiktokUrl: string;
  readonly address: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly logoUrl: string | null;
}

export interface DemoCatalogSettings {
  readonly id: string;
  readonly currency: "EUR";
  readonly dateFormat: DateFormat;
  readonly lowStockThreshold: number;
  readonly taxPercentage: number;
  readonly notifications: boolean;
  readonly acceptingOrders: boolean;
  readonly serviceTypes: {
    readonly pickup: boolean;
    readonly delivery: boolean;
    readonly dineIn: boolean;
  };
  readonly openingHours: string;
  readonly weeklyHours: WeeklyHours | null;
  readonly orderTimingAsap: boolean;
  readonly orderTimingScheduled: boolean;
  readonly orderTimingTimeOptional: boolean;
  readonly deliveryFee: number;
  readonly minOrderAmount: number;
  readonly leadTimeValue: number;
  readonly leadTimeUnit: LeadTimeUnit;
  readonly timezone: string;
  readonly revolutRevtag: string;
  readonly weroIdentifier: string;
  readonly paymentMethods: {
    readonly cash: boolean;
    readonly card: boolean;
    readonly revolut: boolean;
    readonly wero: boolean;
  };
  readonly paymentInstructionsEn: string;
  readonly paymentInstructionsFr: string;
  readonly inAppAlerts: boolean;
  readonly soundAlerts: boolean;
}

export interface DemoCatalogCategory {
  readonly key: DemoCategoryKey;
  readonly id: string;
  readonly name: string;
  readonly nameEn: string;
  readonly sortOrder: number;
  readonly role: CategoryRole;
}

export interface DemoCatalogProduct {
  readonly key: string;
  readonly id: string;
  readonly categoryKey: DemoCategoryKey;
  readonly name: string;
  readonly nameEn: string;
  readonly description: string;
  readonly descriptionEn: string;
  readonly price: number;
  readonly unitCost: number;
  readonly stock: number;
  readonly allergens: readonly Allergen[];
  readonly visible: boolean;
  readonly suggestAddOns: boolean;
  readonly imageUrl: string | null;
}

export interface DemoCatalogGuest {
  readonly name: string;
  readonly phone: string;
  readonly email: string;
  readonly address: string;
  readonly notes: string;
}

export interface DemoCatalogExpense {
  readonly description: string;
  readonly amount: number;
  readonly tag: StandardExpenseTag;
}

export const DEMO_CATALOG_BUSINESS: DemoCatalogBusiness = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Les Saveurs du Continent",
  slug: "les-saveurs-du-continent",
  currency: "EUR",
  description:
    "Cuisine camerounaise faite maison à Paris : grillades braisées, mets traditionnels, beignets et jus naturels. À emporter ou en livraison.",
  descriptionEn:
    "Home-made Cameroonian cooking in Paris: charcoal grills, traditional dishes, fritters and fresh juices. Takeaway or delivery.",
  phone: "+33 6 39 98 00 01",
  email: "commandes@example.com",
  whatsappNumber: "+33 6 39 98 00 01",
  instagramUrl: "",
  facebookUrl: "",
  tiktokUrl: "",
  address: "52 Quai de la Rapée, 75012 Paris, France",
  latitude: 48.8446,
  longitude: 2.3667,
  logoUrl: null,
};

export const DEMO_CATALOG_SETTINGS: DemoCatalogSettings = {
  id: "11111111-1111-4111-8111-111111111112",
  currency: "EUR",
  dateFormat: "DD/MM/YYYY",
  lowStockThreshold: 5,
  taxPercentage: 10,
  notifications: true,
  acceptingOrders: true,
  serviceTypes: {
    pickup: true,
    delivery: true,
    dineIn: false,
  },
  openingHours: "Mar–Dim 11:00–21:00 · fermé le lundi",
  weeklyHours: null,
  orderTimingAsap: true,
  orderTimingScheduled: true,
  orderTimingTimeOptional: false,
  deliveryFee: 300,
  minOrderAmount: 1500,
  leadTimeValue: 3,
  leadTimeUnit: "hours",
  timezone: "Europe/Paris",
  revolutRevtag: "@saveurscontinent",
  weroIdentifier: "+33639980001",
  paymentMethods: {
    cash: true,
    card: false,
    revolut: true,
    wero: true,
  },
  paymentInstructionsEn:
    "Pay with Revolut or Wero when you order, or in cash at pickup or delivery. Questions? Message us on WhatsApp.",
  paymentInstructionsFr:
    "Payez par Revolut ou Wero à la commande, ou en espèces au retrait ou à la livraison. Une question ? Écrivez-nous sur WhatsApp.",
  inAppAlerts: true,
  soundAlerts: true,
};

export const DEMO_CATALOG_CATEGORIES = [
  {
    key: "meatFish",
    id: "22222222-2222-4222-8222-222222222201",
    name: "Viandes & Poissons",
    nameEn: "Meat & Fish",
    sortOrder: 1,
    role: "regular",
  },
  {
    key: "traditional",
    id: "22222222-2222-4222-8222-222222222202",
    name: "Mets traditionnels",
    nameEn: "Traditional Dishes",
    sortOrder: 2,
    role: "regular",
  },
  {
    key: "fritters",
    id: "22222222-2222-4222-8222-222222222204",
    name: "Beignets",
    nameEn: "Fritters",
    sortOrder: 3,
    role: "snacks",
  },
  {
    key: "drinks",
    id: "22222222-2222-4222-8222-222222222203",
    name: "Boissons",
    nameEn: "Drinks",
    sortOrder: 4,
    role: "drinks",
  },
] as const satisfies readonly DemoCatalogCategory[];

export const DEMO_CATALOG_PRODUCTS = [
  {
    key: "chaudChaudNoyaux",
    id: "33333333-3333-4333-8333-333333333301",
    categoryKey: "meatFish",
    name: "Chaud-chaud Noyaux",
    nameEn: "Chaud-chaud Noyaux",
    description:
      "La véritable saucisse façon 237 farcie au bœuf haché, ail, gingembre et rondelle, saisie minute. Un concentré de saveurs fumées et épicées à déguster brûlant.",
    descriptionEn:
      "The real 237-style sausage stuffed with minced beef, garlic, ginger and rondelle spice, seared to order. A burst of smoky, spicy flavour, best eaten piping hot.",
    price: 1000,
    unitCost: 300,
    stock: 15,
    allergens: [],
    visible: true,
    suggestAddOns: true,
    imageUrl: null,
  },
  {
    key: "boulettes",
    id: "33333333-3333-4333-8333-333333333302",
    categoryKey: "meatFish",
    name: "Boulettes de viande",
    nameEn: "Meatballs",
    description:
      "Boulettes de bœuf mijotées dans une sauce tomate épicée accompagnées de frites de plantains.",
    descriptionEn: "Beef meatballs simmered in a spiced tomato sauce, served with plantain fries.",
    price: 1500,
    unitCost: 450,
    stock: 15,
    allergens: ["gluten", "eggs"],
    visible: true,
    suggestAddOns: true,
    imageUrl: null,
  },
  {
    key: "pouletBraise",
    id: "33333333-3333-4333-8333-333333333303",
    categoryKey: "meatFish",
    name: "Poulet Braisé",
    nameEn: "Roasted Chicken",
    description:
      "Poulet mariné au gingembre, à l'ail et aux épices, grillé sur la braise, servi avec frites de plantain.",
    descriptionEn:
      "Chicken marinated in ginger, garlic and spices, grilled over embers, served with plantain fries.",
    price: 1500,
    unitCost: 450,
    stock: 20,
    allergens: [],
    visible: true,
    suggestAddOns: true,
    imageUrl: null,
  },
  {
    key: "porcBraise",
    id: "33333333-3333-4333-8333-333333333304",
    categoryKey: "meatFish",
    name: "Porc Braisé",
    nameEn: "Roasted Pork",
    description:
      "Morceaux de porc marinés aux épices, grillés sur la braise, servis avec frites de plantain.",
    descriptionEn: "Spice-marinated pork pieces grilled over embers, served with plantain fries.",
    price: 1400,
    unitCost: 420,
    stock: 15,
    allergens: [],
    visible: true,
    suggestAddOns: true,
    imageUrl: null,
  },
  {
    key: "poissonBraise",
    id: "33333333-3333-4333-8333-333333333305",
    categoryKey: "meatFish",
    name: "Poisson Braisé",
    nameEn: "Roasted Fish",
    description:
      "Poisson entier mariné, grillé sur la braise, servi avec plantain ou bâton de manioc.",
    descriptionEn:
      "Whole marinated fish grilled over embers, served with plantain or cassava sticks.",
    price: 1600,
    unitCost: 550,
    stock: 10,
    allergens: ["fish"],
    visible: true,
    suggestAddOns: true,
    imageUrl: null,
  },
  {
    key: "ndombaPoisson",
    id: "33333333-3333-4333-8333-333333333306",
    categoryKey: "meatFish",
    name: "Ndomba de poisson",
    nameEn: "Fish Ndomba",
    description: "Poisson épicé cuit à l'étouffée en papillote de feuilles de bananier.",
    descriptionEn: "Spiced fish steamed in a banana-leaf parcel.",
    price: 1600,
    unitCost: 550,
    stock: 10,
    allergens: ["fish"],
    visible: true,
    suggestAddOns: true,
    imageUrl: null,
  },
  {
    key: "metsPistache",
    id: "33333333-3333-4333-8333-333333333307",
    categoryKey: "traditional",
    name: "Mets de pistache",
    nameEn: "Egusi Seed Cake",
    description:
      "Graines de courge (pistache) écrasées, cuites à la vapeur en feuilles de bananier avec poisson fumé et crevettes séchées.",
    descriptionEn:
      "Ground egusi (pumpkin) seeds steamed in banana leaves with smoked fish and dried shrimp.",
    price: 1500,
    unitCost: 450,
    stock: 12,
    allergens: ["fish", "crustaceans"],
    visible: true,
    suggestAddOns: true,
    imageUrl: null,
  },
  {
    key: "koki",
    id: "33333333-3333-4333-8333-333333333308",
    categoryKey: "traditional",
    name: "Koki",
    nameEn: "Koki (Black-Eyed Pea Cake)",
    description:
      "Haricots cornille pilés à l'huile de palme rouge, cuits à la vapeur en feuilles de bananier.",
    descriptionEn: "Pounded black-eyed peas with red palm oil, steamed in banana leaves.",
    price: 1800,
    unitCost: 500,
    stock: 4,
    allergens: [],
    visible: true,
    suggestAddOns: true,
    imageUrl: null,
  },
  {
    key: "pommesPilees",
    id: "33333333-3333-4333-8333-333333333309",
    categoryKey: "traditional",
    name: "Pommes pilées",
    nameEn: "Pounded Potatoes & Beans",
    description:
      "Pommes de terre pilées avec haricots rouges et huile de palme, spécialité de l'Ouest Cameroun.",
    descriptionEn: "Potatoes pounded with red beans and palm oil, a West Cameroon speciality.",
    price: 1200,
    unitCost: 350,
    stock: 15,
    allergens: [],
    visible: true,
    suggestAddOns: true,
    imageUrl: null,
  },
  {
    key: "okokSucre",
    id: "33333333-3333-4333-8333-333333333310",
    categoryKey: "traditional",
    name: "Okok Sucré",
    nameEn: "Sweet Okok",
    description:
      "Feuilles d'okok finement coupées, cuites dans une sauce d'arachide sucrée, servies avec bâton de manioc.",
    descriptionEn:
      "Finely cut okok (gnetum) leaves cooked in a sweet peanut sauce, served with cassava sticks.",
    price: 1400,
    unitCost: 420,
    stock: 12,
    allergens: ["peanuts"],
    visible: true,
    suggestAddOns: true,
    imageUrl: null,
  },
  {
    key: "sanga",
    id: "33333333-3333-4333-8333-333333333311",
    categoryKey: "traditional",
    name: "Sanga",
    nameEn: "Sanga",
    description: "Maïs frais et feuilles de morelle cuits au jus de noix de palme.",
    descriptionEn: "Fresh corn and black nightshade leaves cooked in palm-nut juice.",
    price: 1400,
    unitCost: 400,
    stock: 10,
    allergens: [],
    visible: true,
    suggestAddOns: true,
    imageUrl: null,
  },
  {
    key: "beignetsHaricots",
    id: "33333333-3333-4333-8333-333333333312",
    categoryKey: "traditional",
    name: "Beignets & Haricots",
    nameEn: "Puff-Puff & Beans",
    description:
      "Le classique BH : beignets soufflés et haricots rouges sautés avec piment en supplément.",
    descriptionEn: "The classic BH: puff-puff with sautéed red beans, extra chilli on request.",
    price: 1000,
    unitCost: 280,
    stock: 20,
    allergens: ["gluten"],
    visible: true,
    suggestAddOns: true,
    imageUrl: null,
  },
  {
    key: "beignetsMais",
    id: "33333333-3333-4333-8333-333333333313",
    categoryKey: "fritters",
    name: "Beignets de maïs",
    nameEn: "Corn Fritters",
    description: "Beignets à la farine de maïs, dorés et légèrement sucrés. Portion de 5.",
    descriptionEn: "Golden, lightly sweet cornmeal fritters. Portion of 5.",
    price: 1000,
    unitCost: 200,
    stock: 25,
    allergens: ["gluten"],
    visible: true,
    suggestAddOns: true,
    imageUrl: null,
  },
  {
    key: "beignetsManioc",
    id: "33333333-3333-4333-8333-333333333314",
    categoryKey: "fritters",
    name: "Beignets de manioc",
    nameEn: "Cassava Fritters",
    description: "Beignets de manioc râpé, croustillants à l'extérieur. Portion de 5.",
    descriptionEn: "Grated cassava fritters, crisp outside. Portion of 5.",
    price: 1000,
    unitCost: 200,
    stock: 25,
    allergens: [],
    visible: true,
    suggestAddOns: true,
    imageUrl: null,
  },
  {
    key: "beignetsFarine",
    id: "33333333-3333-4333-8333-333333333315",
    categoryKey: "fritters",
    name: "Beignets de farine",
    nameEn: "Flour Fritters",
    description: "Beignets de farine de blé, lait et œufs, moelleux et sucrés. Portion de 5.",
    descriptionEn: "Soft, sweet wheat-flour fritters made with milk and eggs. Portion of 5.",
    price: 1000,
    unitCost: 200,
    stock: 25,
    allergens: ["gluten", "milk", "eggs"],
    visible: true,
    suggestAddOns: true,
    imageUrl: null,
  },
  {
    key: "beignetsSouffles",
    id: "33333333-3333-4333-8333-333333333316",
    categoryKey: "fritters",
    name: "Beignets soufflés",
    nameEn: "Puff-Puff",
    description: "Beignets levés, légers et aérés, roulés dans le sucre. Portion de 5.",
    descriptionEn: "Yeast-raised fritters, light and airy, rolled in sugar. Portion of 5.",
    price: 1000,
    unitCost: 180,
    stock: 30,
    allergens: ["gluten"],
    visible: true,
    suggestAddOns: true,
    imageUrl: null,
  },
  {
    key: "kossam",
    id: "33333333-3333-4333-8333-333333333317",
    categoryKey: "drinks",
    name: "Kossam",
    nameEn: "Kossam (Sweet Curdled Milk)",
    description: "Lait caillé sucré à la manière peule, servi bien frais. Bouteille de 1 L.",
    descriptionEn: "Sweetened Fulani-style curdled milk, served chilled. 1 L bottle.",
    price: 2000,
    unitCost: 500,
    stock: 10,
    allergens: ["milk"],
    visible: true,
    suggestAddOns: true,
    imageUrl: null,
  },
  {
    key: "folere",
    id: "33333333-3333-4333-8333-333333333318",
    categoryKey: "drinks",
    name: "Folere",
    nameEn: "Folere (Hibiscus Drink)",
    description: "Boisson de fleurs d'hibiscus (bissap) sucrée, servie fraîche. Bouteille de 1 L.",
    descriptionEn: "Sweetened hibiscus-flower (bissap) drink, served chilled. 1 L bottle.",
    price: 1500,
    unitCost: 300,
    stock: 15,
    allergens: [],
    visible: true,
    suggestAddOns: true,
    imageUrl: null,
  },
  {
    key: "jusGingembre",
    id: "33333333-3333-4333-8333-333333333319",
    categoryKey: "drinks",
    name: "Jus de gingembre",
    nameEn: "Ginger Juice",
    description: "Gingembre frais pressé, citron et sucre de canne. Bouteille de 1 L.",
    descriptionEn: "Fresh pressed ginger with lemon and cane sugar. 1 L bottle.",
    price: 1500,
    unitCost: 300,
    stock: 15,
    allergens: [],
    visible: true,
    suggestAddOns: true,
    imageUrl: null,
  },
  {
    key: "jusBaobab",
    id: "33333333-3333-4333-8333-333333333320",
    categoryKey: "drinks",
    name: "Jus de baobab",
    nameEn: "Baobab Juice",
    description: "Pulpe de fruit du baobab (bouye) mixée et sucrée. Bouteille de 1 L.",
    descriptionEn: "Blended, sweetened baobab fruit pulp (bouye). 1 L bottle.",
    price: 1500,
    unitCost: 350,
    stock: 12,
    allergens: [],
    visible: true,
    suggestAddOns: true,
    imageUrl: null,
  },
  {
    key: "jusMangue",
    id: "33333333-3333-4333-8333-333333333321",
    categoryKey: "drinks",
    name: "Jus de mangue",
    nameEn: "Mango Juice",
    description: "Mangues mûres mixées, sans colorant. Bouteille de 1 L.",
    descriptionEn: "Blended ripe mangoes, no colouring. 1 L bottle.",
    price: 2000,
    unitCost: 500,
    stock: 12,
    allergens: [],
    visible: true,
    suggestAddOns: true,
    imageUrl: null,
  },
  {
    key: "jusMulti",
    id: "33333333-3333-4333-8333-333333333322",
    categoryKey: "drinks",
    name: "Jus Multi",
    nameEn: "Multi Juice",
    description: "Citron, gingembre et ananas pressés. Bouteille de 1 L.",
    descriptionEn: "Pressed lemon, ginger and pineapple. 1 L bottle.",
    price: 2000,
    unitCost: 500,
    stock: 12,
    allergens: [],
    visible: true,
    suggestAddOns: true,
    imageUrl: null,
  },
] as const satisfies readonly DemoCatalogProduct[];

export type DemoProductKey = (typeof DEMO_CATALOG_PRODUCTS)[number]["key"];

export const DEMO_CATALOG_GUESTS: readonly DemoCatalogGuest[] = [
  {
    name: "Aïcha Mbarga",
    phone: "+33639980011",
    email: "aicha.mbarga@example.com",
    address: "18 Rue de Lyon, 75012 Paris",
    notes: "Toujours piment en supplément",
  },
  {
    name: "Thomas Girard",
    phone: "+33639980012",
    email: "thomas.girard@example.com",
    address: "7 Avenue Daumesnil, 75012 Paris",
    notes: "Commande le vendredi pour le bureau",
  },
  {
    name: "Grâce Nkoulou",
    phone: "+33639980013",
    email: "grace.nkoulou@example.com",
    address: "42 Rue de Charenton, 75012 Paris",
    notes: "Allergique aux arachides",
  },
  {
    name: "Julie Fontaine",
    phone: "+33639980014",
    email: "julie.fontaine@example.com",
    address: "9 Boulevard de Bercy, 75012 Paris",
    notes: "Préfère la livraison après 19h",
  },
  {
    name: "Paul Essomba",
    phone: "+33639980015",
    email: "paul.essomba@example.com",
    address: "23 Rue Crozatier, 75012 Paris",
    notes: "Grandes commandes pour les fêtes de famille",
  },
  {
    name: "Marc Laurent",
    phone: "+33639980016",
    email: "marc.laurent@example.com",
    address: "15 Rue Traversière, 75012 Paris",
    notes: "Voisin, retire en boutique",
  },
];

export const DEMO_CATALOG_EXPENSES: readonly DemoCatalogExpense[] = [
  {
    description: "Plantains mûrs et verts, 2 caisses",
    amount: 9800,
    tag: "Ingredients",
  },
  {
    description: "Poisson frais (bar, tilapia) 12 kg",
    amount: 16500,
    tag: "Ingredients",
  },
  {
    description: "Huile de palme rouge 10 L et arachides",
    amount: 7200,
    tag: "Ingredients",
  },
  {
    description: "Électricité et gaz du mois",
    amount: 18900,
    tag: "Utilities",
  },
  {
    description: "Barquettes et sacs kraft compostables",
    amount: 6400,
    tag: "Supplies",
  },
  {
    description: "Feuilles de bananier et épices (rondelle, pèbè, njansang)",
    amount: 5300,
    tag: "Ingredients",
  },
  {
    description: "Charbon de bois 4 sacs de 20 kg",
    amount: 4800,
    tag: "Supplies",
  },
  {
    description: "Viande de bœuf et porc 15 kg",
    amount: 21000,
    tag: "Ingredients",
  },
  {
    description: "Électricité et gaz du mois",
    amount: 17600,
    tag: "Utilities",
  },
  {
    description: "Hibiscus, gingembre et fruits pour les jus",
    amount: 8900,
    tag: "Ingredients",
  },
  {
    description: "Bouteilles en verre 1 L (lot de 60)",
    amount: 7500,
    tag: "Supplies",
  },
  {
    description: "Réparation du grill à braise",
    amount: 14500,
    tag: "Equipment",
  },
];
