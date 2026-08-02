import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ScrollProgress } from "@/components/scroll-progress"
import { HeroSection } from "@/components/hero-section"
import { SocialProofSection } from "@/components/social-proof-section"
import { HowItWorksSection } from "@/components/how-it-works-section"
import { ReceiptsSection } from "@/components/receipts-section"
import { ComparisonSection } from "@/components/comparison-section"
import { FAQSection } from "@/components/faq-section"
import { FinalCTA } from "@/components/final-cta"
import { AlibabaRAGDemo } from "@/components/alibaba-rag-demo"
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
        <section className="mx-auto max-w-6xl px-4 py-8">
          <AlibabaRAGDemo />
        </section>
        <HowItWorksSection />
        <ReceiptsSection />
        <ComparisonSection />
        <FAQSection />
        <FinalCTA />
      </main>
      <Footer />
    </>
  )
}
