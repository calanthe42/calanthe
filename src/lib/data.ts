/**
 * Temporary typed data layer, shaped like the future Payload CMS
 * collections. Every homepage section reads ONLY from this module —
 * when the CMS arrives, swap this one import.
 *
 * Images are botanical-placeholder descriptors until real photography
 * is provided; the CMS versions will carry real `src` URLs.
 */

export type PlaceholderPalette = "warm" | "olive" | "burgundy";

export type ProductImage = {
  alt: string;
  placeholder: { seed: string; palette: PlaceholderPalette };
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  priceAed: number;
  images: readonly [ProductImage, ProductImage];
  occasions: readonly OccasionSlug[];
  featured: boolean;
  newArrival: boolean;
};

export type OccasionSlug =
  "birthday" | "congratulations" | "new-baby" | "love" | "just-because";

export type Occasion = {
  slug: OccasionSlug;
  name: string;
  image: ProductImage;
};

function img(seed: string, palette: PlaceholderPalette, alt: string): ProductImage {
  return { alt, placeholder: { seed, palette } };
}

export const occasions: readonly Occasion[] = [
  {
    slug: "birthday",
    name: "Birthday",
    image: img("occ-birthday", "warm", "Birthday arrangements"),
  },
  {
    slug: "congratulations",
    name: "Congratulations",
    image: img("occ-congrats", "olive", "Congratulations arrangements"),
  },
  {
    slug: "new-baby",
    name: "New Baby",
    image: img("occ-baby", "warm", "New baby arrangements"),
  },
  {
    slug: "love",
    name: "Love",
    image: img("occ-love", "burgundy", "Love arrangements"),
  },
  {
    slug: "just-because",
    name: "Just Because",
    image: img("occ-because", "olive", "Just because arrangements"),
  },
] as const;

export const products: readonly Product[] = [
  {
    id: "p1",
    slug: "amber-hour",
    name: "Amber Hour",
    priceAed: 480,
    images: [
      img("amber-hour-a", "warm", "Amber Hour arrangement"),
      img("amber-hour-b", "olive", "Amber Hour arrangement, detail"),
    ],
    occasions: ["birthday", "just-because"],
    featured: true,
    newArrival: true,
  },
  {
    id: "p2",
    slug: "quiet-devotion",
    name: "Quiet Devotion",
    priceAed: 650,
    images: [
      img("quiet-devotion-a", "burgundy", "Quiet Devotion arrangement"),
      img("quiet-devotion-b", "warm", "Quiet Devotion arrangement, detail"),
    ],
    occasions: ["love"],
    featured: true,
    newArrival: false,
  },
  {
    id: "p3",
    slug: "the-first-letter",
    name: "The First Letter",
    priceAed: 420,
    images: [
      img("first-letter-a", "warm", "The First Letter arrangement"),
      img("first-letter-b", "olive", "The First Letter arrangement, detail"),
    ],
    occasions: ["new-baby", "congratulations"],
    featured: false,
    newArrival: true,
  },
  {
    id: "p4",
    slug: "bordeaux-whisper",
    name: "Bordeaux Whisper",
    priceAed: 720,
    images: [
      img("bordeaux-whisper-a", "burgundy", "Bordeaux Whisper arrangement"),
      img("bordeaux-whisper-b", "warm", "Bordeaux Whisper arrangement, detail"),
    ],
    occasions: ["love", "just-because"],
    featured: true,
    newArrival: false,
  },
  {
    id: "p5",
    slug: "sage-and-cinder",
    name: "Sage & Cinder",
    priceAed: 390,
    images: [
      img("sage-cinder-a", "olive", "Sage & Cinder arrangement"),
      img("sage-cinder-b", "warm", "Sage & Cinder arrangement, detail"),
    ],
    occasions: ["just-because"],
    featured: false,
    newArrival: true,
  },
  {
    id: "p6",
    slug: "dawn-procession",
    name: "Dawn Procession",
    priceAed: 850,
    images: [
      img("dawn-procession-a", "warm", "Dawn Procession arrangement"),
      img("dawn-procession-b", "olive", "Dawn Procession arrangement, detail"),
    ],
    occasions: ["congratulations", "birthday"],
    featured: true,
    newArrival: true,
  },
  {
    id: "p7",
    slug: "velvet-hour",
    name: "Velvet Hour",
    priceAed: 950,
    images: [
      img("velvet-hour-a", "burgundy", "Velvet Hour arrangement"),
      img("velvet-hour-b", "olive", "Velvet Hour arrangement, detail"),
    ],
    occasions: ["love"],
    featured: true,
    newArrival: false,
  },
  {
    id: "p8",
    slug: "a-soft-reply",
    name: "A Soft Reply",
    priceAed: 350,
    images: [
      img("soft-reply-a", "warm", "A Soft Reply arrangement"),
      img("soft-reply-b", "warm", "A Soft Reply arrangement, detail"),
    ],
    occasions: ["just-because", "new-baby"],
    featured: false,
    newArrival: true,
  },
  {
    id: "p9",
    slug: "the-long-stem",
    name: "The Long Stem",
    priceAed: 540,
    images: [
      img("long-stem-a", "olive", "The Long Stem arrangement"),
      img("long-stem-b", "burgundy", "The Long Stem arrangement, detail"),
    ],
    occasions: ["congratulations"],
    featured: false,
    newArrival: true,
  },
  {
    id: "p10",
    slug: "meadow-at-dusk",
    name: "Meadow at Dusk",
    priceAed: 610,
    images: [
      img("meadow-dusk-a", "olive", "Meadow at Dusk arrangement"),
      img("meadow-dusk-b", "warm", "Meadow at Dusk arrangement, detail"),
    ],
    occasions: ["birthday", "just-because"],
    featured: true,
    newArrival: false,
  },
] as const;

export function getNewArrivals(): readonly Product[] {
  return products.filter((p) => p.newArrival);
}

export function getBestSellers(): readonly Product[] {
  return products.filter((p) => p.featured);
}

export function formatAed(price: number): string {
  return `AED ${price.toLocaleString("en-AE")}`;
}

/* ------------------------------------------------------------------ */
/* Commerce configuration (future CMS globals)                         */
/* ------------------------------------------------------------------ */

export type SizeId = "standard" | "deluxe" | "premium";

export type ProductSize = {
  id: SizeId;
  name: string;
  /** Added to the product base price. */
  priceDeltaAed: number;
  note: string;
};

export const sizes: readonly ProductSize[] = [
  { id: "standard", name: "Standard", priceDeltaAed: 0, note: "As photographed" },
  { id: "deluxe", name: "Deluxe", priceDeltaAed: 140, note: "A third fuller" },
  { id: "premium", name: "Premium", priceDeltaAed: 320, note: "Twice the stems" },
] as const;

export type AddonId = "vase" | "chocolates" | "balloon" | "polaroid";

export type Addon = {
  id: AddonId;
  name: string;
  priceAed: number;
};

export const addons: readonly Addon[] = [
  { id: "vase", name: "Vase", priceAed: 60 },
  { id: "chocolates", name: "Chocolates", priceAed: 85 },
  { id: "balloon", name: "Balloon", priceAed: 35 },
  { id: "polaroid", name: "Polaroid Card", priceAed: 25 },
] as const;

export type DeliveryZone = {
  id: string;
  name: string;
  feeAed: number;
};

export const deliveryZones: readonly DeliveryZone[] = [
  { id: "dubai", name: "Dubai", feeAed: 25 },
  { id: "abu-dhabi", name: "Abu Dhabi", feeAed: 35 },
  { id: "sharjah", name: "Sharjah", feeAed: 30 },
  { id: "ajman", name: "Ajman", feeAed: 35 },
  { id: "umm-al-quwain", name: "Umm Al Quwain", feeAed: 45 },
  { id: "ras-al-khaimah", name: "Ras Al Khaimah", feeAed: 45 },
  { id: "fujairah", name: "Fujairah", feeAed: 45 },
] as const;

export const FREE_DELIVERY_THRESHOLD_AED = 350;

/** Orders placed before this hour (UAE time) can be delivered today. */
export const SAME_DAY_CUTOFF_HOUR = 17;

export const timeSlots = [
  "10:00 – 13:00",
  "13:00 – 17:00",
  "17:00 – 21:00",
] as const;

/* ------------------------------------------------------------------ */
/* Build Your Own                                                      */
/* ------------------------------------------------------------------ */

export const byoBudgetsAed = [250, 350, 500, 750, 1000] as const;

/** FLAGGED: placeholder — replace with the client's exact note text. */
export const byoBudgetNote =
  "Every budget is composed with the same care — a smaller arrangement is simply a quieter one.";

/** FLAGGED: placeholder set — replace with the client's exact 8 options. */
export const byoColours = [
  "Whites & Creams",
  "Blush & Rose",
  "Peach & Apricot",
  "Sunlit Yellows",
  "Burnt Orange & Rust",
  "Reds & Burgundies",
  "Lilac & Purples",
  "Greens & Foliage",
] as const;

/** FLAGGED: placeholder set — replace with the client's exact 8 occasions. */
export const byoOccasionOptions = [
  "Birthday",
  "Anniversary",
  "Congratulations",
  "New Baby",
  "Love & Romance",
  "Thank You",
  "Get Well Soon",
  "Just Because",
] as const;

export const BYO_VASE_PRICE_AED = 60;

/** FLAGGED: placeholder — replace with the client's exact disclaimer. */
export const seasonalDisclaimer =
  "Flowers are subject to seasonal availability. Our florists may substitute stems of equal or greater value while keeping the palette and spirit of your arrangement.";

/* ------------------------------------------------------------------ */
/* Membership                                                          */
/* ------------------------------------------------------------------ */

export type MembershipTier = {
  id: string;
  name: string;
  fromAedPerDelivery: number;
  mostLoved: boolean;
  blurb: string;
  includes: readonly string[];
};

export const membershipTiers: readonly MembershipTier[] = [
  {
    id: "essential",
    name: "Essential",
    fromAedPerDelivery: 260,
    mostLoved: false,
    blurb: "A single seasonal arrangement, composed weekly.",
    includes: [
      "4 deliveries a month",
      "Seasonal stems, florist's choice",
      "Kraft-wrapped, hand-tied",
    ],
  },
  {
    id: "signature",
    name: "Signature",
    fromAedPerDelivery: 420,
    mostLoved: true,
    blurb: "Our fullest weekly ritual — the atelier's signature scale.",
    includes: [
      "4 deliveries a month",
      "Premium seasonal stems",
      "Vase included with the first delivery",
      "Priority delivery window",
    ],
  },
  {
    id: "grand",
    name: "Grand",
    fromAedPerDelivery: 680,
    mostLoved: false,
    blurb: "Statement arrangements for entrances, tables and offices.",
    includes: [
      "4 deliveries a month",
      "Grand-scale arrangements",
      "Dedicated florist",
      "Same-morning refresh on request",
    ],
  },
] as const;

export const weekDays = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

export type FaqItem = { q: string; a: string };

export const membershipFaq: readonly FaqItem[] = [
  {
    q: "Can I pause or skip a week?",
    a: "Yes — pause, skip or resume any time from your account, up to 24 hours before your delivery day.",
  },
  {
    q: "What flowers will I receive?",
    a: "Each week our florists compose around the best stems of the season, in the palette you prefer. No two weeks are the same.",
  },
  {
    q: "Which areas do you deliver to?",
    a: "All seven emirates. Your delivery day is reserved for your area's route, keeping stems in the cold chain until your door.",
  },
  {
    q: "Can I gift a membership?",
    a: "Beautifully. Choose gifting at checkout and we'll include a hand-written first-week card.",
  },
] as const;

/* ------------------------------------------------------------------ */
/* Mock orders (account area)                                          */
/* ------------------------------------------------------------------ */

export type OrderStatus = "preparing" | "out-for-delivery" | "delivered";

export type Order = {
  id: string;
  number: string;
  placedOn: string;
  status: OrderStatus;
  items: readonly {
    name: string;
    size: string;
    qty: number;
    priceAed: number;
    addons: readonly string[];
  }[];
  totalAed: number;
  deliverTo: string;
};

export const mockOrders: readonly Order[] = [
  {
    id: "o1",
    number: "CAL-1042",
    placedOn: "24 Aug 2026",
    status: "out-for-delivery",
    items: [
      {
        name: "Quiet Devotion",
        size: "Deluxe",
        qty: 1,
        priceAed: 790,
        addons: ["Vase", "Polaroid Card"],
      },
    ],
    totalAed: 875,
    deliverTo: "Home — Jumeirah, Dubai",
  },
  {
    id: "o2",
    number: "CAL-0987",
    placedOn: "12 Aug 2026",
    status: "delivered",
    items: [
      { name: "Amber Hour", size: "Standard", qty: 1, priceAed: 480, addons: [] },
      {
        name: "A Soft Reply",
        size: "Standard",
        qty: 1,
        priceAed: 350,
        addons: ["Chocolates"],
      },
    ],
    totalAed: 940,
    deliverTo: "Office — Al Reem Island, Abu Dhabi",
  },
  {
    id: "o3",
    number: "CAL-0871",
    placedOn: "30 Jul 2026",
    status: "delivered",
    items: [
      { name: "Velvet Hour", size: "Premium", qty: 1, priceAed: 1270, addons: ["Vase"] },
    ],
    totalAed: 1330,
    deliverTo: "Home — Jumeirah, Dubai",
  },
] as const;

export const orderStatusLabels: Record<OrderStatus, string> = {
  preparing: "Being arranged",
  "out-for-delivery": "Out for delivery",
  delivered: "Delivered",
};

/* ------------------------------------------------------------------ */
/* Instagram                                                           */
/* ------------------------------------------------------------------ */

export const instagramTiles: readonly ProductImage[] = [
  img("ig-1", "warm", "Calanthe on Instagram"),
  img("ig-2", "olive", "Calanthe on Instagram"),
  img("ig-3", "burgundy", "Calanthe on Instagram"),
  img("ig-4", "warm", "Calanthe on Instagram"),
  img("ig-5", "olive", "Calanthe on Instagram"),
  img("ig-6", "warm", "Calanthe on Instagram"),
  img("ig-7", "olive", "Calanthe on Instagram"),
  img("ig-8", "warm", "Calanthe on Instagram"),
  img("ig-9", "burgundy", "Calanthe on Instagram"),
  img("ig-10", "olive", "Calanthe on Instagram"),
  img("ig-11", "warm", "Calanthe on Instagram"),
  img("ig-12", "olive", "Calanthe on Instagram"),
] as const;

export const CONTACT = {
  whatsapp: "+971500000000",
  whatsappHref: "https://wa.me/971500000000",
  instagramHandle: "@calanthe",
  instagramHref: "https://instagram.com/calanthe",
  email: "hello@calanthe.ae",
} as const;
