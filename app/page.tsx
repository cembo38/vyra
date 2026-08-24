import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Hero } from "@/components/marketing/Hero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { EventTicker } from "@/components/marketing/EventTicker";
import { EventTypesGrid } from "@/components/marketing/EventTypesGrid";
import { TrustSection } from "@/components/marketing/TrustSection";
import { SwipeTeaser } from "@/components/marketing/SwipeTeaser";
import { Footer } from "@/components/marketing/Footer";

export default function LandingPage() {
  return (
    <>
      <MarketingHeader />
      <main>
        <Hero />
        <HowItWorks />
        <EventTicker />
        <TrustSection />
        <EventTypesGrid />
        <SwipeTeaser />
      </main>
      <Footer />
    </>
  );
}
