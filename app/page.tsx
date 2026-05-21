import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ScrollProgress } from "@/components/scroll-progress"
import { HeroSection } from "@/components/hero-section"
import { WorkflowSection } from "@/components/workflow-section"
import { CopilotSection } from "@/components/copilot-section"
import { MemorySection } from "@/components/memory-section"
import { OrchestrationSection } from "@/components/orchestration-section"
import { TrustSection } from "@/components/trust-section"
import { ComparisonSection } from "@/components/comparison-section"
import { FAQSection } from "@/components/faq-section"
import { FinalCTA } from "@/components/final-cta"

export default function HomePage() {
  return (
    <>
      <ScrollProgress />
      <Header />
      <main className="relative">
        <HeroSection />
        <SectionDivider />
        <WorkflowSection />
        <SectionDivider />
        <CopilotSection />
        <SectionDivider />
        <MemorySection />
        <SectionDivider />
        <OrchestrationSection />
        <SectionDivider />
        <TrustSection />
        <SectionDivider />
        <ComparisonSection />
        <SectionDivider />
        <FAQSection />
        <SectionDivider />
        <FinalCTA />
      </main>
      <Footer />
    </>
  )
}

function SectionDivider() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-hidden>
      <div className="hairline" />
    </div>
  )
}
