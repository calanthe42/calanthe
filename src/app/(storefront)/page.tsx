import { BestSellers } from "@/components/blocks/BestSellers";
import { CalantheTouch } from "@/components/blocks/CalantheTouch";
import { Hero } from "@/components/blocks/Hero";
import { InstagramMarquee } from "@/components/blocks/InstagramMarquee";
import {
  LazyBuildYourOwnBanner,
  LazyWeeklyRitual,
} from "@/components/blocks/LazyHomeSections";
import { NewArrivals } from "@/components/blocks/NewArrivals";
import { QuickNavBand } from "@/components/blocks/QuickNavBand";
import { ShopByOccasion } from "@/components/blocks/ShopByOccasion";
import { TrustBand } from "@/components/blocks/TrustBand";
import { VideoApprovalSection } from "@/components/blocks/VideoApprovalSection";

/* Client-locked section order preserved; QuickNav, VideoApproval and
   TrustBand are client-approved ADDITIONS between locked sections. */
export default function HomePage() {
  return (
    <main>
      <Hero />
      <QuickNavBand />
      <NewArrivals />
      <ShopByOccasion />
      <LazyBuildYourOwnBanner />
      <VideoApprovalSection />
      <BestSellers />
      <CalantheTouch />
      <TrustBand />
      <LazyWeeklyRitual />
      <InstagramMarquee />
    </main>
  );
}
