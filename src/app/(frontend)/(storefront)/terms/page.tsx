import type { Metadata } from "next";
import { LegalPage } from "@/components/blocks/LegalPage";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  robots: { index: false },
};

const sections = [
  {
    heading: "Orders and acceptance",
    body: "Placeholder copy - the client's approved wording for this section will be placed here before launch.",
  },
  {
    heading: "Prices and payment",
    body: "Placeholder copy - the client's approved wording for this section will be placed here before launch.",
  },
  {
    heading: "Delivery",
    body: "Placeholder copy - the client's approved wording for this section will be placed here before launch.",
  },
  {
    heading: "Substitutions",
    body: "Placeholder copy - the client's approved wording for this section will be placed here before launch.",
  },
  {
    heading: "Cancellations",
    body: "Placeholder copy - the client's approved wording for this section will be placed here before launch.",
  },
  {
    heading: "Liability",
    body: "Placeholder copy - the client's approved wording for this section will be placed here before launch.",
  },
  {
    heading: "Contact",
    body: "Placeholder copy - the client's approved wording for this section will be placed here before launch.",
  },
] as const;

export default function Page() {
  return <LegalPage title="Terms & Conditions" sections={sections} />;
}
