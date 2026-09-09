"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { createProduct, deleteProduct, updateProduct } from "@backend/actions/admin";
import {
  ActionButton,
  ActionForm,
  CheckboxGroup,
  Field,
  Fieldset,
  Select,
  TextArea,
  TextInput,
  Toggle,
} from "@admin/components/Form";

/**
 * Add and edit a product, in business language.
 *
 * Grouped the way the owner thinks about an arrangement — what it is, what it
 * costs, what it contains, who sees it — rather than in database order. The
 * technical fields she has no use for (slug rules, fils, sort keys, stock
 * plumbing) are either derived, hidden, or explained in her terms.
 */

export type MediaOption = { id: number; alt: string; url: string; thumbnailUrl?: string };

const CATEGORIES = [
  { label: "Bouquet", value: "bouquet" },
  { label: "Vase arrangement", value: "vase-arrangement" },
  { label: "Box arrangement", value: "box-arrangement" },
  { label: "Basket", value: "basket" },
  { label: "Single stem", value: "single-stem" },
  { label: "Plant", value: "plant" },
  { label: "Event piece", value: "event-piece" },
] as const;

const FLOWERS = [
  { label: "Roses", value: "roses" },
  { label: "Peonies", value: "peonies" },
  { label: "Orchids", value: "orchids" },
  { label: "Tulips", value: "tulips" },
  { label: "Lilies", value: "lilies" },
  { label: "Wildflowers", value: "wildflowers" },
] as const;

export type ProductFormValues = {
  id?: number;
  name: string;
  slug?: string;
  shortDescription?: string;
  priceAed: string;
  compareAtPriceAed?: string;
  category: string;
  flowers: string[];
  occasionIds: string[];
  imageIds: number[];
  available: boolean;
  featured: boolean;
  bestseller: boolean;
  newArrival: boolean;
  seasonal: boolean;
  sortOrder: number;
};

/** The gallery picker. Order is the order chosen; the first is the card image. */
function ImagePicker({
  media,
  initial,
}: {
  media: MediaOption[];
  initial: number[];
}) {
  const [selected, setSelected] = useState<number[]>(initial);

  function toggle(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div>
      {selected.map((id) => (
        <input key={id} type="hidden" name="imageIds" value={id} />
      ))}

      {media.length === 0 ? (
        <p className="rounded-md border border-dashed border-hairline bg-admin-sunken px-4 py-6 text-center text-sm text-sage">
          No photographs uploaded yet.{" "}
          <Link href="/admin/media" className="underline underline-offset-4 hover:text-olive">
            Upload one first
          </Link>
          .
        </p>
      ) : (
        <>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {media.map((m) => {
              const index = selected.indexOf(m.id);
              const isOn = index >= 0;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => toggle(m.id)}
                    aria-pressed={isOn}
                    className={cn(
                      "relative block aspect-square w-full overflow-hidden rounded-media-sm border-2 transition-colors",
                      isOn ? "border-burnt-orange" : "border-transparent hover:border-hairline",
                    )}
                  >
                    <Image
                      src={m.thumbnailUrl ?? m.url}
                      alt={m.alt}
                      fill
                      sizes="120px"
                      className="object-cover"
                    />
                    {isOn ? (
                      <span className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-burnt-orange text-[10px] font-medium text-cream">
                        {index + 1}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-sage">
            {selected.length === 0
              ? "Choose at least one photograph before making this product available."
              : `${selected.length} selected — the first is used on product cards.`}
          </p>
        </>
      )}
    </div>
  );
}

export function ProductForm({
  values,
  occasions,
  media,
}: {
  values: ProductFormValues;
  occasions: { label: string; value: string }[];
  media: MediaOption[];
}) {
  const isEdit = typeof values.id === "number";

  return (
    <ActionForm
      action={(form) => (isEdit ? updateProduct(values.id!, form) : createProduct(form))}
      submitLabel={isEdit ? "Save changes" : "Create product"}
      redirectTo={isEdit ? undefined : "/admin/products"}
      destructive={
        isEdit ? (
          <ActionButton
            action={() => deleteProduct(values.id!)}
            label="Delete product"
            variant="danger"
            confirm="This removes the product from the catalogue permanently. Orders that already contain it keep their own record and are unaffected."
          />
        ) : null
      }
    >
      <Fieldset legend="Basic information">
        <Field label="Product name" name="name" required>
          <TextInput name="name" defaultValue={values.name} required placeholder="Amber Hour" />
        </Field>

        <Field
          label="Short description"
          name="shortDescription"
          hint="One or two lines, shown on product cards and in search results."
        >
          <TextArea
            name="shortDescription"
            rows={3}
            maxLength={200}
            defaultValue={values.shortDescription}
          />
        </Field>

        {isEdit ? (
          <Field
            label="Web address"
            name="slug"
            hint="Changing this breaks links you have already shared. Leave it alone unless you must."
          >
            <TextInput name="slug" defaultValue={values.slug} />
          </Field>
        ) : null}
      </Fieldset>

      <Fieldset
        legend="Photos"
        hint="Uploaded photographs are stored permanently. A product cannot be made available without at least one."
      >
        <ImagePicker media={media} initial={values.imageIds} />
      </Fieldset>

      <Fieldset legend="Pricing" hint="Enter prices in dirhams, exactly as a customer sees them.">
        <Field label="Price (AED)" name="priceAed" required>
          <TextInput
            name="priceAed"
            type="number"
            min="0"
            step="0.01"
            defaultValue={values.priceAed}
            required
            placeholder="480"
          />
        </Field>
        <Field
          label="Compare-at price (AED)"
          name="compareAtPriceAed"
          hint="Optional. The crossed-out 'was' price — must be higher than the price."
        >
          <TextInput
            name="compareAtPriceAed"
            type="number"
            min="0"
            step="0.01"
            defaultValue={values.compareAtPriceAed}
          />
        </Field>
      </Fieldset>

      <Fieldset legend="Product">
        <Field label="Category" name="category">
          <Select name="category" options={CATEGORIES} defaultValue={values.category} />
        </Field>
        <Field label="Occasions" name="occasions" hint="Which occasion pages this appears on.">
          <CheckboxGroup name="occasions" options={occasions} defaultValues={values.occasionIds} />
        </Field>
        <Field label="Flowers" name="flowers" hint="Drives the shop's flower filter.">
          <CheckboxGroup name="flowers" options={FLOWERS} defaultValues={values.flowers} />
        </Field>
        <Field label="Order on the shop page" name="sortOrder" hint="Lower numbers appear first.">
          <TextInput name="sortOrder" type="number" defaultValue={String(values.sortOrder)} />
        </Field>
      </Fieldset>

      <Fieldset legend="Visibility">
        <Toggle
          name="available"
          label="Available to buy"
          hint="Unticked keeps it off the website. Requires at least one photograph."
          defaultChecked={values.available}
        />
        <Toggle
          name="featured"
          label="Featured"
          hint="Shows in the homepage featured row."
          defaultChecked={values.featured}
        />
        <Toggle
          name="bestseller"
          label="Bestseller"
          hint="Shows in the Best Sellers row."
          defaultChecked={values.bestseller}
        />
        <Toggle
          name="newArrival"
          label="New arrival"
          hint="Shows in the New Arrivals row."
          defaultChecked={values.newArrival}
        />
        <Toggle
          name="seasonal"
          label="Seasonal"
          hint="Shown with a seasonal availability note."
          defaultChecked={values.seasonal}
        />
      </Fieldset>
    </ActionForm>
  );
}
