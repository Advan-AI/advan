import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="pt-20">
        <section className="py-24">
          <div className="max-w-3xl mx-auto px-6">
            <h1 className="text-4xl font-light text-[#1a1a1a] mb-4 font-serif">Terms of Service</h1>
            <p className="text-[#666] mb-10">Last updated: January 2026</p>

            <div className="prose prose-lg max-w-none space-y-10">
              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Acceptance of Terms</h2>
                <p className="text-[#555] leading-relaxed">
                  By accessing or using Advan AI&apos;s services, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using our services.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Services</h2>
                <p className="text-[#555] leading-relaxed">
                  Advan AI provides AI-powered B2B revenue growth services, including but not limited to AI outbound prospecting, CRM reactivation, and inbound conversion optimization. The specific services provided are outlined in your service agreement.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Acceptable Use</h2>
                <p className="text-[#555] leading-relaxed mb-4">You agree not to use our services to:</p>
                <ul className="list-disc pl-6 space-y-2 text-[#555]">
                  <li>Violate any applicable laws or regulations</li>
                  <li>Send unsolicited commercial communications in violation of applicable law</li>
                  <li>Transmit any harmful, offensive, or disruptive content</li>
                  <li>Infringe upon intellectual property rights of others</li>
                  <li>Attempt to gain unauthorized access to our systems</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Intellectual Property</h2>
                <p className="text-[#555] leading-relaxed">
                  The service and its original content, features, and functionality are and will remain the exclusive property of Advan AI. Our trademarks may not be used in connection with any product or service without prior written consent.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Limitation of Liability</h2>
                <p className="text-[#555] leading-relaxed">
                  To the maximum extent permitted by law, Advan AI shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Termination</h2>
                <p className="text-[#555] leading-relaxed">
                  Either party may terminate the service agreement with 30 days&apos; written notice. We reserve the right to suspend or terminate your access immediately if you breach these terms. Upon termination, your right to use our services will cease immediately.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Confidentiality</h2>
                <p className="text-[#555] leading-relaxed">
                  Both parties agree to maintain the confidentiality of any proprietary information shared during the course of our business relationship. This obligation survives termination of services.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Governing Law</h2>
                <p className="text-[#555] leading-relaxed">
                  These terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law principles. Any disputes arising from these terms shall be resolved through binding arbitration.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Changes to Terms</h2>
                <p className="text-[#555] leading-relaxed">
                  We reserve the right to modify these terms at any time. We will notify users of any material changes via email or through our services. Continued use of our services after changes constitutes acceptance of the modified terms.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Contact Information</h2>
                <p className="text-[#555] leading-relaxed">
                  For questions about these Terms of Service, please contact us at <a href="mailto:day@advanai.net" className="text-[#E85D04] hover:underline">day@advanai.net</a>.
                </p>
              </section>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
