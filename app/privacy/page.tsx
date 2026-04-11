import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white">
      <Header />
      
      <section className="pt-32 pb-16 lg:pt-40 lg:pb-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-light text-[#1a1a1a] mb-8 font-serif">
            Privacy Policy
          </h1>
          
          <div className="prose prose-lg max-w-none">
            <p className="text-[#666] mb-6">
              Last updated: January 2024
            </p>

            <div className="space-y-8 text-[#444]">
              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Introduction</h2>
                <p>
                  Advan AI (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI Growth Engine platform and services.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Information We Collect</h2>
                <p className="mb-4">We may collect the following types of information:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Contact information (name, email, phone number, company name)</li>
                  <li>Business information related to your ideal customer profile</li>
                  <li>Usage data and analytics from our platform</li>
                  <li>Communication records and campaign performance data</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">How We Use Your Information</h2>
                <p className="mb-4">We use the information we collect to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Provide and improve our AI Growth Engine services</li>
                  <li>Generate and manage outbound campaigns on your behalf</li>
                  <li>Communicate with you about our services</li>
                  <li>Analyze and optimize campaign performance</li>
                  <li>Comply with legal obligations</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Data Security</h2>
                <p>
                  We implement industry-standard security measures to protect your data, including encryption, access controls, and regular security audits. Our infrastructure is designed with enterprise-grade security in alignment with SOC 2, GDPR, and CCPA requirements.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Your Rights</h2>
                <p className="mb-4">You have the right to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Access and receive a copy of your personal data</li>
                  <li>Request correction of inaccurate data</li>
                  <li>Request deletion of your personal data</li>
                  <li>Opt-out of marketing communications</li>
                  <li>Withdraw consent where applicable</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Contact Us</h2>
                <p>
                  If you have questions about this Privacy Policy or our data practices, please contact us at{" "}
                  <a href="mailto:privacy@advan.ai" className="text-[#E85D04] hover:underline">
                    privacy@advan.ai
                  </a>
                </p>
              </section>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
