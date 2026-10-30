"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { headers as nextHeaders } from "next/headers";
import { getPayload, type Payload } from "payload";
import config from "@payload-config";
import { recordActivity, type FieldChange } from "@backend/activity/record";
import { readSavedAddons, STORE_ADDONS_TAG } from "@backend/data/store-settings";
import { AddonInputError, parseAddonsForm } from "@backend/domain/addon-form";
import { activeRole } from "@backend/payload/access";
import { formatFils } from "@/lib/money";
import type { StoreAddon } from "@/lib/store-settings";
import { actorOf, failure, type ActionResult, type Failure } from "./admin-shared";

/**
 * The owner's add-ons — the "Something extra" list on every product — saved
 * from Admin → Add-ons.
 *
 * OWNER ONLY, TWICE. The action checks the signed-in person is the owner
 * before it reads a field, and answers anyone else with
 * `actions.addons.ownerOnly`. Then the save passes that user with
 * `overrideAccess: false`, so the global's own rule (update: owner) refuses
 * anyone else as well.
 *
 * The whole list is saved at once, in the order she left it. Parsing and the
 * keys are in backend/domain/addon-form.ts (pure, tested). The shop shows the
 * change on its next page load: the storefront's cached list is cleared here,
 * and the checkout reads the global fresh every time, so a basket priced at
 * the old figure is refused as PRICE_CHANGED rather than charged.
 */

const OWNER_ONLY: Failure = {
  ok: false,
  message: "Only the owner can change the add-ons.",
  code: "actions.addons.ownerOnly",
};

async function authed() {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });
  return { payload, user };
}

/**
 * What moved, add-on by add-on, in words for the activity log. A price or a
 * show/hide is logged under the activity log's own field names (priceFils,
 * active), which is what marks it notable there: either one reprices the shop.
 */
function changesBetween(before: readonly StoreAddon[], after: readonly StoreAddon[]): FieldChange[] {
  const changes: FieldChange[] = [];
  const was = new Map(before.map((addon) => [addon.key, addon]));
  for (const addon of after) {
    const old = was.get(addon.key);
    const field = `addons.${addon.key}`;
    if (!old) {
      changes.push({ field, label: addon.nameEn, before: "not offered", after: formatFils(addon.priceFils) });
      continue;
    }
    if (old.priceFils !== addon.priceFils) {
      changes.push({ field: "priceFils", label: `${addon.nameEn} price`, before: formatFils(old.priceFils), after: formatFils(addon.priceFils) });
    }
    if (old.nameEn !== addon.nameEn || old.nameAr !== addon.nameAr) {
      changes.push({
        field: `${field}.name`,
        label: `${old.nameEn} name`,
        before: `${old.nameEn} / ${old.nameAr}`,
        after: `${addon.nameEn} / ${addon.nameAr}`,
      });
    }
    if (old.active !== addon.active) {
      changes.push({
        field: "active",
        label: addon.nameEn,
        before: old.active ? "Shown" : "Hidden",
        after: addon.active ? "Shown" : "Hidden",
      });
    }
  }
  const kept = new Set(after.map((addon) => addon.key));
  for (const old of before) {
    if (!kept.has(old.key)) changes.push({ field: `addons.${old.key}`, label: old.nameEn, before: formatFils(old.priceFils), after: "removed" });
  }
  const order = (list: readonly StoreAddon[]) => list.map((addon) => addon.key).filter((key) => was.has(key) && kept.has(key));
  if (order(before).join() !== order(after).join()) {
    changes.push({ field: "addons.order", label: "order", before: "", after: after.map((addon) => addon.nameEn).join(", ") });
  }
  return changes;
}

/**
 * Save her whole list: `addons` is the screen's rows as JSON —
 * `[{ key?, nameEn, nameAr, priceAed, active }]`, in display order.
 */
export async function saveAddons(form: FormData): Promise<ActionResult> {
  const { payload, user } = await authed();
  if (activeRole(user) !== "admin") return OWNER_ONLY;
  try {
    /* Her list as it is saved NOW — never a fallback — decides which keys
       are kept (backend/data/store-settings.ts). */
    const before = await readSavedAddons(payload);
    const addons = parseAddonsForm(form.get("addons"), before.addons);

    await saveList(payload, user, addons);

    const changes = changesBetween(before.addons, addons);
    await recordActivity(payload, {
      actor: actorOf(user),
      action: "update",
      area: "products",
      collection: "settings",
      itemLabel: "Add-ons",
      changes,
      summary:
        changes.length === 0
          ? "Add-ons saved with no changes"
          : `Add-ons: ${changes
              .slice(0, 3)
              .map((c) => (c.field === "addons.order" ? "new order" : `${c.label} ${c.before} → ${c.after}`))
              .join(", ")}${changes.length > 3 ? ` (+${changes.length - 3} more)` : ""}`,
    });

    /* The storefront's cached list, every storefront page, and this screen. */
    revalidateTag(STORE_ADDONS_TAG);
    revalidatePath("/", "layout");
    revalidatePath("/admin/addons");
    return { ok: true, message: "Add-ons saved. The shop shows them now.", code: "actions.addons.saved" };
  } catch (error) {
    if (error instanceof AddonInputError) {
      return { ok: false, message: error.message, code: error.code, vars: error.vars };
    }
    return failure(error, "The add-ons could not be saved.", "actions.addons.saveFailed");
  }
}

async function saveList(payload: Payload, user: unknown, addons: readonly StoreAddon[]): Promise<void> {
  await payload.updateGlobal({
    slug: "settings",
    data: {
      addons: addons.map((addon) => ({
        key: addon.key,
        nameEn: addon.nameEn,
        nameAr: addon.nameAr,
        priceFils: addon.priceFils,
        active: addon.active,
      })),
    },
    depth: 0,
    user: user as never,
    overrideAccess: false,
  });
}
