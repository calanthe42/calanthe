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
  return `AED ${price}`;
}
