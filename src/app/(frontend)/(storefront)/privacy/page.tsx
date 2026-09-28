import type { Metadata } from "next";
import { LegalPage } from "@/components/blocks/LegalPage";
import { getDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return {
    robots: { index: false },
    title: t.meta.privacy,
  };
}

/*
 * The section order. The headings and the placeholder body are in the
 * dictionary (`legal.privacy`), in both languages. The bodies are still
 * placeholders: the client's counsel-approved wording has not arrived, and
 * none is invented here. See the note above `legal` in the dictionary.
 */
const ORDER = [
  "collect",
  "use",
  "sharing",
  "storage",
  "rights",
  "cookies",
  "contact",
] as const;

export default async function Page() {
  const { t } = await getDictionary();
  const doc = t.legal.privacy;
  return (
    <LegalPage
      title={doc.title}
      sections={ORDER.map((id) => ({
        heading: doc.headings[id],
        body: t.legal.placeholderBody,
      }))}
    />
  );
}
