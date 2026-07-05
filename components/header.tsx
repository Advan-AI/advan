"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Menu, X, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"

const navLinks = [
  { href: "#how", label: "How it works" },
  { href: "#receipts", label: "Product" },
  { href: "#why", label: "Why Advan" },
  { href: "#faq", label: "FAQ" },
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
  const [activeHash, setActiveHash] = useState<string>("")
  const pathname = usePathname()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8)
    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Track which in-page section is active for nav highlighting
  useEffect(() => {
    if (pathname !== "/") return
    const sectionIds = navLinks.filter((l) => l.href.startsWith("#")).map((l) => l.href.slice(1))
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) {
          const top = visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
          setActiveHash(`#${top.target.id}`)
        }
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
    )
    sectionIds.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [pathname])

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
      className={`fixed top-0 left-0 right-0 z-50 transition-[background,border,backdrop-filter] duration-300 ${
        scrolled
          ? "backdrop-blur-xl bg-[hsl(40_32%_86%/0.78)] border-b border-black/[0.06] shadow-[0_1px_0_rgba(15,23,42,0.02),0_8px_24px_-18px_rgba(60,50,30,0.18)]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`flex items-center justify-between transition-[height] duration-300 ${scrolled ? "h-14 lg:h-16" : "h-16 lg:h-20"}`}>
          <Link href="/" className="flex items-center gap-2.5 group rounded-lg">
            <Image
              src="/images/advan-logo.svg"
              alt="Advan AI Logo"
              width={36}
              height={36}
              priority
              className="rounded-lg group-hover:scale-105 group-active:scale-95 transition-transform duration-200"
            />
            <span className="font-bold text-lg text-foreground tracking-tight">Advan</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1 rounded-full glass px-1.5 py-1.5">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (pathname === "/" && activeHash === link.href)
              const cls = `relative px-3.5 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap ${
                isActive ? "text-foreground" : "text-foreground/65 hover:text-foreground"
              }`
              const indicator = isActive ? (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 -z-10 rounded-full bg-black/[0.07]"
                  transition={{ type: "spring", stiffness: 340, damping: 32 }}
                />
              ) : null
              return link.href.startsWith("/") ? (
                <Link key={link.href} href={link.href} className={cls}>
                  {indicator}
                  {link.label}
                </Link>
              ) : (
                <a key={link.href} href={link.href} onClick={(e) => handleNavClick(e, link.href)} className={`${cls} cursor-pointer`}>
                  {indicator}
                  {link.label}
                </a>
              )
            })}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <Link
              href="/signin"
              className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Button
              asChild
              className="group rounded-full h-9 px-4 text-sm font-semibold bg-[#6B5CD6] hover:bg-[#4E3FB6] text-white shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] hover:-translate-y-px transition-all whitespace-nowrap"
            >
              <Link href="/signin">
                Start free trial
                <ArrowRight className="ml-1.5 w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </Button>
          </div>

          <button
            className="lg:hidden p-2 rounded-lg text-foreground hover:bg-black/[0.04] transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
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
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="lg:hidden overflow-hidden border-t border-black/[0.06]"
            >
              <nav className="py-4 space-y-1">
                {navLinks.map((link) =>
                  link.href.startsWith("/") ? (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="block px-4 py-3 text-sm font-medium text-foreground/75 hover:text-foreground hover:bg-black/[0.04] rounded-lg transition-all"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={(e) => handleNavClick(e, link.href)}
                      className="block px-4 py-3 text-sm font-medium text-foreground/75 hover:text-foreground hover:bg-black/[0.04] rounded-lg transition-all cursor-pointer"
                    >
                      {link.label}
                    </a>
                  )
                )}
                <div className="pt-2 px-4 flex flex-col gap-2">
                  <Link
                    href="/signin"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block w-full text-center rounded-full h-10 leading-10 text-sm font-medium border border-black/10 hover:bg-black/[0.04] transition"
                  >
                    Sign in
                  </Link>
                  <Button
                    asChild
                    className="w-full rounded-full bg-[#6B5CD6] hover:bg-[#4E3FB6] text-white"
                  >
                    <Link href="/signin" onClick={() => setIsMobileMenuOpen(false)}>
                      Start free trial
                    </Link>
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
