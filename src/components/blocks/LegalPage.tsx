import { Fragment } from "react";
import { getDictionary } from "@/lib/i18n/server";
import { Reveal } from "@/components/motion/Reveal";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { parseLegal } from "@/content/legal/parse";

/** `**bold**` and `*italic*`, with single newlines kept as line breaks. */
function Inline({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {li > 0 && <br />}
          {line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) =>
            part.startsWith("**") && part.endsWith("**") ? (
              <strong key={i} className="font-medium text-olive">
                {part.slice(2, -2)}
              </strong>
            ) : part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
              <em key={i}>{part.slice(1, -1)}</em>
            ) : (
              <Fragment key={i}>{part}</Fragment>
            ),
          )}
        </Fragment>
      ))}
    </>
  );
}

export async function LegalPage({ source }: { source: string }) {
  const { t } = await getDictionary();
  const doc = parseLegal(source);

  return (
    <main className="mx-auto max-w-3xl gutter section-pad">
      <Reveal className="mb-10">
        <Eyebrow>{t.errors.legal}</Eyebrow>
        <h1 className="display-2 mt-3 font-display font-light text-olive">{doc.title}</h1>
      </Reveal>
      {doc.intro.length > 0 && (
        <div className="mb-10 flex flex-col gap-4">
          {doc.intro.map((b, i) => (
            <p key={i} className="max-w-prose text-base leading-relaxed text-ink-muted">
              <Inline text={b.text} />
            </p>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-10">
        {doc.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="mb-3 font-display text-2xl font-light text-olive">{s.heading}</h2>
            <div className="flex flex-col gap-3">
              {s.body.map((b, i) => (
                <p key={i} className="max-w-prose text-base leading-relaxed text-ink-muted">
                  <Inline text={b.text} />
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
