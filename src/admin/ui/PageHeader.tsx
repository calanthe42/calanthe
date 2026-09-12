import Link from "next/link";
import type { ReactNode } from "react";
import { getAdminI18n } from "@admin/i18n/server";
import { Icon } from "./icons";

/**
 * The top of every screen: where you are, what this is, what you can do.
 *
 * A Server Component that reads the translator itself, so breadcrumbs and
 * their landmark label are always in the page's language. Never import it
 * from a Client Component.
 */

export type Crumb = { label: string; href?: string };

export async function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  const { t } = await getAdminI18n();
  return (
    <nav aria-label={t("common.breadcrumb")}>
      <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-3">
        {items.map((crumb, i) => (
          <li key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1">
            {i > 0 ? <Icon name="chevronRight" className="h-3.5 w-3.5 text-ink-3/70" /> : null}
            {crumb.href ? (
              /* -my/py: a 44px-tall target that takes no extra room in the row. */
              <Link href={crumb.href} className="-my-3 truncate py-3 hover:text-ink hover:underline">
                {crumb.label}
              </Link>
            ) : (
              <span aria-current={i === items.length - 1 ? "page" : undefined} className="truncate">
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export async function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  badge,
}: {
  title: string;
  description?: ReactNode;
  breadcrumbs?: readonly Crumb[];
  actions?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <header className="mb-6 lg:mb-8">
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <div className="mb-2">
          <Breadcrumbs items={breadcrumbs} />
        </div>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="min-w-0 break-words font-display text-[1.875rem] font-light leading-tight text-ink sm:text-4xl">
              {title}
            </h1>
            {badge}
          </div>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-3">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
      </div>
    </header>
  );
}
