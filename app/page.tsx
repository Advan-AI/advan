import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { HeroSection } from "@/components/hero-section"
import { WorkflowSection } from "@/components/workflow-section"
import { CopilotSection } from "@/components/copilot-section"
import { MemorySection } from "@/components/memory-section"
import { OrchestrationSection } from "@/components/orchestration-section"
import { TrustSection } from "@/components/trust-section"
import { ComparisonSection } from "@/components/comparison-section"
import { TestimonialsSection } from "@/components/testimonials-section"
import { PricingSection } from "@/components/pricing-section"
import { FAQSection } from "@/components/faq-section"
import { FinalCTA } from "@/components/final-cta"
import { ContactSection } from "@/components/contact-section"

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="relative">
        <HeroSection />
        <WorkflowSection />
        <CopilotSection />
        <MemorySection />
        <OrchestrationSection />
        <TrustSection />
        <ComparisonSection />
        <TestimonialsSection />
        <PricingSection />
        <FAQSection />
        <FinalCTA />
        <ContactSection />
      </main>
      <Footer />
    </>
  )
}
