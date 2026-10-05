import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { DiscountForm } from "@admin/components/DiscountForm";
import { getAdminI18n } from "@admin/i18n/server";
import { blankDiscountValues, duplicateDiscountValues } from "@admin/lib/discount-view";
import { ButtonLink } from "@admin/ui/Button";
import { PageHeader } from "@admin/ui/PageHeader";
import { EmptyState, Notice } from "@admin/ui/States";
import { getAdminSession } from "@backend/data/admin-session";
import { getDiscountFormOptions } from "@backend/data/discount-form";
import type { Discount } from "@/payload-types";

/**
 * A new discount: a sale (`?kind=automatic`) or a code (`?kind=code`).
 *
 * The kind is chosen before the form opens (CreateDiscountButton) and cannot
 * be changed afterwards, so it is in the address, not in a dropdown.
 *
 * `?from=<id>` starts from a copy of an existing discount — last year's Eid
 * offer, this year. The copy keeps the terms and drops what made the
 * original a particular event: no dates, no code, and a DRAFT whatever the
 * original was (admin/lib/discount-view.ts `duplicateDiscountValues`).
 *
 * EVERY NEW DISCOUNT OPENS AS A DRAFT. The Active switch is off; turning it
 * on and saving shows what would change and asks first.
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("discounts.create") };
}

const TITLE_MAX = 80;

export default async function NewDiscountPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; from?: string }>;
}) {
  const { kind: kindParam, from } = await searchParams;
  const [{ t }, session] = await Promise.all([getAdminI18n(), getAdminSession()]);

  if (!session?.isAdmin) {
    return (
      <>
        <PageHeader
          title={t("discounts.create")}
          breadcrumbs={[
            { label: t("nav.sections.marketing") },
            { label: t("discounts.title") },
            { label: t("discounts.create") },
          ]}
        />
        <EmptyState
          icon="tag"
          title={t("discounts.ownerOnlyTitle")}
          body={t("discounts.ownerOnlyBody")}
          action={<ButtonLink href="/admin">{t("discounts.back")}</ButtonLink>}
        />
      </>
    );
  }

  /* The discount being copied, read as the owner. A bad or stale id is not
     an error: she simply gets an empty form. */
  let source: Discount | null = null;
  const fromId = Number(from);
  if (from && Number.isInteger(fromId) && fromId > 0) {
    const payload = await getPayload({ config });
    const { user } = await payload.auth({ headers: await nextHeaders() });
    source = await payload
      .findByID({ collection: "discounts", id: fromId, depth: 0, user, overrideAccess: false })
      .catch(() => null);
  }

  const kind = source ? source.kind : kindParam === "code" ? "code" : "automatic";
  const title = kind === "code" ? t("discounts.new.titleCode") : t("discounts.new.titleAutomatic");
  const values = source
    ? duplicateDiscountValues(
        source,
        /* A code that was never given a name of its own is called by its
           code; the copy will be called by ITS code, once she has typed one. */
        source.kind === "code" && source.title === source.code
          ? ""
          : t("discounts.new.copyTitle", { name: source.title }).slice(0, TITLE_MAX),
      )
    : blankDiscountValues(kind);

  const options = await getDiscountFormOptions();

  return (
    <>
      <PageHeader
        title={title}
        breadcrumbs={[
          { label: t("nav.sections.marketing") },
          { label: t("discounts.title"), href: "/admin/discounts" },
          { label: title },
        ]}
      />
      {source ? <Notice>{t("discounts.new.duplicated", { name: source.title })}</Notice> : null}
      {/* Keyed, so opening "duplicate" for another discount starts a fresh
          form rather than keeping what the last one typed. */}
      <DiscountForm key={source ? `from-${source.id}` : kind} values={values} options={options} />
    </>
  );
}
