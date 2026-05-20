"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Menu, X, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"

const BOOKING_URL = "https://cal.com/day-nguyen"

const navLinks = [
  { href: "#workflow", label: "Workflow" },
  { href: "#copilot", label: "Copilot" },
  { href: "#trust", label: "Trust" },
  { href: "#pricing", label: "Pricing" },
  { href: "/about", label: "About" },
]

function scrollToHash(hash: string) {
  const el = document.getElementById(hash)
  if (el) {
    const offset = 80
    const top = el.getBoundingClientRect().top + window.scrollY - offset
    window.scrollTo({ top, behavior: "smooth" })
  }
}

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8)
    handleScroll()
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (!href.startsWith("#")) return
    const hash = href.replace("#", "")
    if (pathname === "/") {
      e.preventDefault()
      scrollToHash(hash)
      window.history.pushState(null, "", `#${hash}`)
    }
    setIsMobileMenuOpen(false)
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "backdrop-blur-xl bg-background/70 border-b border-white/[0.06]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Image
              src="/images/advan-logo.png"
              alt="Advan AI Logo"
              width={36}
              height={36}
              priority
              className="rounded-lg ring-1 ring-white/10 group-hover:ring-cyan-300/40 transition-all"
            />
            <span className="font-semibold text-lg text-white tracking-tight">Advan</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1 rounded-full glass px-1.5 py-1.5">
            {navLinks.map((link) =>
              link.href.startsWith("/") ? (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-3.5 py-1.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.06] rounded-full transition-all"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className="px-3.5 py-1.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.06] rounded-full transition-all cursor-pointer"
                >
                  {link.label}
                </a>
              )
            )}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <a
              href="#contact"
              onClick={(e) => handleNavClick(e, "#contact")}
              className="text-sm font-medium text-white/70 hover:text-white transition-colors"
            >
              Sign in
            </a>
            <Button
              asChild
              className="group rounded-full h-9 px-4 text-sm font-medium bg-white text-slate-900 hover:bg-white/90 shadow-[0_8px_24px_-10px_rgba(34,211,238,0.6)]"
            >
              <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
                Book a demo
                <ArrowRight className="ml-1.5 w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </Button>
          </div>

          <button
            className="lg:hidden p-2 rounded-lg text-white hover:bg-white/[0.06] transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden overflow-hidden border-t border-white/[0.06]"
            >
              <nav className="py-4 space-y-1">
                {navLinks.map((link) =>
                  link.href.startsWith("/") ? (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="block px-4 py-3 text-sm font-medium text-white/75 hover:text-white hover:bg-white/[0.05] rounded-lg transition-all"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={(e) => handleNavClick(e, link.href)}
                      className="block px-4 py-3 text-sm font-medium text-white/75 hover:text-white hover:bg-white/[0.05] rounded-lg transition-all cursor-pointer"
                    >
                      {link.label}
                    </a>
                  )
                )}
                <div className="pt-2 px-4">
                  <Button
                    asChild
                    className="w-full rounded-full bg-white text-slate-900 hover:bg-white/90"
                  >
                    <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
                      Book a demo
                    </a>
                  </Button>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  )
}
