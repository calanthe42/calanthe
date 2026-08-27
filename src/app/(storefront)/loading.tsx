import { Monogram } from "@/components/ui/Monogram";

export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-20">
      <div className="flex flex-col items-center gap-8 py-8">
        <Monogram className="monogram-pulse w-12 text-sage" />
      </div>
      {/* Cream skeletons */}
      <div className="mt-4 flex flex-col gap-8">
        <div className="h-8 w-2/3 max-w-md animate-pulse rounded-sm bg-cream" />
        <div className="h-4 w-1/2 max-w-sm animate-pulse rounded-sm bg-cream" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col gap-3">
              <div className="aspect-[4/5] animate-pulse rounded-sm bg-cream" />
              <div className="h-4 w-3/4 animate-pulse rounded-sm bg-cream" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
