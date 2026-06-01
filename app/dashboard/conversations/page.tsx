"use client"

import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  MessageSquare,
  Sparkles,
  Send,
  Smile,
  Paperclip,
  Image as ImageIcon,
  AtSign,
  Filter,
} from "lucide-react"
import { DashPageHeader, DashCard } from "@/components/dashboard/page-header"
import { api } from "@/lib/api/trpc-client"

type Role = "customer" | "ai" | "agent" | "note"
type Msg = { role: Role; who: string; text: string; time: string; badge?: string }

const TABS = ["All", "Customer", "AI Copilot", "Agent Notes"] as const
type Tab = (typeof TABS)[number]

export default function ConversationsPage() {
  const [tab, setTab] = useState<Tab>("All")
  const [typing, setTyping] = useState(true)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState("")

  const { data: conversationList, isLoading: listLoading } = api.conversations.list.useQuery({ limit: 20 })
  const firstConvId = conversationList?.[0]?.id ?? null

  // Select the first conversation by default
  useEffect(() => {
    if (firstConvId && !selectedConversationId) {
      setSelectedConversationId(firstConvId)
    }
  }, [firstConvId, selectedConversationId])

  const activeId = selectedConversationId ?? firstConvId

  const { data: thread } = api.conversations.getByTicketId.useQuery(
    { ticketId: conversationList?.find((c) => c.id === activeId)?.ticketId ?? "" },
    { enabled: !!activeId && !!(conversationList?.find((c) => c.id === activeId)?.ticketId) }
  )

  const addMessage = api.conversations.addMessage.useMutation()

  useEffect(() => {
    const t = setTimeout(() => setTyping(false), 1800)
    return () => clearTimeout(t)
  }, [tab])

  // Map DB messages to display format
  const allMsgs: Msg[] = useMemo(() => {
    if (!thread?.messages) return []
    return thread.messages.map((m) => ({
      role: (m.role === "assistant" ? "ai" : m.role) as Role,
      who: m.role === "assistant" ? "AI Copilot" : m.role === "user" ? "Customer" : "Agent",
      text: m.content,
      time: new Date(m.createdAt!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      badge: m.role === "assistant" ? "AI Draft" : m.role === "user" ? "Customer" : "Agent",
    }))
  }, [thread])

  const filtered = useMemo(() => {
    if (tab === "All") return allMsgs
    if (tab === "Customer") return allMsgs.filter((m) => m.role === "customer")
    if (tab === "AI Copilot") return allMsgs.filter((m) => m.role === "ai")
    return allMsgs.filter((m) => m.role === "note")
  }, [tab, allMsgs])

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
          right={
            <span className="text-[11px] font-bold text-[var(--dash-ink-faint)]">
              {listLoading ? "…" : `${conversationList?.length ?? 0} open`}
            </span>
          }
          padded={false}
        >
          <ul>
            {listLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <li key={i} className="flex items-start gap-3 px-4 py-3 border-b dash-border-soft">
                    <div className="skeleton w-8 h-8 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-3.5 w-28 rounded" />
                      <div className="skeleton h-3 w-40 rounded" />
                    </div>
                  </li>
                ))
              : (conversationList ?? []).map((conv) => {
                  const isActive = conv.id === activeId
                  return (
                    <li
                      key={conv.id}
                      onClick={() => setSelectedConversationId(conv.id)}
                      className={`flex items-start gap-3 px-4 py-3 border-b dash-border-soft last:border-b-0 cursor-pointer transition ${
                        isActive ? "bg-[var(--dash-accent-wash)]" : "hover:bg-[rgba(107,92,214,0.04)]"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full dash-bg-deep shrink-0 flex items-center justify-center text-[11px] font-bold text-[var(--dash-ink-soft)]">
                        {conv.id.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[13px] truncate ${isActive ? "font-bold text-[var(--dash-accent-deep)]" : "font-semibold text-[var(--dash-ink)]"}`}>
                            Conv #{conv.id.slice(0, 6)}
                          </span>
                          <span className="ml-auto text-[10.5px] text-[var(--dash-ink-faint)] capitalize">{conv.channel}</span>
                        </div>
                        <div className="text-[12px] text-[var(--dash-ink-soft)] truncate capitalize">{conv.channel}</div>
                      </div>
                    </li>
                  )
                })}
          </ul>
        </DashCard>

        {/* Main conversation panel (center) */}
        <DashCard
          title="Conversation"
          icon={<MessageSquare className="w-[18px] h-[18px]" />}
          right={
            <span className="font-mono text-[11.5px] text-[var(--dash-ink-faint)]">
              #{activeId?.slice(0, 8) ?? "—"}
            </span>
          }
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
                  key={`${m.role}-${i}`}
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
              {filtered.length === 0 && (
                <div className="py-12 text-center text-[13px] text-[var(--dash-ink-faint)]">
                  No messages yet.
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Note composer */}
          <div className="m-4 mt-2 rounded-xl border border-dashed dash-border bg-white">
            <div className="px-3 py-2 text-[11.5px] font-bold text-[var(--dash-ink-soft)]">Internal note</div>
            <input
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
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
              <button
                disabled={!noteText.trim() || !activeId || addMessage.isPending}
                onClick={async () => {
                  if (!activeId || !noteText.trim()) return
                  await addMessage.mutateAsync({ conversationId: activeId, role: "agent", content: noteText })
                  setNoteText("")
                }}
                className="ml-auto text-[11.5px] font-bold text-[var(--dash-ink-soft)] bg-[var(--dash-bg-deep)] hover:bg-[var(--dash-accent)] hover:text-white rounded-md px-2.5 py-1 transition disabled:opacity-50"
              >
                Add Note
              </button>
            </div>
          </div>
        </DashCard>

        {/* Customer context (right) */}
        <DashCard
          title="Conversation details"
          icon={<Sparkles className="w-[18px] h-[18px]" />}
        >
          <div className="space-y-3 text-[12.5px]">
            <ContextRow label="Channel" value={thread?.conversation?.channel ?? "—"} />
            <ContextRow label="Messages" value={String(thread?.messages?.length ?? 0)} />
            <ContextRow label="Conv ID" value={`#${activeId?.slice(0, 8) ?? "—"}`} />
          </div>
        </DashCard>
      </div>
    </div>
  )
}

function MessageBubble({ role, who, text, time, badge, typing }: Msg & { typing?: boolean }) {
  const isAi = role === "ai"
  const isNote = role === "note"
  const isAgent = role === "agent"

  const avatarBg =
    role === "customer" ? "dash-bg-rose-wash text-[#8a3e3e]" :
    isAi                ? "bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]" :
    isNote              ? "bg-[var(--dash-amber-wash)] text-[#8a5a1e]" :
                          "bg-[var(--dash-sage-wash)] text-[#2f5d3f]"

  const bubbleClass =
    role === "customer" ? "bg-[var(--dash-bg)] text-[var(--dash-ink)] border dash-border" :
    isAi                ? "bg-[var(--dash-accent-wash)] text-[#37308a] border border-[#D7CFF2]" :
    isNote              ? "bg-[var(--dash-amber-wash)] text-[#5a3e1c] border border-[#E5D2A8]" :
                          "bg-[var(--dash-sage-wash)] text-[#2f5d3f] border border-[#CBE0CF]"

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-bold ${avatarBg}`}>
          {who.split(" ").map((p) => p[0]).slice(0, 2).join("")}
        </div>
        <span className="text-[12.5px] font-bold text-[var(--dash-ink)]">{who}</span>
        {badge && (
          <span className={`text-[10px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 ${
            isAi ? "bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]" :
            isNote ? "bg-[var(--dash-amber-wash)] text-[#8a5a1e]" :
            isAgent ? "bg-[var(--dash-sage-wash)] text-[#2f5d3f]" :
            "dash-bg-deep text-[var(--dash-ink-soft)]"
          }`}>{badge}</span>
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
      <span className="font-semibold text-[var(--dash-ink)] capitalize">{value}</span>
    </div>
  )
}
