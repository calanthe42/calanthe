import { BestSellers } from "@/components/blocks/BestSellers";
import { BuildYourOwnBanner } from "@/components/blocks/BuildYourOwnBanner";
import { CalantheTouch } from "@/components/blocks/CalantheTouch";
import { Hero } from "@/components/blocks/Hero";
import { InstagramMarquee } from "@/components/blocks/InstagramMarquee";
import { NewArrivals } from "@/components/blocks/NewArrivals";
import { ShopByOccasion } from "@/components/blocks/ShopByOccasion";
import { WeeklyRitual } from "@/components/blocks/WeeklyRitual";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <NewArrivals />
      <ShopByOccasion />
      <BuildYourOwnBanner />
      <BestSellers />
      <CalantheTouch />
      <WeeklyRitual />
      <InstagramMarquee />
    </main>
  );
}
