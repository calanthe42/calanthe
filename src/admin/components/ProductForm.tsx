"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { createProduct, deleteProduct, updateProduct } from "@backend/actions/admin";
import type { MediaOption } from "@backend/domain/media-option";
import {
  MAX_PRODUCT_IMAGES,
  PRODUCT_CATEGORIES,
  PRODUCT_FLOWERS,
  PUBLISH_NEEDS_PHOTO,
} from "@backend/domain/product-form";
import {
  ActionButton,
  ActionForm,
  CheckboxGroup,
  Field,
  Fieldset,
  OptionalSection,
  Select,
  TextArea,
  TextInput,
  Toggle,
  inputClass,
  secondaryButtonClass,
} from "@admin/components/Form";
import { MediaPickerDialog } from "@admin/components/MediaPicker";

/**
 * Add and edit a product, in business language.
 *
 * Grouped the way the owner thinks about an arrangement — what it is and what
 * it costs, what it looks like, who sees it — rather than in database order.
 * Everything technical is either derived, folded away, or explained in her
 * terms: prices are dirhams, the web address is an address, "noIndex" is
 * "Hide from search engines".
 *
 * On a new product the optional groups start folded, so creating one is:
 * name, price, description, category, occasions, flowers, photos, save.
 */

export type ProductFormValues = {
  id?: number;
  name: string;
  slug?: string;
  shortDescription?: string;
  descriptionText?: string;
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
  trackStock: boolean;
  stock: number;
  sortOrder: number;
  seoTitle?: string;
  seoDescription?: string;
  noIndex: boolean;
};

function Counter({ length, max }: { length: number; max: number }) {
  return (
    <span className={cn("tabular-nums", length > max ? "text-burgundy" : "text-sage")}>
      {length}/{max}
    </span>
  );
}

/** A dirham amount. Text, not a number input: no spinner, and "480.50" stays as typed. */
function MoneyInput({
  name,
  defaultValue,
  placeholder,
  required,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-sage"
      >
        AED
      </span>
      <input
        id={name}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className={cn(inputClass, "pl-12 tabular-nums")}
      />
    </div>
  );
}

function PhotoGallery({
  library,
  ids,
  onChange,
  onOpenPicker,
  disabled,
}: {
  library: MediaOption[];
  ids: number[];
  onChange: (ids: number[]) => void;
  onOpenPicker: () => void;
  disabled: boolean;
}) {
  const byId = new Map(library.map((m) => [m.id, m]));

  function move(from: number, to: number) {
    if (to < 0 || to >= ids.length) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    if (moved === undefined) return;
    next.splice(to, 0, moved);
    onChange(next);
  }

  return (
    <div>
      {/* The order of these hidden inputs IS the gallery order. */}
      {ids.map((id) => (
        <input key={id} type="hidden" name="imageIds" value={id} />
      ))}

      {ids.length === 0 ? (
        <div className="rounded-md border border-dashed border-burnt-orange/40 bg-burnt-orange/[0.05] px-4 py-6 text-center">
          <p className="text-sm font-medium text-olive">No photos yet</p>
          <p className="mt-1 text-sm text-sage">{PUBLISH_NEEDS_PHOTO}</p>
        </div>
      ) : (
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {ids.map((id, index) => {
            const photo = byId.get(id);
            return (
              <li key={id} className="min-w-0 overflow-hidden rounded-md border border-hairline/70 bg-white">
                <div className="relative aspect-[4/5] bg-admin-sunken">
                  {photo ? (
                    <Image
                      src={photo.thumbnailUrl ?? photo.url}
                      alt={photo.alt}
                      fill
                      sizes="(max-width: 640px) 45vw, 220px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs text-sage">
                      Photo not found
                    </span>
                  )}
                  {index === 0 ? (
                    <span className="absolute left-2 top-2 rounded-sm bg-olive px-1.5 py-0.5 text-[10px] font-medium text-cream">
                      Card image
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => move(index, index - 1)}
                    disabled={disabled || index === 0}
                    aria-label={`Move photo ${index + 1} earlier`}
                    className="inline-flex h-11 w-11 items-center justify-center text-olive hover:bg-admin-sunken disabled:text-hairline"
                  >
                    <span aria-hidden>←</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, index + 1)}
                    disabled={disabled || index === ids.length - 1}
                    aria-label={`Move photo ${index + 1} later`}
                    className="inline-flex h-11 w-11 items-center justify-center text-olive hover:bg-admin-sunken disabled:text-hairline"
                  >
                    <span aria-hidden>→</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(ids.filter((x) => x !== id))}
                    disabled={disabled}
                    aria-label={`Remove photo ${index + 1}`}
                    className="ml-auto inline-flex min-h-11 items-center px-3 text-xs font-medium text-burgundy hover:bg-burgundy/5 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onOpenPicker}
          disabled={disabled}
          className={cn(secondaryButtonClass, "disabled:opacity-50")}
        >
          {ids.length === 0 ? "Add photos" : "Add or change photos"}
        </button>
        <p className="text-xs text-sage">
          {ids.length > 0
            ? `${ids.length} of ${MAX_PRODUCT_IMAGES} — use the arrows to change the order.`
            : "Upload new photos or choose from your library."}
        </p>
      </div>
    </div>
  );
}

export function ProductForm({
  values,
  occasions,
  media,
  readOnly = false,
  viewHref,
}: {
  values: ProductFormValues;
  occasions: { label: string; value: string }[];
  media: MediaOption[];
  readOnly?: boolean;
  /** Set only when the saved product is live, so the link never 404s. */
  viewHref?: string;
}) {
  const productId = values.id;
  const isEdit = typeof productId === "number";
  const router = useRouter();

  const [library, setLibrary] = useState<MediaOption[]>(media);
  const [imageIds, setImageIds] = useState<number[]>(values.imageIds);
  const [available, setAvailable] = useState(values.available);
  const [trackStock, setTrackStock] = useState(values.trackStock);
  const [picking, setPicking] = useState(false);
  const [shortLength, setShortLength] = useState(values.shortDescription?.length ?? 0);
  const [seoTitleLength, setSeoTitleLength] = useState(values.seoTitle?.length ?? 0);
  const [seoDescriptionLength, setSeoDescriptionLength] = useState(
    values.seoDescription?.length ?? 0,
  );

  const canPublish = imageIds.length > 0;

  return (
    <>
      <ActionForm
        action={(form) =>
          typeof productId === "number" ? updateProduct(productId, form) : createProduct(form)
        }
        submitLabel={isEdit ? "Save changes" : "Create product"}
        disabled={readOnly}
        onSuccess={(result) => {
          if (!isEdit && result.ok && result.id) {
            router.push(`/admin/products/${result.id}/edit?created=1`);
          }
        }}
        secondary={
          <>
            <Link href="/admin/products" className={secondaryButtonClass}>
              {readOnly ? "Back to products" : "Cancel"}
            </Link>
            {isEdit ? (
              viewHref ? (
                <a href={viewHref} target="_blank" rel="noreferrer" className={secondaryButtonClass}>
                  View on shop ↗
                </a>
              ) : (
                <span className="px-1 text-xs text-sage">Not on the shop yet</span>
              )
            ) : null}
          </>
        }
        destructive={
          typeof productId === "number" && !readOnly ? (
            <ActionButton
              action={() => deleteProduct(productId)}
              label="Delete product"
              variant="danger"
              redirectTo="/admin/products?deleted=1"
              confirm="This permanently removes the product from your catalogue. If it has ever been ordered, it is kept for your records and you can hide it instead."
            />
          ) : null
        }
      >
        <Fieldset legend="General">
          <Field label="Product name" name="name" required>
            <TextInput
              name="name"
              defaultValue={values.name}
              required
              maxLength={140}
              placeholder="Amber Hour"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Price (AED)" name="priceAed" required hint="What the customer pays, in dirhams.">
              <MoneyInput name="priceAed" defaultValue={values.priceAed} placeholder="480" required />
            </Field>
            <Field
              label="Compare-at price (AED)"
              name="compareAtPriceAed"
              hint="Optional crossed-out “was” price. Must be higher than the price."
            >
              <MoneyInput name="compareAtPriceAed" defaultValue={values.compareAtPriceAed} />
            </Field>
          </div>

          <Field
            label="Short description"
            name="shortDescription"
            hint={
              <>
                One or two lines for product cards and search results.{" "}
                <Counter length={shortLength} max={200} />
              </>
            }
          >
            <TextArea
              name="shortDescription"
              rows={2}
              maxLength={200}
              defaultValue={values.shortDescription}
              onChange={(e) => setShortLength(e.target.value.length)}
            />
          </Field>

          <Field
            label="Full description"
            name="descriptionText"
            hint="The story on the product page. Leave a blank line between paragraphs."
          >
            <TextArea name="descriptionText" rows={6} defaultValue={values.descriptionText} />
          </Field>
        </Fieldset>

        <Fieldset legend="Photos" hint="The first photo is the card image customers see first.">
          <PhotoGallery
            library={library}
            ids={imageIds}
            onChange={setImageIds}
            onOpenPicker={() => setPicking(true)}
            disabled={readOnly}
          />
        </Fieldset>

        <Fieldset legend="Product">
          <Field label="Category" name="category">
            <Select name="category" options={PRODUCT_CATEGORIES} defaultValue={values.category} />
          </Field>
          <Field label="Occasions" name="occasions" hint="The occasion pages this product appears on.">
            {occasions.length > 0 ? (
              <CheckboxGroup name="occasions" options={occasions} defaultValues={values.occasionIds} />
            ) : (
              <p className="text-sm text-sage">
                No occasions yet.{" "}
                <Link href="/admin/occasions/new" className="underline underline-offset-4 hover:text-olive">
                  Add one
                </Link>
                .
              </p>
            )}
          </Field>
          <Field label="Flowers" name="flowers" hint="Used by the shop’s flower filter.">
            <CheckboxGroup name="flowers" options={PRODUCT_FLOWERS} defaultValues={values.flowers} />
          </Field>
        </Fieldset>

        <Fieldset legend="Visibility & highlights">
          {/* Controlled, because it depends on the photos above: a product
              cannot be put on sale without one, and the box says so rather
              than letting her tick it and find out on save. */}
          <label className={cn("flex min-h-11 items-start gap-3 py-1", !canPublish && "cursor-not-allowed")}>
            <input
              type="checkbox"
              name="available"
              checked={available && canPublish}
              disabled={!canPublish || readOnly}
              onChange={(e) => setAvailable(e.target.checked)}
              aria-describedby="available-hint"
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#b55b29]"
            />
            <span>
              <span className={cn("block text-sm font-medium", canPublish ? "text-olive" : "text-sage")}>
                Available to buy
              </span>
              <span
                id="available-hint"
                className={cn("block text-xs leading-relaxed", canPublish ? "text-sage" : "text-[#8f4620]")}
              >
                {canPublish
                  ? "Shows the product on the website. Untick to hide it."
                  : PUBLISH_NEEDS_PHOTO}
              </span>
            </span>
          </label>
          <Toggle name="featured" label="Featured" hint="Shows in the homepage featured row." defaultChecked={values.featured} />
          <Toggle name="bestseller" label="Bestseller" hint="Shows in the Best Sellers row." defaultChecked={values.bestseller} />
          <Toggle name="newArrival" label="New arrival" hint="Shows in the New Arrivals row." defaultChecked={values.newArrival} />
          <Toggle name="seasonal" label="Seasonal" hint="Availability depends on the season." defaultChecked={values.seasonal} />
        </Fieldset>

        <OptionalSection title="Stock, web address & shop order" defaultOpen={isEdit}>
          <label className="flex min-h-11 items-start gap-3 py-1">
            <input
              type="checkbox"
              name="trackStock"
              checked={trackStock}
              onChange={(e) => setTrackStock(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#b55b29]"
            />
            <span>
              <span className="block text-sm font-medium text-olive">Track stock</span>
              <span className="block text-xs leading-relaxed text-sage">
                Most made-to-order arrangements do not need this.
              </span>
            </span>
          </label>
          {trackStock ? (
            <Field label="Stock" name="stock" hint="Units on hand, 0 or more.">
              <TextInput name="stock" type="number" min="0" step="1" inputMode="numeric" defaultValue={String(values.stock)} />
            </Field>
          ) : (
            <input type="hidden" name="stock" value={String(values.stock)} />
          )}

          <Field
            label="Web address"
            name="slug"
            hint={
              isEdit
                ? "Changing this breaks links you have already shared."
                : "Optional — created from the name if left empty."
            }
          >
            <div className="flex min-h-11 overflow-hidden rounded-md border border-hairline bg-white focus-within:ring-2 focus-within:ring-burnt-orange">
              <span className="flex items-center bg-admin-sunken px-3 text-xs text-sage">/product/</span>
              <input
                id="slug"
                name="slug"
                defaultValue={values.slug}
                placeholder={isEdit ? undefined : "amber-hour"}
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 bg-white px-3 text-sm text-olive placeholder:text-sage/60 focus:outline-none disabled:bg-admin-sunken"
              />
            </div>
          </Field>

          <Field label="Shop order" name="sortOrder" hint="Lower numbers appear first on the shop.">
            <TextInput name="sortOrder" type="number" step="1" defaultValue={String(values.sortOrder)} />
          </Field>
        </OptionalSection>

        <OptionalSection
          title="Search engines"
          hint="Optional"
          defaultOpen={isEdit && Boolean(values.seoTitle || values.seoDescription || values.noIndex)}
        >
          <Field
            label="Search title"
            name="seoTitle"
            hint={
              <>
                Shown as the headline in Google. Falls back to the product name.{" "}
                <Counter length={seoTitleLength} max={60} />
              </>
            }
          >
            <TextInput
              name="seoTitle"
              maxLength={70}
              defaultValue={values.seoTitle}
              onChange={(e) => setSeoTitleLength(e.target.value.length)}
            />
          </Field>
          <Field
            label="Search description"
            name="seoDescription"
            hint={
              <>
                The line under the headline. Falls back to the short description.{" "}
                <Counter length={seoDescriptionLength} max={155} />
              </>
            }
          >
            <TextArea
              name="seoDescription"
              rows={2}
              maxLength={180}
              defaultValue={values.seoDescription}
              onChange={(e) => setSeoDescriptionLength(e.target.value.length)}
            />
          </Field>
          <Toggle
            name="noIndex"
            label="Hide from search engines"
            hint="Asks Google not to list this product. It stays on your shop."
            defaultChecked={values.noIndex}
          />
        </OptionalSection>
      </ActionForm>

      {picking ? (
        <MediaPickerDialog
          title="Product photos"
          library={library}
          initialSelected={imageIds}
          multiple
          max={MAX_PRODUCT_IMAGES}
          onClose={() => setPicking(false)}
          onConfirm={(ids, nextLibrary) => {
            setLibrary(nextLibrary);
            setImageIds(ids);
            setPicking(false);
          }}
        />
      ) : null}
    </>
  );
}
