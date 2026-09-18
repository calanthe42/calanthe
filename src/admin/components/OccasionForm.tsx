"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useState } from "react";
import { createOccasion, deleteOccasion, updateOccasion } from "@backend/actions/admin";
import type { MediaOption } from "@backend/domain/media-option";
import { useI18n } from "@admin/i18n/client";
import { ActionButton } from "@admin/ui/ActionButton";
import { ActionForm, useMarkDirty } from "@admin/ui/ActionForm";
import { Button, ButtonLink } from "@admin/ui/Button";
import { FormSection } from "@admin/ui/Content";
import { Field, Input, PrefixInput, Switch, Textarea } from "@admin/ui/Field";

/**
 * Occasions are the store's one real taxonomy, so the owner must be able to
 * add "Eid" or "Mother's Day" herself without a developer. This is that form,
 * built from the same pieces as the product editor.
 */

const MediaPickerDialog = dynamic(() => import("./MediaPicker").then((m) => m.MediaPickerDialog), {
  ssr: false,
});

export type OccasionValues = {
  id?: number;
  name: string;
  slug?: string;
  description?: string;
  imageId?: number;
  sortOrder: number;
  active: boolean;
};

function OccasionImage({
  image,
  imageId,
  onPick,
  onRemove,
}: {
  image: MediaOption | undefined;
  imageId: number | undefined;
  onPick: () => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const markDirty = useMarkDirty();

  return (
    <div>
      {imageId !== undefined ? <input type="hidden" name="imageId" value={imageId} /> : null}
      {imageId !== undefined ? (
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative aspect-[4/3] w-48 overflow-hidden rounded-md border border-line bg-sunken">
            {image ? (
              <Image src={image.thumbnailUrl ?? image.url} alt={image.alt} fill sizes="192px" className="object-cover" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-xs text-ink-3">{t("common.photoNotFound")}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon="image" onClick={onPick}>
              {t("occasions.form.changeImage")}
            </Button>
            <Button
              variant="ghost"
              icon="trash"
              className="text-danger hover:text-danger"
              onClick={() => {
                onRemove();
                markDirty();
              }}
            >
              {t("occasions.form.removeImage")}
            </Button>
          </div>
        </div>
      ) : (
        <Button icon="plus" onClick={onPick}>
          {t("occasions.form.chooseImage")}
        </Button>
      )}
    </div>
  );
}

export function OccasionForm({
  values,
  media,
  isOwner,
  liveHref,
}: {
  values: OccasionValues;
  media: MediaOption[];
  /** Creating and deleting occasions is owner-only; staff may edit. */
  isOwner: boolean;
  liveHref?: string;
}) {
  const { t } = useI18n();
  const occasionId = values.id;
  const isEdit = typeof occasionId === "number";

  const [library, setLibrary] = useState<MediaOption[]>(media);
  const [imageId, setImageId] = useState<number | undefined>(values.imageId);
  const [picking, setPicking] = useState(false);
  const [descriptionLength, setDescriptionLength] = useState(values.description?.length ?? 0);
  /* Changing the image happens in the picker, outside the form's own events. */
  const [imageChanged, setImageChanged] = useState(0);

  const image = imageId !== undefined ? library.find((m) => m.id === imageId) : undefined;

  return (
    <>
      <ActionForm
        key={imageChanged}
        action={(form) => (typeof occasionId === "number" ? updateOccasion(occasionId, form) : createOccasion(form))}
        submitLabel={isEdit ? undefined : t("occasions.form.create")}
        redirectTo={isEdit ? undefined : "/admin/occasions?created=1"}
        secondary={
          <>
            <ButtonLink href="/admin/occasions" variant="ghost">
              {t("common.cancel")}
            </ButtonLink>
            {liveHref ? (
              <ButtonLink href={liveHref} external icon="store" className="max-sm:hidden">
                {t("common.viewOnStore")}
              </ButtonLink>
            ) : null}
          </>
        }
        destructive={
          typeof occasionId === "number" && isOwner ? (
            <ActionButton
              variant="danger"
              icon="trash"
              label={t("common.delete")}
              action={() => deleteOccasion(occasionId)}
              redirectTo="/admin/occasions?deleted=1"
              confirm={{
                title: t("occasions.form.deleteTitle", { name: values.name }),
                body: t("occasions.form.deleteBody"),
                confirmLabel: t("occasions.form.deleteConfirm"),
              }}
            />
          ) : null
        }
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          <div className="min-w-0 space-y-6">
            <FormSection id="occasion-details" title={t("occasions.form.sections.details")}>
              <Field id="name" label={t("occasions.form.name")} required>
                <Input id="name" name="name" defaultValue={values.name} required maxLength={80} placeholder={t("occasions.form.namePlaceholder")} />
              </Field>
              <Field
                id="description"
                label={t("occasions.form.description")}
                hint={t("occasions.form.descriptionHint")}
                aside={`${descriptionLength}/600`}
              >
                <Textarea
                  id="description"
                  name="description"
                  withHint
                  rows={4}
                  maxLength={600}
                  defaultValue={values.description}
                  onChange={(e) => setDescriptionLength(e.target.value.length)}
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="slug" label={t("occasions.form.slug")} hint={isEdit ? t("occasions.form.slugHintEdit") : t("occasions.form.slugHintNew")}>
                  <PrefixInput
                    id="slug"
                    name="slug"
                    prefix="/occasions/"
                    ltr
                    withHint
                    defaultValue={values.slug}
                    placeholder={isEdit ? undefined : "birthday"}
                    autoCapitalize="none"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </Field>
                <Field id="sortOrder" label={t("occasions.form.order")} hint={t("occasions.form.orderHint")}>
                  <Input id="sortOrder" name="sortOrder" withHint type="number" step="1" defaultValue={String(values.sortOrder)} />
                </Field>
              </div>
            </FormSection>

            <FormSection id="occasion-image" title={t("occasions.form.sections.image")} description={t("occasions.form.sections.imageHint")}>
              <OccasionImage image={image} imageId={imageId} onPick={() => setPicking(true)} onRemove={() => setImageId(undefined)} />
            </FormSection>
          </div>

          <div className="min-w-0">
            <FormSection id="occasion-visibility" title={t("occasions.form.sections.visibility")}>
              <Switch name="active" label={t("occasions.form.active")} hint={t("occasions.form.activeHint")} defaultChecked={values.active} />
            </FormSection>
          </div>
        </div>
      </ActionForm>

      {picking ? (
        <MediaPickerDialog
          title={t("occasions.form.pickerTitle")}
          library={library}
          initialSelected={imageId !== undefined ? [imageId] : []}
          multiple={false}
          onClose={() => setPicking(false)}
          onConfirm={(ids, nextLibrary) => {
            setLibrary(nextLibrary);
            if (ids[0] !== imageId) setImageChanged((n) => n);
            setImageId(ids[0]);
            setPicking(false);
          }}
        />
      ) : null}
    </>
  );
}
