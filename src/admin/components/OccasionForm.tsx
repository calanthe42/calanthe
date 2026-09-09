"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { createOccasion, deleteOccasion, updateOccasion } from "@backend/actions/admin";
import {
  ActionButton,
  ActionForm,
  Field,
  Fieldset,
  TextInput,
  Toggle,
} from "@admin/components/Form";
import type { MediaOption } from "@admin/components/ProductForm";

/**
 * Occasions are the shop's one real taxonomy, so the client must be able to
 * add "Eid" or "Mother's Day" herself without a developer. This is that form.
 */

export type OccasionValues = {
  id?: number;
  name: string;
  slug?: string;
  imageId?: number;
  sortOrder: number;
  active: boolean;
};

function TilePicker({ media, initial }: { media: MediaOption[]; initial?: number }) {
  const [selected, setSelected] = useState<number | undefined>(initial);

  return (
    <div>
      {selected ? <input type="hidden" name="imageId" value={selected} /> : null}
      {media.length === 0 ? (
        <p className="text-sm text-sage">
          No photographs uploaded yet — the occasion will use generated artwork.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
          {media.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setSelected((prev) => (prev === m.id ? undefined : m.id))}
                aria-pressed={selected === m.id}
                className={cn(
                  "relative block aspect-square w-full overflow-hidden rounded-media-sm border-2",
                  selected === m.id ? "border-burnt-orange" : "border-transparent hover:border-hairline",
                )}
              >
                <Image
                  src={m.thumbnailUrl ?? m.url}
                  alt={m.alt}
                  fill
                  sizes="100px"
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function OccasionForm({
  values,
  media,
}: {
  values: OccasionValues;
  media: MediaOption[];
}) {
  const isEdit = typeof values.id === "number";

  return (
    <ActionForm
      action={(form) => (isEdit ? updateOccasion(values.id!, form) : createOccasion(form))}
      submitLabel={isEdit ? "Save changes" : "Create occasion"}
      redirectTo="/admin/occasions"
      destructive={
        isEdit ? (
          <ActionButton
            action={() => deleteOccasion(values.id!)}
            label="Delete occasion"
            variant="danger"
            confirm="If any product still uses this occasion, the system will refuse to delete it."
          />
        ) : null
      }
    >
      <Fieldset legend="Occasion">
        <Field label="Name" name="name" required>
          <TextInput name="name" defaultValue={values.name} required placeholder="Birthday" />
        </Field>
        <Field
          label="Web address"
          name="slug"
          hint="Generated from the name if left blank. Changing it breaks existing links."
        >
          <TextInput name="slug" defaultValue={values.slug} placeholder="birthday" />
        </Field>
        <Field label="Order" name="sortOrder" hint="Lower numbers appear first.">
          <TextInput name="sortOrder" type="number" defaultValue={String(values.sortOrder)} />
        </Field>
        <Toggle
          name="active"
          label="Show on the website"
          hint="Unticked hides the occasion and its page from customers."
          defaultChecked={values.active}
        />
      </Fieldset>

      <Fieldset legend="Tile image" hint="Shown on the occasions grid.">
        <TilePicker media={media} initial={values.imageId} />
      </Fieldset>
    </ActionForm>
  );
}
