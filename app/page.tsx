import { Header } from "@/components/header"
import { HeroSection } from "@/components/hero-section"
import { PlatformSection } from "@/components/platform-section"
import { LifecycleSection } from "@/components/lifecycle-section"
import { SuccessStories } from "@/components/success-stories"
import { ComplianceSection } from "@/components/compliance-section"
import { FAQSection } from "@/components/faq-section"
import { ContactSection } from "@/components/contact-section"
import { FinalCTA } from "@/components/final-cta"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <main className="min-h-screen">
      <Header />
      <HeroSection />
      <PlatformSection />
      <LifecycleSection />
      <SuccessStories />
      <ComplianceSection />
      <FAQSection />
      <ContactSection />
      <FinalCTA />
      <Footer />
    </main>
  )
}
