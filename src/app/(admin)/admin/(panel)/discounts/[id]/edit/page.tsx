import { notFound } from "next/navigation";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { DiscountForm } from "@admin/components/DiscountForm";
import { getAdminI18n } from "@admin/i18n/server";
import { discountFormValues } from "@admin/lib/discount-view";
import { toneFor } from "@admin/lib/status";
import { Badge } from "@admin/ui/Badge";
import { ButtonLink } from "@admin/ui/Button";
import { FormSection } from "@admin/ui/Content";
import { PageHeader } from "@admin/ui/PageHeader";
import { EmptyState } from "@admin/ui/States";
import { getAdminSession } from "@backend/data/admin-session";
import { getDiscountFormOptions } from "@backend/data/discount-form";
import { getDiscountUsage } from "@backend/data/discount-usage";
import { NO_USAGE } from "@backend/domain/discount-usage";
import { discountStatus } from "@/lib/discounts";

/**
 * One discount, edited.
 *
 * The same form as "new" (DiscountForm), with what it has done so far beside
 * it: how many paid orders used it, what it took off them and what they came
 * to — read from those orders' own snapshots, so editing the discount here
 * changes none of those figures and no past receipt.
 *
 * CHANGING A LIVE DISCOUNT ASKS FIRST. Renaming one saves at once; changing
 * what it does (its value, what it applies to, its dates) while it is live
 * shows the new numbers and waits for her yes, exactly like switching it on.
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("discounts.title") };
}

export default async function EditDiscountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const [i18n, session] = await Promise.all([getAdminI18n(), getAdminSession()]);
  const { t, plural, money, label, number } = i18n;

  if (!session?.isAdmin) {
    return (
      <>
        <PageHeader
          title={t("discounts.title")}
          breadcrumbs={[{ label: t("nav.sections.marketing") }, { label: t("discounts.title") }]}
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

  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });
  const discount = await payload
    .findByID({ collection: "discounts", id: numericId, depth: 0, user, overrideAccess: false })
    .catch(() => null);
  if (!discount) notFound();

  const [options, usageById] = await Promise.all([getDiscountFormOptions(), getDiscountUsage([discount.id])]);
  /* Null when the orders could not be read: the card then says less, never
     a confident zero. */
  const usage = usageById ? (usageById.get(discount.id) ?? NO_USAGE) : null;
  const status = discountStatus(
    { active: discount.active === true, startsAt: discount.startsAt, endsAt: discount.endsAt },
    new Date(),
  );

  const isCode = discount.kind === "code";
  /* A code keeps its own count (written by the payment webhook, and the one
     its limit is measured against); a sale's is counted from paid orders. */
  const used = isCode ? Number(discount.timesUsed ?? 0) : (usage?.orders ?? null);

  const performance = (
    <FormSection id="discount-performance" title={t("discounts.form.sections.performance")}>
      <ul className="grid gap-2 text-sm leading-relaxed text-ink-2">
        <li className="font-medium text-ink">
          {used === null
            ? t("discounts.form.usageUnavailable")
            : isCode && discount.usageLimit
              ? t("discounts.form.usedOf", { used: number(used), limit: number(discount.usageLimit) })
              : used > 0
                ? plural("discounts.form.usedOrders", used)
                : t("discounts.form.neverUsed")}
        </li>
        {usage && usage.orders > 0 ? (
          <>
            <li>{t("discounts.form.discountGiven", { amount: money(usage.discountFils) })}</li>
            <li>{t("discounts.form.salesWith", { amount: money(usage.salesFils) })}</li>
          </>
        ) : null}
      </ul>
      {isCode && discount.code && used !== null && used > 0 ? (
        <div>
          <ButtonLink href={`/admin/orders?q=${encodeURIComponent(discount.code)}`} size="sm" iconEnd="chevronRight">
            {t("discounts.form.viewOrders")}
          </ButtonLink>
        </div>
      ) : null}
    </FormSection>
  );

  return (
    <>
      <PageHeader
        title={discount.title}
        breadcrumbs={[
          { label: t("nav.sections.marketing") },
          { label: t("discounts.title"), href: "/admin/discounts" },
          { label: discount.title },
        ]}
        badge={
          <Badge tone={toneFor("discountStatus", status)} dot={status === "active"}>
            {label("discountStatus", status)}
          </Badge>
        }
        actions={
          <ButtonLink href={`/admin/discounts/new?from=${discount.id}`} icon="plus">
            {t("discounts.duplicate")}
          </ButtonLink>
        }
      />
      <DiscountForm
        key={discount.id}
        values={discountFormValues(discount)}
        options={options}
        performance={performance}
      />
    </>
  );
}
