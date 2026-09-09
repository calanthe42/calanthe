"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMedia, uploadMedia } from "@backend/actions/admin";
import { ActionButton, Toast } from "@admin/components/Form";
import type { ActionResult } from "@backend/actions/admin";

/**
 * The photograph library.
 *
 * Alt text is required at the point of upload rather than offered as an
 * optional extra, because it is the only moment anyone knows what the picture
 * shows. Uploading first and describing later means never describing.
 */

export type MediaItem = {
  id: number;
  alt: string;
  url: string;
  thumbnailUrl?: string;
  filename?: string;
  filesize?: number;
  width?: number;
  height?: number;
};

function readableSize(bytes?: number): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export function MediaManager({ items }: { items: MediaItem[] }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const router = useRouter();

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const el = e.currentTarget;
          startTransition(async () => {
            const res = await uploadMedia(form);
            setResult(res);
            if (res.ok) {
              el.reset();
              router.refresh();
            }
          });
        }}
        className="mb-8 rounded-md border border-hairline/70 bg-white p-5"
      >
        <p className="font-brand text-[10px] uppercase tracking-brand text-sage">
          Upload a photograph
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label htmlFor="file" className="mb-1.5 block text-sm font-medium text-olive">
              Image file
            </label>
            <input
              id="file"
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              required
              className="min-h-11 w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm text-olive file:mr-3 file:rounded-sm file:border-0 file:bg-admin-sunken file:px-3 file:py-1.5 file:text-xs file:text-olive"
            />
          </div>
          <div>
            <label htmlFor="alt" className="mb-1.5 block text-sm font-medium text-olive">
              Description
            </label>
            <input
              id="alt"
              name="alt"
              required
              placeholder="Blush peonies in a cream vase"
              className="min-h-11 w-full rounded-md border border-hairline bg-white px-3 text-sm text-olive placeholder:text-sage/60"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-burnt-orange px-5 text-sm font-medium text-cream disabled:opacity-60"
          >
            {pending ? "Uploading…" : "Upload"}
          </button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-sage">
          JPEG, PNG, WebP or AVIF, up to 4 MB. Four sizes are generated automatically. The
          description is read aloud by screen readers and used by search engines.
        </p>
      </form>

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-hairline bg-white/60 px-6 py-14 text-center">
          <p className="font-display text-xl font-light text-olive">No photographs yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-sage">
            Upload your first photograph above. Products cannot go on sale until they have one.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((item) => (
            <li key={item.id} className="overflow-hidden rounded-md border border-hairline/70 bg-white">
              <button
                type="button"
                onClick={() => setPreview(item)}
                className="relative block aspect-square w-full"
                aria-label={`Preview ${item.alt}`}
              >
                <Image
                  src={item.thumbnailUrl ?? item.url}
                  alt={item.alt}
                  fill
                  sizes="(max-width: 640px) 50vw, 20vw"
                  className="object-cover"
                />
              </button>
              <div className="p-3">
                <p className="truncate text-xs text-olive" title={item.alt}>
                  {item.alt}
                </p>
                <p className="mt-0.5 text-[11px] text-sage">
                  {item.width && item.height ? `${item.width}×${item.height}` : ""}{" "}
                  {readableSize(item.filesize)}
                </p>
                <div className="mt-2">
                  <ActionButton
                    action={() => deleteMedia(item.id)}
                    label="Delete"
                    variant="danger"
                    className="min-h-9 w-full px-2 text-xs"
                    confirm="If a product uses this photograph, the system will refuse to delete it."
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close preview"
            onClick={() => setPreview(null)}
            className="absolute inset-0 bg-olive/70"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={preview.alt}
            className="relative max-h-[90vh] w-full max-w-2xl overflow-auto rounded-md bg-white p-4"
          >
            <div className="relative aspect-[4/3] w-full">
              <Image
                src={preview.url}
                alt={preview.alt}
                fill
                sizes="(max-width: 768px) 100vw, 672px"
                className="object-contain"
              />
            </div>
            <p className="mt-3 text-sm text-olive">{preview.alt}</p>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="mt-3 min-h-11 rounded-md border border-hairline px-4 text-sm text-olive"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      <Toast result={result} onDismiss={() => setResult(null)} />
    </>
  );
}
