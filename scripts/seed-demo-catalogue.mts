/**
 * The demo catalogue, made real enough to shop.
 *
 * The ten products imported from the pre-database catalogue exist with their
 * photography still on an external host (`legacyImages`) and no words, so
 * every one of them is hidden and the shop has nothing to sell. Until the
 * client's own photography and copy arrive, this gives each product what the
 * storefront needs to be walked end to end — cards, detail, cart, checkout:
 *
 *   1. its two photographs, DOWNLOADED and uploaded through Payload as Media
 *      (so Vercel Blob holds them in production, and every hook and image
 *      size applies), attached in order — the first is the card;
 *   2. a short description and a description, in the brand's voice, only
 *      where the owner has not written her own;
 *   3. `available: true`.
 *
 * IDEMPOTENT AND CAUTIOUS. A product that already has photographs is left
 * exactly as it is — its images, its words, its availability. Nothing is
 * deleted. Run it twice and the second run does nothing.
 *
 * Run (development, from .env.local):
 *   node --env-file=.env.local --import ./scripts/register-aliases.mjs \
 *        scripts/seed-demo-catalogue.mts [--dry-run]
 * Against production, point --env-file at a pulled production env instead.
 *
 * A developer utility: never imported by the application.
 */
import { getPayload } from "payload";
import config from "../src/payload.config.ts";
import { plainTextToLexical } from "../src/backend/domain/richtext.ts";

const DRY = process.argv.includes("--dry-run");

/** Demo copy, by slug. Replaced by the owner's own words in /admin. */
const COPY: Record<string, { short: string; long: string }> = {
  "amber-hour": {
    short: "Apricot roses and soft tulips, gathered loosely and tied with raw silk.",
    long: "A late-afternoon bouquet: apricot garden roses, blush tulips and a few stems of grass for movement, wrapped in kraft and tied with raw silk.\n\nSent as a birthday wish, or for no reason at all.",
  },
  "quiet-devotion": {
    short: "Burgundy roses and peonies, set low and full in a matte ceramic vase.",
    long: "Deep burgundy roses and open peonies, arranged low and close so the colour reads as one. The vase is matte ceramic in the atelier's cream, and stays with the arrangement.\n\nFor the person you would rather show than tell.",
  },
  "the-first-letter": {
    short: "White peonies and pale tulips with a single line of eucalyptus.",
    long: "White peonies, pale tulips and one line of eucalyptus, loosely gathered and wrapped in cream paper.\n\nMade for beginnings — a new baby, a graduation, a first day.",
  },
  "bordeaux-whisper": {
    short: "Wine-dark roses set close in a black box, for the evenings that matter.",
    long: "Two dozen wine-dark roses, trimmed short and set close in a lidded black box so they arrive composed and stay that way.\n\nNo greenery, no wrapping — only the roses.",
  },
  "sage-and-cinder": {
    short: "Dried grasses, sage and pale everlastings — an arrangement that stays.",
    long: "Dried grasses, silver sage and pale everlastings in a small stoneware vase. Nothing here wilts; it softens.\n\nFor a desk, a hallway, or a friend who forgets to water things.",
  },
  "dawn-procession": {
    short: "Cream roses and lilies, tall and open, for a table that gathers people.",
    long: "Cream roses and oriental lilies arranged tall and open in a footed vessel, scaled for the centre of a long table.\n\nComposed for a celebration — a graduation dinner, a milestone birthday — and delivered ready to place.",
  },
  "velvet-hour": {
    short: "Mauve peonies in a lidded box, dense and unhurried.",
    long: "Mauve and dusk-pink peonies, fully open, set edge to edge in a lidded box the colour of deep olive.\n\nThe peony season is short; this is what it is for.",
  },
  "a-soft-reply": {
    short: "A white orchid in a woven basket — simple, sincere, long-lasting.",
    long: "A single white phalaenopsis orchid in a hand-woven basket, dressed with moss. It flowers for weeks and asks for very little.\n\nFor a new home, a new baby, or a quiet thank you.",
  },
  "the-long-stem": {
    short: "Twelve long-stem roses in a tall glass vase — the classic, done properly.",
    long: "Twelve long-stem roses in a single colour, their stems left long and set in a tall clear vase.\n\nThe arrangement everyone knows, composed the way it should be.",
  },
  "meadow-at-dusk": {
    short: "Lilies and field flowers, gathered as if from a walk at the end of the day.",
    long: "Pale lilies among wildflowers and field grasses, gathered loosely so nothing looks placed.\n\nA bouquet for someone who prefers a meadow to a florist's window.",
  },
};

type LegacyImage = { src?: string | null; alt?: string | null };
type ProductRow = {
  id: number;
  slug: string;
  name: string;
  available?: boolean | null;
  shortDescription?: string | null;
  description?: unknown;
  images?: unknown[] | null;
  legacyImages?: LegacyImage[] | null;
};

const payload = await getPayload({ config });
const products = (await payload.find({ collection: "products", limit: 100, depth: 0, sort: "sortOrder" })).docs as unknown as ProductRow[];
console.log(`${products.length} products${DRY ? " (dry run — nothing will be written)" : ""}\n`);

let touched = 0;
for (const product of products) {
  const label = product.slug.padEnd(18);
  if ((product.images?.length ?? 0) > 0) {
    console.log(`${label} has ${product.images!.length} photograph(s) already — left alone`);
    continue;
  }
  const refs = (product.legacyImages ?? []).filter((l): l is { src: string; alt: string } => Boolean(l.src && l.alt));
  if (refs.length === 0) {
    console.log(`${label} no photograph references — nothing to import`);
    continue;
  }

  const imageIds: number[] = [];
  for (const [i, ref] of refs.entries()) {
    const res = await fetch(ref.src);
    if (!res.ok) {
      console.log(`${label} photograph ${i + 1}: ${res.status} from the host — skipped`);
      continue;
    }
    const mimetype = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    const ext = mimetype === "image/png" ? "png" : mimetype === "image/webp" ? "webp" : "jpg";
    const data = Buffer.from(await res.arrayBuffer());
    if (DRY) {
      console.log(`${label} photograph ${i + 1}: ${(data.length / 1024).toFixed(0)} KB ${mimetype} — would upload`);
      continue;
    }
    const media = await payload.create({
      collection: "media",
      data: { alt: ref.alt, credit: "Demo photograph (Pexels licence) — replace with the atelier's own." } as never,
      file: { data, mimetype, name: `${product.slug}-${i + 1}.${ext}`, size: data.length },
    });
    imageIds.push(media.id as number);
    console.log(`${label} photograph ${i + 1}: uploaded as media ${media.id}`);
  }
  if (DRY) continue;
  if (imageIds.length === 0) {
    console.log(`${label} no photograph could be fetched — stays hidden`);
    continue;
  }

  const copy = COPY[product.slug];
  const update: Record<string, unknown> = {
    images: imageIds.map((id) => ({ image: id })),
    available: true,
  };

  /* Some imported products carry `trackStock` with a count of zero, and
     validateProduct refuses to publish those — correctly, since a live
     product nobody can buy is worse than a hidden one. The seed used to
     ignore stock entirely and died partway through the catalogue on the
     first such product, leaving it half seeded. Give a tracked product
     something to sell; leave untracked ones alone, because made-to-order
     arrangements are the norm here and turning tracking on would be a
     change of meaning, not a fix. */
  if (product.trackStock === true && (typeof product.stock !== "number" || product.stock <= 0)) {
    update.stock = 25;
  }
  if (copy && !product.shortDescription) update.shortDescription = copy.short;
  if (copy && !product.description) update.description = plainTextToLexical(copy.long);

  await payload.update({ collection: "products", id: product.id, data: update as never });
  touched += 1;
  console.log(`${label} ${imageIds.length} photograph(s) attached${copy ? ", words added" : ""}, now available`);
}

console.log(`\n${DRY ? "dry run complete" : `${touched} product(s) made available`}`);
process.exit(0);
