import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Hero } from "@/components/marketing/Hero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { EventTypesGrid } from "@/components/marketing/EventTypesGrid";
import { TrustSection } from "@/components/marketing/TrustSection";
import { Footer } from "@/components/marketing/Footer";

export default function LandingPage() {
  return (
    <>
      <MarketingHeader />
      <main>
        <Hero />
        <HowItWorks />
        <TrustSection />
        <EventTypesGrid />
      </main>
      <Footer />
    </>
  );
}
