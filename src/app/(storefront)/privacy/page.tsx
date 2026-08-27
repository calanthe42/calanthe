import type { Metadata } from "next";
import { LegalPage } from "@/components/blocks/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy", robots: { index: false } };

const sections = [
  {
    heading: "What we collect",
    body: "Placeholder copy - the client's approved wording for this section will be placed here before launch.",
  },
  {
    heading: "How we use it",
    body: "Placeholder copy - the client's approved wording for this section will be placed here before launch.",
  },
  {
    heading: "Sharing",
    body: "Placeholder copy - the client's approved wording for this section will be placed here before launch.",
  },
  {
    heading: "Storage and security",
    body: "Placeholder copy - the client's approved wording for this section will be placed here before launch.",
  },
  {
    heading: "Your rights",
    body: "Placeholder copy - the client's approved wording for this section will be placed here before launch.",
  },
  {
    heading: "Cookies",
    body: "Placeholder copy - the client's approved wording for this section will be placed here before launch.",
  },
  {
    heading: "Contact",
    body: "Placeholder copy - the client's approved wording for this section will be placed here before launch.",
  },
] as const;

export default function Page() {
  return <LegalPage title="Privacy Policy" sections={sections} />;
}
