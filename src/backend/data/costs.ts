import { headers as nextHeaders } from "next/headers";
import { getPayload, type Payload } from "payload";
import config from "@payload-config";
import { activeRole } from "@backend/payload/access";
import {
  isCostGroup,
  isOneUnit,
  type CostEditorData,
  type CostItemRow,
  type InvoiceDetail,
  type InvoiceListRow,
  type ProductCostRecipe,
  type SupplierRow,
} from "@backend/domain/costs";
import { dubaiDateInputValue } from "@backend/domain/dates";
import type { CostItem, Invoice, ProductCost, Supplier } from "@/payload-types";

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

/** A populated supplier as `{ id, name }`, or null when it is only an id or missing. */
const supplierOf = (value: unknown): { id: number; name: string } | null => {
  if (!value || typeof value !== "object") return null;
  const { id, name } = value as Partial<Supplier>;
  return typeof id === "number" && typeof name === "string" ? { id, name } : null;
};

function toRow(doc: CostItem, usedIn: number): CostItemRow {
  const price = doc.currentUnitCostFils;
  return {
    id: doc.id,
    name: doc.name,
    group: isCostGroup(doc.group) ? doc.group : "packaging",
    priceForOneFils: typeof price === "number" && Number.isFinite(price) ? price : null,
    packName: doc.packName?.trim() || null,
    unitsPerPack: finite(doc.unitsPerPack, 1),
    one: isOneUnit(doc.one) ? doc.one : "piece",
    costSource: doc.costSource === "invoice" ? "invoice" : "typed",
    lastPaidAt: doc.lastPaidAt ?? null,
    lastSupplier: supplierOf(doc.lastSupplier),
    archived: doc.archived === true,
    notes: doc.notes?.trim() || null,
    aliases: (doc.aliases ?? []).map((alias) => alias.text).filter(Boolean),
    usedIn,
  };
}

/** Every "what goes in", read once: a small shop has tens of products, not thousands. */
async function allRecipes(owner: Owner): Promise<ProductCost[]> {
  const found = await owner.payload.find({
    collection: "product-costs",
    depth: 0,
    pagination: false,
    ...access(owner),
  });
  return found.docs;
}

/** How many arrangements each thing is in. Twice in one arrangement is one arrangement. */
function usageCounts(recipes: ProductCost[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const recipe of recipes) {
    const items = new Set((recipe.lines ?? []).map((line) => idOf(line.item)).filter((id): id is number => id !== null));
    for (const id of items) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/**
 * What you buy, by name — with the supplier its price came from. Things she
 * no longer buys only when asked.
 */
export async function listCostItems(opts: { includeArchived?: boolean } = {}): Promise<CostItemRow[]> {
  const owner = await asOwner();
  if (!owner) return [];
  const [items, recipes] = await Promise.all([
    owner.payload.find({
      collection: "cost-items",
      where: opts.includeArchived ? undefined : { archived: { not_equals: true } },
      sort: "name",
      /* The last supplier's name, for "last paid 26 Oct, Al Aweer". */
      depth: 1,
      pagination: false,
      ...access(owner),
    }),
    allRecipes(owner),
  ]);
  const counts = usageCounts(recipes);
  return items.docs.map((doc) => toRow(doc, counts.get(doc.id) ?? 0));
}

export type CostItemDetail = CostItemRow & {
  /** The arrangements that use it, and how many of it each takes. */
  usedInProducts: { id: number; name: string; quantity: number }[];
  /** Its price for one on its last 8 invoice lines, newest first. */
  recentPrices: {
    invoiceId: number;
    /** YYYY-MM-DD, in the UAE. */
    invoiceDate: string;
    supplier: { id: number; name: string } | null;
    packs: number;
    unitsPerPack: number;
    priceForOneFils: number;
  }[];
};

/** One thing she buys, with the arrangements that use it and its last 8 invoice prices. */
export async function getCostItem(id: number): Promise<CostItemDetail | null> {
  const owner = await asOwner();
  if (!owner || !Number.isInteger(id) || id <= 0) return null;

  const doc = await owner.payload
    .findByID({ collection: "cost-items", id, depth: 1, ...access(owner) })
    .catch(() => null);
  if (!doc) return null;

  const [recipes, invoices] = await Promise.all([
    owner.payload.find({
      collection: "product-costs",
      where: { "lines.item": { equals: id } },
      depth: 0,
      pagination: false,
      ...access(owner),
    }),
    owner.payload.find({
      collection: "invoices",
      where: { "lines.item": { equals: id } },
      sort: "-invoiceDate",
      limit: 8,
      depth: 1,
      ...access(owner),
    }),
  ]);

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

  const recentPrices = invoices.docs
    .sort((a, b) => (a.invoiceDate === b.invoiceDate ? b.id - a.id : a.invoiceDate < b.invoiceDate ? 1 : -1))
    .flatMap((invoice) =>
      (invoice.lines ?? [])
        .filter((line) => idOf(line.item) === id)
        .map((line) => ({
          invoiceId: invoice.id,
          invoiceDate: dubaiDateInputValue(invoice.invoiceDate),
          supplier: supplierOf(invoice.supplier),
          packs: finite(line.packs, 0),
          unitsPerPack: finite(line.unitsPerPack, 1),
          priceForOneFils: finite(line.priceForOneFils, 0),
        })),
    )
    .slice(0, 8);

  return { ...toRow(doc, usedInProducts.length), usedInProducts, recentPrices };
}

/** Her suppliers, by name. */
export async function listSuppliers(): Promise<SupplierRow[]> {
  const owner = await asOwner();
  if (!owner) return [];
  const found = await owner.payload.find({
    collection: "suppliers",
    sort: "name",
    depth: 0,
    pagination: false,
    ...access(owner),
  });
  return found.docs.map((doc) => ({
    id: doc.id,
    name: doc.name,
    phone: doc.phone?.trim() || null,
    notes: doc.notes?.trim() || null,
  }));
}

/** The total she reads for an invoice: as printed, or — with none typed — the lines plus delivery and VAT. */
function invoiceTotal(doc: Invoice): number {
  if (typeof doc.totalFils === "number" && Number.isFinite(doc.totalFils)) return doc.totalFils;
  const lines = (doc.lines ?? []).reduce((sum, line) => sum + finite(line.lineTotalFils, 0), 0);
  return lines + finite(doc.deliveryFils, 0) + finite(doc.vatFils, 0);
}

/** Every invoice, newest invoice date first (and, on one day, the one added last first). */
export async function listInvoices(): Promise<InvoiceListRow[]> {
  const owner = await asOwner();
  if (!owner) return [];
  const found = await owner.payload.find({
    collection: "invoices",
    sort: ["-invoiceDate", "-id"],
    depth: 1,
    pagination: false,
    ...access(owner),
  });
  return found.docs.map((doc) => ({
    id: doc.id,
    supplier: supplierOf(doc.supplier) ?? { id: idOf(doc.supplier) ?? 0, name: "" },
    invoiceNumber: doc.invoiceNumber?.trim() || null,
    invoiceDate: dubaiDateInputValue(doc.invoiceDate),
    totalFils: invoiceTotal(doc),
    lineCount: (doc.lines ?? []).length,
    source: doc.source === "photo" ? "photo" : "typed",
    createdAt: doc.createdAt,
  }));
}

/** One invoice, as its editor opens it, with each line's thing named. */
export async function getInvoice(id: number): Promise<InvoiceDetail | null> {
  const owner = await asOwner();
  if (!owner || !Number.isInteger(id) || id <= 0) return null;
  const doc = await owner.payload
    .findByID({ collection: "invoices", id, depth: 1, ...access(owner) })
    .catch(() => null);
  if (!doc) return null;

  return {
    id: doc.id,
    supplier: supplierOf(doc.supplier) ?? { id: idOf(doc.supplier) ?? 0, name: "" },
    invoiceNumber: doc.invoiceNumber?.trim() || null,
    invoiceDate: dubaiDateInputValue(doc.invoiceDate),
    deliveryFils: finite(doc.deliveryFils, 0),
    vatFils: finite(doc.vatFils, 0),
    totalFils: typeof doc.totalFils === "number" && Number.isFinite(doc.totalFils) ? doc.totalFils : null,
    source: doc.source === "photo" ? "photo" : "typed",
    notes: doc.notes?.trim() || null,
    createdAt: doc.createdAt,
    lines: (doc.lines ?? []).map((line) => {
      const item = typeof line.item === "object" && line.item !== null ? line.item : null;
      return {
        itemId: idOf(line.item) ?? 0,
        name: item?.name ?? "",
        group: item && isCostGroup(item.group) ? item.group : "packaging",
        one: item && isOneUnit(item.one) ? item.one : "piece",
        printedName: line.printedName?.trim() || null,
        packs: finite(line.packs, 0),
        unitsPerPack: finite(line.unitsPerPack, 1),
        units: finite(line.units, 0),
        lineTotalFils: finite(line.lineTotalFils, 0),
        priceForOneFils: finite(line.priceForOneFils, 0),
      };
    }),
  };
}

/**
 * Everything the product editor's Cost section needs, or null for anyone but
 * the owner — the page passes that straight on, and the section is not drawn.
 *
 * `productId` null is a new product: no "what goes in" yet, only what she buys.
 */
export async function getCostEditorData(productId: number | null): Promise<CostEditorData | null> {
  const owner = await asOwner();
  if (!owner) return null;

  const [active, recipeDoc, recipes] = await Promise.all([
    owner.payload.find({
      collection: "cost-items",
      where: { archived: { not_equals: true } },
      sort: "name",
      depth: 1,
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
      }
    : null;

  /* Something she no longer buys that this arrangement still uses must stay
     visible in the editor, marked, or the product would silently lose part
     of its cost. */
  const activeIds = new Set(active.docs.map((doc) => doc.id));
  const archivedIds = (recipe?.lines ?? []).map((line) => line.itemId).filter((id) => !activeIds.has(id));
  const archived =
    archivedIds.length === 0
      ? []
      : (
          await owner.payload.find({
            collection: "cost-items",
            where: { id: { in: archivedIds } },
            depth: 1,
            pagination: false,
            ...access(owner),
          })
        ).docs;

  const counts = usageCounts(recipes);
  const items = [...active.docs, ...archived]
    .map((doc) => toRow(doc, counts.get(doc.id) ?? 0))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { recipe, items };
}
