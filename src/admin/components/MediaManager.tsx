"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMedia, uploadMedia } from "@backend/actions/admin";
import type { ActionResult } from "@backend/actions/admin";
import { listNames, type MediaOption } from "@backend/domain/media-option";
import { ActionButton, Toast } from "@admin/components/Form";

/**
 * The photograph library.
 *
 * Alt text is required at the point of upload rather than offered as an
 * optional extra, because it is the only moment anyone knows what the picture
 * shows. Uploading first and describing later means never describing.
 *
 * Every photo says where it is used. That is what makes deleting safe to
 * offer: a photo in use cannot be deleted, and the card says why and where,
 * instead of a product quietly losing its image.
 */

export type MediaItem = MediaOption & { usedBy: string[] };

const TYPES = [
  { label: "JPEG", value: "image/jpeg" },
  { label: "PNG", value: "image/png" },
  { label: "WebP", value: "image/webp" },
  { label: "AVIF", value: "image/avif" },
];

function readableSize(bytes?: number): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const typeLabel = (mime?: string) =>
  TYPES.find((t) => t.value === mime)?.label ?? (mime ? mime.replace("image/", "").toUpperCase() : "");

function Preview({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close preview" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-olive/70" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Photo: ${item.alt}`}
        className="relative max-h-[90svh] w-full max-w-2xl overflow-auto rounded-md bg-white p-4"
      >
        <div className="relative aspect-[4/3] w-full bg-admin-sunken">
          <Image src={item.url} alt={item.alt} fill sizes="(max-width: 768px) 100vw, 672px" className="object-contain" />
        </div>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-xs text-sage">Description</dt>
            <dd className="text-olive">{item.alt || "—"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-sage">File name</dt>
            <dd className="break-all text-olive">{item.filename ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-sage">Details</dt>
            <dd className="text-olive">
              {[item.width && item.height ? `${item.width}×${item.height}` : "", readableSize(item.filesize), typeLabel(item.mimeType)]
                .filter(Boolean)
                .join(" · ") || "—"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-sage">Used by</dt>
            <dd className="text-olive">{item.usedBy.length ? listNames(item.usedBy) : "Not used yet"}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <button ref={closeRef} type="button" onClick={onClose} className="min-h-11 rounded-md border border-hairline px-4 text-sm text-olive">
            Close
          </button>
          <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-md px-3 text-sm text-sage underline underline-offset-4 hover:text-olive">
            Open full size ↗
          </a>
        </div>
      </div>
    </div>
  );
}

export function MediaManager({ items, canDelete }: { items: MediaItem[]; canDelete: boolean }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [usage, setUsage] = useState("");
  const router = useRouter();
  const dismiss = useRef(() => setResult(null)).current;

  const q = query.trim().toLowerCase();
  const visible = items.filter((item) => {
    if (q && !`${item.alt} ${item.filename ?? ""}`.toLowerCase().includes(q)) return false;
    if (type && item.mimeType !== type) return false;
    if (usage === "used" && item.usedBy.length === 0) return false;
    if (usage === "unused" && item.usedBy.length > 0) return false;
    return true;
  });
  const filtering = Boolean(q || type || usage);

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
        className="mb-6 rounded-md border border-hairline/70 bg-white p-4 sm:p-5"
      >
        <p className="font-brand text-[10px] uppercase tracking-brand text-sage">Upload a photo</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="min-w-0">
            <label htmlFor="file" className="mb-1.5 block text-sm font-medium text-olive">
              Photo file
            </label>
            <input
              id="file"
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              required
              className="min-h-11 w-full rounded-md border border-hairline bg-white px-2 py-2 text-sm text-olive file:mr-3 file:rounded-sm file:border-0 file:bg-admin-sunken file:px-3 file:py-1.5 file:text-xs file:text-olive"
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="alt" className="mb-1.5 block text-sm font-medium text-olive">
              Description
            </label>
            <input
              id="alt"
              name="alt"
              required
              maxLength={200}
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
          JPEG, PNG, WebP or AVIF, up to 4 MB. The description is read aloud to people using screen
          readers and helps search engines.
        </p>
      </form>

      {items.length > 0 ? (
        <div role="search" className="mb-4 grid gap-3 rounded-md border border-hairline/70 bg-white p-4 sm:grid-cols-[2fr_1fr_1fr]">
          <div className="min-w-0">
            <label htmlFor="media-search" className="mb-1.5 block text-xs font-medium text-olive">
              Search photos
            </label>
            <input
              id="media-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Description or file name"
              className="min-h-11 w-full rounded-md border border-hairline px-3 text-sm text-olive placeholder:text-sage/60"
            />
          </div>
          <div>
            <label htmlFor="media-type" className="mb-1.5 block text-xs font-medium text-olive">
              File type
            </label>
            <select id="media-type" value={type} onChange={(e) => setType(e.target.value)} className="min-h-11 w-full rounded-md border border-hairline bg-white px-3 text-sm text-olive">
              <option value="">All types</option>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="media-usage" className="mb-1.5 block text-xs font-medium text-olive">
              Where used
            </label>
            <select id="media-usage" value={usage} onChange={(e) => setUsage(e.target.value)} className="min-h-11 w-full rounded-md border border-hairline bg-white px-3 text-sm text-olive">
              <option value="">Everywhere</option>
              <option value="used">In use</option>
              <option value="unused">Not used yet</option>
            </select>
          </div>
        </div>
      ) : null}

      {!canDelete && items.length > 0 ? (
        <p className="mb-4 text-xs text-sage">Only the owner can delete photos.</p>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-hairline bg-white/60 px-6 py-14 text-center">
          <p className="font-display text-xl font-light text-olive">No photos yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-sage">
            Upload your first photo above. Products cannot go on sale until they have one.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-md border border-dashed border-hairline bg-white/60 px-6 py-10 text-center">
          <p className="text-sm text-sage">No photos match those filters.</p>
        </div>
      ) : (
        <>
          {filtering ? (
            <p className="mb-3 text-xs text-sage" aria-live="polite">
              Showing {visible.length} of {items.length}
            </p>
          ) : null}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {visible.map((item) => (
              <li key={item.id} className="flex min-w-0 flex-col overflow-hidden rounded-md border border-hairline/70 bg-white">
                <button
                  type="button"
                  onClick={() => setPreview(item)}
                  className="relative block aspect-square w-full bg-admin-sunken"
                  aria-label={`Preview: ${item.alt || item.filename || "photo"}`}
                >
                  <Image
                    src={item.thumbnailUrl ?? item.url}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 50vw, 20vw"
                    className="object-cover"
                  />
                </button>
                <div className="flex flex-1 flex-col p-3">
                  <p className="line-clamp-2 text-xs font-medium text-olive" title={item.alt}>
                    {item.alt || "No description"}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-sage" title={item.filename}>
                    {item.filename}
                  </p>
                  <p className="text-[11px] text-sage">
                    {[item.width && item.height ? `${item.width}×${item.height}` : "", readableSize(item.filesize), typeLabel(item.mimeType)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className={`mt-1.5 text-[11px] ${item.usedBy.length ? "text-olive" : "text-sage"}`}>
                    {item.usedBy.length ? `Used by ${listNames(item.usedBy)}` : "Not used yet"}
                  </p>
                  {canDelete ? (
                    <div className="mt-auto pt-2">
                      {item.usedBy.length === 0 ? (
                        <ActionButton
                          action={() => deleteMedia(item.id)}
                          label="Delete"
                          variant="danger"
                          className="w-full"
                          confirm="This permanently deletes the photo file."
                        />
                      ) : (
                        <p className="text-[11px] leading-snug text-sage">
                          Remove it from where it is used to delete it.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {preview ? <Preview item={preview} onClose={() => setPreview(null)} /> : null}

      <Toast result={result} onDismiss={dismiss} />
    </>
  );
}
