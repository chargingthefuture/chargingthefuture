import { HeroSection } from "@/components/hero-section"
import { FeaturesSection } from "@/components/features-section"
import { ServicesSection } from "@/components/services-section"
import { MomentumSection } from "@/components/momentum-section"
import { HowItWorksSection } from "@/components/how-it-works-section"
import { WaitlistCTA } from "@/components/waitlist-cta"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-foreground focus:text-background font-[var(--font-bangers)] text-lg"
      >
        Skip to main content
      </a>
      <main id="main-content" className="min-h-screen bg-background">
        <HeroSection />
        <FeaturesSection />
        <ServicesSection />
        <MomentumSection />
        <HowItWorksSection />
        <WaitlistCTA />
        <Footer />
      </main>
    </>
  )
}
