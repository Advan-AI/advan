import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ScrollProgress } from "@/components/scroll-progress"
import { HeroSection } from "@/components/hero-section"
import { SocialProofSection } from "@/components/social-proof-section"
import { WorkflowSection } from "@/components/workflow-section"
import { CopilotSection } from "@/components/copilot-section"
import { MemorySection } from "@/components/memory-section"
import { OrchestrationSection } from "@/components/orchestration-section"
import { TrustSection } from "@/components/trust-section"
import { ComparisonSection } from "@/components/comparison-section"
import { FAQSection } from "@/components/faq-section"
import { FinalCTA } from "@/components/final-cta"
import { faqs } from "@/lib/faq-data"

const SITE_URL = "https://advan.ai"

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Advan AI",
      url: SITE_URL,
      logo: `${SITE_URL}/images/advan-logo.svg`,
      sameAs: [
        "https://www.linkedin.com/company/advanai/",
        "https://www.youtube.com/@AdvanAI1",
      ],
      contactPoint: {
        "@type": "ContactPoint",
        email: "hello@advan.ai",
        contactType: "sales",
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: "Advan AI",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Trust infrastructure for AI customer support: source-cited answers, confidence scoring, policy validation, human-in-the-loop approval, and full audit trails.",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    },
  ],
}

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <ScrollProgress />
      <Header />
      <main className="relative">
        <HeroSection />
        <SocialProofSection />
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
