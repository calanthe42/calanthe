import Link from "next/link";
import { cn } from "@/lib/cn";
import { per100Number, signedMoney } from "@admin/components/costs/cost-view";
import { getAdminI18n } from "@admin/i18n/server";
import { intlLocale, type Translator } from "@admin/i18n/translate";
import { ButtonLink } from "@admin/ui/Button";
import { Card, CardHeader } from "@admin/ui/Card";
import { PageHeader } from "@admin/ui/PageHeader";
import { EmptyState } from "@admin/ui/States";
import { getAdminSession } from "@backend/data/admin-session";
import { getMoneyMonth, type MoneyMonth } from "@backend/data/money";
import { per100 } from "@backend/domain/costs";
import { uaeMidnight } from "@backend/domain/dates";
import { monthOf, shiftMonth, type MonthKey } from "@backend/domain/money";

/**
 * Money — the home of Costs, and the answer to "am I making money this
 * month?" in one sentence: what customers paid and what she kept.
 *
 * OWNER ONLY. The loader refuses anyone else on the server; a florist who
 * types the address gets a plain sentence instead.
 *
 * WHAT IT NEVER DOES. It never shows "kept" without an invoice to take it
 * from (that would be "kept = paid"), never shows a share of AED 100
 * without the dirhams before it, and always says that what she kept is
 * before her time, rent and other bills. It says how many invoices it rests
 * on, because a missing invoice makes "kept" look better than it is.
 *
 * Arithmetic: backend/domain/money.ts. This page only words it.
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("costs.money.title") };
}

/** "October so far: customers paid AED 18,400 and you kept AED 11,015." */
function headline(m: MoneyMonth, month: string, i18n: Translator): string {
  const { t, money } = i18n;
  const paid = money(m.paidFils);
  if (m.keptFils === null) {
    if (!m.soFar) return t("costs.money.noInvoicesMonth", { paid, month });
    return m.anyInvoice ? t("costs.money.noInvoicesYet", { paid }) : t("costs.money.firstInvoice", { paid });
  }
  if (m.keptFils < 0) {
    const over = money(-m.keptFils);
    return m.soFar
      ? t("costs.money.overSoFar", { month, paid, over })
      : t("costs.money.overMonth", { month, paid, over });
  }
  const kept = money(m.keptFils);
  return m.soFar ? t("costs.money.keptSoFar", { month, paid, kept }) : t("costs.money.keptMonth", { month, paid, kept });
}

/**
 * "You kept AED 1,200 more than this time in September." What she kept when
 * both months have invoices, otherwise what customers paid. Nothing at all
 * when the month before took nothing: "more than nothing" compares nothing.
 */
function comparison(m: MoneyMonth, previousMonth: string, i18n: Translator): string | null {
  const { t, money } = i18n;
  if (m.previous.paidFils <= 0) return null;
  const than = m.previous.soFar
    ? t("costs.money.thanSoFar", { month: previousMonth })
    : t("costs.money.thanMonth", { month: previousMonth });
  if (m.keptFils !== null && m.previous.keptFils !== null) {
    const difference = m.keptFils - m.previous.keptFils;
    const amount = money(Math.abs(difference));
    if (difference > 0) return t("costs.money.keptMore", { amount, than });
    if (difference < 0) return t("costs.money.keptLess", { amount, than });
    return t("costs.money.keptSame", { than });
  }
  const difference = m.paidFils - m.previous.paidFils;
  const amount = money(Math.abs(difference));
  if (difference > 0) return t("costs.money.paidMore", { amount, than });
  if (difference < 0) return t("costs.money.paidLess", { amount, than });
  return t("costs.money.paidSame", { than });
}

type Bar = { key: string; label: string; hint?: string; fils: number; kept?: boolean };

/**
 * Where the money went, as bars of what customers paid: spending biggest
 * first, and what she kept always last, where the eye ends. Each bar says
 * its dirhams first and its share of every AED 100 after.
 */
function WhereTheMoneyWent({ m, i18n }: { m: MoneyMonth; i18n: Translator }) {
  const { t, plural, money, number } = i18n;
  const spending: Bar[] = [
    { key: "flowers", label: t("costs.money.flowers"), fils: m.flowersFils },
    { key: "packaging", label: t("costs.money.packaging"), fils: m.packagingFils },
    { key: "cardFees", label: t("costs.money.cardFees"), hint: t("costs.money.cardFeesHint"), fils: m.cardFeesFils },
  ].sort((a, b) => b.fils - a.fils);
  const bars: Bar[] = [
    ...spending,
    { key: "kept", label: t("costs.money.kept"), hint: t("costs.money.beforeBills"), fils: m.keptFils ?? 0, kept: true },
  ];

  return (
    <Card as="section">
      <CardHeader id="money-where" title={t("costs.money.where")} description={t("costs.money.whereHint")} />
      <ul aria-labelledby="money-where" className="mt-2 divide-y divide-line">
        {bars.map((bar) => {
          /* A month that spent more than it took has no share to show: "AED 0
             of every AED 100" would hide a loss behind a zero. */
          const share = bar.fils < 0 ? null : per100(bar.fils, m.paidFils);
          return (
            <li key={bar.key} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className={cn("text-sm text-ink", bar.kept && "font-semibold")}>{bar.label}</span>
                <span className="flex flex-wrap items-baseline justify-end gap-x-3">
                  <span
                    className={cn("text-sm font-medium tabular", bar.kept && bar.fils < 0 ? "text-danger" : "text-ink")}
                  >
                    {signedMoney(money, bar.fils)}
                  </span>
                  {share !== null ? (
                    <span className="text-xs text-ink-3 tabular">
                      {t("costs.money.per100", { amount: per100Number(number, share) })}
                    </span>
                  ) : null}
                </span>
              </div>
              {share !== null ? (
                <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken">
                  <div
                    className={cn("h-full rounded-full", bar.kept ? "bg-success" : "bg-ink-3")}
                    style={{ width: `${Math.min(100, share)}%` }}
                  />
                </div>
              ) : null}
              {bar.hint ? <p className="mt-1.5 text-xs leading-relaxed text-ink-3">{bar.hint}</p> : null}
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-ink-2">{plural("costs.money.basedOn", m.invoiceCount)}</p>
        <ButtonLink href="/admin/costs/invoices/new" icon="plus" className="max-sm:w-full">
          {t("costs.money.addInvoice")}
        </ButtonLink>
      </div>
    </Card>
  );
}

export default async function MoneyPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: which } = await searchParams;
  const [i18n, session] = await Promise.all([getAdminI18n(), getAdminSession()]);
  const { t, plural, money } = i18n;
  const breadcrumbs = [{ label: t("nav.sections.costs") }, { label: t("costs.money.title") }];

  const ownerOnly = (
    <>
      <PageHeader title={t("costs.money.title")} breadcrumbs={breadcrumbs} />
      <EmptyState
        icon="lock"
        title={t("costs.ownerOnlyTitle")}
        body={t("costs.ownerOnlyBody")}
        action={<ButtonLink href="/admin">{t("costs.back")}</ButtonLink>}
      />
    </>
  );
  if (!session?.isAdmin) return ownerOnly;

  const now = new Date();
  const last = which === "last";
  const month: MonthKey = last ? shiftMonth(monthOf(now), -1) : monthOf(now);
  const data = await getMoneyMonth(month, now);
  if (!data) return ownerOnly;

  /* "October", in her language. The 15th, so no time zone can move it into
     the month either side. */
  const monthFormat = new Intl.DateTimeFormat(intlLocale(i18n.locale), { month: "long", timeZone: "Asia/Dubai" });
  const monthName = (key: MonthKey) => monthFormat.format(uaeMidnight(`${key}-15`));
  const compared = comparison(data, monthName(data.previous.month), i18n);

  const addInvoice = (
    <ButtonLink href="/admin/costs/invoices/new" variant="primary" icon="plus">
      {t("costs.money.addInvoice")}
    </ButtonLink>
  );

  return (
    <>
      <PageHeader
        title={t("costs.money.title")}
        breadcrumbs={breadcrumbs}
        description={t("costs.money.description")}
        actions={addInvoice}
      />

      <nav aria-label={t("costs.money.monthSwitch")} className="mb-4">
        <ul className="inline-flex max-w-full gap-1 rounded-md border border-line bg-surface p-1 shadow-card">
          {[
            { href: "/admin/costs", label: t("costs.money.thisMonth"), active: !last },
            { href: "/admin/costs?month=last", label: t("costs.money.lastMonth"), active: last },
          ].map((tab) => (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={tab.active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center whitespace-nowrap rounded-sm px-4 text-sm font-medium transition-colors duration-150 lg:min-h-9",
                  tab.active ? "bg-ink text-page" : "text-ink-2 hover:bg-hover hover:text-ink",
                )}
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        <Card as="section">
          <h2 className="max-w-2xl font-display text-2xl font-light leading-snug text-ink sm:text-[1.75rem]">
            {headline(data, monthName(data.month), i18n)}
          </h2>
          <p className="mt-2 text-sm text-ink-3">{plural("costs.money.orders", data.orders)}</p>
          {compared ? <p className="mt-1 text-sm text-ink-2">{compared}</p> : null}

          {data.keptFils !== null ? (
            <div className="mt-5 border-t border-line pt-5">
              <p className="text-sm font-medium text-ink-2">{t("costs.money.kept")}</p>
              <p
                className={cn(
                  "mt-1 text-[2rem] font-semibold leading-tight tracking-tight tabular",
                  data.keptFils < 0 ? "text-danger" : "text-ink",
                )}
              >
                {signedMoney(money, data.keptFils)}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-3">{t("costs.money.beforeBills")}</p>
            </div>
          ) : (
            <div className="mt-5 border-t border-line pt-5">{addInvoice}</div>
          )}

          {data.partlyRefunded > 0 ? (
            <p className="mt-4 text-xs leading-relaxed text-ink-3">
              {plural("costs.money.partlyRefunded", data.partlyRefunded)}
            </p>
          ) : null}
        </Card>

        {data.keptFils !== null ? <WhereTheMoneyWent m={data} i18n={i18n} /> : null}
      </div>
    </>
  );
}
