"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { createOccasion, deleteOccasion, updateOccasion } from "@backend/actions/admin";
import type { MediaOption } from "@backend/domain/media-option";
import {
  ActionButton,
  ActionForm,
  Field,
  Fieldset,
  TextArea,
  TextInput,
  Toggle,
  secondaryButtonClass,
} from "@admin/components/Form";
import { MediaPickerDialog } from "@admin/components/MediaPicker";

/**
 * Occasions are the shop's one real taxonomy, so the client must be able to
 * add "Eid" or "Mother's Day" herself without a developer. This is that form.
 */

export type OccasionValues = {
  id?: number;
  name: string;
  slug?: string;
  description?: string;
  imageId?: number;
  sortOrder: number;
  active: boolean;
};

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
  const occasionId = values.id;
  const isEdit = typeof occasionId === "number";

  const [library, setLibrary] = useState<MediaOption[]>(media);
  const [imageId, setImageId] = useState<number | undefined>(values.imageId);
  const [picking, setPicking] = useState(false);
  const [descriptionLength, setDescriptionLength] = useState(values.description?.length ?? 0);

  const image = imageId !== undefined ? library.find((m) => m.id === imageId) : undefined;

  return (
    <>
      <ActionForm
        action={(form) =>
          typeof occasionId === "number" ? updateOccasion(occasionId, form) : createOccasion(form)
        }
        submitLabel={isEdit ? "Save changes" : "Create occasion"}
        redirectTo={isEdit ? undefined : "/admin/occasions?created=1"}
        secondary={
          <>
            <Link href="/admin/occasions" className={secondaryButtonClass}>
              Cancel
            </Link>
            {isEdit ? (
              liveHref ? (
                <a href={liveHref} target="_blank" rel="noreferrer" className={secondaryButtonClass}>
                  View on shop ↗
                </a>
              ) : (
                <span className="px-1 text-xs text-sage">Hidden from the shop</span>
              )
            ) : null}
          </>
        }
        destructive={
          typeof occasionId === "number" && isOwner ? (
            <ActionButton
              action={() => deleteOccasion(occasionId)}
              label="Delete occasion"
              variant="danger"
              redirectTo="/admin/occasions?deleted=1"
              confirm="This removes the occasion and its page. If any product still uses it, deletion is refused and you can hide it instead."
            />
          ) : null
        }
      >
        <Fieldset legend="Occasion">
          <Field label="Name" name="name" required>
            <TextInput name="name" defaultValue={values.name} required maxLength={80} placeholder="Birthday" />
          </Field>

          <Field
            label="Description"
            name="description"
            hint={
              <>
                A line or two shown under the name on the occasion’s page.{" "}
                <span className="tabular-nums">{descriptionLength}/600</span>
              </>
            }
          >
            <TextArea
              name="description"
              rows={3}
              maxLength={600}
              defaultValue={values.description}
              onChange={(e) => setDescriptionLength(e.target.value.length)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Web address"
              name="slug"
              hint={isEdit ? "Changing this breaks existing links." : "Optional — created from the name."}
            >
              <div className="flex min-h-11 overflow-hidden rounded-md border border-hairline bg-white focus-within:ring-2 focus-within:ring-burnt-orange">
                <span className="flex items-center bg-admin-sunken px-3 text-xs text-sage">/occasions/</span>
                <input
                  id="slug"
                  name="slug"
                  defaultValue={values.slug}
                  placeholder={isEdit ? undefined : "birthday"}
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  className="min-w-0 flex-1 bg-white px-3 text-sm text-olive placeholder:text-sage/60 focus:outline-none"
                />
              </div>
            </Field>
            <Field label="Order" name="sortOrder" hint="Lower numbers appear first.">
              <TextInput name="sortOrder" type="number" step="1" defaultValue={String(values.sortOrder)} />
            </Field>
          </div>

          <Toggle
            name="active"
            label="Show on the website"
            hint="Untick to hide the occasion and its page from customers."
            defaultChecked={values.active}
          />
        </Fieldset>

        <Fieldset
          legend="Image"
          hint="Shown on the occasion tiles. Without one, the shop uses soft generated artwork."
        >
          {imageId !== undefined ? <input type="hidden" name="imageId" value={imageId} /> : null}
          {imageId !== undefined ? (
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative aspect-[4/3] w-44 overflow-hidden rounded-md bg-admin-sunken">
                {image ? (
                  <Image
                    src={image.thumbnailUrl ?? image.url}
                    alt={image.alt}
                    fill
                    sizes="176px"
                    className="object-cover"
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-xs text-sage">
                    Photo not found
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setPicking(true)} className={secondaryButtonClass}>
                  Change image
                </button>
                <button
                  type="button"
                  onClick={() => setImageId(undefined)}
                  className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-burgundy hover:bg-burgundy/5"
                >
                  Remove image
                </button>
              </div>
            </div>
          ) : (
            <div>
              <button type="button" onClick={() => setPicking(true)} className={secondaryButtonClass}>
                Choose an image
              </button>
            </div>
          )}
        </Fieldset>
      </ActionForm>

      {picking ? (
        <MediaPickerDialog
          title="Occasion image"
          library={library}
          initialSelected={imageId !== undefined ? [imageId] : []}
          multiple={false}
          onClose={() => setPicking(false)}
          onConfirm={(ids, nextLibrary) => {
            setLibrary(nextLibrary);
            setImageId(ids[0]);
            setPicking(false);
          }}
        />
      ) : null}
    </>
  );
}
