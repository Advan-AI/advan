"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"

const BOOKING_URL = "https://cal.com/day-nguyen"

const navLinks = [
  { href: "#platform", label: "Platform" },
  { href: "#lifecycle", label: "Solutions" },
  { href: "#results", label: "Results" },
  { href: "/about", label: "About" },
  { href: "#contact", label: "Contact" },
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
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    const isHash = href.startsWith("#")
    if (!isHash) return

    const hash = href.replace("#", "")

    if (pathname === "/") {
      e.preventDefault()
      scrollToHash(hash)
      window.history.pushState(null, "", `#${hash}`)
    }
    setIsMobileMenuOpen(false)
  }

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 bg-[#fefefe] transition-shadow duration-200 ${scrolled ? "shadow-sm" : ""}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-[#E85D04] flex items-center justify-center">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <span className="font-semibold text-xl text-[#1a1a1a]">Advan AI</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              link.href.startsWith("/") ? (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2 text-sm font-medium text-[#1a1a1a]/70 hover:text-[#1a1a1a] hover:bg-[#f5f5f5] transition-all rounded-lg"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className="px-4 py-2 text-sm font-medium text-[#1a1a1a]/70 hover:text-[#1a1a1a] hover:bg-[#f5f5f5] transition-all rounded-lg cursor-pointer"
                >
                  {link.label}
                </a>
              )
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <Button
              variant="outline"
              asChild
              className="rounded-full px-6 border-[#1a1a1a] text-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-white bg-transparent"
            >
              <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
                Book a demo
              </a>
            </Button>
          </div>

          <button
            className="lg:hidden p-2 rounded-lg text-[#1a1a1a] hover:bg-[#f5f5f5] transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden overflow-hidden border-t border-[#f0f0f0]"
            >
              <nav className="py-4 space-y-1">
                {navLinks.map((link) => (
                  link.href.startsWith("/") ? (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="block px-4 py-3 text-sm font-medium text-[#1a1a1a]/70 hover:text-[#1a1a1a] hover:bg-[#f5f5f5] rounded-lg transition-all"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={(e) => handleNavClick(e, link.href)}
                      className="block px-4 py-3 text-sm font-medium text-[#1a1a1a]/70 hover:text-[#1a1a1a] hover:bg-[#f5f5f5] rounded-lg transition-all cursor-pointer"
                    >
                      {link.label}
                    </a>
                  )
                ))}
                <div className="pt-2 px-4">
                  <Button asChild className="w-full bg-[#E85D04] hover:bg-[#D45A04] text-white rounded-full">
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
