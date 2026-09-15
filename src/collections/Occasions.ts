import type { CollectionConfig } from "payload";
import { isAdmin, isStaff, publicReadWhenLive } from "@backend/payload/access";
import { generateSlugFrom, validateSlug } from "@backend/payload/hooks/slug";

/**
 * The one real taxonomy on the site: why someone is buying flowers.
 *
 * A collection rather than a hardcoded list, because the client must be
 * able to add "Eid", "Ramadan" or "Mother's Day" herself. A select field
 * would mean a developer and a deployment every time the calendar turns,
 * and converting select values into relationships afterwards is a data
 * migration nobody wants to write.
 *
 * Deliberately NOT a generic `categories` table (docs/DATABASE.md §1):
 * three overlapping ways to group a product is how a catalogue rots.
 * Flower type is a select on the product; price bucket is derived at query
 * time; occasion is this.
 */
export const Occasions: CollectionConfig = {
  slug: "occasions",
  admin: {
    group: "Shop",
    useAsTitle: "name",
    defaultColumns: ["name", "slug", "sortOrder", "active"],
    description: "Why someone is buying — birthdays, love, new arrivals.",
  },
  access: {
    read: publicReadWhenLive("active"),
    create: isAdmin,
    update: isStaff,
    delete: isAdmin,
  },
  defaultSort: "sortOrder",
  fields: [
    { name: "name", type: "text", required: true, maxLength: 80 },
    {
      name: "description",
      type: "textarea",
      maxLength: 600,
      /* Optional, and nullable in the database, so every existing occasion
         stays valid without a backfill. */
      admin: { description: "A line or two shown under the name on the occasion's page." },
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      hooks: { beforeValidate: [generateSlugFrom("name")] },
      validate: validateSlug,
      admin: {
        position: "sidebar",
        description: "The page address. Generated from the name; changing it breaks live links.",
      },
    },
    {
      name: "image",
      type: "upload",
      relationTo: "media",
      admin: { description: "The tile image on the occasions grid." },
    },
    {
      name: "sortOrder",
      type: "number",
      defaultValue: 0,
      index: true,
      admin: { position: "sidebar", description: "Lower numbers appear first." },
    },
    {
      name: "active",
      type: "checkbox",
      defaultValue: true,
      index: true,
      admin: { position: "sidebar", description: "Unticked hides it from the website." },
    },
  ],
};
