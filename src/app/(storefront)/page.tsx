import { BestSellers } from "@/components/blocks/BestSellers";
import { CalantheTouch } from "@/components/blocks/CalantheTouch";
import { Hero } from "@/components/blocks/Hero";
import { InstagramMarquee } from "@/components/blocks/InstagramMarquee";
import {
  LazyBuildYourOwnBanner,
  LazyWeeklyRitual,
} from "@/components/blocks/LazyHomeSections";
import { NewArrivals } from "@/components/blocks/NewArrivals";
import { ShopByOccasion } from "@/components/blocks/ShopByOccasion";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <NewArrivals />
      <ShopByOccasion />
      <LazyBuildYourOwnBanner />
      <BestSellers />
      <CalantheTouch />
      <LazyWeeklyRitual />
      <InstagramMarquee />
    </main>
  );
}
