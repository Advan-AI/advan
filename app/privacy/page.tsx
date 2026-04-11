import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="pt-20">
        <section className="py-24 bg-white">
          <div className="max-w-3xl mx-auto px-6">
            <h1 className="text-4xl font-light text-[#1a1a1a] mb-4 font-serif">Privacy Policy</h1>
            <p className="text-[#666] mb-10">Last updated: January 2026</p>

            <div className="prose prose-lg max-w-none space-y-10">
              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Introduction</h2>
                <p className="text-[#555] leading-relaxed">
                  Advan AI (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) respects your privacy and is committed to protecting your personal data. This privacy policy explains how we collect, use, disclose, and safeguard your information when you use our services.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Information We Collect</h2>
                <p className="text-[#555] leading-relaxed mb-4">We collect information that you provide directly to us, including:</p>
                <ul className="list-disc pl-6 space-y-2 text-[#555]">
                  <li>Contact information (name, email address, phone number)</li>
                  <li>Company information (company name, job title, industry)</li>
                  <li>Account credentials and preferences</li>
                  <li>Communication history and correspondence</li>
                  <li>Payment and billing information</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">How We Use Your Information</h2>
                <p className="text-[#555] leading-relaxed mb-4">We use the information we collect to:</p>
                <ul className="list-disc pl-6 space-y-2 text-[#555]">
                  <li>Provide, maintain, and improve our services</li>
                  <li>Process transactions and send related information</li>
                  <li>Send promotional communications (with your consent)</li>
                  <li>Respond to your comments, questions, and requests</li>
                  <li>Monitor and analyze trends, usage, and activities</li>
                  <li>Detect, investigate, and prevent security incidents</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Data Sharing and Disclosure</h2>
                <p className="text-[#555] leading-relaxed">
                  We do not sell your personal information. We may share your information with third-party service providers who perform services on our behalf, such as payment processing, data analysis, email delivery, and customer service. These providers are contractually obligated to protect your information.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Data Security</h2>
                <p className="text-[#555] leading-relaxed">
                  We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction. This includes encryption, access controls, and regular security assessments.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Your Rights</h2>
                <p className="text-[#555] leading-relaxed mb-4">Depending on your location, you may have certain rights regarding your personal information, including:</p>
                <ul className="list-disc pl-6 space-y-2 text-[#555]">
                  <li>Right to access your personal data</li>
                  <li>Right to correct inaccurate data</li>
                  <li>Right to request deletion of your data</li>
                  <li>Right to object to processing</li>
                  <li>Right to data portability</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Cookies</h2>
                <p className="text-[#555] leading-relaxed">
                  We use cookies and similar tracking technologies to track activity on our services and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Changes to This Policy</h2>
                <p className="text-[#555] leading-relaxed">
                  We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the date at the top.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">Contact Us</h2>
                <p className="text-[#555] leading-relaxed">
                  For questions about this Privacy Policy, please contact us at <a href="mailto:day@advanai.net" className="text-[#E85D04] hover:underline">day@advanai.net</a>.
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
