import type { Metadata } from "next";
import { LegalPage } from "@/components/blocks/LegalPage";
import { refundsEn, refundsAr } from "@/content/legal/refunds";
import { getDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return {
    robots: { index: false },
    title: t.meta.refunds,
  };
}

/* The client's approved text (2026-10-03), in the reader's language.
   The wording lives in src/content/legal/refunds.ts. */
export default async function Page() {
  const { locale } = await getDictionary();
  return <LegalPage source={locale === "ar" ? refundsAr : refundsEn} />;
}
