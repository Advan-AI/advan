"use client"

import { useEffect, useState } from "react"
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion"
import { ArrowRight } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"

const BOOKING_URL = "https://cal.com/day-nguyen"

const CARDS = [
  { id: 1, image: "/images/card-demo.jpg", label: "Demo Booked" },
  { id: 2, image: "/images/card-email.jpg", label: "Email Sent" },
  { id: 3, image: "/images/card-profile.jpg", label: "Profile Match" },
  { id: 4, image: "/images/card-lead.jpg", label: "Lead Signal" },
  { id: 5, image: "/images/card-reply.jpg", label: "Reply Rate" },
  { id: 6, image: "/images/card-sequence.jpg", label: "AI Sequence" },
]

function StackedCards() {
  const [order, setOrder] = useState(CARDS.map((_, i) => i))

  useEffect(() => {
    const interval = setInterval(() => {
      setOrder((prev) => {
        const next = [...prev]
        const last = next.pop()!
        next.unshift(last)
        return next
      })
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative w-[320px] h-[320px] select-none" aria-hidden="true">
      {order.map((cardIdx, stackPos) => {
        const card = CARDS[cardIdx]
        const total = order.length
        const isTop = stackPos === total - 1

        const xOffset = (total - 1 - stackPos) * 14
        const yOffset = (total - 1 - stackPos) * 6
        const scale = 1 - (total - 1 - stackPos) * 0.04
        const zIndex = stackPos

        return (
          <motion.div
            key={card.id}
            layout
            animate={{ x: xOffset, y: yOffset, scale, zIndex }}
            whileHover={isTop ? { scale: scale * 1.02, y: yOffset - 4 } : {}}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            className="absolute inset-0 rounded-2xl overflow-hidden shadow-2xl cursor-pointer"
            style={{ boxShadow: isTop ? "0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)" : undefined }}
          >
            <Image
              src={card.image}
              alt={card.label}
              fill
              className="object-cover"
              sizes="320px"
            />
          </motion.div>
        )
      })}
    </div>
  )
}

export function HeroSection() {
  const mouseX = useMotionValue(0.5)
  const mouseY = useMotionValue(0.5)
  const glowX = useSpring(useTransform(mouseX, [0, 1], ["-10%", "110%"]), { stiffness: 40, damping: 20 })
  const glowY = useSpring(useTransform(mouseY, [0, 1], ["-10%", "110%"]), { stiffness: 40, damping: 20 })

  function handleMouseMove(e: React.MouseEvent<HTMLElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    mouseX.set((e.clientX - rect.left) / rect.width)
    mouseY.set((e.clientY - rect.top) / rect.height)
  }

  return (
    <section
      className="relative min-h-screen bg-[#0a0a0a] overflow-hidden flex items-center"
      onMouseMove={handleMouseMove}
    >
      {/* Background gradient */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#0a0a0a]" />
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full blur-[100px] pointer-events-none"
          style={{
            left: glowX,
            top: glowY,
            transform: "translate(-50%, -50%)",
            background: "radial-gradient(circle, rgba(124, 58, 237, 0.15) 0%, transparent 70%)",
          }}
        />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[#E85D04]/5 blur-[80px]" />
      </div>
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "60px 60px" }}
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: text */}
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="font-light text-white mb-6 text-[40px] font-serif"
            >
              AI-Powered<br />Growth Systems for<br />
              <span className="italic text-[#E85D04]">Predictable Revenue</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="text-lg text-white/60 max-w-lg mb-10 leading-relaxed"
            >
              Build, optimize, and scale AI agents that generate new demand, reactivate existing leads, and convert inbound traffic.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Button size="lg" asChild
                className="group bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-full px-8 h-13 text-base shadow-xl shadow-purple-900/40"
              >
                <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
                  Book a demo
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild
                className="border-white/15 text-white hover:bg-white/8 hover:border-white/25 rounded-full px-8 h-13 text-base bg-transparent transition-all"
              >
                <a href="#platform" onClick={(e) => {
                  e.preventDefault()
                  const el = document.getElementById("platform")
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
                }}>
                  See how it works
                </a>
              </Button>
            </motion.div>
          </div>

          {/* Right: stacked cards */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
            className="hidden lg:flex flex-1 items-center justify-center"
          >
            <div className="relative">
              <div className="absolute inset-0 scale-110 rounded-3xl blur-3xl bg-purple-500/10 pointer-events-none" />
              <StackedCards />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
