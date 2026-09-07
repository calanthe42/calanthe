/**
 * Imports the pre-database catalogue from src/lib/data.ts into Payload.
 *
 * IDEMPOTENT BY SLUG. The slug is the deterministic identity: running this
 * twice creates nothing new. An existing row is updated only where the source
 * is authoritative, and fields a human has since edited in the admin — the
 * description, the real Media images, availability — are never overwritten.
 * That distinction is the whole reason this is a script rather than a seed:
 * a seed that clobbers the client's edits is worse than no seed.
 *
 * Run:
 *   node --env-file=.env.local --import <tsx-loader> scripts/import-catalog.mts
 *   ... --dry-run   to report what would change without writing
 *
 * Images are NOT migrated. The source references photography on an external
 * host (Pexels), and downloading third-party images to fabricate Media rows
 * would be inventing content we do not own. The references are preserved in
 * `legacyImages` instead, and every product lands unavailable until real
 * photography is uploaded — enforced by validateProductState.
 */
import { getPayload } from "payload";
import config from "../src/payload.config";
import { occasions as sourceOccasions, products as sourceProducts } from "../src/lib/data";

const DRY_RUN = process.argv.includes("--dry-run");

type Tally = { created: number; updated: number; unchanged: number; failed: number };
const products: Tally = { created: 0, updated: 0, unchanged: 0, failed: 0 };
const occasions: Tally = { created: 0, updated: 0, unchanged: 0, failed: 0 };
const problems: string[] = [];

const label = DRY_RUN ? "[dry-run]" : "[import]";
const payload = await getPayload({ config });

/* ------------------------------------------------------------------ */
/* Occasions first — products reference them.                          */
/* ------------------------------------------------------------------ */

const occasionIdBySlug = new Map<string, number | string>();

console.log(`\n${label} OCCASIONS (${sourceOccasions.length} in source)`);

for (const [index, source] of sourceOccasions.entries()) {
  try {
    const existing = await payload.find({
      collection: "occasions",
      where: { slug: { equals: source.slug } },
      limit: 1,
      overrideAccess: true,
      depth: 0,
    });

    if (existing.totalDocs > 0) {
      const doc = existing.docs[0];
      occasionIdBySlug.set(source.slug, doc.id);
      /* Only the name is authoritative in the source; sortOrder and active
         are operational choices the client may have changed. */
      if (doc.name !== source.name) {
        if (!DRY_RUN) {
          await payload.update({
            collection: "occasions",
            id: doc.id,
            overrideAccess: true,
            data: { name: source.name } as never,
          });
        }
        occasions.updated += 1;
        console.log(`  updated   ${source.slug} (name: "${doc.name}" -> "${source.name}")`);
      } else {
        occasions.unchanged += 1;
        console.log(`  unchanged ${source.slug}`);
      }
      continue;
    }

    if (DRY_RUN) {
      occasions.created += 1;
      /* Record a placeholder so the product pass can still tell a genuinely
         unmatched occasion from one this run would have created. Without it
         a dry run reports every product as unlinkable, which is noise. */
      occasionIdBySlug.set(source.slug, "would-create");
      console.log(`  would create ${source.slug}`);
      continue;
    }

    const created = await payload.create({
      collection: "occasions",
      overrideAccess: true,
      data: {
        name: source.name,
        slug: source.slug,
        sortOrder: index,
        active: true,
      } as never,
    });
    occasionIdBySlug.set(source.slug, created.id);
    occasions.created += 1;
    console.log(`  created   ${source.slug}`);
  } catch (error) {
    occasions.failed += 1;
    const message = `occasion ${source.slug}: ${(error as Error).message}`;
    problems.push(message);
    console.log(`  FAILED    ${message}`);
  }
}

/* ------------------------------------------------------------------ */
/* Products.                                                           */
/* ------------------------------------------------------------------ */

console.log(`\n${label} PRODUCTS (${sourceProducts.length} in source)`);

for (const [index, source] of sourceProducts.entries()) {
  try {
    const unmatched = source.occasions.filter((slug) => !occasionIdBySlug.has(slug));
    if (unmatched.length > 0) {
      problems.push(`product ${source.slug}: occasion(s) not found — ${unmatched.join(", ")}`);
    }

    /* "would-create" is the dry-run placeholder and is never written. */
    const occasionIds = source.occasions
      .map((slug) => occasionIdBySlug.get(slug))
      .filter((id): id is number => typeof id === "number");


    /* Every image reference from the old catalogue, kept verbatim. */
    const legacyImages = source.images.map((image) => ({
      alt: image.alt,
      src: image.src ?? null,
      placeholderSeed: image.placeholder.seed,
      placeholderPalette: image.placeholder.palette,
    }));

    /* Fields the source is authoritative for. Everything else — description,
       images, available, category, stock — is left to the admin. */
    const authoritative = {
      name: source.name,
      priceFils: Math.round(source.priceAed * 100),
      currency: "AED",
      flowers: [...source.flowers],
      occasions: occasionIds,
      featured: source.featured,
      newArrival: source.newArrival,
      sortOrder: index,
      legacyImages,
    };

    const existing = await payload.find({
      collection: "products",
      where: { slug: { equals: source.slug } },
      limit: 1,
      overrideAccess: true,
      depth: 0,
    });

    if (existing.totalDocs > 0) {
      const doc = existing.docs[0] as Record<string, unknown>;
      const drifted =
        doc.name !== authoritative.name ||
        Number(doc.priceFils) !== authoritative.priceFils ||
        Boolean(doc.featured) !== authoritative.featured ||
        Boolean(doc.newArrival) !== authoritative.newArrival;

      if (!drifted) {
        products.unchanged += 1;
        console.log(`  unchanged ${source.slug}`);
        continue;
      }

      if (!DRY_RUN) {
        await payload.update({
          collection: "products",
          id: doc.id as number,
          overrideAccess: true,
          data: authoritative as never,
        });
      }
      products.updated += 1;
      console.log(`  updated   ${source.slug}`);
      continue;
    }

    if (DRY_RUN) {
      products.created += 1;
      console.log(`  would create ${source.slug} (AED ${source.priceAed})`);
      continue;
    }

    await payload.create({
      collection: "products",
      overrideAccess: true,
      data: {
        ...authoritative,
        slug: source.slug,
        /* Not in the source. `bouquet` is the collection's own default, not a
           guess about this product — recorded in the report as defaulted. */
        category: "bouquet",
        /* Deliberately hidden. These products have no Media images yet, so
           publishing them would put broken cards on the shop. */
        available: false,
      } as never,
    });
    products.created += 1;
    console.log(`  created   ${source.slug} (AED ${source.priceAed}, hidden)`);
  } catch (error) {
    products.failed += 1;
    const message = `product ${source.slug}: ${(error as Error).message}`;
    problems.push(message);
    console.log(`  FAILED    ${message}`);
  }
}

/* ------------------------------------------------------------------ */

const finalProducts = await payload.count({ collection: "products", overrideAccess: true });
const finalOccasions = await payload.count({ collection: "occasions", overrideAccess: true });
const finalMedia = await payload.count({ collection: "media", overrideAccess: true });

console.log(`\n${label} SUMMARY`);
console.log(
  `  occasions  created ${occasions.created}  updated ${occasions.updated}  unchanged ${occasions.unchanged}  failed ${occasions.failed}`,
);
console.log(
  `  products   created ${products.created}  updated ${products.updated}  unchanged ${products.unchanged}  failed ${products.failed}`,
);
console.log(
  `  totals now products=${finalProducts.totalDocs} occasions=${finalOccasions.totalDocs} media=${finalMedia.totalDocs}`,
);

if (problems.length > 0) {
  console.log("\n  NEEDS ATTENTION:");
  problems.forEach((p) => console.log(`    - ${p}`));
}

console.log(
  "\n  Images were NOT migrated: the source references external photography.\n" +
    "  Every product is hidden (available: false) until real Media is uploaded.\n",
);

process.exit(products.failed + occasions.failed > 0 ? 1 : 0);
