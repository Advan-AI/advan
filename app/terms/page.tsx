import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white">
      <Header />
      
      <section className="pt-32 pb-16 lg:pt-40 lg:pb-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-light text-[#1a1a1a] mb-8 font-serif">
            Terms of Service
          </h1>
          
          <div className="prose prose-lg max-w-none">
            <p className="text-[#666] mb-6">
              Last updated: January 2024
            </p>

            <div className="space-y-8 text-[#444]">
              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Agreement to Terms</h2>
                <p>
                  By accessing or using Advan AI&apos;s services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Description of Services</h2>
                <p>
                  Advan AI provides an AI-powered revenue growth platform that includes prospect research, personalized outreach, campaign management, and meeting scheduling services. Our AI Growth Engine is designed to generate qualified sales appointments for B2B companies.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Client Responsibilities</h2>
                <p className="mb-4">As a client, you agree to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Provide accurate information about your business and ideal customer profile</li>
                  <li>Attend scheduled strategy calls and provide timely feedback</li>
                  <li>Comply with all applicable laws and regulations regarding email communications</li>
                  <li>Not use our services for any unlawful or prohibited purpose</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Payment Terms</h2>
                <p>
                  Payment terms are outlined in your service agreement. Advan AI operates on a performance-based model where applicable, with specific terms defined in your contract.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Intellectual Property</h2>
                <p>
                  All content, technology, and intellectual property related to Advan AI&apos;s platform and services remain the property of Advan AI. Campaign content created for clients is provided under license for the client&apos;s use in connection with our services.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Limitation of Liability</h2>
                <p>
                  Advan AI shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of our services. Our total liability shall not exceed the amounts paid by you for our services in the twelve months preceding the claim.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Termination</h2>
                <p>
                  Either party may terminate the service agreement according to the terms specified in your contract. Upon termination, Advan AI will provide you with any data and reports generated during the engagement.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Contact</h2>
                <p>
                  For questions about these Terms of Service, please contact us at{" "}
                  <a href="mailto:legal@advan.ai" className="text-[#E85D04] hover:underline">
                    legal@advan.ai
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
