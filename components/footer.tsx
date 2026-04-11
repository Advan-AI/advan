"use client"

import Link from "next/link"
import Image from "next/image"
import { Linkedin, Instagram, Youtube } from "lucide-react"

const footerLinks = {
  Platform: [
    { label: "How it Works", href: "#lifecycle" },
    { label: "Solutions", href: "#platform" },
    { label: "Results", href: "#results" },
    { label: "FAQs", href: "#faq" },
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "Contact", href: "#contact" },
    { label: "Book a Demo", href: "https://cal.com/day-nguyen", external: true },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
  ],
}

// X (Twitter) icon component
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

const socialLinks = [
  { icon: Linkedin, href: "https://www.linkedin.com/company/advanai/", label: "LinkedIn" },
  { icon: Instagram, href: "https://www.instagram.com/advanintech/?hl=en", label: "Instagram" },
  { icon: XIcon, href: "https://twitter.com/advanai", label: "X" },
  { icon: Youtube, href: "https://youtube.com/@advanai", label: "YouTube" },
]

export function Footer() {
  return (
    <footer className="bg-[#f8f8f8] border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12">
          {/* Brand column */}
          <div className="md:col-span-4">
            <Link href="/" className="inline-flex items-center gap-2 mb-4">
              <Image
                src="/images/advan-logo.png"
                alt="Advan AI Logo"
                width={36}
                height={36}
                className="rounded-lg"
              />
              <span className="font-semibold text-lg text-[#1a1a1a]">Advan AI</span>
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed mb-6 max-w-[280px]">
              AI-Powered Growth Systems for Predictable Revenue
            </p>
            <div className="flex gap-2">
              {socialLinks.map((social) => {
                const Icon = social.icon
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 flex items-center justify-center transition-colors"
                    aria-label={social.label}
                  >
                    <Icon className="w-5 h-5 text-[#1a1a1a]" />
                  </a>
                )
              })}
            </div>
          </div>

          {/* Links columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title} className="md:col-span-2 md:col-start-auto first:md:col-start-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">{title}</h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    {"external" in link && link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[#1a1a1a] hover:text-[#E85D04] transition-colors"
                      >
                        {link.label}
                      </a>
                    ) : link.href.startsWith("#") ? (
                      <a
                        href={link.href}
                        onClick={(e) => {
                          e.preventDefault()
                          const el = document.getElementById(link.href.replace("#", ""))
                          if (el) el.scrollIntoView({ behavior: "smooth" })
                        }}
                        className="text-sm text-[#1a1a1a] hover:text-[#E85D04] transition-colors cursor-pointer"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-[#1a1a1a] hover:text-[#E85D04] transition-colors"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  )
}
