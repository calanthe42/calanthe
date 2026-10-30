import { revalidatePath } from "next/cache";
import type { Payload } from "payload";
import { recordActivity } from "@backend/activity/record";
import { activeRole } from "@backend/payload/access";
import { parseCostRecipe, type ProductCostRecipe } from "@backend/domain/costs";
import { actorOf, type Failure } from "./admin-shared";

/**
 * What the costs actions share with the product actions.
 *
 * WHY NOT IN actions/costs.ts. That file is "use server": every async
 * function it exports becomes an endpoint a browser can call. Saving a
 * product's recipe is only ever a step INSIDE createProduct/updateProduct,
 * after the product itself is saved — it must not be callable on its own.
 */

export const OWNER_ONLY: Failure = {
  ok: false,
  message: "Only the owner can do that.",
  code: "actions.costs.ownerOnly",
};

/** The owner of an ACTIVE account. A suspended owner holds no rights. */
export const isOwner = (user: unknown): boolean => activeRole(user) === "admin";

/** Every screen that shows a cost: the costs pages and the product editor. */
export function revalidateCosts() {
  revalidatePath("/admin/costs", "layout");
  revalidatePath("/admin/products", "layout");
}

/**
 * The recipe a product form sent, for the owner only.
 *
 *   undefined   nothing to do: not the owner, or the form had no Cost
 *               section. A florist's save never touches a recipe, whatever
 *               her browser sends.
 *   null        the owner's form sent something unreadable: the product is
 *               saved, and she is told her cost was not.
 */
export function recipeFromForm(form: { get(name: string): FormDataEntryValue | null }, user: unknown) {
  if (!isOwner(user)) return undefined;
  return parseCostRecipe(form.get("costRecipe"));
}

/**
 * Create, replace or remove the product's recipe. Throws on failure.
 *
 * An empty recipe removes it: "no cost yet" is a state the owner can return
 * to. Lines whose item has since been deleted from "What you buy" are
 * dropped rather than refusing the whole save; something she no longer buys
 * (archived) stays, because the product still uses it and the editor says so.
 */
export async function saveProductRecipe(
  payload: Payload,
  user: unknown,
  product: { id: number; name: string },
  recipe: ProductCostRecipe,
): Promise<void> {
  const access = { user: user as never, overrideAccess: false as const };
  const found = await payload.find({
    collection: "product-costs",
    where: { product: { equals: product.id } },
    limit: 1,
    depth: 0,
    ...access,
  });
  const existing = found.docs[0];

  const ids = [...new Set(recipe.lines.map((line) => line.itemId))];
  const known =
    ids.length === 0
      ? new Set<number>()
      : new Set(
          (
            await payload.find({
              collection: "cost-items",
              where: { id: { in: ids } },
              limit: ids.length,
              depth: 0,
              pagination: false,
              ...access,
            })
          ).docs.map((doc) => doc.id),
        );
  const lines = recipe.lines.filter((line) => known.has(line.itemId));

  if (lines.length === 0) {
    if (!existing) return;
    await payload.delete({ collection: "product-costs", id: existing.id, ...access });
    await recordActivity(payload, {
      actor: actorOf(user),
      action: "delete",
      area: "products",
      collection: "product-costs",
      itemId: product.id,
      itemLabel: product.name,
      summary: `${product.name}: what goes in removed`,
    });
    revalidateCosts();
    return;
  }

  const data = {
    product: product.id,
    lines: lines.map((line) => ({ item: line.itemId, quantity: line.quantity })),
  };
  if (existing) {
    await payload.update({ collection: "product-costs", id: existing.id, data, ...access });
  } else {
    await payload.create({ collection: "product-costs", data, ...access });
  }

  await recordActivity(payload, {
    actor: actorOf(user),
    action: existing ? "update" : "create",
    area: "products",
    collection: "product-costs",
    itemId: product.id,
    itemLabel: product.name,
    summary: `${product.name}: what goes in saved (${lines.length} ${lines.length === 1 ? "line" : "lines"})`,
  });
  revalidateCosts();
}

/**
 * The same, for a product that has ALREADY been saved: never throws, so a
 * cost that will not save never takes the product down with it. `true` when
 * there was nothing to do or it saved; `false` when the owner must be told.
 */
export async function saveProductRecipeAfterProduct(
  payload: Payload,
  user: unknown,
  product: { id: number; name: string },
  recipe: ProductCostRecipe | null | undefined,
): Promise<boolean> {
  if (recipe === undefined) return true;
  if (recipe === null) return false;
  try {
    await saveProductRecipe(payload, user, product, recipe);
    return true;
  } catch (error) {
    payload.logger.error(
      `[costs] recipe for product ${product.id} not saved: ${error instanceof Error ? error.message : "unknown"}`,
    );
    return false;
  }
}
