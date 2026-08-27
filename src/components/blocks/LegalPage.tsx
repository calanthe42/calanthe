import { Reveal } from "@/components/motion/Reveal";
import { Eyebrow } from "@/components/ui/Eyebrow";

type LegalPageProps = {
  title: string;
  sections: readonly { heading: string; body: string }[];
};

/** Structured legal page — headings now, the client's counsel-approved
 *  copy replaces the body placeholders later. */
export function LegalPage({ title, sections }: LegalPageProps) {
  return (
    <main className="mx-auto max-w-3xl gutter section-pad">
      <Reveal className="mb-10">
        <Eyebrow>Legal</Eyebrow>
        <h1 className="display-2 mt-3 font-display font-light text-olive">{title}</h1>
        <p className="mt-3 text-xs text-sage">
          Placeholder structure — final wording arrives with the client&apos;s legal copy.
        </p>
      </Reveal>
      <div className="flex flex-col gap-8">
        {sections.map((s) => (
          <section key={s.heading}>
            <h2 className="mb-2 font-brand text-xs font-medium uppercase tracking-brand text-olive">
              {s.heading}
            </h2>
            <p className="max-w-prose text-base leading-relaxed text-sage">{s.body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
