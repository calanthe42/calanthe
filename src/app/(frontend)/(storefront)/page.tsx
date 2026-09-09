import { BestSellers } from "@/components/blocks/BestSellers";
import { BotanicalStem } from "@/components/motion/BotanicalStem";
import { JsonLd } from "@/components/blocks/JsonLd";
import { CalantheTouch } from "@/components/blocks/CalantheTouch";
import { Hero } from "@/components/blocks/Hero";
import { InstagramMarquee } from "@/components/blocks/InstagramMarquee";
import {
  LazyBuildYourOwnBanner,
  LazyWeeklyRitual,
} from "@/components/blocks/LazyHomeSections";
import { NewArrivals } from "@/components/blocks/NewArrivals";
import { QuickNavBand } from "@/components/blocks/QuickNavBand";
import { getActiveOccasions } from "@backend/data/occasions";
import { ShopByOccasion } from "@/components/blocks/ShopByOccasion";
import { TrustBand } from "@/components/blocks/TrustBand";
import { VideoApprovalSection } from "@/components/blocks/VideoApprovalSection";
import { floristJsonLd, websiteJsonLd } from "@/lib/seo";

/* Client-locked section order preserved; QuickNav, VideoApproval and
   TrustBand are client-approved ADDITIONS between locked sections. */
export default async function HomePage() {
  const occasions = await getActiveOccasions();

  return (
    <main>
      {/* Real business facts only — no ratings, no reviews, no awards.
          See lib/seo.ts for why those are deliberately absent. */}
      <JsonLd data={floristJsonLd()} />
      <JsonLd data={websiteJsonLd()} />
      {/* The signature: a hairline stem drawing itself down the left
          margin as the page is scrolled. Fixed-position marginalia — it
          adds nothing to the layout and cannot shift it. */}
      <BotanicalStem />
      <Hero />
      <QuickNavBand occasions={occasions} />
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
