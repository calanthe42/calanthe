import { Eyebrow } from "@/components/ui/Eyebrow";
import { MonogramBloom } from "@/components/motion/MonogramBloom";

type StubPageProps = {
  eyebrow: string;
  title: string;
  note?: string;
};

/** Placeholder route body until the real page is designed. */
export function StubPage({ eyebrow, title, note }: StubPageProps) {
  return (
    <main className="flex min-h-[70svh] flex-col items-center justify-center gap-5 px-6 py-24 text-center">
      <MonogramBloom className="w-14 text-sage" />
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="max-w-xl font-display text-4xl font-light text-olive lg:text-5xl">
        {title}
      </h1>
      <p className="max-w-md text-base text-sage">
        {note ?? "This page is being arranged. Please visit again soon."}
      </p>
    </main>
  );
}
