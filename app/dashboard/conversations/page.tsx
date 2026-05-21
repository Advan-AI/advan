"use client"

import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  MessageSquare,
  Sparkles,
  StickyNote,
  Send,
  Smile,
  Paperclip,
  Image as ImageIcon,
  AtSign,
  ChevronDown,
  Filter,
} from "lucide-react"
import { DashPageHeader, DashCard } from "@/components/dashboard/page-header"

type Role = "customer" | "ai" | "agent" | "note"
type Msg = {
  role: Role
  who: string
  text: string
  time: string
  badge?: string
}

const ALL_MESSAGES: Msg[] = [
  { role: "customer", who: "Jenna Lee",  text: "I was overcharged this month. Can you please review my invoice?", time: "10:24 AM", badge: "Customer" },
  { role: "ai",       who: "AI Copilot", text: "I've reviewed Jenna's invoice. There's an extra add-on charge for premium reports that was applied incorrectly. Suggested refund: $49.00. Sources cited: Docs / Billing Overcharges, KB / Refunds Process Guide.", time: "10:24 AM", badge: "AI Draft" },
  { role: "agent",    who: "Sarah Johnson", text: "Hi Jenna, I'm reviewing your account right now. Confirming the refund and posting it back to the card on file.", time: "10:25 AM", badge: "Agent" },
  { role: "note",     who: "Sarah Johnson", text: "Refund issued via Stripe (re-stripe.ref.0481). Watch for repeat with billing import on May 31.", time: "10:26 AM", badge: "Internal note" },
  { role: "customer", who: "Jenna Lee",  text: "Amazing, thank you! How long until I see it on my statement?", time: "10:27 AM", badge: "Customer" },
  { role: "ai",       who: "AI Copilot", text: "Per Billing Policy v2.3, refunds appear on the customer's statement within 3–5 business days. Draft reply ready for review.", time: "10:27 AM", badge: "AI Draft" },
]

const TABS = ["All", "Customer", "AI Copilot", "Agent Notes"] as const

export default function ConversationsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("All")
  const [typing, setTyping] = useState(true)

  // Toggle the AI typing dots after a short delay
  useEffect(() => {
    const t = setTimeout(() => setTyping(false), 1800)
    return () => clearTimeout(t)
  }, [tab])

  const filtered = useMemo(() => {
    if (tab === "All") return ALL_MESSAGES
    if (tab === "Customer") return ALL_MESSAGES.filter((m) => m.role === "customer")
    if (tab === "AI Copilot") return ALL_MESSAGES.filter((m) => m.role === "ai")
    return ALL_MESSAGES.filter((m) => m.role === "note")
  }, [tab])

  return (
    <div>
      <DashPageHeader
        eyebrow="Inbox"
        title="Conversations"
        subtitle="One thread, every channel. The AI drafts, your agents approve, customers stay in the loop."
        actions={
          <>
            <button className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border dash-border bg-[var(--dash-card)] text-[13px] font-semibold text-[var(--dash-ink-soft)] hover:dash-shadow-sm transition">
              <Filter className="w-4 h-4" /> Filters
            </button>
            <button className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-white bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] hover:-translate-y-px transition">
              <Sparkles className="w-4 h-4" /> Ask Copilot
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr_320px] gap-4">
        {/* Conversation list (left) */}
        <DashCard
          title="Inbox"
          icon={<MessageSquare className="w-[18px] h-[18px]" />}
          right={<span className="text-[11px] font-bold text-[var(--dash-ink-faint)]">12 open</span>}
          padded={false}
        >
          <ul>
            {[
              { who: "Jenna Lee",  preview: "I was overcharged this month…", time: "10:24a", unread: true, active: true },
              { who: "Marcus Hall", preview: "Webhook signature rotation broke…", time: "9:58a", unread: true },
              { who: "Priya Shah",  preview: "SSO not provisioning new seats", time: "9:30a" },
              { who: "Tom Becker",  preview: "Confirming refund landed",       time: "8:47a" },
              { who: "Dana Romero", preview: "Quarterly usage report export",  time: "8:12a" },
              { who: "Liam Patel",  preview: "Can we enable EU residency?",    time: "Yest" },
            ].map((t) => (
              <li
                key={t.who}
                className={`flex items-start gap-3 px-4 py-3 border-b dash-border-soft last:border-b-0 cursor-pointer transition ${
                  t.active ? "bg-[var(--dash-accent-wash)]" : "hover:bg-[rgba(107,92,214,0.04)]"
                }`}
              >
                <div className="w-8 h-8 rounded-full dash-bg-deep shrink-0 flex items-center justify-center text-[11px] font-bold text-[var(--dash-ink-soft)]">
                  {t.who.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[13px] truncate ${
                        t.active ? "font-bold text-[var(--dash-accent-deep)]" : "font-semibold text-[var(--dash-ink)]"
                      }`}
                    >
                      {t.who}
                    </span>
                    <span className="ml-auto text-[10.5px] text-[var(--dash-ink-faint)]">{t.time}</span>
                  </div>
                  <div className="text-[12px] text-[var(--dash-ink-soft)] truncate">{t.preview}</div>
                </div>
                {t.unread && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--dash-accent)] mt-2" />
                )}
              </li>
            ))}
          </ul>
        </DashCard>

        {/* Main conversation panel (center) */}
        <DashCard
          title="Conversation"
          icon={<MessageSquare className="w-[18px] h-[18px]" />}
          right={<span className="font-mono text-[11.5px] text-[var(--dash-ink-faint)]">#TK-84219</span>}
          padded={false}
        >
          {/* Tabs */}
          <div className="flex items-center gap-1 px-4 py-2.5">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`text-[12px] font-semibold px-2.5 py-1 rounded-md transition ${
                  tab === t
                    ? "bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]"
                    : "text-[var(--dash-ink-faint)] hover:text-[var(--dash-ink-soft)]"
                }`}
              >
                {t}
              </button>
            ))}
            <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--dash-sage)] dash-bg-sage-wash rounded-full px-2.5 py-0.5">
              <span className="w-[6px] h-[6px] rounded-full bg-[var(--dash-sage)] dash-pulse-dot" />
              Live
            </span>
          </div>

          <div className="px-4 pb-2 flex flex-col gap-4 max-h-[460px] overflow-y-auto relative">
            <AnimatePresence initial={false}>
              {filtered.map((m, i) => (
                <motion.div
                  key={`${m.role}-${i}-${m.time}-${m.text.slice(0, 12)}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.03 }}
                >
                  <MessageBubble
                    role={m.role}
                    who={m.who}
                    text={m.text}
                    time={m.time}
                    badge={m.badge}
                    typing={m.role === "ai" && i === filtered.length - 1 && typing}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Note composer */}
          <div className="m-4 mt-2 rounded-xl border border-dashed dash-border bg-white">
            <div className="px-3 py-2 text-[11.5px] font-bold text-[var(--dash-ink-soft)]">Internal note</div>
            <input
              placeholder="Add a private note…"
              className="w-full bg-transparent outline-none px-3 pb-2.5 text-[12.5px] text-[var(--dash-ink)] placeholder:text-[var(--dash-ink-faint)]"
            />
            <div className="flex items-center gap-3 px-3 py-2 border-t dash-border-soft">
              <button className="text-[var(--dash-ink-faint)] hover:text-[var(--dash-accent)] transition">
                <Paperclip className="w-[15px] h-[15px]" />
              </button>
              <button className="text-[var(--dash-ink-faint)] hover:text-[var(--dash-accent)] transition">
                <ImageIcon className="w-[15px] h-[15px]" />
              </button>
              <button className="text-[var(--dash-ink-faint)] hover:text-[var(--dash-accent)] transition">
                <Smile className="w-[15px] h-[15px]" />
              </button>
              <button className="text-[var(--dash-ink-faint)] hover:text-[var(--dash-accent)] transition">
                <AtSign className="w-[15px] h-[15px]" />
              </button>
              <button className="ml-auto text-[11.5px] font-bold text-[var(--dash-ink-soft)] bg-[var(--dash-bg-deep)] hover:bg-[var(--dash-accent)] hover:text-white rounded-md px-2.5 py-1 transition">
                Add Note
              </button>
            </div>
          </div>
        </DashCard>

        {/* Customer context (right) */}
        <DashCard
          title="Customer"
          icon={<Sparkles className="w-[18px] h-[18px]" />}
          right={
            <button className="text-[11px] font-semibold text-[var(--dash-accent-deep)] hover:underline">
              Open profile
            </button>
          }
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-full dash-bg-rose-wash flex items-center justify-center text-[14px] font-bold text-[#8a3e3e]">
              JL
            </div>
            <div>
              <div className="text-[14px] font-bold text-[var(--dash-ink)]">Jenna Lee</div>
              <div className="text-[12px] text-[var(--dash-ink-soft)]">Acme Corp · Enterprise</div>
            </div>
          </div>

          <div className="space-y-3 text-[12.5px]">
            <ContextRow label="Plan" value="Enterprise · annual" />
            <ContextRow label="MRR" value="$4,200" />
            <ContextRow label="Account owner" value="Jordan Kim" />
            <ContextRow label="Tone preference" value="Concise, friendly" />
            <ContextRow label="Last touch" value="2h ago · Slack" />
          </div>

          <div className="mt-5 pt-4 border-t dash-border-soft">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--dash-ink-soft)] mb-2">
              Active collaborators
            </div>
            <div className="flex items-center gap-1.5">
              <CollabAvatar label="AI" gradient="from-[#8E80E5] to-[#5C4DC1]" pulse />
              <CollabAvatar label="SJ" gradient="from-[#B6A98C] to-[#807458]" />
              <CollabAvatar label="JK" gradient="from-[#76B98C] to-[#4A8A60]" />
              <span className="text-[11px] text-[var(--dash-ink-faint)] ml-2">3 live</span>
            </div>
          </div>
        </DashCard>
      </div>
    </div>
  )
}

function MessageBubble({
  role,
  who,
  text,
  time,
  badge,
  typing,
}: Msg & { typing?: boolean }) {
  const isCustomer = role === "customer"
  const isAi = role === "ai"
  const isAgent = role === "agent"
  const isNote = role === "note"

  const avatarBg =
    isCustomer ? "dash-bg-rose-wash text-[#8a3e3e]" :
    isAi       ? "bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]" :
    isNote     ? "bg-[var(--dash-amber-wash)] text-[#8a5a1e]" :
                 "bg-[var(--dash-sage-wash)] text-[#2f5d3f]"

  const bubbleClass =
    isCustomer ? "bg-[var(--dash-bg)] text-[var(--dash-ink)] border dash-border" :
    isAi       ? "bg-[var(--dash-accent-wash)] text-[#37308a] border border-[#D7CFF2]" :
    isNote     ? "bg-[var(--dash-amber-wash)] text-[#5a3e1c] border border-[#E5D2A8]" :
                 "bg-[var(--dash-sage-wash)] text-[#2f5d3f] border border-[#CBE0CF]"

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-bold ${avatarBg}`}>
          {who.split(" ").map((p) => p[0]).slice(0, 2).join("")}
        </div>
        <span className="text-[12.5px] font-bold text-[var(--dash-ink)]">{who}</span>
        {badge && (
          <span
            className={`text-[10px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 ${
              isAi
                ? "bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]"
                : isNote
                ? "bg-[var(--dash-amber-wash)] text-[#8a5a1e]"
                : isAgent
                ? "bg-[var(--dash-sage-wash)] text-[#2f5d3f]"
                : "dash-bg-deep text-[var(--dash-ink-soft)]"
            }`}
          >
            {badge}
          </span>
        )}
        <span className="ml-auto text-[10.5px] text-[var(--dash-ink-faint)]">{time}</span>
      </div>
      <div className={`rounded-xl rounded-tl-sm px-3.5 py-2.5 text-[13px] leading-[1.55] ${bubbleClass}`}>
        {typing ? <TypingDots /> : text}
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[var(--dash-accent)]"
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.16, ease: "easeInOut" }}
        />
      ))}
    </div>
  )
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--dash-ink-faint)]">{label}</span>
      <span className="font-semibold text-[var(--dash-ink)]">{value}</span>
    </div>
  )
}

function CollabAvatar({ label, gradient, pulse }: { label: string; gradient: string; pulse?: boolean }) {
  return (
    <span
      className={`relative w-6 h-6 rounded-full text-[10px] font-bold text-white flex items-center justify-center bg-gradient-to-br ${gradient} ring-2 ring-[var(--dash-card)]`}
    >
      {label}
      {pulse && <span className="absolute inset-0 rounded-full ring-2 ring-[var(--dash-accent)]/40 animate-ping" />}
    </span>
  )
}
