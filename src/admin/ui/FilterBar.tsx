import type { ReactNode } from "react";
import { getAdminI18n } from "@admin/i18n/server";
import { Button, ButtonLink } from "./Button";
import { SearchInput, Select, type SelectOption } from "./Field";

/**
 * A list's search and filters, as a plain GET form.
 *
 * It works before JavaScript loads, the URL can be bookmarked, and the back
 * button undoes a filter. Filtering itself happens on the server, never by
 * shipping every row to the browser.
 *
 * Search sits on its own row with the buttons; the filters wrap in a grid
 * beneath, so a list with five filters never pushes the page sideways.
 */
export async function FilterBar({
  action,
  active,
  searchValue,
  searchPlaceholder,
  children,
}: {
  action: string;
  active: boolean;
  searchValue: string;
  searchPlaceholder: string;
  children?: ReactNode;
}) {
  const { t } = await getAdminI18n();

  return (
    <form action={action} role="search" className="mb-4 rounded-md border border-line bg-surface p-3 shadow-card sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="filter-q" className="mb-1.5 block text-xs font-medium text-ink-2">
            {t("common.search")}
          </label>
          <SearchInput id="filter-q" name="q" defaultValue={searchValue} placeholder={searchPlaceholder} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" icon="filter" className="max-sm:flex-1">
            {t("common.applyFilters")}
          </Button>
          {active ? (
            <ButtonLink href={action} variant="ghost" className="max-sm:flex-1">
              {t("common.clearFilters")}
            </ButtonLink>
          ) : null}
        </div>
      </div>
      {children ? <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div> : null}
    </form>
  );
}

export function FilterSelect({
  id,
  label,
  value,
  options,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly SelectOption[];
  /** Omit for a select that always has a value, like "Sort by". */
  placeholder?: string;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-ink-2">
        {label}
      </label>
      <Select id={id} name={id} defaultValue={value} options={options} placeholder={placeholder} />
    </div>
  );
}
