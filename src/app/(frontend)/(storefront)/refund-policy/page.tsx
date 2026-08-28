import type { Metadata } from "next";
import { LegalPage } from "@/components/blocks/LegalPage";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  robots: { index: false },
};

const sections = [
  {
    heading: "Cancelling an order",
    body: "Placeholder copy - the client's approved wording for this section will be placed here before launch.",
  },
  {
    heading: "Changes to an order",
    body: "Placeholder copy - the client's approved wording for this section will be placed here before launch.",
  },
  {
    heading: "Quality concerns",
    body: "Placeholder copy - the client's approved wording for this section will be placed here before launch.",
  },
  {
    heading: "Refund method and timing",
    body: "Placeholder copy - the client's approved wording for this section will be placed here before launch.",
  },
  {
    heading: "Perishable goods",
    body: "Placeholder copy - the client's approved wording for this section will be placed here before launch.",
  },
  {
    heading: "Contact",
    body: "Placeholder copy - the client's approved wording for this section will be placed here before launch.",
  },
] as const;

export default function Page() {
  return <LegalPage title="Refund & Cancellation Policy" sections={sections} />;
}
