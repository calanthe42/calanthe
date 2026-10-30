import type { GlobalConfig } from "payload";
import { activeRole, isAdmin } from "@backend/payload/access";
import { COST_LIMITS, DEFAULT_COST_SETTINGS } from "@backend/domain/costs";

/**
 * The owner's costing settings — one record.
 *
 * May be empty: backend/data/costs.ts `getCostSettings` fills in
 * DEFAULT_COST_SETTINGS (backend/domain/costs.ts) for anything not yet saved,
 * so every product's margin is worked out from day one.
 *
 * OWNER ONLY, INCLUDING READ — unlike the store settings, which the
 * storefront reads on every request. Her target margin and what she pays a
 * florist are nobody else's business.
 */
export const CostSettings: GlobalConfig = {
  slug: "cost-settings",
  label: "Cost settings",
  admin: {
    group: "Costs",
    description: "Target margin, florist's hourly rate, lost flowers and VAT. Edited from /admin → Costs → Settings.",
    hidden: ({ user }) => activeRole(user) !== "admin",
  },
  access: {
    read: isAdmin,
    update: isAdmin,
  },
  fields: [
    {
      name: "targetMarginPercent",
      type: "number",
      defaultValue: DEFAULT_COST_SETTINGS.targetMarginPercent,
      min: COST_LIMITS.targetMarginPercent.min,
      max: COST_LIMITS.targetMarginPercent.max,
      admin: { description: "The share of what you receive (after VAT) you want to keep." },
    },
    {
      name: "labourRatePerHourFils",
      type: "number",
      defaultValue: DEFAULT_COST_SETTINGS.labourRatePerHourFils,
      min: 0,
      max: COST_LIMITS.maxFils,
      admin: { description: "What an hour of making time costs, in fils (AED × 100)." },
    },
    {
      name: "defaultWastePercent",
      type: "number",
      defaultValue: DEFAULT_COST_SETTINGS.defaultWastePercent,
      min: COST_LIMITS.wastePercent.min,
      max: COST_LIMITS.wastePercent.max,
      admin: { description: "The allowance for lost flowers a new product starts with." },
    },
    {
      name: "vatReclaimable",
      type: "checkbox",
      defaultValue: DEFAULT_COST_SETTINGS.vatReclaimable,
      admin: { description: "You claim VAT back on what you buy, so costs are counted without it." },
    },
    {
      name: "vatRatePercent",
      type: "number",
      defaultValue: DEFAULT_COST_SETTINGS.vatRatePercent,
      min: COST_LIMITS.vatRatePercent.min,
      max: COST_LIMITS.vatRatePercent.max,
    },
  ],
};
