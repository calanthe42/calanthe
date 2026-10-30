"use server";

import { headers as nextHeaders } from "next/headers";
import { getPayload, type Payload } from "payload";
import config from "@payload-config";
import { diffFields, recordActivity } from "@backend/activity/record";
import { CostInputError, parseCostItemForm, parseCostSettingsForm } from "@backend/domain/cost-forms";
import { actorOf, failure, type ActionResult, type Failure } from "./admin-shared";
import { OWNER_ONLY, isOwner, revalidateCosts } from "./costs-shared";

/**
 * Every write the owner makes to her costs: the flowers and materials
 * library, and her costing settings. A product's recipe is saved by the
 * product's own Save (actions/admin.ts, through actions/costs-shared.ts).
 *
 * OWNER ONLY, TWICE. Each action checks the signed-in person is the owner
 * before it reads a field, and answers anyone else with
 * `actions.costs.ownerOnly`. Then every Payload call passes that user with
 * `overrideAccess: false`, so the owner-only collections refuse a florist
 * on their own as well — if the first wall is ever got wrong, the second
 * still holds.
 *
 * Parsing is in backend/domain/cost-forms.ts (pure, tested).
 */

const LOGGED = [
  "name",
  "kind",
  "useUnit",
  "packName",
  "unitsPerPack",
  "currentUnitCostFils",
  "costSource",
  "swatch",
  "archived",
  "notes",
] as const;

const SETTINGS_LOGGED = [
  "targetMarginPercent",
  "labourRatePerHourFils",
  "defaultWastePercent",
  "vatReclaimable",
  "vatRatePercent",
] as const;

async function authed() {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });
  return { payload, user };
}

/** A mistake in what she typed is shown as written; anything else is a sentence. */
function costFailure(error: unknown, fallback: string, fallbackCode: string): Failure {
  if (error instanceof CostInputError) {
    return { ok: false, message: error.message, code: error.code, vars: error.vars };
  }
  return failure(error, fallback, fallbackCode);
}

/**
 * Is that name already in her library, whatever its case? The database's
 * unique index is case-sensitive, and "Red rose" beside "red rose" is the
 * same flower twice.
 */
async function nameTaken(payload: Payload, user: unknown, name: string, exceptId?: number): Promise<boolean> {
  const found = await payload.find({
    collection: "cost-items",
    where: { name: { like: name } },
    limit: 50,
    depth: 0,
    user: user as never,
    overrideAccess: false,
  });
  return found.docs.some((doc) => doc.id !== exceptId && doc.name.trim().toLowerCase() === name.toLowerCase());
}

const parseId = (raw: FormDataEntryValue | null): number | undefined => {
  const id = typeof raw === "string" ? Number(raw) : Number.NaN;
  return Number.isInteger(id) && id > 0 ? id : undefined;
};

/**
 * Add a flower or material, or change one.
 *
 * `unitCostAed` is the cost of ONE use-unit in dirhams, decimals allowed
 * ("0.375" for a stem). Typing it makes the cost hers (`costSource:
 * "manual"`); leaving it empty, or sending back the cost already there,
 * keeps the cost and where it came from — editing a name must not turn a
 * price taken from an invoice into one typed by hand.
 */
export async function saveCostItem(form: FormData): Promise<ActionResult> {
  const { payload, user } = await authed();
  if (!isOwner(user)) return OWNER_ONLY;
  try {
    const id = parseId(form.get("id"));
    const parsed = parseCostItemForm(form);

    const existing = id
      ? await payload.findByID({ collection: "cost-items", id, depth: 0, user, overrideAccess: false })
      : null;

    if (await nameTaken(payload, user, parsed.name, id)) {
      return {
        ok: false,
        message: `“${parsed.name}” is already in your library.`,
        code: "actions.costs.nameTaken",
        vars: { name: parsed.name },
      };
    }

    const costChanged =
      parsed.unitCostFils !== null &&
      (!existing || Math.abs((existing.currentUnitCostFils ?? 0) - parsed.unitCostFils) >= 0.005);

    const data = {
      name: parsed.name,
      kind: parsed.kind,
      useUnit: parsed.useUnit,
      packName: parsed.packName,
      unitsPerPack: parsed.unitsPerPack,
      swatch: parsed.swatch,
      notes: parsed.notes,
      aliases: parsed.aliases.map((text) => ({ text })),
      ...(costChanged ? { currentUnitCostFils: parsed.unitCostFils, costSource: "manual" as const } : {}),
      ...(!existing && !costChanged ? { currentUnitCostFils: 0, costSource: "manual" as const } : {}),
    };

    const doc = existing
      ? await payload.update({ collection: "cost-items", id: existing.id, data, user, overrideAccess: false })
      : await payload.create({ collection: "cost-items", data, user, overrideAccess: false });

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
          message: `“${doc.name}” added to your library.`,
          code: "actions.costs.itemCreated",
          vars: { name: doc.name },
          id: doc.id,
        };
  } catch (error) {
    return costFailure(error, "The item could not be saved.", "actions.costs.saveFailed");
  }
}

/**
 * Archive an item she no longer buys, or bring it back. Archived items leave
 * the picker but stay in every recipe that names them, marked, so a product
 * never silently loses part of its cost.
 */
export async function archiveCostItem(id: number, archived: boolean): Promise<ActionResult> {
  const { payload, user } = await authed();
  if (!isOwner(user)) return OWNER_ONLY;
  try {
    const existing = await payload.findByID({ collection: "cost-items", id, depth: 0, user, overrideAccess: false });
    const doc = await payload.update({
      collection: "cost-items",
      id,
      data: { archived: archived === true },
      user,
      overrideAccess: false,
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
          message: `“${doc.name}” archived. Products that use it still show it.`,
          code: "actions.costs.itemArchived",
          vars: { name: doc.name },
          id,
        }
      : {
          ok: true,
          message: `“${doc.name}” is back in your library.`,
          code: "actions.costs.itemRestored",
          vars: { name: doc.name },
          id,
        };
  } catch (error) {
    return costFailure(error, "The item could not be changed.", "actions.costs.archiveFailed");
  }
}

/**
 * Her target margin, the florist's hourly rate (typed in dirhams, stored in
 * fils), the allowance for lost flowers new products start with, and VAT.
 */
export async function saveCostSettings(form: FormData): Promise<ActionResult> {
  const { payload, user } = await authed();
  if (!isOwner(user)) return OWNER_ONLY;
  try {
    const data = parseCostSettingsForm(form);
    const before = await payload.findGlobal({ slug: "cost-settings", depth: 0, user, overrideAccess: false });
    const after = await payload.updateGlobal({ slug: "cost-settings", data, depth: 0, user, overrideAccess: false });

    await recordActivity(payload, {
      actor: actorOf(user),
      action: "update",
      area: "other",
      collection: "cost-settings",
      itemLabel: "Cost settings",
      changes: diffFields(
        before as unknown as Record<string, unknown>,
        after as unknown as Record<string, unknown>,
        SETTINGS_LOGGED,
      ),
    });

    revalidateCosts();
    return { ok: true, message: "Cost settings saved.", code: "actions.costs.settingsSaved" };
  } catch (error) {
    return costFailure(error, "The cost settings could not be saved.", "actions.costs.settingsFailed");
  }
}
