import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { HeroSection } from "@/components/hero-section"
import { NewStandardSection } from "@/components/new-standard-section"
import { LifecycleSection } from "@/components/lifecycle-section"
import { SuccessStories } from "@/components/success-stories"
import { ComplianceSection } from "@/components/compliance-section"
import { FinalCTA } from "@/components/final-cta"
import { FAQSection } from "@/components/faq-section"
import { ContactSection } from "@/components/contact-section"

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <NewStandardSection />
        <LifecycleSection />
        <SuccessStories />
        <ComplianceSection />
        <FinalCTA />
        <FAQSection />
        <ContactSection />
      </main>
      <Footer />
    </>
  )
}
