/**
 * Writing an activity entry, and working out what actually changed.
 *
 * WHAT THE OWNER ASKS. Not "was this record touched" but "who changed this
 * price, and what was it before?". So `diffFields` compares the document
 * before and after and keeps only the fields that really moved, rendered as
 * words — "AED 480 → AED 520", "Available → Hidden" — rather than a JSON
 * blob nobody reads.
 *
 * NEVER FAILS THE ACTION IT DESCRIBES. Logging is a side effect of work that
 * has already happened. `recordActivity` has no throwing path: if the log
 * write fails, the price change still stands and the failure is shouted into
 * the server log, because refusing a florist's edit because an audit row
 * would not write is the wrong trade.
 *
 * AND IT IS CALLED AFTER THE WRITE, NEVER INSIDE IT. A Payload hook writing
 * to another collection through a second connection, inside the first one's
 * transaction, deadlocks until the database terminates it — that is not a
 * theory here, it took down order status emails earlier in this project.
 * Every caller logs after its update has returned.
 */
import type { Payload } from "payload";

export type ActivityArea = "orders" | "products" | "other";
export type ActivityAction = "create" | "update" | "delete" | "status" | "email" | "login";

export type Actor = {
  id?: number | string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
};

export type FieldChange = {
  field: string;
  label?: string;
  before?: string;
  after?: string;
};

/** Fields worth naming, and what to call them in front of a florist. */
const LABELS: Record<string, string> = {
  priceFils: "price",
  compareAtPriceFils: "compare-at price",
  available: "availability",
  name: "name",
  slug: "web address",
  shortDescription: "short description",
  description: "description",
  stock: "stock",
  trackStock: "stock tracking",
  fulfilmentStatus: "status",
  paymentStatus: "payment status",
  staffNotes: "internal notes",
  images: "photographs",
  occasions: "occasions",
};

/** Changes that should stand out in a long list. */
const NOTABLE = new Set(["priceFils", "compareAtPriceFils", "available", "stock"]);

function money(fils: unknown): string {
  const n = Number(fils);
  if (!Number.isFinite(n)) return String(fils ?? "");
  return `AED ${(n / 100).toLocaleString("en-AE", { maximumFractionDigits: 2 })}`;
}

/** One value, as the owner would say it. */
export function renderValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "empty";
  if (field.endsWith("Fils")) return money(value);
  if (field === "available") return value === true ? "Available" : "Hidden";
  if (field === "trackStock") return value === true ? "On" : "Off";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (typeof value === "object") return "changed";
  const s = String(value);
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
}

/**
 * The fields that genuinely differ.
 *
 * Only keys present in `after` are considered, so a partial update does not
 * report every untouched field as "changed to empty". Values are compared
 * after rendering, which keeps 480 and "480" from looking like an edit.
 */
export function diffFields(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  only?: readonly string[],
): FieldChange[] {
  if (!after) return [];
  const keys = only ?? Object.keys(after);
  const changes: FieldChange[] = [];

  for (const key of keys) {
    if (key === "id" || key === "updatedAt" || key === "createdAt") continue;
    const from = renderValue(key, before?.[key]);
    const to = renderValue(key, after[key]);
    if (from === to) continue;
    changes.push({ field: key, label: LABELS[key] ?? key, before: from, after: to });
  }
  return changes;
}

export function isNotable(changes: readonly FieldChange[], action: ActivityAction): boolean {
  if (action === "delete") return true;
  return changes.some((c) => NOTABLE.has(c.field));
}

/** A single readable line for the list view. */
export function summarise(
  action: ActivityAction,
  itemLabel: string,
  changes: readonly FieldChange[],
): string {
  if (action === "delete") return `${itemLabel} deleted`;
  if (action === "create") return `${itemLabel} created`;
  if (action === "email") return `Email resent for ${itemLabel}`;
  if (changes.length === 0) return `${itemLabel} saved with no changes`;

  const parts = changes
    .slice(0, 3)
    .map((c) => `${c.label ?? c.field} ${c.before} → ${c.after}`);
  const more = changes.length > 3 ? ` (+${changes.length - 3} more)` : "";
  return `${itemLabel}: ${parts.join(", ")}${more}`;
}

export type RecordInput = {
  actor: Actor;
  action: ActivityAction;
  area: ActivityArea;
  collection?: string;
  itemId?: number | string;
  itemLabel?: string;
  changes?: readonly FieldChange[];
  /** Overrides the generated line when the caller can say it better. */
  summary?: string;
};

export async function recordActivity(payload: Payload, input: RecordInput): Promise<void> {
  try {
    const changes = input.changes ?? [];
    const label = input.itemLabel ?? String(input.itemId ?? "item");
    await payload.create({
      collection: "activity-log",
      overrideAccess: true,
      data: {
        actorEmail: input.actor.email ?? "unknown",
        actorName: input.actor.name ?? undefined,
        /* Anything that is not the owner is recorded as staff rather than
           left blank: an entry with no role is an entry nobody can read. */
        actorRole: input.actor.role === "admin" ? "admin" : "staff",
        action: input.action,
        area: input.area,
        collection: input.collection,
        itemId: input.itemId === undefined ? undefined : String(input.itemId),
        itemLabel: label,
        summary: input.summary ?? summarise(input.action, label, changes),
        changes: changes.map((c) => ({
          field: c.field,
          label: c.label,
          before: c.before,
          after: c.after,
        })),
        notable: isNotable(changes, input.action),
      } as never,
    });
  } catch (error) {
    payload.logger.error(
      `[activity] could not record ${input.action} on ${input.collection ?? "?"} ${
        input.itemId ?? ""
      }: ${error instanceof Error ? error.message : "unknown"}`,
    );
  }
}
