"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import { deleteMedia, updateMediaAlt, uploadMedia } from "@backend/actions/admin";
import type { MediaOption } from "@backend/domain/media-option";
import { useI18n } from "@admin/i18n/client";
import { Button, ButtonLink } from "@admin/ui/Button";
import { Card, CardHeader } from "@admin/ui/Card";
import { DescriptionList } from "@admin/ui/Content";
import { ConfirmDialog, Dialog } from "@admin/ui/Dialog";
import { Field, Input, SearchInput, Select, fieldClasses } from "@admin/ui/Field";
import { Icon } from "@admin/ui/icons";
import { EmptyState } from "@admin/ui/States";
import { useAction } from "@admin/ui/useAction";

/**
 * The photograph library.
 *
 * Alt text is required at the point of upload rather than offered as an
 * optional extra, because it is the only moment anyone knows what the picture
 * shows. It can be corrected later from the photo's details.
 *
 * Every photo says where it is used. That is what makes deleting safe to
 * offer: a photo in use cannot be deleted, and the details say why and where,
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

function MediaDetails({
  item,
  canDelete,
  onDeleted,
}: {
  item: MediaItem;
  canDelete: boolean;
  onDeleted: () => void;
}) {
  const { t, date } = useI18n();
  const router = useRouter();
  const altAction = useAction();
  const deleteAction = useAction();
  const [confirming, setConfirming] = useState(false);

  function saveAlt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void altAction.run(() => updateMediaAlt(item.id, data), { onSuccess: () => router.refresh() });
  }

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-line bg-sunken">
        <Image src={item.url} alt={item.alt} fill sizes="(max-width: 768px) 100vw, 520px" className="object-contain" />
      </div>

      <div className="min-w-0 space-y-5">
        <form onSubmit={saveAlt} className="space-y-3" noValidate>
          <Field id={`alt-${item.id}`} label={t("media.upload.alt")} hint={t("media.upload.altHint")}>
            <Input id={`alt-${item.id}`} name="alt" withHint defaultValue={item.alt} maxLength={200} required />
          </Field>
          <Button type="submit" size="sm" icon="check" loading={altAction.pending} loadingText={t("common.saving")}>
            {t("media.detail.saveAlt")}
          </Button>
        </form>

        <DescriptionList
          emptyLabel={t("common.nothingProvided")}
          rows={[
            [t("media.detail.filename"), item.filename ? <span className="break-all">{item.filename}</span> : null],
            [t("media.detail.dimensions"), item.width && item.height ? <span dir="ltr">{`${item.width} × ${item.height}`}</span> : null],
            [t("media.detail.size"), readableSize(item.filesize) || null],
            [t("media.detail.type"), typeLabel(item.mimeType) || null],
            [t("media.detail.uploaded"), item.createdAt ? date(item.createdAt, "long") : null],
            [t("media.detail.usedBy"), item.usedBy.length > 0 ? item.usedBy.join(" · ") : t("media.card.notUsed")],
          ]}
        />

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <ButtonLink href={item.url} external size="sm" variant="ghost" iconEnd="external">
            {t("media.detail.openFull")}
          </ButtonLink>
          {canDelete ? (
            item.usedBy.length === 0 ? (
              <Button variant="danger" size="sm" icon="trash" className="ms-auto" onClick={() => setConfirming(true)}>
                {t("common.delete")}
              </Button>
            ) : (
              <p className="w-full text-xs leading-relaxed text-ink-3">{t("media.detail.inUse")}</p>
            )
          ) : (
            <p className="w-full text-xs leading-relaxed text-ink-3">{t("media.detail.ownerOnlyDelete")}</p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        pending={deleteAction.pending}
        title={t("media.detail.deleteTitle")}
        body={t("media.detail.deleteBody")}
        confirmLabel={t("media.detail.deleteConfirm")}
        onConfirm={() =>
          void deleteAction.run(() => deleteMedia(item.id), {
            onSuccess: () => {
              setConfirming(false);
              onDeleted();
            },
            onFailure: () => setConfirming(false),
          })
        }
      />
    </div>
  );
}

export function MediaManager({ items, canDelete }: { items: MediaItem[]; canDelete: boolean }) {
  const { t, plural } = useI18n();
  const router = useRouter();
  const upload = useAction();
  const [formKey, setFormKey] = useState(0);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [usage, setUsage] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);

  const detail = items.find((item) => item.id === detailId) ?? null;
  const q = query.trim().toLowerCase();
  const visible = items.filter((item) => {
    if (q && !`${item.alt} ${item.filename ?? ""}`.toLowerCase().includes(q)) return false;
    if (type && item.mimeType !== type) return false;
    if (usage === "used" && item.usedBy.length === 0) return false;
    if (usage === "unused" && item.usedBy.length > 0) return false;
    return true;
  });
  const filtering = Boolean(q || type || usage);

  function onUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void upload.run(() => uploadMedia(data), {
      onSuccess: () => {
        setFormKey((key) => key + 1);
        router.refresh();
      },
    });
  }

  return (
    <>
      <Card as="section" className="mb-4">
        <CardHeader title={t("media.upload.title")} description={t("media.upload.rules")} />
        <form key={formKey} onSubmit={onUpload} noValidate className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <Field id="upload-file" label={t("media.upload.file")}>
            <input
              id="upload-file"
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              required
              className={cn(fieldClasses, "py-2 file:me-3 file:rounded-sm file:border-0 file:bg-sunken file:px-3 file:py-1 file:text-xs file:text-ink")}
            />
          </Field>
          <Field id="upload-alt" label={t("media.upload.alt")}>
            <Input id="upload-alt" name="alt" required maxLength={200} placeholder={t("media.upload.altPlaceholder")} />
          </Field>
          <Button type="submit" variant="primary" icon="upload" loading={upload.pending} loadingText={t("common.uploading")}>
            {t("common.upload")}
          </Button>
        </form>
        <p className="mt-3 text-xs leading-relaxed text-ink-3">{t("media.upload.altHint")}</p>
      </Card>

      {items.length > 0 ? (
        <div role="search" className="mb-4 grid gap-3 rounded-md border border-line bg-surface p-3 shadow-card sm:grid-cols-[2fr_1fr_1fr] sm:p-4">
          <div className="min-w-0">
            <label htmlFor="media-search" className="mb-1.5 block text-xs font-medium text-ink-2">
              {t("media.filters.search")}
            </label>
            <SearchInput
              id="media-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("media.filters.searchPlaceholder")}
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="media-type" className="mb-1.5 block text-xs font-medium text-ink-2">
              {t("media.filters.type")}
            </label>
            <Select id="media-type" value={type} onChange={(e) => setType(e.target.value)} placeholder={t("media.filters.allTypes")} options={TYPES} />
          </div>
          <div className="min-w-0">
            <label htmlFor="media-usage" className="mb-1.5 block text-xs font-medium text-ink-2">
              {t("media.filters.usage")}
            </label>
            <Select
              id="media-usage"
              value={usage}
              onChange={(e) => setUsage(e.target.value)}
              placeholder={t("media.filters.everywhere")}
              options={[
                { value: "used", label: t("media.filters.used") },
                { value: "unused", label: t("media.filters.unused") },
              ]}
            />
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState icon="image" title={t("media.empty.title")} body={t("media.empty.body")} />
      ) : visible.length === 0 ? (
        <EmptyState icon="search" title={t("media.empty.noMatch")} body={t("media.empty.noMatchBody")} />
      ) : (
        <>
          {filtering ? (
            <p className="mb-2 text-xs text-ink-3" aria-live="polite">
              {t("common.showing", { shown: visible.length, total: items.length })} · {plural("media.count", items.length)}
            </p>
          ) : null}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5">
            {visible.map((item) => {
              const name = item.alt || item.filename || `#${item.id}`;
              return (
                <li key={item.id} className="flex min-w-0 flex-col overflow-hidden rounded-md border border-line bg-surface shadow-card">
                  <button
                    type="button"
                    onClick={() => setDetailId(item.id)}
                    className="group relative block aspect-square w-full bg-sunken"
                    aria-label={t("media.card.details", { name })}
                  >
                    <Image
                      src={item.thumbnailUrl ?? item.url}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 50vw, 20vw"
                      className="object-cover transition-opacity duration-150 group-hover:opacity-90"
                    />
                  </button>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    {item.alt ? (
                      <p className="line-clamp-2 text-xs font-medium text-ink" title={item.alt}>
                        {item.alt}
                      </p>
                    ) : (
                      <p className="flex items-center gap-1 text-xs font-medium text-warning">
                        <Icon name="alert" className="h-3.5 w-3.5" />
                        {t("media.card.noAlt")}
                      </p>
                    )}
                    <p className="truncate text-[11px] text-ink-3" dir="ltr">
                      {[item.width && item.height ? `${item.width}×${item.height}` : "", readableSize(item.filesize), typeLabel(item.mimeType)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className={cn("mt-auto truncate pt-1 text-[11px]", item.usedBy.length ? "text-ink-2" : "text-ink-3")}>
                      {item.usedBy.length ? t("media.card.usedBy", { names: item.usedBy.join(", ") }) : t("media.card.notUsed")}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Dialog open={detail !== null} onClose={() => setDetailId(null)} title={t("media.detail.title")} size="lg" variant="sheet">
        {detail ? (
          <MediaDetails
            key={detail.id}
            item={detail}
            canDelete={canDelete}
            onDeleted={() => {
              setDetailId(null);
              router.refresh();
            }}
          />
        ) : null}
      </Dialog>
    </>
  );
}
