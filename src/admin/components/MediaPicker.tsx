"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { uploadMedia } from "@backend/actions/admin";
import type { MediaOption } from "@backend/domain/media-option";

/**
 * Choose photographs — or upload new ones — without leaving the editor.
 *
 * WHY A PORTAL. This dialog opens from inside the product form, and it has
 * inputs of its own (search, file, description). Rendered in place they would
 * sit inside that <form>: pressing Enter in the search box would submit the
 * product, and the upload field would travel with the product's data. Portalled
 * to <body>, its inputs belong to no form at all. It also contains no <form>
 * element, because React forwards submit events through portals to the
 * product form above it in the component tree.
 *
 * A new upload is added to the grid and selected immediately, so the owner
 * never loses what she has typed into the product to reload a page.
 */

type Props = {
  title: string;
  library: MediaOption[];
  initialSelected: number[];
  multiple: boolean;
  max?: number;
  onClose: () => void;
  onConfirm: (ids: number[], library: MediaOption[]) => void;
};

export function MediaPickerDialog({
  title,
  library,
  initialSelected,
  multiple,
  max = 8,
  onClose,
  onConfirm,
}: Props) {
  const [items, setItems] = useState<MediaOption[]>(library);
  const [selected, setSelected] = useState<number[]>(initialSelected);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [uploading, startUpload] = useTransition();
  const [mounted, setMounted] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const altRef = useRef<HTMLInputElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    setMounted(true);
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      /* Return focus to the button that opened the dialog. */
      opener?.focus();
    };
  }, []);

  useEffect(() => {
    if (mounted) searchRef.current?.focus();
  }, [mounted]);

  const q = query.trim().toLowerCase();
  const visible = q
    ? items.filter((m) => `${m.alt} ${m.filename ?? ""}`.toLowerCase().includes(q))
    : items;

  function toggle(id: number) {
    setNotice(null);
    if (!multiple) {
      setSelected((prev) => (prev[0] === id ? [] : [id]));
      return;
    }
    if (selected.includes(id)) {
      setSelected((prev) => prev.filter((x) => x !== id));
      return;
    }
    if (selected.length >= max) {
      setNotice({ ok: false, text: `A product can have up to ${max} photos. Remove one first.` });
      return;
    }
    setSelected((prev) => [...prev, id]);
  }

  function upload() {
    const file = fileRef.current?.files?.[0];
    const alt = altRef.current?.value.trim() ?? "";
    if (!file) {
      setNotice({ ok: false, text: "Choose a photo file to upload." });
      return;
    }
    if (!alt) {
      setNotice({
        ok: false,
        text: "Describe the photo first — for example “Blush peonies in a cream vase”.",
      });
      altRef.current?.focus();
      return;
    }

    const data = new FormData();
    data.set("file", file);
    data.set("alt", alt);
    setNotice(null);

    startUpload(async () => {
      const res = await uploadMedia(data);
      if (res.ok && res.media) {
        const added = res.media;
        setItems((prev) => [added, ...prev]);
        setSelected((prev) =>
          multiple ? (prev.length < max ? [...prev, added.id] : prev) : [added.id],
        );
        if (fileRef.current) fileRef.current.value = "";
        if (altRef.current) altRef.current.value = "";
        setQuery("");
        setNotice({ ok: true, text: "Uploaded and selected." });
      } else {
        setNotice({ ok: false, text: res.message });
      }
    });
  }

  if (!mounted) return null;

  const confirmLabel = multiple
    ? selected.length === 0
      ? "Use no photos"
      : `Use ${selected.length} photo${selected.length === 1 ? "" : "s"}`
    : selected.length === 0
      ? "Use no image"
      : "Use this image";

  return createPortal(
    <div className="admin-portal fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-olive/60"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-picker-title"
        className="relative flex max-h-[92svh] w-full flex-col rounded-t-md bg-white shadow-xl sm:max-w-3xl sm:rounded-md"
      >
        <div className="flex items-center justify-between gap-3 border-b border-hairline/70 px-4 py-2 sm:px-5">
          <h2 id="media-picker-title" className="font-display text-xl font-light text-olive">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 inline-flex h-11 w-11 items-center justify-center text-sage hover:text-olive"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label htmlFor="media-picker-search" className="mb-1.5 block text-xs font-medium text-olive">
                Search your photos
              </label>
              <input
                id="media-picker-search"
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Description or file name"
                className="min-h-11 w-full rounded-md border border-hairline px-3 text-sm text-olive placeholder:text-sage/60"
              />
            </div>
            <p className="text-xs text-sage sm:pb-3">
              {items.length} photo{items.length === 1 ? "" : "s"} in your library
            </p>
          </div>

          <details
            className="group rounded-md border border-hairline/70 bg-admin-sunken/60"
            open={items.length === 0}
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-sm font-medium text-olive [&::-webkit-details-marker]:hidden">
              Upload a new photo
              <span aria-hidden className="text-lg leading-none text-sage transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <div className="grid gap-3 px-4 pb-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="min-w-0">
                <label htmlFor="media-picker-file" className="mb-1.5 block text-xs font-medium text-olive">
                  Photo file
                </label>
                <input
                  id="media-picker-file"
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="min-h-11 w-full rounded-md border border-hairline bg-white px-2 py-2 text-sm text-olive file:mr-2 file:rounded-sm file:border-0 file:bg-admin-sunken file:px-2 file:py-1 file:text-xs file:text-olive"
                />
              </div>
              <div className="min-w-0">
                <label htmlFor="media-picker-alt" className="mb-1.5 block text-xs font-medium text-olive">
                  Description
                </label>
                <input
                  id="media-picker-alt"
                  ref={altRef}
                  maxLength={200}
                  placeholder="Blush peonies in a cream vase"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      upload();
                    }
                  }}
                  className="min-h-11 w-full rounded-md border border-hairline bg-white px-3 text-sm text-olive placeholder:text-sage/60"
                />
              </div>
              <button
                type="button"
                onClick={upload}
                disabled={uploading}
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-olive px-4 text-sm font-medium text-cream disabled:opacity-60"
              >
                {uploading ? "Uploading…" : "Upload"}
              </button>
            </div>
            <p className="px-4 pb-4 text-xs leading-relaxed text-sage">
              JPEG, PNG, WebP or AVIF, up to 4 MB. The description is read aloud to people using
              screen readers.
            </p>
          </details>

          {notice ? (
            <p
              role={notice.ok ? "status" : "alert"}
              className={cn(
                "rounded-md border px-3 py-2 text-sm",
                notice.ok
                  ? "border-[#4a6741]/30 bg-[#4a6741]/[0.06] text-[#3d5636]"
                  : "border-burgundy/30 bg-burgundy/5 text-burgundy",
              )}
            >
              {notice.text}
            </p>
          ) : null}

          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-sage">
              Your photo library is empty. Upload the first photo above.
            </p>
          ) : visible.length === 0 ? (
            <p className="py-6 text-center text-sm text-sage">Nothing matches “{query}”.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {visible.map((m) => {
                const index = selected.indexOf(m.id);
                const isOn = index >= 0;
                const caption = m.alt || m.filename || `Photo ${m.id}`;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => toggle(m.id)}
                      aria-pressed={isOn}
                      className={cn(
                        "relative block w-full overflow-hidden rounded-md border-2 bg-white text-left transition-colors",
                        isOn ? "border-burnt-orange" : "border-transparent hover:border-hairline",
                      )}
                    >
                      <span className="relative block aspect-square bg-admin-sunken">
                        <Image
                          src={m.thumbnailUrl ?? m.url}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 45vw, 170px"
                          className="object-cover"
                        />
                      </span>
                      <span className="block truncate px-2 py-1.5 text-xs text-olive">{caption}</span>
                      {isOn ? (
                        <span
                          aria-hidden
                          className="absolute right-1.5 top-1.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-burnt-orange px-1.5 text-[11px] font-medium text-cream"
                        >
                          {multiple ? index + 1 : "✓"}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-hairline/70 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 sm:px-5">
          <p className="mr-auto text-sm text-sage" aria-live="polite">
            {multiple
              ? selected.length === 0
                ? "No photos selected"
                : `${selected.length} selected — number 1 is the card image`
              : selected.length === 0
                ? "No image selected"
                : "1 image selected"}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-md border border-hairline bg-white px-4 text-sm text-olive"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selected, items)}
            className="min-h-11 rounded-md bg-burnt-orange px-4 text-sm font-medium text-cream"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
