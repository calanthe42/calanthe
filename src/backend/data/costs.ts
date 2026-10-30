import { headers as nextHeaders } from "next/headers";
import { getPayload, type Payload } from "payload";
import config from "@payload-config";
import { activeRole } from "@backend/payload/access";
import {
  DEFAULT_COST_SETTINGS,
  isCostKind,
  isUseUnit,
  type CostEditorData,
  type CostItemRow,
  type CostSettingsValues,
  type ProductCostRecipe,
} from "@backend/domain/costs";
import type { CostItem, ProductCost } from "@/payload-types";

/**
 * What the admin's costs screens and the product editor's Cost section read.
 *
 * AS THE OWNER, NEVER AROUND HER. Every read passes the signed-in user with
 * `overrideAccess: false`, so the owner-only collections decide; anyone else
 * gets the empty answer (no rows, no editor) without a query being tried.
 * There is deliberately no bypass in this file: costs reach no storefront,
 * no public API and no florist.
 *
 * No `import "server-only"`, for the same reason as data/products.ts: the
 * Payload CLI loads this graph in plain Node.
 */

type Owner = { payload: Payload; user: unknown };

async function asOwner(): Promise<Owner | null> {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });
  return activeRole(user) === "admin" ? { payload, user } : null;
}

const access = (owner: Owner) => ({ user: owner.user as never, overrideAccess: false as const });

const finite = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const idOf = (value: unknown): number | null => {
  const id = typeof value === "object" && value !== null ? (value as { id?: unknown }).id : value;
  return typeof id === "number" && Number.isInteger(id) ? id : null;
};

async function readSettings(owner: Owner): Promise<CostSettingsValues> {
  /* The global may never have been saved: every value falls back to the
     code's default on its own, so a half-filled row is still a whole answer. */
  const stored = await owner.payload
    .findGlobal({ slug: "cost-settings", depth: 0, ...access(owner) })
    .catch(() => null);
  return {
    targetMarginPercent: finite(stored?.targetMarginPercent, DEFAULT_COST_SETTINGS.targetMarginPercent),
    labourRatePerHourFils: finite(stored?.labourRatePerHourFils, DEFAULT_COST_SETTINGS.labourRatePerHourFils),
    defaultWastePercent: finite(stored?.defaultWastePercent, DEFAULT_COST_SETTINGS.defaultWastePercent),
    vatReclaimable:
      typeof stored?.vatReclaimable === "boolean" ? stored.vatReclaimable : DEFAULT_COST_SETTINGS.vatReclaimable,
    vatRatePercent: finite(stored?.vatRatePercent, DEFAULT_COST_SETTINGS.vatRatePercent),
  };
}

function toRow(doc: CostItem, usedIn: number): CostItemRow {
  return {
    id: doc.id,
    name: doc.name,
    kind: isCostKind(doc.kind) ? doc.kind : "other",
    useUnit: isUseUnit(doc.useUnit) ? doc.useUnit : "piece",
    packName: doc.packName?.trim() || null,
    unitsPerPack: finite(doc.unitsPerPack, 1),
    currentUnitCostFils: finite(doc.currentUnitCostFils, 0),
    costSource: doc.costSource === "purchase" ? "purchase" : "manual",
    swatch: doc.swatch || null,
    archived: doc.archived === true,
    notes: doc.notes?.trim() || null,
    aliases: (doc.aliases ?? []).map((alias) => alias.text).filter(Boolean),
    usedIn,
  };
}

/** Every recipe, read once: a small shop has tens of products, not thousands. */
async function allRecipes(owner: Owner): Promise<ProductCost[]> {
  const found = await owner.payload.find({
    collection: "product-costs",
    depth: 0,
    pagination: false,
    ...access(owner),
  });
  return found.docs;
}

/** How many products each item is in. An item twice in one recipe is one product. */
function usageCounts(recipes: ProductCost[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const recipe of recipes) {
    const items = new Set((recipe.lines ?? []).map((line) => idOf(line.item)).filter((id): id is number => id !== null));
    for (const id of items) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** The owner's costing settings, or the defaults until she saves her own. */
export async function getCostSettings(): Promise<CostSettingsValues> {
  const owner = await asOwner();
  return owner ? readSettings(owner) : { ...DEFAULT_COST_SETTINGS };
}

/** The flowers and materials library, by name. Archived items only when asked. */
export async function listCostItems(opts: { includeArchived?: boolean } = {}): Promise<CostItemRow[]> {
  const owner = await asOwner();
  if (!owner) return [];
  const [items, recipes] = await Promise.all([
    owner.payload.find({
      collection: "cost-items",
      where: opts.includeArchived ? undefined : { archived: { not_equals: true } },
      sort: "name",
      depth: 0,
      pagination: false,
      ...access(owner),
    }),
    allRecipes(owner),
  ]);
  const counts = usageCounts(recipes);
  return items.docs.map((doc) => toRow(doc, counts.get(doc.id) ?? 0));
}

/** One item, with the products whose recipe uses it and how much of it each takes. */
export async function getCostItem(
  id: number,
): Promise<(CostItemRow & { usedInProducts: { id: number; name: string; quantity: number }[] }) | null> {
  const owner = await asOwner();
  if (!owner || !Number.isInteger(id) || id <= 0) return null;

  const doc = await owner.payload
    .findByID({ collection: "cost-items", id, depth: 0, ...access(owner) })
    .catch(() => null);
  if (!doc) return null;

  const recipes = await owner.payload.find({
    collection: "product-costs",
    where: { "lines.item": { equals: id } },
    depth: 0,
    pagination: false,
    ...access(owner),
  });

  const quantities = new Map<number, number>();
  for (const recipe of recipes.docs) {
    const productId = idOf(recipe.product);
    if (productId === null) continue;
    const quantity = (recipe.lines ?? [])
      .filter((line) => idOf(line.item) === id)
      .reduce((sum, line) => sum + finite(line.quantity, 0), 0);
    quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
  }

  const productIds = [...quantities.keys()];
  const products =
    productIds.length === 0
      ? []
      : (
          await owner.payload.find({
            collection: "products",
            where: { id: { in: productIds } },
            depth: 0,
            pagination: false,
            select: { name: true },
            ...access(owner),
          })
        ).docs;

  const usedInProducts = products
    .map((product) => ({ id: product.id, name: String(product.name ?? ""), quantity: quantities.get(product.id) ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { ...toRow(doc, usedInProducts.length), usedInProducts };
}

/**
 * Everything the product editor's Cost section needs, or null for anyone but
 * the owner — the page passes that straight on, and the section is not drawn.
 *
 * `productId` null is a new product: no recipe yet, the library and her
 * settings only.
 */
export async function getCostEditorData(productId: number | null): Promise<CostEditorData | null> {
  const owner = await asOwner();
  if (!owner) return null;

  const [settings, active, recipeDoc, recipes] = await Promise.all([
    readSettings(owner),
    owner.payload.find({
      collection: "cost-items",
      where: { archived: { not_equals: true } },
      sort: "name",
      depth: 0,
      pagination: false,
      ...access(owner),
    }),
    productId === null
      ? Promise.resolve(null)
      : owner.payload
          .find({
            collection: "product-costs",
            where: { product: { equals: productId } },
            limit: 1,
            depth: 0,
            ...access(owner),
          })
          .then((found) => found.docs[0] ?? null),
    allRecipes(owner),
  ]);

  const recipe: ProductCostRecipe | null = recipeDoc
    ? {
        lines: (recipeDoc.lines ?? [])
          .map((line) => ({ itemId: idOf(line.item), quantity: finite(line.quantity, 0) }))
          .filter((line): line is { itemId: number; quantity: number } => line.itemId !== null && line.quantity > 0),
        wastePercent: finite(recipeDoc.wastePercent, settings.defaultWastePercent),
        makingMinutes: finite(recipeDoc.makingMinutes, 0),
      }
    : null;

  /* An archived item the recipe still uses must stay visible in the editor,
     marked, or the product would silently lose part of its cost. */
  const activeIds = new Set(active.docs.map((doc) => doc.id));
  const archivedIds = (recipe?.lines ?? []).map((line) => line.itemId).filter((id) => !activeIds.has(id));
  const archived =
    archivedIds.length === 0
      ? []
      : (
          await owner.payload.find({
            collection: "cost-items",
            where: { id: { in: archivedIds } },
            depth: 0,
            pagination: false,
            ...access(owner),
          })
        ).docs;

  const counts = usageCounts(recipes);
  const items = [...active.docs, ...archived]
    .map((doc) => toRow(doc, counts.get(doc.id) ?? 0))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { recipe, items, settings };
}
