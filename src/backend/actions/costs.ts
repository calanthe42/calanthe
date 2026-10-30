"use server";

import { headers as nextHeaders } from "next/headers";
import {
  commitTransaction,
  createLocalReq,
  getPayload,
  initTransaction,
  killTransaction,
  type Payload,
  type PayloadRequest,
} from "payload";
import config from "@payload-config";
import { diffFields, recordActivity } from "@backend/activity/record";
import { CostInputError, parseCostItemForm, parseInvoiceInput, type ParsedInvoice } from "@backend/domain/cost-forms";
import {
  invoiceExtrasFils,
  invoicePricesForOne,
  invoiceUnits,
  isOneUnit,
  latestPrices,
  normaliseName,
  type InvoiceInput,
  type InvoiceResult,
  type OneUnit,
  type PriceChange,
  type PricedLine,
} from "@backend/domain/costs";
import { dubaiDateInputValue } from "@backend/domain/dates";
import { BUSINESS } from "@/lib/business";
import type { CostItem, Invoice, Supplier } from "@/payload-types";
import { actorOf, failure, type ActionResult, type Failure } from "./admin-shared";
import { OWNER_ONLY, isOwner, revalidateCosts } from "./costs-shared";

/**
 * Every write the owner makes to her costs: her invoices (the one way she
 * adds information), and the one-sentence form for something she buys. What
 * goes into a product is saved by the product's own Save (actions/admin.ts,
 * through actions/costs-shared.ts).
 *
 * OWNER ONLY, TWICE. Each action checks the signed-in person is the owner
 * before it reads a field, and answers anyone else with
 * `actions.costs.ownerOnly`. Then every Payload call passes that user with
 * `overrideAccess: false`, so the owner-only collections refuse a florist
 * on their own as well — if the first wall is ever got wrong, the second
 * still holds.
 *
 * AN INVOICE IS SAVED WHOLE OR NOT AT ALL. Saving one may create a supplier
 * and new things she buys, store the invoice, and reprice everything on it;
 * all of that runs in one database transaction, so a failure half-way
 * leaves no new supplier and no orphan "Spray rose" behind.
 *
 * Parsing is in backend/domain/cost-forms.ts and the arithmetic in
 * backend/domain/costs.ts (pure, tested); the types the screens send and
 * receive (`InvoiceInput`, `InvoiceResult`) live there too, because a
 * "use server" file may export nothing but async functions.
 */

const LOGGED = ["name", "group", "packName", "unitsPerPack", "one", "currentUnitCostFils", "costSource", "archived"] as const;

/** A printed name is learned at most this often per thing; the oldest go first. */
const ALIASES_KEPT = 30;

async function authed() {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });
  return { payload, user };
}

/** A mistake in what she typed is shown as written; anything else is a sentence. */
function costFailure(error: unknown, fallback: string, fallbackCode: string): Failure & { field?: string } {
  if (error instanceof CostInputError) {
    return { ok: false, message: error.message, code: error.code, vars: error.vars, field: error.field };
  }
  /* A unique index tripped by two saves at the same moment: the checks
     before the write passed for both. Never "That web address is in use". */
  const raw = error instanceof Error ? error.message : "";
  if (/duplicate key|unique constraint/i.test(raw)) {
    return {
      ok: false,
      message: "That is already saved. Refresh the page and check before adding it again.",
      code: "actions.costs.alreadySaved",
    };
  }
  return failure(error, fallback, fallbackCode);
}

/**
 * An InvoiceResult failure, from anything; `code` is always set, as the
 * contract promises. Beyond her own typing mistakes, what went wrong inside
 * the database is never shown to her as it came: everything was rolled
 * back, and that is the sentence she needs.
 */
function invoiceFailure(error: unknown, fallback: string, fallbackCode: string): Extract<InvoiceResult, { ok: false }> {
  const result = costFailure(error, fallback, fallbackCode);
  const known = error instanceof CostInputError || result.code === "actions.costs.alreadySaved" || result.code === "actions.permission";
  if (!known) return { ok: false, message: fallback, code: fallbackCode };
  return {
    ok: false,
    message: result.message,
    code: result.code ?? fallbackCode,
    ...(result.field ? { field: result.field } : {}),
    ...(result.vars ? { vars: result.vars } : {}),
  };
}

const parseId = (raw: FormDataEntryValue | null): number | undefined => {
  const id = typeof raw === "string" ? Number(raw) : Number.NaN;
  return Number.isInteger(id) && id > 0 ? id : undefined;
};

const idOf = (value: unknown): number | null => {
  const id = typeof value === "object" && value !== null ? (value as { id?: unknown }).id : value;
  return typeof id === "number" && Number.isInteger(id) ? id : null;
};

const lower = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();

/** "26 Oct 2026", in the UAE. */
const dayText = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dubai" }).format(
    new Date(iso),
  );

/**
 * An invoice's day as stored: MIDDAY in the UAE (08:00 UTC). Midday, not
 * midnight, so the day reads the same in every timezone a server or a
 * report might use, while every month boundary taken at UAE midnight
 * (backend/domain/dates.ts `uaeMidnight`) still puts it in the right month.
 */
const middayIso = (day: string) => new Date(`${day}T12:00:00+04:00`).toISOString();

/** Today in the UAE, YYYY-MM-DD. */
const uaeToday = () => dubaiDateInputValue(new Date().toISOString());

type Access = { req: PayloadRequest; user: never; overrideAccess: false };

/**
 * Something already in her list with that name, whatever its case — or
 * none. The database's unique index is case-sensitive, and "Peach rose"
 * beside "peach rose" is the same flower twice.
 */
async function itemNamed(payload: Payload, access: Access | { user: never; overrideAccess: false }, name: string) {
  const found = await payload.find({
    collection: "cost-items",
    where: { name: { like: name } },
    limit: 50,
    depth: 0,
    ...access,
  });
  return found.docs.find((doc) => lower(doc.name) === lower(name)) ?? null;
}

/* ------------------------------------------------------------------ */
/* Something she buys                                                  */
/* ------------------------------------------------------------------ */

/**
 * "[Peach Avalanche rose] comes as a [bunch] of [20] [stems]", and — only
 * while it has no invoice price — "I paid AED [ ] for one".
 *
 * A price from an invoice is never overwritten from here: the invoice is
 * the record, and the next one will change it anyway. A price she types for
 * something with no invoice yet makes it hers (`costSource: "typed"`);
 * leaving the box empty keeps the price there is.
 */
export async function saveCostItem(form: FormData): Promise<ActionResult> {
  const { payload, user } = await authed();
  if (!isOwner(user)) return OWNER_ONLY;
  try {
    const id = parseId(form.get("id"));
    const parsed = parseCostItemForm(form);
    const access = { user: user as never, overrideAccess: false as const };

    const existing = id ? await payload.findByID({ collection: "cost-items", id, depth: 0, ...access }) : null;

    const taken = await itemNamed(payload, access, parsed.name);
    if (taken && taken.id !== existing?.id) {
      return {
        ok: false,
        message: `“${parsed.name}” is already in what you buy.`,
        code: "actions.costs.nameTaken",
        vars: { name: parsed.name },
      };
    }

    const fromInvoice = existing?.costSource === "invoice";
    const price: Pick<CostItem, "costSource"> & { currentUnitCostFils?: number | null } =
      !fromInvoice && parsed.priceFils !== null
        ? { currentUnitCostFils: parsed.priceFils, costSource: "typed" }
        : existing
          ? { costSource: existing.costSource }
          : { currentUnitCostFils: null, costSource: "typed" };

    const data: Omit<CostItem, "id" | "updatedAt" | "createdAt"> = {
      name: parsed.name,
      group: parsed.group,
      packName: parsed.packName,
      unitsPerPack: parsed.unitsPerPack,
      one: parsed.one,
      archived: parsed.archived,
      ...price,
    };

    const doc = existing
      ? await payload.update({ collection: "cost-items", id: existing.id, data, depth: 0, ...access })
      : await payload.create({ collection: "cost-items", data, depth: 0, ...access });

    await recordActivity(payload, {
      actor: actorOf(user),
      action: existing ? "update" : "create",
      area: "other",
      collection: "cost-items",
      itemId: doc.id,
      itemLabel: doc.name,
      changes: diffFields(
        (existing ?? {}) as unknown as Record<string, unknown>,
        doc as unknown as Record<string, unknown>,
        LOGGED,
      ),
    });

    revalidateCosts();
    return existing
      ? { ok: true, message: `“${doc.name}” saved.`, code: "actions.costs.itemSaved", vars: { name: doc.name }, id: doc.id }
      : {
          ok: true,
          message: `“${doc.name}” added to what you buy.`,
          code: "actions.costs.itemCreated",
          vars: { name: doc.name },
          id: doc.id,
        };
  } catch (error) {
    return costFailure(error, "It could not be saved.", "actions.costs.saveFailed");
  }
}

/**
 * "I don't buy this any more", or "I buy this again". It leaves the lists
 * she picks from, and stays on every invoice and in every arrangement that
 * names it, so nothing silently loses part of its cost.
 */
export async function archiveCostItem(id: number, archived: boolean): Promise<ActionResult> {
  const { payload, user } = await authed();
  if (!isOwner(user)) return OWNER_ONLY;
  try {
    const access = { user: user as never, overrideAccess: false as const };
    const existing = await payload.findByID({ collection: "cost-items", id, depth: 0, ...access });
    const doc = await payload.update({
      collection: "cost-items",
      id,
      data: { archived: archived === true },
      depth: 0,
      ...access,
    });

    await recordActivity(payload, {
      actor: actorOf(user),
      action: "update",
      area: "other",
      collection: "cost-items",
      itemId: id,
      itemLabel: doc.name,
      changes: diffFields(
        existing as unknown as Record<string, unknown>,
        doc as unknown as Record<string, unknown>,
        ["archived"],
      ),
    });

    revalidateCosts();
    return archived
      ? {
          ok: true,
          message: `You don't buy “${doc.name}” any more. Arrangements that use it still show it.`,
          code: "actions.costs.itemArchived",
          vars: { name: doc.name },
          id,
        }
      : {
          ok: true,
          message: `“${doc.name}” is back in what you buy.`,
          code: "actions.costs.itemRestored",
          vars: { name: doc.name },
          id,
        };
  } catch (error) {
    return costFailure(error, "It could not be changed.", "actions.costs.archiveFailed");
  }
}

/* ------------------------------------------------------------------ */
/* Invoices                                                            */
/* ------------------------------------------------------------------ */

type ItemPlan = { doc: CostItem; data: Record<string, unknown> };

/**
 * Set the price of each of `itemIds` from its latest remaining invoice line
 * (backend/domain/costs.ts `latestPrices`), and plan the update — written
 * by the caller together with anything else the item gains (a printed name),
 * so each thing is written once.
 *
 * Something with no invoice left keeps the price it has: it is still the
 * last price she paid, and a blank would turn every arrangement that uses it
 * into "at least". It becomes `typed`, the price she can now change by hand,
 * and loses the "last paid" day and supplier, which no invoice backs any more.
 */
async function planPrices(
  payload: Payload,
  access: Access,
  items: Map<number, CostItem>,
  unarchiveFrom: number | null,
): Promise<Map<number, ItemPlan>> {
  const ids = [...items.keys()];
  const plans = new Map<number, ItemPlan>();
  if (ids.length === 0) return plans;

  const invoices = await payload.find({
    collection: "invoices",
    where: { "lines.item": { in: ids } },
    depth: 0,
    pagination: false,
    ...access,
  });

  const wanted = new Set(ids);
  const lines: PricedLine[] = [];
  for (const invoice of invoices.docs) {
    const supplierId = idOf(invoice.supplier);
    if (supplierId === null) continue;
    for (const line of invoice.lines ?? []) {
      const itemId = idOf(line.item);
      if (itemId === null || !wanted.has(itemId)) continue;
      lines.push({
        itemId,
        invoiceId: invoice.id,
        invoiceDate: invoice.invoiceDate,
        supplierId,
        units: line.units,
        priceForOneFils: line.priceForOneFils ?? 0,
      });
    }
  }
  const latest = latestPrices(lines);

  for (const [id, doc] of items) {
    const price = latest.get(id);
    const data: Record<string, unknown> = {};
    if (price) {
      if (doc.currentUnitCostFils !== price.priceForOneFils) data.currentUnitCostFils = price.priceForOneFils;
      if (doc.costSource !== "invoice") data.costSource = "invoice";
      if (doc.lastPaidAt !== price.invoiceDate) data.lastPaidAt = price.invoiceDate;
      if (idOf(doc.lastSupplier) !== price.supplierId) data.lastSupplier = price.supplierId;
      /* She bought it again: it is back on her list — but only when this
         invoice is the newest one for it, not an old invoice typed late. */
      if (doc.archived && unarchiveFrom !== null && price.invoiceId === unarchiveFrom) data.archived = false;
    } else if (doc.costSource === "invoice" || doc.lastPaidAt || doc.lastSupplier) {
      data.costSource = "typed";
      data.lastPaidAt = null;
      data.lastSupplier = null;
    }
    plans.set(id, { doc, data });
  }
  return plans;
}

/**
 * The printed name, learned as one of the item's names on the invoice, so
 * the next invoice from the same supplier is matched by itself
 * (backend/domain/costs.ts `matchItem`). Its own name, and a name it
 * already has, are not learned twice.
 */
function learnAlias(plan: ItemPlan, printed: string | null) {
  if (!printed) return;
  const key = normaliseName(printed);
  if (!key || key === normaliseName(plan.doc.name)) return;
  const current = (plan.data.aliases as { text: string }[] | undefined) ?? (plan.doc.aliases ?? []).map(({ text }) => ({ text }));
  if (current.some((alias) => normaliseName(alias.text) === key)) return;
  plan.data.aliases = [...current, { text: printed.slice(0, 80) }].slice(-ALIASES_KEPT);
}

async function writePlans(payload: Payload, access: Access, plans: Map<number, ItemPlan>) {
  for (const [id, plan] of plans) {
    if (Object.keys(plan.data).length === 0) continue;
    const doc = await payload.update({ collection: "cost-items", id, data: plan.data, depth: 0, ...access });
    plan.doc = doc;
  }
}

/** Her supplier by id, or by name — created the first time she types it. */
async function resolveSupplier(
  payload: Payload,
  access: Access,
  supplier: ParsedInvoice["supplier"],
): Promise<{ doc: Supplier; created: boolean }> {
  if ("id" in supplier) {
    const doc = await payload.findByID({ collection: "suppliers", id: supplier.id, depth: 0, ...access }).catch(() => null);
    if (!doc) {
      throw new CostInputError(
        "That supplier could not be found. Choose another, or type the name.",
        "supplierGone",
        undefined,
        "supplier",
      );
    }
    return { doc, created: false };
  }
  const found = await payload.find({
    collection: "suppliers",
    where: { name: { like: supplier.name } },
    limit: 50,
    depth: 0,
    ...access,
  });
  const same = found.docs.find((doc) => lower(doc.name) === lower(supplier.name));
  if (same) return { doc: same, created: false };
  const doc = await payload.create({ collection: "suppliers", data: { name: supplier.name }, depth: 0, ...access });
  return { doc, created: true };
}

/**
 * Add an invoice, or change one — typed by her tonight, read from a photo
 * in a later step; the same action either way.
 *
 * In order, all in one transaction: the supplier (created if new); the
 * same invoice twice refused, naming the day she added it; the things on
 * it (new ones created, a new name that is already on her list taken as
 * that one); each line's units and price for one (its share of delivery,
 * and of supplier VAT while the shop is not VAT-registered); the invoice
 * stored; then every thing on it — and on the invoice as it was before an
 * edit — repriced from its latest invoice line, and each printed name
 * learned.
 *
 * Answers what changed: every thing on the invoice once, in line order,
 * with its price for one before and now (the same when an older invoice was
 * typed late; `beforeFils` null when it had no price).
 */
export async function saveInvoice(input: InvoiceInput): Promise<InvoiceResult> {
  const { payload, user } = await authed();
  if (!isOwner(user)) {
    return { ok: false, message: OWNER_ONLY.message, code: OWNER_ONLY.code ?? "actions.costs.ownerOnly" };
  }

  let parsed: ParsedInvoice;
  try {
    parsed = parseInvoiceInput(input, uaeToday());
  } catch (error) {
    return invoiceFailure(error, "The invoice could not be saved.", "actions.costs.invoiceFailed");
  }

  const req = await createLocalReq({ user: user ?? undefined }, payload);
  const access: Access = { req, user: user as never, overrideAccess: false };
  let committed = false;
  try {
    await initTransaction(req);

    const existing: Invoice | null = parsed.id
      ? await payload.findByID({ collection: "invoices", id: parsed.id, depth: 0, ...access }).catch(() => null)
      : null;
    if (parsed.id && !existing) {
      throw new CostInputError("That invoice could not be found. It may have been deleted.", "invoiceNotFound");
    }

    const { doc: supplier } = await resolveSupplier(payload, access, parsed.supplier);

    /* The same invoice twice: same supplier, same number, whatever its case.
       An invoice without a number cannot be checked, and is allowed. */
    if (parsed.invoiceNumber) {
      const same = await payload.find({
        collection: "invoices",
        where: { and: [{ supplier: { equals: supplier.id } }, { invoiceNumber: { like: parsed.invoiceNumber } }] },
        limit: 50,
        depth: 0,
        ...access,
      });
      const twin = same.docs.find(
        (doc) => doc.id !== existing?.id && lower(doc.invoiceNumber ?? "") === lower(parsed.invoiceNumber!),
      );
      if (twin) {
        /* The number as it was saved, and the day she added it — not the
           invoice's own date — because that is what she will remember. */
        const date = dayText(twin.createdAt);
        const number = twin.invoiceNumber?.trim() || parsed.invoiceNumber;
        throw new CostInputError(
          `You added invoice ${number} from ${supplier.name} on ${date}.`,
          "invoiceDuplicate",
          { number, supplier: supplier.name, date },
          "invoiceNumber",
        );
      }
    }

    /* What is on it: the things she already buys, then the new ones. */
    const chosen = [...new Set(parsed.lines.map((line) => line.itemId).filter((id): id is number => id !== null))];
    const known = new Map<number, CostItem>(
      chosen.length === 0
        ? []
        : (
            await payload.find({
              collection: "cost-items",
              where: { id: { in: chosen } },
              depth: 0,
              pagination: false,
              ...access,
            })
          ).docs.map((doc) => [doc.id, doc]),
    );
    const before = new Map<number, number | null>([...known].map(([id, doc]) => [id, doc.currentUnitCostFils ?? null]));

    const freshByName = new Map<string, CostItem>();
    const lineItems: CostItem[] = [];
    for (const [index, line] of parsed.lines.entries()) {
      if (line.itemId !== null) {
        const doc = known.get(line.itemId);
        if (!doc) {
          throw new CostInputError(
            `Line ${index + 1}: that is no longer in what you buy. Choose it again.`,
            "lineItemGone",
            { line: index + 1 },
            `lines.${index}.item`,
          );
        }
        lineItems.push(doc);
        continue;
      }
      const fresh = line.newItem!;
      const key = lower(fresh.name);
      let doc = freshByName.get(key) ?? null;
      if (!doc) {
        /* A "new" name already on her list is that thing, not a second one. */
        doc = await itemNamed(payload, access, fresh.name);
        if (doc) {
          if (!before.has(doc.id)) before.set(doc.id, doc.currentUnitCostFils ?? null);
        } else {
          doc = await payload.create({
            collection: "cost-items",
            data: {
              name: fresh.name,
              group: fresh.group,
              packName: fresh.packName,
              unitsPerPack: fresh.unitsPerPack,
              one: fresh.one,
              costSource: "typed",
              currentUnitCostFils: null,
            },
            depth: 0,
            ...access,
          });
          before.set(doc.id, null);
        }
        freshByName.set(key, doc);
      }
      known.set(doc.id, doc);
      lineItems.push(doc);
    }

    /* Units and the price for one. */
    const units = parsed.lines.map((line) => invoiceUnits(line.packs, line.unitsPerPack));
    const tooFew = units.findIndex((count) => count < 0.001);
    if (tooFew >= 0) {
      throw new CostInputError(
        `Line ${tooFew + 1}: how many did you buy? Type a number, like 5.`,
        "packsInvalid",
        { line: tooFew + 1 },
        `lines.${tooFew}.packs`,
      );
    }
    const prices = invoicePricesForOne(
      parsed.lines.map((line, i) => ({ lineTotalFils: line.lineTotalFils, units: units[i]! })),
      invoiceExtrasFils(parsed.deliveryFils, parsed.vatFils, BUSINESS.vatRegistered),
    );

    const data = {
      supplier: supplier.id,
      invoiceNumber: parsed.invoiceNumber,
      invoiceDate: middayIso(parsed.invoiceDate),
      lines: parsed.lines.map((line, i) => ({
        item: lineItems[i]!.id,
        printedName: line.printedName,
        packs: line.packs,
        unitsPerPack: line.unitsPerPack,
        units: units[i]!,
        lineTotalFils: line.lineTotalFils,
        priceForOneFils: prices[i]!,
      })),
      deliveryFils: parsed.deliveryFils,
      vatFils: parsed.vatFils,
      totalFils: parsed.totalFils,
      source: existing?.source ?? ("typed" as const),
    };
    const saved = existing
      ? await payload.update({ collection: "invoices", id: existing.id, data, depth: 0, ...access })
      : await payload.create({ collection: "invoices", data, depth: 0, ...access });

    /* Reprice everything on it, and what an edit took off it. */
    const affected = new Map(known);
    const dropped = (existing?.lines ?? [])
      .map((line) => idOf(line.item))
      .filter((id): id is number => id !== null && !affected.has(id));
    if (dropped.length > 0) {
      const docs = await payload.find({
        collection: "cost-items",
        where: { id: { in: [...new Set(dropped)] } },
        depth: 0,
        pagination: false,
        ...access,
      });
      for (const doc of docs.docs) affected.set(doc.id, doc);
    }
    const plans = await planPrices(payload, access, affected, saved.id);
    parsed.lines.forEach((line, i) => learnAlias(plans.get(lineItems[i]!.id)!, line.printedName));
    await writePlans(payload, access, plans);

    await commitTransaction(req);
    committed = true;

    const seen = new Set<number>();
    const changes: PriceChange[] = [];
    for (const doc of lineItems) {
      if (seen.has(doc.id)) continue;
      seen.add(doc.id);
      const now = plans.get(doc.id)!.doc;
      changes.push({
        itemId: doc.id,
        name: now.name,
        one: isOneUnit(now.one) ? now.one : ("piece" satisfies OneUnit),
        beforeFils: before.get(doc.id) ?? null,
        nowFils: now.currentUnitCostFils ?? 0,
      });
    }

    await recordActivity(payload, {
      actor: actorOf(user),
      action: existing ? "update" : "create",
      area: "other",
      collection: "invoices",
      itemId: saved.id,
      itemLabel: parsed.invoiceNumber ? `${supplier.name} ${parsed.invoiceNumber}` : supplier.name,
      summary: `Invoice from ${supplier.name}, ${dayText(saved.invoiceDate)}: ${parsed.lines.length} ${
        parsed.lines.length === 1 ? "line" : "lines"
      }`,
    });

    revalidateCosts();
    return existing
      ? { ok: true, id: saved.id, message: "Invoice saved.", code: "actions.costs.invoiceSaved", changes }
      : { ok: true, id: saved.id, message: "Invoice added.", code: "actions.costs.invoiceAdded", changes };
  } catch (error) {
    if (!committed) await killTransaction(req);
    if (!(error instanceof CostInputError)) {
      payload.logger.error(`[costs] invoice not saved: ${error instanceof Error ? error.message : "unknown"}`);
    }
    return invoiceFailure(error, "The invoice could not be saved. Nothing was changed.", "actions.costs.invoiceFailed");
  }
}

/**
 * Delete an invoice, after she has said yes. Everything that was on it is
 * repriced from its latest remaining invoice; something with no invoice left
 * keeps its price, now as one she typed.
 */
export async function deleteInvoice(id: number): Promise<ActionResult> {
  const { payload, user } = await authed();
  if (!isOwner(user)) return OWNER_ONLY;

  const req = await createLocalReq({ user: user ?? undefined }, payload);
  const access: Access = { req, user: user as never, overrideAccess: false };
  let committed = false;
  try {
    await initTransaction(req);
    const existing = await payload
      .findByID({ collection: "invoices", id, depth: 0, ...access })
      .catch(() => null);
    if (!existing) {
      throw new CostInputError("That invoice could not be found. It may have been deleted.", "invoiceNotFound");
    }
    const supplierId = idOf(existing.supplier);
    const supplier = supplierId
      ? await payload.findByID({ collection: "suppliers", id: supplierId, depth: 0, ...access }).catch(() => null)
      : null;

    await payload.delete({ collection: "invoices", id, ...access });

    const ids = [...new Set((existing.lines ?? []).map((line) => idOf(line.item)).filter((n): n is number => n !== null))];
    const items =
      ids.length === 0
        ? []
        : (
            await payload.find({
              collection: "cost-items",
              where: { id: { in: ids } },
              depth: 0,
              pagination: false,
              ...access,
            })
          ).docs;
    const plans = await planPrices(payload, access, new Map(items.map((doc) => [doc.id, doc])), null);
    await writePlans(payload, access, plans);

    await commitTransaction(req);
    committed = true;

    const name = supplier?.name ?? "a supplier";
    await recordActivity(payload, {
      actor: actorOf(user),
      action: "delete",
      area: "other",
      collection: "invoices",
      itemId: id,
      itemLabel: existing.invoiceNumber ? `${name} ${existing.invoiceNumber}` : name,
      summary: `Invoice from ${name}, ${dayText(existing.invoiceDate)}, deleted`,
    });

    revalidateCosts();
    return {
      ok: true,
      message: "Invoice deleted. The prices on it are worked out again from your other invoices.",
      code: "actions.costs.invoiceDeleted",
      id,
    };
  } catch (error) {
    if (!committed) await killTransaction(req);
    return costFailure(error, "The invoice could not be deleted.", "actions.costs.deleteFailed");
  }
}
