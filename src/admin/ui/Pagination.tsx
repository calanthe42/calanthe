import { getAdminI18n } from "@admin/i18n/server";
import { ButtonLink } from "./Button";

/**
 * Previous / next through a long list.
 *
 * Links, not buttons: the page number lives in the URL alongside the filters,
 * so a page can be bookmarked and the back button behaves.
 */
export async function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  const { t } = await getAdminI18n();

  return (
    <nav aria-label={t("common.pagination")} className="mt-4 flex items-center justify-between gap-3">
      {page > 1 ? (
        <ButtonLink href={hrefFor(page - 1)} icon="chevronLeft" size="sm">
          {t("common.previous")}
        </ButtonLink>
      ) : (
        <span />
      )}
      <p className="text-sm text-ink-3 tabular">{t("common.pageOf", { page, pages: totalPages })}</p>
      {page < totalPages ? (
        <ButtonLink href={hrefFor(page + 1)} iconEnd="chevronRight" size="sm">
          {t("common.next")}
        </ButtonLink>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** Reads `?page=` safely: anything that is not a positive whole number is page 1. */
export function parsePage(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

/** Builds a list URL, dropping empty parameters so links stay readable. */
export function listHref(path: string, params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || (key === "page" && Number(value) <= 1)) continue;
    query.set(key, String(value));
  }
  const s = query.toString();
  return s ? `${path}?${s}` : path;
}
