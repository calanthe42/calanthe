import { Hero } from "@/components/blocks/Hero";
import { NewArrivals } from "@/components/blocks/NewArrivals";
import { ShopByOccasion } from "@/components/blocks/ShopByOccasion";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <NewArrivals />
      <ShopByOccasion />
    </main>
  );
}
