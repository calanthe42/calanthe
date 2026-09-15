"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createProduct, deleteProduct, updateProduct } from "@backend/actions/admin";
import type { MediaOption } from "@backend/domain/media-option";
import { MAX_PRODUCT_IMAGES, PRODUCT_CATEGORIES, PRODUCT_FLOWERS } from "@backend/domain/product-form";
import { useI18n } from "@admin/i18n/client";
import { ActionButton } from "@admin/ui/ActionButton";
import { ActionForm, useMarkDirty } from "@admin/ui/ActionForm";
import { Button, ButtonLink } from "@admin/ui/Button";
import { FormSection } from "@admin/ui/Content";
import { Checkbox, Field, Input, PrefixInput, Select, Switch, Textarea } from "@admin/ui/Field";
import { IconButton } from "@admin/ui/IconButton";
import { Icon } from "@admin/ui/icons";

/**
 * Add and edit a product, in business language.
 *
 * Grouped the way the owner thinks about an arrangement — what it is, what it
 * looks like, what it costs, where it appears — rather than in database order.
 * Prices are dirhams, the web address is an address, "noIndex" is "Hide from
 * search engines".
 *
 * Nothing about money is decided here. The form sends what was typed; the
 * server action parses it (backend/domain/product-form.ts) and the collection
 * re-validates it. A price typed in the browser cannot bypass either.
 *
 * On a wide screen the visibility, flags and SEO settings sit in a side
 * column; on a phone every section stacks in the order they matter.
 */

/* The photo picker is only needed when someone opens it. */
const MediaPickerDialog = dynamic(() => import("./MediaPicker").then((m) => m.MediaPickerDialog), {
  ssr: false,
});

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
  const { t } = useI18n();
  const markDirty = useMarkDirty();
  const byId = new Map(library.map((m) => [m.id, m]));

  const update = (next: number[]) => {
    onChange(next);
    markDirty();
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= ids.length) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    if (moved === undefined) return;
    next.splice(to, 0, moved);
    update(next);
  };

  return (
    <div>
      {/* The order of these hidden inputs IS the gallery order. */}
      {ids.map((id) => (
        <input key={id} type="hidden" name="imageIds" value={id} />
      ))}

      {ids.length === 0 ? (
        <div className="flex flex-col items-center rounded-md border border-dashed border-line-strong bg-sunken/50 px-4 py-8 text-center">
          <span aria-hidden className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink-3">
            <Icon name="image" />
          </span>
          <p className="text-sm font-medium text-ink">{t("products.form.photos.none")}</p>
          <p className="mt-1 max-w-sm text-sm text-ink-3">{t("actions.validation.publishNeedsPhoto")}</p>
        </div>
      ) : (
        <ol className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:grid-cols-3">
          {ids.map((id, index) => {
            const photo = byId.get(id);
            const n = index + 1;
            return (
              <li key={id} className="min-w-0 overflow-hidden rounded-md border border-line bg-surface">
                <div className="relative aspect-[4/3] bg-sunken min-[480px]:aspect-[4/5]">
                  {photo ? (
                    <Image
                      src={photo.thumbnailUrl ?? photo.url}
                      alt={photo.alt}
                      fill
                      sizes="(max-width: 480px) 90vw, 240px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs text-ink-3">
                      {t("common.photoNotFound")}
                    </span>
                  )}
                  {index === 0 ? (
                    <span className="absolute start-2 top-2 rounded-sm bg-nav px-1.5 py-0.5 text-[11px] font-medium text-nav-ink">
                      {t("products.form.photos.primary")}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center justify-between p-1">
                  <IconButton
                    icon="chevronLeft"
                    label={t("products.form.photos.moveEarlier", { n })}
                    disabled={disabled || index === 0}
                    onClick={() => move(index, index - 1)}
                  />
                  {index > 0 ? (
                    <IconButton
                      icon="star"
                      label={t("products.form.photos.makePrimary", { n })}
                      disabled={disabled}
                      onClick={() => move(index, 0)}
                    />
                  ) : (
                    <span aria-hidden className="h-11 w-11" />
                  )}
                  <IconButton
                    icon="chevronRight"
                    label={t("products.form.photos.moveLater", { n })}
                    disabled={disabled || index === ids.length - 1}
                    onClick={() => move(index, index + 1)}
                  />
                  <IconButton
                    icon="trash"
                    label={t("products.form.photos.remove", { n })}
                    disabled={disabled}
                    onClick={() => update(ids.filter((x) => x !== id))}
                    className="text-danger hover:text-danger"
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button icon={ids.length === 0 ? "plus" : "image"} onClick={onOpenPicker} disabled={disabled}>
          {ids.length === 0 ? t("products.form.photos.add") : t("products.form.photos.change")}
        </Button>
        <p className="text-xs text-ink-3">
          {ids.length > 0
            ? t("products.form.photos.count", { count: ids.length, max: MAX_PRODUCT_IMAGES })
            : t("products.form.photos.emptyHint")}
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
  const { t, label } = useI18n();
  const router = useRouter();
  const productId = values.id;
  const isEdit = typeof productId === "number";

  const [library, setLibrary] = useState<MediaOption[]>(media);
  const [imageIds, setImageIds] = useState<number[]>(values.imageIds);
  const [available, setAvailable] = useState(values.available);
  const [trackStock, setTrackStock] = useState(values.trackStock);
  const [picking, setPicking] = useState(false);
  const [shortLength, setShortLength] = useState(values.shortDescription?.length ?? 0);
  const [seoTitleLength, setSeoTitleLength] = useState(values.seoTitle?.length ?? 0);
  const [seoDescriptionLength, setSeoDescriptionLength] = useState(values.seoDescription?.length ?? 0);

  const canPublish = imageIds.length > 0;

  return (
    <>
      <ActionForm
        action={(form) => (typeof productId === "number" ? updateProduct(productId, form) : createProduct(form))}
        submitLabel={isEdit ? undefined : t("products.form.create")}
        readOnly={readOnly}
        onSuccess={(result) => {
          if (!isEdit && result.id) router.push(`/admin/products/${result.id}/edit?created=1`);
        }}
        secondary={
          <>
            <ButtonLink href="/admin/products" variant="ghost">
              {readOnly ? t("products.new.back") : t("common.cancel")}
            </ButtonLink>
            {viewHref ? (
              <ButtonLink href={viewHref} external icon="store" className="max-sm:hidden">
                {t("common.viewOnStore")}
              </ButtonLink>
            ) : null}
          </>
        }
        destructive={
          typeof productId === "number" && !readOnly ? (
            <ActionButton
              variant="danger"
              icon="trash"
              label={t("common.delete")}
              action={() => deleteProduct(productId)}
              redirectTo="/admin/products?deleted=1"
              confirm={{
                title: t("products.deleteTitle", { name: values.name }),
                body: t("products.deleteBody"),
                confirmLabel: t("products.deleteConfirm"),
              }}
            />
          ) : null
        }
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          <div className="min-w-0 space-y-6">
            <FormSection id="product-information" title={t("products.form.sections.info")} description={t("products.form.sections.infoHint")}>
              <Field id="name" label={t("products.form.name")} required>
                <Input id="name" name="name" defaultValue={values.name} required maxLength={140} placeholder={t("products.form.namePlaceholder")} />
              </Field>
              <Field
                id="shortDescription"
                label={t("products.form.shortDescription")}
                hint={t("products.form.shortDescriptionHint")}
                aside={t("products.form.counter", { length: shortLength, max: 200 })}
              >
                <Textarea
                  id="shortDescription"
                  name="shortDescription"
                  withHint
                  rows={2}
                  maxLength={200}
                  defaultValue={values.shortDescription}
                  onChange={(e) => setShortLength(e.target.value.length)}
                />
              </Field>
              <Field id="descriptionText" label={t("products.form.description")} hint={t("products.form.descriptionHint")}>
                <Textarea id="descriptionText" name="descriptionText" withHint rows={7} defaultValue={values.descriptionText} />
              </Field>
            </FormSection>

            <FormSection id="product-media" title={t("products.form.sections.media")} description={t("products.form.sections.mediaHint")}>
              <PhotoGallery
                library={library}
                ids={imageIds}
                onChange={setImageIds}
                onOpenPicker={() => setPicking(true)}
                disabled={readOnly}
              />
            </FormSection>

            <FormSection id="product-pricing" title={t("products.form.sections.pricing")} description={t("products.form.sections.pricingHint")}>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="priceAed" label={t("products.form.price")} hint={t("products.form.priceHint")} required>
                  <PrefixInput
                    id="priceAed"
                    name="priceAed"
                    prefix="AED"
                    withHint
                    inputMode="decimal"
                    autoComplete="off"
                    defaultValue={values.priceAed}
                    placeholder="480"
                    required
                    className="tabular"
                  />
                </Field>
                <Field id="compareAtPriceAed" label={t("products.form.compareAt")} hint={t("products.form.compareAtHint")}>
                  <PrefixInput
                    id="compareAtPriceAed"
                    name="compareAtPriceAed"
                    prefix="AED"
                    withHint
                    inputMode="decimal"
                    autoComplete="off"
                    defaultValue={values.compareAtPriceAed}
                    className="tabular"
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection id="product-category" title={t("products.form.sections.category")}>
              <Field id="category" label={t("products.form.category")}>
                <Select
                  id="category"
                  name="category"
                  defaultValue={values.category}
                  options={PRODUCT_CATEGORIES.map((c) => ({ value: c.value, label: label("category", c.value) }))}
                />
              </Field>
              <fieldset className="min-w-0">
                <legend className="text-sm font-medium text-ink">{t("products.form.occasions")}</legend>
                <p className="mt-1 text-xs text-ink-3">{t("products.form.occasionsHint")}</p>
                {occasions.length > 0 ? (
                  <div className="mt-1 grid gap-x-6 sm:grid-cols-2">
                    {occasions.map((occasion) => (
                      <Checkbox
                        key={occasion.value}
                        name="occasions"
                        value={occasion.value}
                        defaultChecked={values.occasionIds.includes(occasion.value)}
                        label={occasion.label}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-ink-3">
                    {t("products.form.noOccasions")}{" "}
                    <Link href="/admin/occasions/new" className="text-ink underline underline-offset-4">
                      {t("products.form.addOccasion")}
                    </Link>
                  </p>
                )}
              </fieldset>
            </FormSection>

            <FormSection id="product-flowers" title={t("products.form.sections.flowers")} description={t("products.form.sections.flowersHint")}>
              <fieldset className="min-w-0">
                <legend className="sr-only">{t("products.form.flowers")}</legend>
                <div className="grid gap-x-6 min-[480px]:grid-cols-2 lg:grid-cols-3">
                  {PRODUCT_FLOWERS.map((flower) => (
                    <Checkbox
                      key={flower.value}
                      name="flowers"
                      value={flower.value}
                      defaultChecked={values.flowers.includes(flower.value)}
                      label={label("flower", flower.value)}
                    />
                  ))}
                </div>
              </fieldset>
            </FormSection>
          </div>

          <div className="min-w-0 space-y-6">
            <FormSection id="product-visibility" title={t("products.form.sections.visibility")}>
              {/* Controlled, because it depends on the photos: a product cannot
                  go on sale without one, and the switch says so rather than
                  letting her turn it on and find out on save. */}
              <Switch
                name="available"
                label={t("products.form.available")}
                hint={canPublish ? t("products.form.availableHint") : t("actions.validation.publishNeedsPhoto")}
                hintTone={canPublish ? "muted" : "warning"}
                checked={available && canPublish}
                disabled={!canPublish || readOnly}
                onChange={(e) => setAvailable(e.target.checked)}
              />
              <Switch
                name="trackStock"
                label={t("products.form.trackStock")}
                hint={t("products.form.trackStockHint")}
                checked={trackStock}
                disabled={readOnly}
                onChange={(e) => setTrackStock(e.target.checked)}
              />
              {trackStock ? (
                <Field id="stock" label={t("products.form.stock")} hint={t("products.form.stockHint")}>
                  <Input id="stock" name="stock" withHint type="number" min="0" step="1" inputMode="numeric" defaultValue={String(values.stock)} />
                </Field>
              ) : (
                <input type="hidden" name="stock" value={String(values.stock)} />
              )}
              <Field
                id="slug"
                label={t("products.form.slug")}
                hint={isEdit ? t("products.form.slugHintEdit") : t("products.form.slugHintNew")}
              >
                <PrefixInput
                  id="slug"
                  name="slug"
                  prefix="/product/"
                  ltr
                  withHint
                  defaultValue={values.slug}
                  placeholder={isEdit ? undefined : "amber-hour"}
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
              <Field id="sortOrder" label={t("products.form.sortOrder")} hint={t("products.form.sortOrderHint")}>
                <Input id="sortOrder" name="sortOrder" withHint type="number" step="1" defaultValue={String(values.sortOrder)} />
              </Field>
            </FormSection>

            <FormSection id="product-flags" title={t("products.form.sections.flags")} description={t("products.form.sections.flagsHint")}>
              <div className="-my-2 divide-y divide-line">
                <Switch name="featured" label={t("products.flags.featured")} hint={t("products.form.featuredHint")} defaultChecked={values.featured} />
                <Switch name="bestseller" label={t("products.flags.bestseller")} hint={t("products.form.bestsellerHint")} defaultChecked={values.bestseller} />
                <Switch name="newArrival" label={t("products.flags.newArrival")} hint={t("products.form.newArrivalHint")} defaultChecked={values.newArrival} />
                <Switch name="seasonal" label={t("products.flags.seasonal")} hint={t("products.form.seasonalHint")} defaultChecked={values.seasonal} />
              </div>
            </FormSection>

            <FormSection id="product-seo" title={t("products.form.sections.seo")} description={t("products.form.sections.seoHint")}>
              <Field
                id="seoTitle"
                label={t("products.form.seoTitle")}
                hint={t("products.form.seoTitleHint")}
                aside={t("products.form.counter", { length: seoTitleLength, max: 60 })}
              >
                <Input
                  id="seoTitle"
                  name="seoTitle"
                  withHint
                  maxLength={70}
                  defaultValue={values.seoTitle}
                  onChange={(e) => setSeoTitleLength(e.target.value.length)}
                />
              </Field>
              <Field
                id="seoDescription"
                label={t("products.form.seoDescription")}
                hint={t("products.form.seoDescriptionHint")}
                aside={t("products.form.counter", { length: seoDescriptionLength, max: 155 })}
              >
                <Textarea
                  id="seoDescription"
                  name="seoDescription"
                  withHint
                  rows={3}
                  maxLength={180}
                  defaultValue={values.seoDescription}
                  onChange={(e) => setSeoDescriptionLength(e.target.value.length)}
                />
              </Field>
              <Switch name="noIndex" label={t("products.form.noIndex")} hint={t("products.form.noIndexHint")} defaultChecked={values.noIndex} />
            </FormSection>
          </div>
        </div>
      </ActionForm>

      {picking ? (
        <MediaPickerDialog
          title={t("products.form.photos.pickerTitle")}
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
