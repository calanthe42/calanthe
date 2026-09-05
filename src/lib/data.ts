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
  /** Curated placeholder photograph — the client's real photography
   *  replaces these URLs later (see PROJECT-BRAIN.md). */
  src?: string;
  placeholder: { seed: string; palette: PlaceholderPalette };
};

/** Cohesive 3D/CGI floral placeholder imagery (one warm sculptural
 *  world, unified by the floral-grade CSS filter) — the client's real
 *  photography replaces these URLs later. */
const photo = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?q=80&w=${w}&auto=format&fit=crop`;

export const PHOTOS = {
  heroBouquet: photo("1700022949496-28ee625db7bd", 2400),
  terracotta: photo("1637404230552-5ac6d76cb3a0"),
  dahliaDark: photo("1638884703877-36d2f4137ff9"),
  blushKraft: photo("1710858775474-08799a698bbc"),
  redRoses: photo("1767810164592-d167c543f1ea"),
  poppyMeadow: photo("1699017494672-2eb201788e72"),
  peachRoses: photo("1652680882466-e83b0cccab34"),
  moodyProtea: photo("1558473720-cf2dbe8a1f91"),
  whiteOrchid: photo("1755502046743-78265e184cc3"),
  roseMauveWall: photo("1679931974860-1af5ac3cc051"),
  callaLilies: photo("1640595843206-4f554e6c6030"),
  whiteRoseWood: photo("1628959892554-3ab56cee1bdd"),
  stargazer: photo("1640597995884-57667d173ccf"),
  pinkTulip: photo("1623077227088-94024ab979c8"),
} as const;

/** Real floral photography for the product cards (Pexels licence).
 *  Chosen per product by character, not at random — see the name of
 *  each key. Extensions matter: Pexels serves some assets as .png and
 *  some as .jpeg, and guessing wrong 404s. Every URL below was probed
 *  before being committed. */
const pexels = (id: string, ext: "jpeg" | "png" = "jpeg", w = 1200) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.${ext}?auto=compress&cs=tinysrgb&w=${w}`;

export const PRODUCT_PHOTOS = {
  amberVase: pexels("15246050"),
  amberInterior: pexels("32555688"),
  devotionBouquet: pexels("13306125"),
  devotionDense: pexels("20178982", "png"),
  blushMass: pexels("8734731"),
  blushRose: pexels("11439083"),
  bordeauxRose: pexels("6616435"),
  bordeauxDark: pexels("19629031"),
  cinderMuted: pexels("34777731"),
  cinderGrass: pexels("32059911"),
  dawnDahlia: pexels("14744122"),
  dawnPastel: pexels("20295105"),
  velvetLilac: pexels("9656872"),
  velvetStem: pexels("4060937"),
  softWhiteRose: pexels("6257764"),
  softGypsophila: pexels("31046060"),
  longStemVase: pexels("33654909"),
  longStemBlossom: pexels("14898893"),
  meadowField: pexels("30210424"),
  meadowMixed: pexels("35461534"),
} as const;


export type FlowerType =
  "roses" | "peonies" | "orchids" | "tulips" | "lilies" | "wildflowers";

export type Product = {
  id: string;
  slug: string;
  name: string;
  priceAed: number;
  images: readonly [ProductImage, ProductImage];
  occasions: readonly OccasionSlug[];
  flowers: readonly FlowerType[];
  featured: boolean;
  newArrival: boolean;
};

export const flowerTypes: readonly { slug: FlowerType; name: string }[] = [
  { slug: "roses", name: "Roses" },
  { slug: "peonies", name: "Peonies" },
  { slug: "orchids", name: "Orchids" },
  { slug: "tulips", name: "Tulips" },
  { slug: "lilies", name: "Lilies" },
  { slug: "wildflowers", name: "Wildflowers" },
];

/** Client-approved price buckets. */
export const priceBuckets = [
  { id: "under-300", label: "Under AED 300", min: 0, max: 299 },
  { id: "300-600", label: "AED 300 - 600", min: 300, max: 600 },
  { id: "over-600", label: "Over AED 600", min: 601, max: Infinity },
] as const;

export type PriceBucketId = (typeof priceBuckets)[number]["id"];

export type OccasionSlug =
  "birthday" | "graduation" | "new-born" | "love" | "just-because";

export type Occasion = {
  slug: OccasionSlug;
  name: string;
  image: ProductImage;
};

function img(
  seed: string,
  palette: PlaceholderPalette,
  alt: string,
  src?: string,
): ProductImage {
  return { alt, src, placeholder: { seed, palette } };
}

export const occasions: readonly Occasion[] = [
  {
    slug: "birthday",
    name: "Birthday",
    image: img("occ-birthday", "warm", "Birthday arrangements", PHOTOS.peachRoses),
  },
  {
    slug: "graduation",
    name: "Graduation",
    image: img(
      "occ-congrats",
      "olive",
      "Graduation arrangements",
      PHOTOS.terracotta,
    ),
  },
  {
    slug: "new-born",
    name: "New Born",
    image: img("occ-baby", "warm", "New born arrangements", PHOTOS.whiteOrchid),
  },
  {
    slug: "love",
    name: "Love",
    image: img("occ-love", "burgundy", "Love arrangements", PHOTOS.redRoses),
  },
  {
    slug: "just-because",
    name: "Just Because",
    image: img("occ-because", "olive", "Just because arrangements", PHOTOS.poppyMeadow),
  },
] as const;

export const products: readonly Product[] = [
  {
    id: "p1",
    slug: "amber-hour",
    name: "Amber Hour",
    priceAed: 480,
    images: [
      img("amber-hour-a", "warm", "Amber Hour arrangement", PRODUCT_PHOTOS.amberInterior),
      img("amber-hour-b", "olive", "Amber Hour arrangement, detail", PRODUCT_PHOTOS.amberVase),
    ],
    occasions: ["birthday", "just-because"],
    flowers: ["roses", "tulips"],
    featured: true,
    newArrival: true,
  },
  {
    id: "p2",
    slug: "quiet-devotion",
    name: "Quiet Devotion",
    priceAed: 650,
    images: [
      img(
        "quiet-devotion-a",
        "burgundy",
        "Quiet Devotion arrangement",
        PRODUCT_PHOTOS.devotionBouquet,
      ),
      img(
        "quiet-devotion-b",
        "warm",
        "Quiet Devotion arrangement, detail",
        PRODUCT_PHOTOS.devotionDense,
      ),
    ],
    occasions: ["love"],
    flowers: ["roses", "peonies"],
    featured: true,
    newArrival: false,
  },
  {
    id: "p3",
    slug: "the-first-letter",
    name: "The First Letter",
    priceAed: 420,
    images: [
      img("first-letter-a", "warm", "The First Letter arrangement", PRODUCT_PHOTOS.blushRose),
      img(
        "first-letter-b",
        "olive",
        "The First Letter arrangement, detail",
        PRODUCT_PHOTOS.blushMass,
      ),
    ],
    occasions: ["new-born", "graduation"],
    flowers: ["peonies", "tulips"],
    featured: false,
    newArrival: true,
  },
  {
    id: "p4",
    slug: "bordeaux-whisper",
    name: "Bordeaux Whisper",
    priceAed: 720,
    images: [
      img(
        "bordeaux-whisper-a",
        "burgundy",
        "Bordeaux Whisper arrangement",
        PRODUCT_PHOTOS.bordeauxRose,
      ),
      img(
        "bordeaux-whisper-b",
        "warm",
        "Bordeaux Whisper arrangement, detail",
        PRODUCT_PHOTOS.bordeauxDark,
      ),
    ],
    occasions: ["love", "just-because"],
    flowers: ["roses"],
    featured: true,
    newArrival: false,
  },
  {
    id: "p5",
    slug: "sage-and-cinder",
    name: "Sage & Cinder",
    priceAed: 390,
    images: [
      img("sage-cinder-a", "olive", "Sage & Cinder arrangement", PRODUCT_PHOTOS.cinderMuted),
      img(
        "sage-cinder-b",
        "warm",
        "Sage & Cinder arrangement, detail",
        PRODUCT_PHOTOS.cinderGrass,
      ),
    ],
    occasions: ["just-because"],
    flowers: ["wildflowers"],
    featured: false,
    newArrival: true,
  },
  {
    id: "p6",
    slug: "dawn-procession",
    name: "Dawn Procession",
    priceAed: 850,
    images: [
      img("dawn-procession-a", "warm", "Dawn Procession arrangement", PRODUCT_PHOTOS.dawnDahlia),
      img(
        "dawn-procession-b",
        "olive",
        "Dawn Procession arrangement, detail",
        PRODUCT_PHOTOS.dawnPastel,
      ),
    ],
    occasions: ["graduation", "birthday"],
    flowers: ["roses", "lilies"],
    featured: true,
    newArrival: true,
  },
  {
    id: "p7",
    slug: "velvet-hour",
    name: "Velvet Hour",
    priceAed: 950,
    images: [
      img("velvet-hour-a", "burgundy", "Velvet Hour arrangement", PRODUCT_PHOTOS.velvetLilac),
      img("velvet-hour-b", "olive", "Velvet Hour arrangement, detail", PRODUCT_PHOTOS.velvetStem),
    ],
    occasions: ["love"],
    flowers: ["peonies"],
    featured: true,
    newArrival: false,
  },
  {
    id: "p8",
    slug: "a-soft-reply",
    name: "A Soft Reply",
    priceAed: 350,
    images: [
      img("soft-reply-a", "warm", "A Soft Reply arrangement", PRODUCT_PHOTOS.softWhiteRose),
      img(
        "soft-reply-b",
        "warm",
        "A Soft Reply arrangement, detail",
        PRODUCT_PHOTOS.softGypsophila,
      ),
    ],
    occasions: ["just-because", "new-born"],
    flowers: ["orchids"],
    featured: false,
    newArrival: true,
  },
  {
    id: "p9",
    slug: "the-long-stem",
    name: "The Long Stem",
    priceAed: 540,
    images: [
      img("long-stem-a", "olive", "The Long Stem arrangement", PRODUCT_PHOTOS.longStemVase),
      img(
        "long-stem-b",
        "burgundy",
        "The Long Stem arrangement, detail",
        PRODUCT_PHOTOS.longStemBlossom,
      ),
    ],
    occasions: ["graduation"],
    flowers: ["roses"],
    featured: false,
    newArrival: true,
  },
  {
    id: "p10",
    slug: "meadow-at-dusk",
    name: "Meadow at Dusk",
    priceAed: 610,
    images: [
      img("meadow-dusk-a", "olive", "Meadow at Dusk arrangement", PRODUCT_PHOTOS.meadowField),
      img(
        "meadow-dusk-b",
        "warm",
        "Meadow at Dusk arrangement, detail",
        PRODUCT_PHOTOS.meadowMixed,
      ),
    ],
    occasions: ["birthday", "just-because"],
    flowers: ["lilies", "wildflowers"],
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

export type AddonId = "vase" | "chocolates" | "balloon" | "cake" | "teddy" | "polaroid";

export type Addon = {
  id: AddonId;
  name: string;
  priceAed: number;
  /** Placeholder art until the client photographs real add-ons. */
  image: ProductImage;
};

export const addons: readonly Addon[] = [
  {
    id: "vase",
    name: "Vase",
    priceAed: 60,
    image: img("addon-vase", "olive", "A ceramic vase"),
  },
  {
    id: "chocolates",
    name: "Chocolates",
    priceAed: 85,
    image: img("addon-choc", "burgundy", "A box of chocolates"),
  },
  {
    id: "balloon",
    name: "Balloon",
    priceAed: 35,
    image: img("addon-balloon", "warm", "A heart balloon"),
  },
  {
    id: "cake",
    name: "Bento Cake",
    priceAed: 95,
    image: img("addon-cake", "warm", "A bento cake"),
  },
  {
    id: "teddy",
    name: "Teddy Bear",
    priceAed: 90,
    image: img("addon-teddy", "warm", "A teddy bear"),
  },
  {
    id: "polaroid",
    name: "Polaroid Card",
    priceAed: 25,
    image: img("addon-polaroid", "olive", "A polaroid card"),
  },
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

export const timeSlots = ["10:00 – 13:00", "13:00 – 17:00", "17:00 – 21:00"] as const;

/* ------------------------------------------------------------------ */
/* Build Your Own                                                      */
/* ------------------------------------------------------------------ */

export const byoBudgetsAed = [250, 350, 500, 750, 1000] as const;

/** Orders below this are not composed — enforced in BuildYourOwnForm. */
export const BYO_MIN_BUDGET_AED = 150;

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
  "Graduation",
  "New Born",
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

export const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

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

/** Site-wide FAQ (delivery/quality) — /faqs. */
export const siteFaq: readonly FaqItem[] = [
  {
    q: "When will my flowers arrive?",
    a: "Order before 5pm and we deliver the same day, anywhere in the UAE. You will choose a delivery day and time window at checkout.",
  },
  {
    q: "How fresh are the arrangements?",
    a: "Every arrangement is composed by hand on the morning of its delivery - never the night before - and travels cool and upright.",
  },
  {
    q: "What if a flower is out of season?",
    a: "Flowers are subject to seasonal availability. Our florists may substitute stems of equal or greater value while keeping the palette and spirit of your arrangement.",
  },
  {
    q: "Can I see my arrangement before it is delivered?",
    a: "Yes - your florist sends a photo or video on WhatsApp for your approval before every delivery.",
  },
  {
    q: "How can I pay?",
    a: "Cards are accepted at checkout, with Tabby instalments; wallet payments arrive soon. The recipient never sees the price.",
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
  img("ig-1", "warm", "Calanthe on Instagram", PHOTOS.terracotta),
  img("ig-2", "olive", "Calanthe on Instagram", PHOTOS.peachRoses),
  img("ig-3", "burgundy", "Calanthe on Instagram", PHOTOS.moodyProtea),
  img("ig-4", "warm", "Calanthe on Instagram", PHOTOS.blushKraft),
  img("ig-5", "olive", "Calanthe on Instagram", PHOTOS.roseMauveWall),
  img("ig-6", "warm", "Calanthe on Instagram", PHOTOS.poppyMeadow),
  img("ig-7", "olive", "Calanthe on Instagram", PHOTOS.dahliaDark),
  img("ig-8", "warm", "Calanthe on Instagram", PHOTOS.whiteOrchid),
  img("ig-9", "burgundy", "Calanthe on Instagram", PHOTOS.callaLilies),
  img("ig-10", "olive", "Calanthe on Instagram", PHOTOS.stargazer),
  img("ig-11", "warm", "Calanthe on Instagram", PHOTOS.whiteRoseWood),
  img("ig-12", "olive", "Calanthe on Instagram", PHOTOS.pinkTulip),
] as const;

/* ------------------------------------------------------------------ */
/* Navigation (single source for header + footer)                      */
/* ------------------------------------------------------------------ */

export const primaryNavLinks = [
  { label: "About", href: "/about" },
  { label: "Shop", href: "/shop" },
  { label: "Memberships", href: "/membership" },
  { label: "Events", href: "/events" },
] as const;

/** The layered menu: a heading, then what sits under it. */
export const navTree = [
  { label: "About Calanthe", href: "/about", children: [] },
  {
    label: "Shop",
    href: "/shop",
    children: [
      { label: "Shop by Occasion", href: "/occasions" },
      { label: "Ready Made for Today", href: "/shop?ready=today" },
      { label: "Build Your Own", href: "/build-your-own" },
    ],
  },
  { label: "Memberships", href: "/membership", children: [] },
  {
    label: "Events",
    href: "/events",
    children: [
      { label: "Guest Favors", href: "/events#guest-favors" },
      { label: "Event Arrangements", href: "/events#arrangements" },
    ],
  },
] as const;

export const helpNavLinks = [
  { label: "Delivery Information", href: "/delivery" },
  { label: "FAQs", href: "/faqs" },
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Refund & Cancellation Policy", href: "/refund-policy" },
] as const;

/* ------------------------------------------------------------------ */
/* Trust layer (ALL numbers/logos are placeholders — client to confirm) */
/* ------------------------------------------------------------------ */

/** FLAGGED placeholder — replace with the client's real count/rating. */
export const TRUST = {
  customersLine: "14,000+ happy customers",
  ratingLine: "Rated 5 stars by our clients",
  guarantees: [
    { title: "Same-day delivery", copy: "Ordered before 5pm, at their door today." },
    {
      title: "Video approval",
      copy: "See your arrangement on WhatsApp before it leaves.",
    },
    {
      title: "Freshness guarantee",
      copy: "Composed the morning of delivery, never before.",
    },
    { title: "All seven Emirates", copy: "One atelier, delivering across the UAE." },
  ],
  /** FLAGGED placeholders — swap for real press logos when provided. */
  pressPlaceholders: ["Press One", "Press Two", "Press Three", "Press Four"],
} as const;

export const VIDEO_APPROVAL = {
  eyebrow: "Before it leaves the atelier",
  title: "See it before it's delivered.",
  copy: "When your arrangement is finished, your florist sends you a photo or video on WhatsApp. Nothing is delivered until you love it.",
  steps: [
    "We compose your arrangement by hand",
    "You receive a photo or video on WhatsApp",
    "Approve it, and it's on its way",
  ],
} as const;

export const CONTACT = {
  whatsapp: "+971 56 211 2733",
  whatsappHref: "https://wa.me/971562112733",
  instagramHandle: "@calanthe.ae",
  instagramHref: "https://instagram.com/calanthe.ae",
  email: "calanthe.ae@gmail.com",
  site: "www.calanthe.ae",
} as const;
