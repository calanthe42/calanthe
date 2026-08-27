import { Eyebrow } from "@/components/ui/Eyebrow";
import { Logotype } from "@/components/ui/Logotype";

export default function HomePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
      <Logotype className="text-3xl" />
      <Eyebrow>Flower Atelier — UAE</Eyebrow>
      <p className="max-w-md font-display text-2xl font-light italic text-olive">
        Coming into bloom.
      </p>
    </main>
  );
}
