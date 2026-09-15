"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { uploadMedia } from "@backend/actions/admin";
import type { MediaOption } from "@backend/domain/media-option";
import { useI18n } from "@admin/i18n/client";
import { Button } from "@admin/ui/Button";
import { Dialog } from "@admin/ui/Dialog";
import { Field, Input, SearchInput, fieldClasses } from "@admin/ui/Field";
import { Icon } from "@admin/ui/icons";

/**
 * Choose photographs — or upload new ones — without leaving the editor.
 *
 * It is rendered OUTSIDE the product's <form> (a sibling, not a child), so
 * pressing Enter in its search box never submits the product, and its file
 * field never travels with the product's data. It contains no <form> of its
 * own for the same reason.
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

export function MediaPickerDialog({ title, library, initialSelected, multiple, max = 8, onClose, onConfirm }: Props) {
  const { t, plural, resolve } = useI18n();
  const [items, setItems] = useState<MediaOption[]>(library);
  const [selected, setSelected] = useState<number[]>(initialSelected);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const altRef = useRef<HTMLInputElement>(null);

  const q = query.trim().toLowerCase();
  const visible = q ? items.filter((m) => `${m.alt} ${m.filename ?? ""}`.toLowerCase().includes(q)) : items;

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
      setNotice({ ok: false, text: t("media.picker.maxReached", { max }) });
      return;
    }
    setSelected((prev) => [...prev, id]);
  }

  async function upload() {
    const file = fileRef.current?.files?.[0];
    const alt = altRef.current?.value.trim() ?? "";
    if (!file) {
      setNotice({ ok: false, text: t("media.picker.chooseFile") });
      return;
    }
    if (!alt) {
      setNotice({ ok: false, text: t("media.picker.describeFirst") });
      altRef.current?.focus();
      return;
    }

    const data = new FormData();
    data.set("file", file);
    data.set("alt", alt);
    setNotice(null);
    setUploading(true);
    try {
      const result = await uploadMedia(data);
      if (result.ok && result.media) {
        const added = result.media;
        setItems((prev) => [added, ...prev]);
        setSelected((prev) => (multiple ? (prev.length < max ? [...prev, added.id] : prev) : [added.id]));
        if (fileRef.current) fileRef.current.value = "";
        if (altRef.current) altRef.current.value = "";
        setQuery("");
        setNotice({ ok: true, text: t("media.picker.uploadedSelected") });
      } else {
        setNotice({ ok: false, text: resolve(result.code, result.vars, result.message) });
      }
    } catch {
      setNotice({ ok: false, text: t("common.couldNotSave") });
    } finally {
      setUploading(false);
    }
  }

  const confirmLabel = multiple
    ? selected.length === 0
      ? t("media.picker.useNone")
      : plural("media.picker.use", selected.length)
    : selected.length === 0
      ? t("media.picker.useNoImage")
      : t("media.picker.useImage");

  const selection = multiple
    ? selected.length === 0
      ? t("media.picker.noneSelected")
      : plural("media.picker.selected", selected.length)
    : selected.length === 0
      ? t("media.picker.noImageSelected")
      : t("media.picker.oneImageSelected");

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      variant="sheet"
      size="lg"
      footer={
        <>
          <p className="w-full text-sm text-ink-3 sm:me-auto sm:w-auto" aria-live="polite">
            {selection}
          </p>
          <Button onClick={onClose} className="max-sm:flex-1">
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={() => onConfirm(selected, items)} className="max-sm:flex-1">
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field id="media-picker-search" label={t("media.picker.search")}>
            <SearchInput
              id="media-picker-search"
              data-autofocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("media.filters.searchPlaceholder")}
            />
          </Field>
          <p className="text-xs text-ink-3 sm:pb-3">{plural("media.count", items.length)}</p>
        </div>

        <details className="group rounded-md border border-line bg-sunken/40" open={items.length === 0}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <Icon name="upload" className="h-4 w-4" />
              {t("media.picker.uploadNew")}
            </span>
            <Icon name="chevronDown" className="h-4 w-4 text-ink-3 transition-transform duration-150 group-open:rotate-180" />
          </summary>
          <div className="grid gap-3 border-t border-line px-4 py-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <Field id="media-picker-file" label={t("media.upload.file")}>
              <input
                ref={fileRef}
                id="media-picker-file"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className={cn(fieldClasses, "py-2 file:me-3 file:rounded-sm file:border-0 file:bg-sunken file:px-3 file:py-1 file:text-xs file:text-ink")}
              />
            </Field>
            <Field id="media-picker-alt" label={t("media.upload.alt")}>
              <Input
                ref={altRef}
                id="media-picker-alt"
                maxLength={200}
                placeholder={t("media.upload.altPlaceholder")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void upload();
                  }
                }}
              />
            </Field>
            <Button icon="upload" onClick={() => void upload()} loading={uploading} loadingText={t("common.uploading")}>
              {t("common.upload")}
            </Button>
          </div>
          <p className="px-4 pb-4 text-xs leading-relaxed text-ink-3">
            {t("media.upload.rules")} {t("media.upload.altHint")}
          </p>
        </details>

        {notice ? (
          <div
            role={notice.ok ? "status" : "alert"}
            className={cn(
              "flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm",
              notice.ok ? "border-success/30 bg-success/[0.08] text-ink" : "border-danger/30 bg-danger/[0.08] text-ink",
            )}
          >
            <Icon name={notice.ok ? "checkCircle" : "alert"} className={cn("mt-0.5 h-4 w-4", notice.ok ? "text-success" : "text-danger")} />
            {notice.text}
          </div>
        ) : null}

        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-3">{t("media.picker.emptyLibrary")}</p>
        ) : visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-3">{t("media.picker.nothingMatches", { query })}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {visible.map((m) => {
              const index = selected.indexOf(m.id);
              const on = index >= 0;
              const caption = m.alt || m.filename || `#${m.id}`;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => toggle(m.id)}
                    aria-pressed={on}
                    className={cn(
                      "relative block w-full overflow-hidden rounded-md border-2 bg-surface text-start transition-colors duration-150",
                      on ? "border-accent" : "border-transparent hover:border-line-strong",
                    )}
                  >
                    <span className="relative block aspect-square bg-sunken">
                      <Image src={m.thumbnailUrl ?? m.url} alt="" fill sizes="(max-width: 640px) 45vw, 200px" className="object-cover" />
                    </span>
                    <span className="block truncate px-2 py-1.5 text-xs text-ink">{caption}</span>
                    {on ? (
                      <span
                        aria-hidden
                        className="absolute end-1.5 top-1.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-medium text-on-accent"
                      >
                        {multiple ? index + 1 : <Icon name="check" className="h-3.5 w-3.5" />}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
