"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Linkedin, Youtube } from "lucide-react"

const footerLinks = {
  Product: [
    { label: "Workflow", href: "/#workflow" },
    { label: "Copilot", href: "/#copilot" },
    { label: "Cross-channel memory", href: "/#memory" },
    { label: "Pricing", href: "/#pricing" },
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "Contact", href: "/#contact" },
    { label: "Book a demo", href: "https://cal.com/day-nguyen", external: true },
  ],
  Trust: [
    { label: "Enterprise trust", href: "/#trust" },
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
  ],
}

const socialLinks = [
  { icon: Linkedin, href: "https://www.linkedin.com/company/advanai/", label: "LinkedIn" },
  { icon: Youtube, href: "https://www.youtube.com/@AdvanAI1", label: "YouTube" },
]

function scrollToHash(hash: string) {
  const el = document.getElementById(hash)
  if (el) {
    const offset = 80
    const top = el.getBoundingClientRect().top + window.scrollY - offset
    window.scrollTo({ top, behavior: "smooth" })
  }
}

export function Footer() {
  const pathname = usePathname()

  function handleAnchorClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    const hash = href.replace("/#", "")
    if (pathname === "/") {
      e.preventDefault()
      scrollToHash(hash)
      window.history.pushState(null, "", `#${hash}`)
    }
  }

  return (
    <footer className="relative border-t border-white/[0.06] bg-background/60">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" aria-hidden />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-12">
          <div className="md:col-span-5">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-5">
              <Image
                src="/images/advan-logo.png"
                alt="Advan AI Logo"
                width={36}
                height={36}
                className="rounded-lg ring-1 ring-white/10"
              />
              <span className="font-semibold text-lg text-white tracking-tight">Advan</span>
            </Link>
            <p className="text-sm text-white/55 leading-relaxed max-w-sm">
              Transparent AI support for better customer experiences. Sourced answers, live confidence,
              cross-channel memory.
            </p>
            <div className="mt-6 flex gap-2">
              {socialLinks.map((social) => {
                const Icon = social.icon
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-lg glass flex items-center justify-center hover:border-cyan-300/40 transition-colors"
                    aria-label={social.label}
                  >
                    <Icon className="w-4 h-4 text-white/70" />
                  </a>
                )
              })}
            </div>
          </div>

          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title} className="md:col-span-2 md:col-start-auto first:md:col-start-7">
              <h3 className="text-[11px] font-semibold text-white/40 uppercase tracking-[0.18em] mb-4">
                {title}
              </h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    {"external" in link && link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-white/75 hover:text-cyan-200 transition-colors"
                      >
                        {link.label}
                      </a>
                    ) : link.href.startsWith("/#") ? (
                      <a
                        href={link.href}
                        onClick={(e) => handleAnchorClick(e, link.href)}
                        className="text-sm text-white/75 hover:text-cyan-200 transition-colors cursor-pointer"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-white/75 hover:text-cyan-200 transition-colors"
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

        <div className="mt-14 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} Advan AI. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-white/40">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              All systems operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
