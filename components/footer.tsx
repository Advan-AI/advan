"use client"

import Link from "next/link"
import Image from "next/image"
import { Linkedin, Twitter, Mail } from "lucide-react"

const footerLinks = {
  Platform: [
    { label: "AI Growth Engine", href: "#platform" },
    { label: "How It Works", href: "#lifecycle" },
    { label: "Results", href: "#results" },
    { label: "FAQ", href: "#faq" },
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

const socialLinks = [
  { icon: Linkedin, href: "https://linkedin.com/company/advan-ai", label: "LinkedIn" },
  { icon: Twitter, href: "https://twitter.com/advanai", label: "Twitter" },
  { icon: Mail, href: "mailto:hello@advan.ai", label: "Email" },
]

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-[#0a0a0a] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2 mb-6">
              <Image
                src="/images/advan-logo.png"
                alt="Advan AI Logo"
                width={40}
                height={40}
                className="rounded-lg"
              />
              <span className="font-semibold text-xl text-white">Advan AI</span>
            </Link>
            <p className="text-sm text-white/50 leading-relaxed mb-6">
              AI-powered growth systems for predictable revenue.
            </p>
            <div className="flex gap-3">
              {socialLinks.map((social) => {
                const Icon = social.icon
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-[#E85D04] flex items-center justify-center transition-colors"
                    aria-label={social.label}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </a>
                )
              })}
            </div>
          </div>

          {/* Links columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="font-semibold text-white mb-4">{title}</h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    {"external" in link && link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-white/50 hover:text-white transition-colors"
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
                        className="text-sm text-white/50 hover:text-white transition-colors cursor-pointer"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-white/50 hover:text-white transition-colors"
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

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-white/40">
            &copy; {currentYear} Advan AI. All rights reserved.
          </p>
          <p className="text-sm text-white/40">
            Built with AI for growth-minded B2B teams.
          </p>
        </div>
      </div>
    </footer>
  )
}
