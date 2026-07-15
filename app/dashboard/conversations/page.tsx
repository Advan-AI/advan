"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import {
  MessageSquare,
  Sparkles,
  Send,
  Smile,
  Paperclip,
  Image as ImageIcon,
  AtSign,
  Filter,
  Search,
  Mail,
  MessageCircle,
  Phone,
  Hash,
  Globe,
  Building2,
  Clock,
  XCircle,
  RefreshCw,
  Star,
  AlertCircle,
  Inbox,
  Radio,
  X,
  Loader2,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react"
import * as SocketIO from "socket.io-client"
import { DashPageHeader, DashCard } from "@/components/dashboard/page-header"
import { api } from "@/lib/api/trpc-client"
import { useCopilot } from "@/lib/copilot/store"
import { useCopilotStream } from "@/lib/copilot/use-copilot-stream"

// ─── Socket URL (mirrors use-pipeline-realtime.ts) ────────────────────────────
const DASH_SOCKET_URL =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_SOCKET_URL
    ? (process.env.NEXT_PUBLIC_SOCKET_URL as string)
    : typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:3002`
      : "http://localhost:3002"

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = ["All", "Customer", "AI Copilot", "Agent"] as const
type Tab = (typeof TABS)[number]
type ComposeMode = "reply" | "note"
type DbRole = "user" | "assistant" | "agent"

// Explicit type for the getById thread response (avoids tRPC spread inference issues)
type MsgMeta = {
  citations?: Array<{ source: string; url?: string; confidence: number }>
  confidence?: number
  policyChecks?: Array<{ rule: string; passed: boolean }>
  latencyMs?: number
  model?: string
  isInternal?: boolean
    isAutoTriaged?: boolean
    triageMode?: "kb_answer" | "clarify" | "warn" | "escalate_ack" | "complaint_ack"
  email?: {
    messageId?: string
    inReplyTo?: string
    resendId?: string
    deliveryStatus?: "queued" | "sent" | "delivered" | "failed" | "bounced" | "suppressed"
    error?: string
  }
  triage?: {
    decision:
      | "auto_send"
      | "auto_clarify"
      | "auto_warn"
      | "auto_escalate"
      | "hitl_complaint"
      | "hitl_collaborative"
      | "hitl_low_confidence"
    confidence: number
    isComplaint: boolean
    auditLogId: string
    classifiedAt: string
    chatIntent?: string
  }
}

type DbMessage = {
  id: string
  conversationId: string
  role: "user" | "assistant" | "agent"
  content: string
  metadata: MsgMeta | null
  createdAt: string
}

type ThreadData = {
  id: string
  orgId: string
  ticketId: string
  channel: "email" | "chat" | "voice" | "slack" | "portal"
  customerId: string | null
  createdAt: string
  ticketSubject: string | null
  ticketStatus: "open" | "pending" | "resolved" | "closed" | null
  ticketPriority: "low" | "medium" | "high" | "urgent" | null
  customerName: string | null
  customerEmail: string | null
  customerTier: "free" | "growth" | "enterprise" | null
  customerCompany: string | null
  customerCsatAvg: string | null
  messages: DbMessage[]
}

// ─── Style maps ───────────────────────────────────────────────────────────────

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="w-3 h-3" />,
  chat: <MessageCircle className="w-3 h-3" />,
  voice: <Phone className="w-3 h-3" />,
  slack: <Hash className="w-3 h-3" />,
  portal: <Globe className="w-3 h-3" />,
}

const PRIORITY_STYLES: Record<string, string> = {
  low: "text-[var(--dash-ink-faint)] bg-[var(--dash-bg-deep)]",
  medium: "text-[#92400E] bg-[#FEF3C7]",
  high: "text-[#B45309] bg-[#FFF3E0]",
  urgent: "text-[#991B1B] bg-[#FEE2E2]",
}

const STATUS_STYLES: Record<string, string> = {
  open: "text-[#166534] bg-[#DCFCE7]",
  pending: "text-[#92400E] bg-[#FEF3C7]",
  resolved: "text-[var(--dash-ink-soft)] bg-[var(--dash-bg-deep)]",
  closed: "text-[var(--dash-ink-faint)] bg-[var(--dash-bg-deep)]",
}

const TIER_STYLES: Record<string, string> = {
  free: "text-[var(--dash-ink-soft)] bg-[var(--dash-bg-deep)]",
  growth: "text-[var(--dash-accent-deep)] bg-[var(--dash-accent-wash)]",
  enterprise: "text-[#5B21B6] bg-[#EDE9FE]",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(d: Date | string): string {
  const ms = Date.now() - new Date(d).getTime()
  if (ms < 60_000) return "just now"
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  if (ms < 604_800_000) return `${Math.floor(ms / 86_400_000)}d ago`
  return new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" })
}

function initials(name: string | null | undefined): string {
  if (!name) return "?"
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function fmtTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function threadToConvItem(thread: ThreadData): ConvItem {
  const last = thread.messages.at(-1)
  return {
    id: thread.id,
    orgId: thread.orgId,
    ticketId: thread.ticketId,
    channel: thread.channel,
    customerId: thread.customerId,
    createdAt:
      typeof thread.createdAt === "string"
        ? thread.createdAt
        : new Date(thread.createdAt).toISOString(),
    ticketSubject: thread.ticketSubject,
    ticketStatus: thread.ticketStatus,
    ticketPriority: thread.ticketPriority,
    customerName: thread.customerName,
    customerEmail: thread.customerEmail,
    customerTier: thread.customerTier,
    lastMessage: last
      ? {
          conversationId: thread.id,
          content: last.content,
          role: last.role,
          metadata: last.metadata,
          createdAt:
            typeof last.createdAt === "string"
              ? last.createdAt
              : new Date(last.createdAt).toISOString(),
        }
      : null,
  }
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ConversationsPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const orgId = session?.user?.orgId

  const [tab, setTab] = useState<Tab>("All")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [composeMode, setComposeMode] = useState<ComposeMode>("reply")
  const [text, setText] = useState("")
  const [sendError, setSendError] = useState<string | null>(null)
  const [ticketIdFromUrl, setTicketIdFromUrl] = useState<string | null>(null)
  const [deepLinkResolved, setDeepLinkResolved] = useState(false)

  // ── AI Copilot State ───────────────────────────────────────────────────────
  const [showCopilot, setShowCopilot] = useState(false)
  const [copilotGuidance, setCopilotGuidance] = useState("")
  const { start: startCopilot, stop: stopCopilot } = useCopilotStream()

  const copilotStatus = useCopilot((s) => s.status)
  const copilotDraft = useCopilot((s) => s.draft)
  const copilotConfidence = useCopilot((s) => s.confidence)
  const copilotCitations = useCopilot((s) => s.citations)
  const copilotError = useCopilot((s) => s.error)

  // ── Chat realtime: visitor presence + typing ───────────────────────────────
  /** Set of conversationIds whose visitor widget is currently connected. */
  const [visitorOnline, setVisitorOnline] = useState<Set<string>>(new Set())
  /**
   * conversationId → true when the visitor is actively typing.
   * Driven by visitor:typing:start/stop events from the socket server.
   */
  const [visitorTyping, setVisitorTyping] = useState<Record<string, boolean>>({})

  const dashSocketRef   = useRef<ReturnType<typeof SocketIO.connect> | null>(null)
  const agentTypingRef  = useRef(false)
  const agentTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const deepLinkCreateAttempted = useRef(false)
  const utils = api.useUtils()

  // ── Agent socket connection ────────────────────────────────────────────────
  useEffect(() => {
    if (!orgId) return

    const sock = SocketIO.connect(DASH_SOCKET_URL, {
      auth: { orgId },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 8,
    })
    dashSocketRef.current = sock

    sock.on("visitor:online", (d: { conversationId: string }) => {
      setVisitorOnline((prev) => {
        const next = new Set(prev)
        next.add(d.conversationId)
        return next
      })
    })

    sock.on("visitor:offline", (d: { conversationId: string }) => {
      setVisitorOnline((prev) => {
        const next = new Set(prev)
        next.delete(d.conversationId)
        return next
      })
      // Clear typing indicator when visitor disconnects.
      setVisitorTyping((prev) => {
        if (!prev[d.conversationId]) return prev
        const next = { ...prev }
        delete next[d.conversationId]
        return next
      })
    })

    sock.on("visitor:typing:start", (d: { conversationId: string }) => {
      setVisitorTyping((prev) => ({ ...prev, [d.conversationId]: true }))
    })

    sock.on("visitor:typing:stop", (d: { conversationId: string }) => {
      setVisitorTyping((prev) => {
        if (!prev[d.conversationId]) return prev
        const next = { ...prev }
        delete next[d.conversationId]
        return next
      })
    })

    return () => {
      sock.disconnect()
      dashSocketRef.current = null
    }
  }, [orgId])

  // Deep-link from tickets queue: /dashboard/conversations?ticketId=<uuid>
  useEffect(() => {
    const ticketId = new URLSearchParams(window.location.search).get("ticketId")
    setTicketIdFromUrl(ticketId)
    if (!ticketId) setDeepLinkResolved(true)
  }, [])

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: convListRaw, isLoading: listLoading } = api.conversations.list.useQuery(
    { limit: 50 },
    { refetchInterval: 15_000 }
  )
  const convList = (convListRaw ?? []) as ConvItem[]

  const {
    data: ticketConversation,
    isLoading: ticketConvLoading,
    isFetched: ticketConvFetched,
  } = api.conversations.getByTicketId.useQuery(
    { ticketId: ticketIdFromUrl! },
    { enabled: !!ticketIdFromUrl }
  )

  const shouldFetchTicket =
    !!ticketIdFromUrl &&
    ticketConvFetched &&
    ticketConversation === null

  const { data: linkedTicket, isError: linkedTicketError, isFetched: linkedTicketFetched } =
    api.tickets.getById.useQuery(
      { id: ticketIdFromUrl! },
      { enabled: shouldFetchTicket, retry: false }
    )

  const ensureConversation = api.conversations.create.useMutation({
    onSuccess: (conv) => {
      setSelectedId(conv.id)
      setDeepLinkResolved(true)
      void utils.conversations.list.invalidate()
      void utils.analytics.overview.invalidate()
      router.replace("/dashboard/conversations", { scroll: false })
    },
    onError: () => {
      setDeepLinkResolved(true)
    },
  })

  // Resolve ticket deep-link: select existing thread or create one if missing.
  useEffect(() => {
    if (!ticketIdFromUrl || deepLinkResolved) return
    if (ticketConvLoading) return

    if (ticketConversation?.conversation) {
      setSelectedId(ticketConversation.conversation.id)
      setDeepLinkResolved(true)
      router.replace("/dashboard/conversations", { scroll: false })
      return
    }

    if (
      ticketConversation === null &&
      linkedTicketFetched &&
      (linkedTicketError || !linkedTicket) &&
      !ensureConversation.isPending &&
      !ensureConversation.isSuccess
    ) {
      setDeepLinkResolved(true)
      router.replace("/dashboard/conversations", { scroll: false })
      return
    }

    if (
      ticketConversation === null &&
      linkedTicket &&
      !deepLinkCreateAttempted.current &&
      !ensureConversation.isPending
    ) {
      deepLinkCreateAttempted.current = true
      ensureConversation.mutate({
        ticketId: ticketIdFromUrl,
        channel: linkedTicket.channel,
        customerId: linkedTicket.customerId ?? undefined,
      })
    }
  }, [
    ticketIdFromUrl,
    deepLinkResolved,
    ticketConvLoading,
    ticketConversation,
    linkedTicket,
    linkedTicketError,
    linkedTicketFetched,
    ensureConversation,
    router,
  ])

  // Auto-select first conversation when not arriving from a ticket deep-link.
  useEffect(() => {
    if (!deepLinkResolved) return
    if (convList[0]?.id && !selectedId) {
      setSelectedId(convList[0].id)
    }
  }, [convList, selectedId, deepLinkResolved])

  const activeId = selectedId ?? convList[0]?.id ?? null

  const { data: threadRaw, isLoading: threadLoading } = api.conversations.getById.useQuery(
    { id: activeId! },
    {
      enabled: !!activeId,
      refetchInterval: 10_000,
      refetchIntervalInBackground: false,
    }
  )
  const thread = (threadRaw ?? null) as ThreadData | null

  // Reset copilot state when selected conversation changes
  useEffect(() => {
    stopCopilot()
    useCopilot.getState().reset()
    setShowCopilot(false)
    setCopilotGuidance("")
  }, [activeId, stopCopilot])

  const handleGenerateCopilotDraft = () => {
    if (!thread) return
    const recent = thread.messages
      .slice(-12)
      .map((message) => {
        const speaker = message.role === "user" ? "Customer" : message.role === "agent" ? "Agent" : "AI"
        return `${speaker}: ${message.content}`
      })
      .join("\n")

    const input = [
      "Draft a concise customer-support reply for the selected real conversation.",
      `Ticket: ${thread.ticketSubject ?? thread.id}`,
      `Priority: ${thread.ticketPriority ?? "medium"}`,
      `Channel: ${thread.channel}`,
      `Customer: ${thread.customerName ?? thread.customerEmail ?? "Unknown customer"}`,
      copilotGuidance.trim() ? `Agent guidance: ${copilotGuidance.trim()}` : "Agent guidance: Use the available context and cite sources.",
      "Conversation:",
      recent || "No customer messages yet. Ask one focused clarifying question.",
    ].join("\n")

    startCopilot(input, { ticketId: thread.ticketId, threshold: 85 })
  }

  // ── Mutation with optimistic update ───────────────────────────────────────

  const addMessage = api.conversations.addMessage.useMutation({
    onMutate: async (vars) => {
      setSendError(null)
      if (!activeId) return
      await utils.conversations.getById.cancel({ id: activeId })
      const prev = utils.conversations.getById.getData({ id: activeId })

      utils.conversations.getById.setData({ id: activeId }, (old) => {
        if (!old) return old
        const optimistic = {
          id: `optimistic-${Date.now()}`,
          conversationId: vars.conversationId,
          role: vars.role as DbRole,
          content: vars.content,
          metadata: (
            thread?.channel === "email" &&
            vars.role === "agent" &&
            !vars.metadata?.isInternal
              ? { ...(vars.metadata ?? {}), email: { deliveryStatus: "queued" } }
              : vars.metadata ?? null
          ) as MsgMeta | null,
          createdAt: new Date().toISOString(),
        }
        return {
          ...(old as unknown as ThreadData),
          messages: [...(old as unknown as ThreadData).messages, optimistic],
        } as typeof old
      })
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev && activeId) {
        utils.conversations.getById.setData({ id: activeId }, ctx.prev)
      }
      setSendError("Failed to send. Please try again.")
    },
    onSettled: () => {
      if (activeId) {
        utils.conversations.getById.invalidate({ id: activeId })
        utils.conversations.list.invalidate()
        utils.analytics.overview.invalidate()
      }
    },
  })

  const retryAgentReply = api.conversations.retryAgentReply.useMutation({
    onMutate: async ({ messageId }) => {
      setSendError(null)
      if (!activeId) return
      await utils.conversations.getById.cancel({ id: activeId })
      const prev = utils.conversations.getById.getData({ id: activeId })

      utils.conversations.getById.setData({ id: activeId }, (old) => {
        if (!old) return old
        const current = old as unknown as ThreadData
        return {
          ...current,
          messages: current.messages.map((message) => {
            if (message.id !== messageId) return message
            const { error: _oldError, ...email } = message.metadata?.email ?? {}
            return {
              ...message,
              metadata: {
                ...(message.metadata ?? {}),
                email: {
                  ...email,
                  deliveryStatus: "queued",
                },
              },
            }
          }),
        } as typeof old
      })

      return { prev }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev && activeId) {
        utils.conversations.getById.setData({ id: activeId }, ctx.prev)
      }
      setSendError(err.message || "Retry failed. Please try again.")
    },
    onSettled: () => {
      if (activeId) {
        void utils.conversations.getById.invalidate({ id: activeId })
        void utils.conversations.list.invalidate()
      }
    },
  })

  // ── Derived state ──────────────────────────────────────────────────────────

  const allMsgs: DbMessage[] = thread?.messages ?? []

  const filteredMsgs = useMemo(() => {
    if (tab === "All") return allMsgs
    if (tab === "Customer") return allMsgs.filter((m) => m.role === "user")
    if (tab === "AI Copilot") return allMsgs.filter((m) => m.role === "assistant")
    return allMsgs.filter((m) => m.role === "agent")
  }, [tab, allMsgs])

  const tabCounts = useMemo(
    () => ({
      All: allMsgs.length,
      Customer: allMsgs.filter((m) => m.role === "user").length,
      "AI Copilot": allMsgs.filter((m) => m.role === "assistant").length,
      Agent: allMsgs.filter((m) => m.role === "agent").length,
    }),
    [allMsgs]
  )

  const inboxList = useMemo(() => {
    if (!selectedId || convList.some((c) => c.id === selectedId)) return convList
    if (thread?.id === selectedId) return [threadToConvItem(thread), ...convList]
    return convList
  }, [convList, selectedId, thread])

  const filteredConvs = useMemo(() => {
    if (!search.trim()) return inboxList
    const q = search.toLowerCase()
    return inboxList.filter(
      (c) =>
        c.customerName?.toLowerCase().includes(q) ||
        c.ticketSubject?.toLowerCase().includes(q) ||
        c.lastMessage?.content?.toLowerCase().includes(q) ||
        c.channel.includes(q)
    )
  }, [inboxList, search])

  const inboxLoading =
    listLoading || (!!ticketIdFromUrl && !deepLinkResolved)

  // ── Auto-scroll on new messages ────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [filteredMsgs.length])

  // ── Agent typing signals (chat channel only) ──────────────────────────────

  const emitAgentTypingStart = useCallback(() => {
    if (!activeId || !dashSocketRef.current || thread?.channel !== "chat") return
    if (!agentTypingRef.current) {
      dashSocketRef.current.emit("agent:typing:start", { conversationId: activeId })
      agentTypingRef.current = true
    }
    // Reset debounce timer.
    if (agentTypingTimer.current) clearTimeout(agentTypingTimer.current)
    agentTypingTimer.current = setTimeout(() => {
      if (dashSocketRef.current && activeId) {
        dashSocketRef.current.emit("agent:typing:stop", { conversationId: activeId })
      }
      agentTypingRef.current = false
      agentTypingTimer.current = null
    }, 1500)
  }, [activeId, thread?.channel])

  const emitAgentTypingStop = useCallback(() => {
    if (!activeId || !dashSocketRef.current) return
    if (agentTypingRef.current) {
      dashSocketRef.current.emit("agent:typing:stop", { conversationId: activeId })
      agentTypingRef.current = false
    }
    if (agentTypingTimer.current) {
      clearTimeout(agentTypingTimer.current)
      agentTypingTimer.current = null
    }
  }, [activeId])

  // Reset typing state when the active conversation changes.
  useEffect(() => {
    agentTypingRef.current = false
    if (agentTypingTimer.current) {
      clearTimeout(agentTypingTimer.current)
      agentTypingTimer.current = null
    }
  }, [activeId])

  // ── Compose handlers ───────────────────────────────────────────────────────

  const handleTextInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
    // Emit typing signal for chat conversations.
    emitAgentTypingStart()
  }, [emitAgentTypingStart])

  const handleSend = useCallback(async () => {
    if (!text.trim() || !activeId || addMessage.isPending) return
    const content = text.trim()
    // Stop typing signal before send (visitor should see the message, not dots).
    emitAgentTypingStop()
    setText("")
    if (textareaRef.current) textareaRef.current.style.height = "auto"

    await addMessage.mutateAsync({
      conversationId: activeId,
      role: "agent",
      content,
      metadata: composeMode === "note" ? { isInternal: true } : undefined,
    })
  }, [text, activeId, addMessage, composeMode, emitAgentTypingStop])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Keyframes for typing dot animation */}
      <style>{`
        @keyframes dash-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%            { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
      <DashPageHeader
        eyebrow="Inbox"
        title="Conversations"
        subtitle="One thread, every channel. AI drafts, agents approve, customers stay in the loop."
        actions={
          <>
            <button className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border dash-border bg-[var(--dash-card)] text-[13px] font-semibold text-[var(--dash-ink-soft)] hover:dash-shadow-sm transition">
              <Filter className="w-4 h-4" /> Filters
            </button>
            <button
              onClick={() => setShowCopilot((prev) => !prev)}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-white bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] hover:-translate-y-px transition"
            >
              <Sparkles className="w-4 h-4" /> Ask Copilot
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr_290px] gap-4 items-start">
        {/* ── Left: Conversation list ── */}
        <ConversationList
          convs={filteredConvs}
          activeId={activeId}
          loading={inboxLoading}
          search={search}
          onSearch={setSearch}
          onSelect={(id) => {
            setSelectedId(id)
            setTab("All")
          }}
        />

        {/* ── Center: Message thread ── */}
        <DashCard
          title={
            thread?.customerName ??
            thread?.ticketSubject?.slice(0, 40) ??
            "Conversation"
          }
          icon={<MessageSquare className="w-[18px] h-[18px]" />}
          right={
            <div className="flex items-center gap-2">
              {/* Visitor online badge — only shown for chat conversations */}
              {thread?.channel === "chat" && activeId && (
                <span
                  title={visitorOnline.has(activeId) ? "Visitor is online" : "Visitor is offline"}
                  className={[
                    "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full",
                    visitorOnline.has(activeId)
                      ? "bg-[#DCFCE7] text-[#166534]"
                      : "bg-[var(--dash-bg-deep)] text-[var(--dash-ink-faint)]",
                  ].join(" ")}
                >
                  <Radio className="w-2.5 h-2.5" />
                  {visitorOnline.has(activeId) ? "Visitor online" : "Visitor offline"}
                </span>
              )}
              <span className="font-mono text-[11px] text-[var(--dash-ink-faint)]">
                #{activeId?.slice(0, 8) ?? "—"}
              </span>
            </div>
          }
          padded={false}
        >
          {!activeId ? (
            <EmptySelect />
          ) : (
            <>
              {/* Tabs */}
              <div className="flex items-center gap-0.5 px-4 py-2.5 border-b dash-border-soft overflow-x-auto">
                {TABS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1.5 rounded-md whitespace-nowrap transition ${
                      tab === t
                        ? "bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]"
                        : "text-[var(--dash-ink-faint)] hover:text-[var(--dash-ink-soft)] hover:bg-[var(--dash-bg-deep)]"
                    }`}
                  >
                    {t}
                    {tabCounts[t] > 0 && (
                      <span
                        className={`text-[10px] font-bold px-1 py-0.5 rounded ${
                          tab === t
                            ? "bg-[var(--dash-accent)] text-white"
                            : "bg-[var(--dash-bg-deep)] text-[var(--dash-ink-faint)]"
                        }`}
                      >
                        {tabCounts[t]}
                      </span>
                    )}
                  </button>
                ))}
                <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--dash-sage)] dash-bg-sage-wash rounded-full px-2.5 py-0.5 shrink-0">
                  <span className="w-[5px] h-[5px] rounded-full bg-[var(--dash-sage)] animate-pulse" />
                  Live
                </span>
              </div>

              {/* Messages */}
              <div className="px-4 py-4 flex flex-col gap-4 overflow-y-auto max-h-[420px] min-h-[200px]">
                {threadLoading ? (
                  <ThreadSkeleton />
                ) : filteredMsgs.length === 0 ? (
                  <div className="py-12 text-center">
                    <MessageSquare className="w-8 h-8 mx-auto text-[var(--dash-ink-faint)] mb-2 opacity-30" />
                    <p className="text-[13px] text-[var(--dash-ink-faint)]">No messages in this view.</p>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {filteredMsgs.map((m, i) => (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.25,
                          delay: Math.min(i * 0.04, 0.32),
                        }}
                      >
                        <MessageBubble
                          role={m.role}
                          content={m.content}
                          createdAt={m.createdAt}
                          metadata={m.metadata}
                          channel={thread?.channel ?? "chat"}
                          onRetry={() => retryAgentReply.mutate({ messageId: m.id })}
                          isRetrying={retryAgentReply.variables?.messageId === m.id && retryAgentReply.isPending}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}

                {/* Visitor typing indicator — shown only for chat conversations */}
                <AnimatePresence>
                  {thread?.channel === "chat" && activeId && visitorTyping[activeId] && (
                    <motion.div
                      key="visitor-typing"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.18 }}
                      className="flex items-start gap-2"
                    >
                      <div className="w-[22px] h-[22px] rounded-full bg-[#FEE2E2] text-[#991B1B] flex items-center justify-center text-[9.5px] font-bold shrink-0">
                        {initials(thread?.customerName ?? null)}
                      </div>
                      <div className="bg-[var(--dash-bg)] border dash-border rounded-xl rounded-tl-sm px-3 py-2.5 flex items-center gap-1">
                        <TypingDot delay="0ms" />
                        <TypingDot delay="180ms" />
                        <TypingDot delay="360ms" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div ref={bottomRef} />
              </div>

              {/* Inline AI Copilot Assistant */}
              <AnimatePresence>
                {showCopilot && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-b dash-border-soft bg-[linear-gradient(180deg,#fff,rgba(107,92,214,0.02))] p-3"
                  >
                    <div className="rounded-xl border border-[#D7CFF2] bg-white p-3.5 shadow-[0_4px_24px_rgba(107,92,214,0.06)]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[12px] font-bold text-[var(--dash-accent-deep)] flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-[var(--dash-accent)] animate-pulse" />
                          AI Copilot Assistant
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCopilot(false)
                            stopCopilot()
                            useCopilot.getState().reset()
                          }}
                          className="text-[var(--dash-ink-faint)] hover:text-[var(--dash-ink)] transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="text"
                          value={copilotGuidance}
                          onChange={(e) => setCopilotGuidance(e.target.value)}
                          placeholder="Instructions (e.g. explain refund process, apologize for delay)..."
                          className="flex-1 h-9 px-3 rounded-lg border dash-border bg-[var(--dash-bg)] text-[12px] text-[var(--dash-ink)] placeholder:text-[var(--dash-ink-faint)] outline-none focus:border-[var(--dash-accent)] focus:bg-white focus:shadow-[0_0_0_2px_var(--dash-accent-wash)] transition-all"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              handleGenerateCopilotDraft()
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleGenerateCopilotDraft}
                          disabled={copilotStatus === "streaming" || copilotStatus === "grounding"}
                          className="h-9 px-3.5 rounded-lg text-[12px] font-bold text-white bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] shadow-[0_4px_14px_-4px_rgba(107,92,214,0.5)] hover:opacity-95 transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-60"
                        >
                          {copilotStatus === "streaming" || copilotStatus === "grounding" ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          {copilotStatus === "streaming" || copilotStatus === "grounding"
                            ? "Drafting..."
                            : copilotDraft
                            ? "Regenerate"
                            : "Generate Reply"}
                        </button>
                      </div>

                      {/* Output Draft */}
                      {(copilotDraft || copilotStatus === "streaming" || copilotStatus === "grounding" || copilotError) && (
                        <div className="mt-3 p-3.5 rounded-xl border border-dashed border-[#D7CFF2] bg-[var(--dash-accent-wash)]/20">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-[var(--dash-accent-deep)]">
                              Suggested Draft
                            </span>
                            {copilotConfidence !== null && (
                              <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 border ${
                                copilotConfidence >= 85
                                  ? "bg-[#DCFCE7] text-[#166534] border-[#CBE0CF]"
                                  : copilotConfidence >= 70
                                  ? "bg-[#FEF3C7] text-[#92400E] border-[#E5D2A8]"
                                  : "bg-[#FEE2E2] text-[#991B1B] border-[#E5C5C3]"
                              }`}>
                                {copilotConfidence}% Confidence
                              </span>
                            )}
                          </div>

                          {copilotError ? (
                            <p className="text-[12px] text-[var(--dash-rose)]">{copilotError}</p>
                          ) : (
                            <p className="text-[13px] leading-[1.65] text-[var(--dash-ink-soft)] whitespace-pre-wrap select-text">
                              {copilotDraft}
                              {(copilotStatus === "streaming" || copilotStatus === "grounding") && (
                                <span className="inline-block w-1.5 h-3.5 bg-[var(--dash-accent)] ml-1 animate-pulse align-middle" />
                              )}
                            </p>
                          )}

                          {/* Citations */}
                          {copilotCitations.length > 0 && (
                            <div className="mt-3.5 pt-2 border-t border-[var(--dash-accent)]/10 flex flex-wrap gap-1.5 items-center">
                              <span className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)] mr-1">
                                Sourced Citations:
                              </span>
                               {copilotCitations.map((cit, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 text-[9.5px] font-semibold px-2 py-0.5 rounded-md bg-white text-[var(--dash-accent-deep)] border border-[#D7CFF2] shadow-sm"
                                >
                                  <span className="w-1 h-1 rounded-full bg-[var(--dash-accent)] shrink-0" />
                                  {cit.title || cit.sourceId}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Action Buttons */}
                          {copilotStatus === "ready" && (
                            <div className="mt-4 flex items-center justify-end gap-2 border-t border-[var(--dash-accent)]/10 pt-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setText(copilotDraft)
                                  setComposeMode("reply")
                                  // Update height of text area automatically
                                  setTimeout(() => {
                                    if (textareaRef.current) {
                                      textareaRef.current.style.height = "auto"
                                      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
                                    }
                                  }, 0)
                                }}
                                className="h-8 px-3 rounded-lg text-[11.5px] font-bold text-white bg-[var(--dash-accent)] hover:opacity-95 transition-all flex items-center gap-1"
                              >
                                <Send className="w-3.5 h-3.5" />
                                Use as Reply
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setText(copilotDraft)
                                  setComposeMode("note")
                                  setTimeout(() => {
                                    if (textareaRef.current) {
                                      textareaRef.current.style.height = "auto"
                                      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
                                    }
                                  }, 0)
                                }}
                                className="h-8 px-3 rounded-lg text-[11.5px] font-bold text-[#92400E] bg-[#FEF3C7] border border-[#FDE68A] hover:bg-[#FDE68A] transition-all flex items-center gap-1"
                              >
                                📌 Use as Note
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  useCopilot.getState().reset()
                                }}
                                className="h-8 px-2.5 rounded-lg text-[11.5px] font-semibold text-[var(--dash-ink-soft)] hover:bg-[var(--dash-bg-deep)] transition-all"
                              >
                                Clear
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Composer */}
              <Composer
                mode={composeMode}
                onModeChange={setComposeMode}
                text={text}
                onTextChange={handleTextInput}
                onKeyDown={handleKeyDown}
                onSend={handleSend}
                textareaRef={textareaRef}
                isPending={addMessage.isPending}
                error={sendError}
                onDismissError={() => setSendError(null)}
                channel={thread?.channel ?? null}
                destinationEmail={thread?.customerEmail ?? null}
                showCopilot={showCopilot}
                onToggleCopilot={() => setShowCopilot((prev) => !prev)}
              />
            </>
          )}
        </DashCard>

        {/* ── Right: Details ── */}
        <DetailsPanel thread={thread ?? null} loading={!!activeId && threadLoading} />
      </div>
    </div>
  )
}

// ─── ConversationList ─────────────────────────────────────────────────────────

type ConvItem = {
  id: string
  orgId: string
  ticketId: string
  channel: "email" | "chat" | "voice" | "slack" | "portal"
  customerId: string | null
  createdAt: string
  ticketSubject: string | null
  ticketStatus: "open" | "pending" | "resolved" | "closed" | null
  ticketPriority: "low" | "medium" | "high" | "urgent" | null
  customerName: string | null
  customerEmail: string | null
  customerTier: "free" | "growth" | "enterprise" | null
  lastMessage: {
    conversationId: string
    content: string
    role: "user" | "assistant" | "agent"
    /** Included since prompt 6 — needed for triage badge rendering. */
    metadata: MsgMeta | null | undefined
    createdAt: string
  } | null
}

function ConversationList({
  convs,
  activeId,
  loading,
  search,
  onSearch,
  onSelect,
}: {
  convs: ConvItem[]
  activeId: string | null
  loading: boolean
  search: string
  onSearch: (s: string) => void
  onSelect: (id: string) => void
}) {
  return (
    <DashCard
      title="Inbox"
      icon={<Inbox className="w-[18px] h-[18px]" />}
      right={
        !loading ? (
          <span className="text-[11px] font-bold text-[var(--dash-ink-faint)]">
            {convs.length}
          </span>
        ) : undefined
      }
      padded={false}
    >
      {/* Search bar */}
      <div className="px-3 py-2.5 border-b dash-border-soft">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--dash-ink-faint)] pointer-events-none" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search conversations…"
            className="w-full pl-8 pr-7 py-1.5 bg-[var(--dash-bg-deep)] rounded-lg text-[12px] outline-none text-[var(--dash-ink)] placeholder:text-[var(--dash-ink-faint)] focus:ring-1 focus:ring-[var(--dash-accent)] transition"
          />
          {search && (
            <button
              onClick={() => onSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--dash-ink-faint)] hover:text-[var(--dash-ink-soft)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <ul className="overflow-y-auto max-h-[600px]">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <li
              key={i}
              className="flex items-start gap-3 px-4 py-3.5 border-b dash-border-soft"
            >
              <div className="skeleton w-9 h-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-2 pt-0.5">
                <div className="skeleton h-3.5 w-28 rounded" />
                <div className="skeleton h-3 w-44 rounded" />
                <div className="skeleton h-2.5 w-32 rounded" />
              </div>
            </li>
          ))
        ) : convs.length === 0 ? (
          <li className="py-14 text-center px-4">
            <MessageSquare className="w-8 h-8 mx-auto text-[var(--dash-ink-faint)] mb-2.5 opacity-30" />
            <p className="text-[12.5px] font-semibold text-[var(--dash-ink-soft)] mb-1">
              {search ? "No results found" : "No conversations yet"}
            </p>
            <p className="text-[11.5px] text-[var(--dash-ink-faint)]">
              {search
                ? "Try a different search term."
                : "Conversations appear here when tickets are opened."}
            </p>
          </li>
        ) : (
          convs.map((conv) => {
            const isActive = conv.id === activeId
            const name = conv.customerName ?? `Conv #${conv.id.slice(0, 6)}`
            const previewRole = conv.lastMessage?.role
            const previewPrefix =
              previewRole === "assistant"
                ? "AI: "
                : previewRole === "agent"
                ? "Agent: "
                : ""

            return (
              <li
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`relative flex items-start gap-3 px-4 py-3.5 border-b dash-border-soft last:border-b-0 cursor-pointer transition-colors ${
                  isActive
                    ? "bg-[var(--dash-accent-wash)]"
                    : "hover:bg-[rgba(107,92,214,0.04)]"
                }`}
              >
                {/* Active indicator strip */}
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[var(--dash-accent)]" />
                )}

                {/* Avatar */}
                <div
                  className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold ${
                    isActive
                      ? "bg-[var(--dash-accent)] text-white"
                      : "dash-bg-deep text-[var(--dash-ink-soft)]"
                  }`}
                >
                  {initials(name)}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5 mb-0.5">
                    <span
                      className={`text-[13px] font-semibold truncate flex-1 ${
                        isActive
                          ? "text-[var(--dash-accent-deep)]"
                          : "text-[var(--dash-ink)]"
                      }`}
                    >
                      {name}
                    </span>
                    {conv.lastMessage && (
                      <span className="text-[10px] text-[var(--dash-ink-faint)] shrink-0">
                        {relativeTime(conv.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  {conv.ticketSubject && (
                    <div className="text-[11.5px] text-[var(--dash-ink-soft)] truncate mb-0.5">
                      {conv.ticketSubject}
                    </div>
                  )}
                  {conv.lastMessage && (
                    <div className="text-[11px] text-[var(--dash-ink-faint)] truncate mb-1.5">
                      {previewPrefix}
                      {conv.lastMessage.content}
                    </div>
                  )}
                  {/* Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                        isActive
                          ? "text-[var(--dash-accent-deep)] bg-white/50"
                          : "text-[var(--dash-ink-faint)] bg-[var(--dash-bg-deep)]"
                      }`}
                    >
                      {CHANNEL_ICONS[conv.channel]}
                      {conv.channel}
                    </span>
                    {conv.ticketPriority &&
                      ["urgent", "high"].includes(conv.ticketPriority) && (
                        <span
                          className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-md capitalize ${PRIORITY_STYLES[conv.ticketPriority]}`}
                        >
                          {conv.ticketPriority}
                        </span>
                      )}
                    {conv.ticketStatus && (
                      <span
                        className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-md capitalize ${STATUS_STYLES[conv.ticketStatus]}`}
                      >
                        {conv.ticketStatus}
                      </span>
                    )}
                    {(() => {
                      const lm = conv.lastMessage
                      if (!lm) return null
                      const meta = lm.metadata
                      if (lm.role === "user" && meta?.triage?.decision === "hitl_complaint") {
                        return (
                          <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold px-1.5 py-0.5 rounded-md text-[var(--dash-rose)] bg-[var(--dash-rose-wash)]">
                            <AlertCircle className="h-2.5 w-2.5" />
                            Complaint · Review
                          </span>
                        )
                      }
                      if (
                        lm.role === "user" &&
                        (meta?.triage?.decision === "hitl_collaborative" ||
                          meta?.triage?.decision === "auto_escalate")
                      ) {
                        return (
                          <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold px-1.5 py-0.5 rounded-md text-[var(--dash-rose)] bg-[var(--dash-rose-wash)]">
                            <AlertCircle className="h-2.5 w-2.5" />
                            Human Joining
                          </span>
                        )
                      }
                      if (lm.role === "user" && meta?.triage?.decision === "hitl_low_confidence") {
                        return (
                          <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md text-[#92400E] bg-[#FEF3C7]">
                            Pending Review
                          </span>
                        )
                      }
                      if (lm.role === "agent" && meta?.isAutoTriaged) {
                        const modeLabel =
                          meta.triageMode === "clarify"
                            ? "AI Clarifying"
                            : meta.triageMode === "warn"
                              ? "AI Redirected"
                              : meta.triageMode === "escalate_ack" || meta.triageMode === "complaint_ack"
                                ? "AI + Human"
                                : "AI Replied"
                        return (
                          <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold px-1.5 py-0.5 rounded-md text-[#166534] bg-[#DCFCE7]">
                            <Sparkles className="h-2.5 w-2.5" />
                            {modeLabel}
                          </span>
                        )
                      }
                      return null
                    })()}
                  </div>
                </div>
              </li>
            )
          })
        )}
      </ul>
    </DashCard>
  )
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

function MessageBubble({
  role,
  content,
  createdAt,
  metadata,
  channel,
  onRetry,
  isRetrying,
}: {
  role: DbRole
  content: string
  createdAt: Date | string
  metadata: MsgMeta | null
  channel: ThreadData["channel"]
  onRetry: () => void
  isRetrying: boolean
}) {
  const isCustomer = role === "user"
  const isAi = role === "assistant"
  const isNote = role === "agent" && metadata?.isInternal === true
  const isAgentReply = role === "agent" && !metadata?.isInternal

  const who = isCustomer
    ? "Customer"
    : isAi
    ? "AI Copilot"
    : isNote
    ? "Agent Note"
    : "Agent"

  const avatarClass = isCustomer
    ? "bg-[#FEE2E2] text-[#991B1B]"
    : isAi
    ? "bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]"
    : isNote
    ? "bg-[#FEF3C7] text-[#92400E]"
    : "bg-[#DCFCE7] text-[#166534]"

  const bubbleClass = isCustomer
    ? "bg-[var(--dash-bg)] border dash-border text-[var(--dash-ink)] rounded-tl-sm"
    : isAi
    ? "bg-[var(--dash-accent-wash)] border border-[#D7CFF2] text-[#37308a] rounded-tl-sm"
    : isNote
    ? "bg-[#FEFCE8] border border-[#FDE68A] text-[#713F12] rounded-tr-sm"
    : "bg-[#F0FDF4] border border-[#BBF7D0] text-[#14532D] rounded-tr-sm"

  const isRight = isAgentReply || isNote
  const deliveryStatus =
    channel === "email" && isAgentReply ? metadata?.email?.deliveryStatus : undefined

  const badge = isAi
    ? "AI Draft"
    : isNote
    ? "Internal"
    : null

  return (
    <div className={`flex flex-col gap-1.5 ${isRight ? "items-end" : "items-start"}`}>
      <div className={`flex items-center gap-1.5 ${isRight ? "flex-row-reverse" : ""}`}>
        <div
          className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[9.5px] font-bold shrink-0 ${avatarClass}`}
        >
          {who
            .split(" ")
            .map((p) => p[0])
            .slice(0, 2)
            .join("")}
        </div>
        <span className="text-[12px] font-bold text-[var(--dash-ink)]">{who}</span>
        {badge && (
          <span
            className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
              isAi
                ? "bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]"
                : "bg-[#FEF3C7] text-[#92400E]"
            }`}
          >
            {badge}
          </span>
        )}
        {metadata?.confidence && (
          <span className="text-[9px] text-[var(--dash-ink-faint)] font-mono">
            {metadata.confidence}% conf
          </span>
        )}
        <span className="text-[10px] text-[var(--dash-ink-faint)]">
          {fmtTime(createdAt)}
        </span>
      </div>

      <div
        className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-[13px] leading-[1.6] whitespace-pre-wrap ${bubbleClass}`}
      >
        {content}

        {/* Citation pills */}
        {metadata?.citations && metadata.citations.length > 0 && (
          <div className="mt-2 pt-2 border-t border-[var(--dash-accent)]/20 flex flex-wrap gap-1">
            {metadata.citations.map((c, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-[9.5px] font-medium px-1.5 py-0.5 rounded bg-white/60 text-[var(--dash-accent-deep)]"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--dash-accent)] opacity-60 shrink-0" />
                {c.source}
              </span>
            ))}
          </div>
        )}
      </div>

      {deliveryStatus && (
        <DeliveryStatusPill
          status={deliveryStatus}
          error={metadata?.email?.error}
          onRetry={onRetry}
          isRetrying={isRetrying}
        />
      )}
    </div>
  )
}

function DeliveryStatusPill({
  status,
  error,
  onRetry,
  isRetrying,
}: {
  status: NonNullable<MsgMeta["email"]>["deliveryStatus"]
  error?: string
  onRetry: () => void
  isRetrying: boolean
}) {
  // Success is the implied default — silence it so the thread stays clean.
  if (status === "sent" || status === "delivered") return null

  // In-flight: a single muted line beneath the bubble, no border/badge weight.
  if (status === "queued") {
    return (
      <span className="flex items-center gap-1 text-[10px] text-[var(--dash-ink-faint)] select-none">
        <Clock className="w-2.5 h-2.5 animate-pulse shrink-0" aria-hidden="true" />
        Sending…
      </span>
    )
  }

  // Failure states — these are actionable and need to be visible.
  const canRetry = status === "failed"
  const label =
    status === "bounced" ? "Bounced" : status === "suppressed" ? "Suppressed" : "Failed"

  return (
    <div
      className={`flex items-center gap-1.5 text-[10.5px] font-bold rounded-full border px-2 py-1 ${
        status === "suppressed"
          ? "border-[#6B21A8] bg-[#FAF5FF] text-[#581C87] ring-1 ring-[#6B21A8]/20"
          : "border-[#991B1B] bg-[#FEF2F2] text-[#7F1D1D] ring-1 ring-[#991B1B]/20"
      }`}
      title={error}
    >
      <XCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
      <span>{label}</span>
      <span className="text-[9px] uppercase tracking-wide px-1 py-px rounded bg-white/80 border border-current/20">
        {canRetry ? "Action needed" : "Channel blocked"}
      </span>
      {canRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="inline-flex items-center gap-1 ml-0.5 px-1.5 py-0.5 rounded-full bg-white border border-current/30 hover:bg-[#FEE2E2] disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          <RefreshCw className={`w-2.5 h-2.5 ${isRetrying ? "animate-spin" : ""}`} />
          Retry
        </button>
      )}
    </div>
  )
}

// ─── Composer ─────────────────────────────────────────────────────────────────

function Composer({
  mode,
  onModeChange,
  text,
  onTextChange,
  onKeyDown,
  onSend,
  textareaRef,
  isPending,
  error,
  onDismissError,
  channel,
  destinationEmail,
  showCopilot = false,
  onToggleCopilot,
}: {
  mode: ComposeMode
  onModeChange: (m: ComposeMode) => void
  text: string
  onTextChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onSend: () => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  isPending: boolean
  error: string | null
  onDismissError: () => void
  channel: ThreadData["channel"] | null
  destinationEmail: string | null
  showCopilot?: boolean
  onToggleCopilot?: () => void
}) {
  const isNote = mode === "note"
  const showEmailDestination = channel === "email" && mode === "reply"

  return (
    <div
      className={`mx-3 mb-3 mt-1 rounded-xl border overflow-hidden bg-white transition-colors ${
        isNote ? "border-[#FCD34D]" : "dash-border"
      }`}
    >
      {/* Mode toggle */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--dash-bg-deep)]">
        {(["reply", "note"] as const).map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-md transition ${
              mode === m
                ? m === "note"
                  ? "bg-[#FEF3C7] text-[#92400E]"
                  : "bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]"
                : "text-[var(--dash-ink-faint)] hover:text-[var(--dash-ink-soft)] hover:bg-[var(--dash-bg-deep)]"
            }`}
          >
            {m === "reply" ? "↩ Reply to Customer" : "📌 Internal Note"}
          </button>
        ))}
        <span className="ml-auto text-[9.5px] text-[var(--dash-ink-faint)]">
          ⌘↵ to send
        </span>
      </div>

      {showEmailDestination && (
        <div className="px-3 py-1.5 border-b border-[var(--dash-bg-deep)] text-[11px] text-[var(--dash-ink-soft)]">
          Sending email to{" "}
          <span className="font-semibold text-[var(--dash-ink)]">
            {destinationEmail || "No customer email on file"}
          </span>
        </div>
      )}

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#FEE2E2] text-[#991B1B] text-[11px] font-medium"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {error}
            <button
              onClick={onDismissError}
              className="ml-auto hover:opacity-70 transition"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={onTextChange}
        onKeyDown={onKeyDown}
        placeholder={
          isNote
            ? "Add a private note visible only to your team…"
            : "Type a reply to the customer…"
        }
        rows={2}
        className="w-full bg-transparent resize-none outline-none px-3.5 py-2.5 text-[13px] text-[var(--dash-ink)] placeholder:text-[var(--dash-ink-faint)] leading-[1.55]"
        style={{ maxHeight: 160 }}
      />

      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-t border-[var(--dash-bg-deep)]">
        {[Paperclip, ImageIcon, Smile, AtSign].map((Icon, i) => (
          <button
            key={i}
            title="Coming soon"
            className="text-[var(--dash-ink-faint)] hover:text-[var(--dash-accent)] transition p-0.5 rounded"
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        ))}

        {onToggleCopilot && (
          <>
            <div className="h-4 w-px bg-slate-200 mx-1 shrink-0" />
            <button
              type="button"
              onClick={onToggleCopilot}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition shrink-0 ${
                showCopilot
                  ? "bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]"
                  : "text-[var(--dash-ink-faint)] hover:text-[var(--dash-accent)] hover:bg-[var(--dash-bg-deep)]"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[var(--dash-accent)] animate-pulse" />
              Ask Copilot
            </button>
          </>
        )}
        <button
          disabled={!text.trim() || isPending}
          onClick={onSend}
          className={`ml-auto flex items-center gap-1.5 text-[11.5px] font-bold px-3 py-1.5 rounded-lg transition-all ${
            text.trim() && !isPending
              ? isNote
                ? "bg-[#FEF3C7] text-[#92400E] hover:bg-[#FDE68A]"
                : "bg-[var(--dash-accent)] text-white shadow-[0_4px_14px_-4px_rgba(107,92,214,0.5)] hover:opacity-90"
              : "bg-[var(--dash-bg-deep)] text-[var(--dash-ink-faint)] cursor-not-allowed"
          }`}
        >
          {isPending ? (
            <span className="animate-pulse">Sending…</span>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              {isNote ? "Add Note" : "Send Reply"}
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function ConfidenceRing({ value, provisional }: { value: number; provisional: boolean }) {
  const reduce = useReducedMotion()
  const R = 28
  const circ = 2 * Math.PI * R
  const offset = circ - (value / 100) * circ
  const color = value >= 85 ? ["#76B98C", "#4A8A60"] : value >= 70 ? ["#E5A84F", "#B07A2A"] : ["#E58080", "#A04040"]

  return (
    <div
      className="relative w-[66px] h-[66px] shrink-0"
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`AI confidence ${value} percent${provisional ? " provisional" : ""}`}
    >
      <svg width={66} height={66} viewBox="0 0 66 66" className="-rotate-90">
        <defs>
          <linearGradient id="copilot-ring-conversations" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={color[0]} />
            <stop offset="1" stopColor={color[1]} />
          </linearGradient>
        </defs>
        <circle cx="33" cy="33" r={R} stroke="var(--dash-line)" strokeWidth="7" fill="none" />
        <motion.circle
          cx="33" cy="33" r={R}
          stroke="url(#copilot-ring-conversations)" strokeWidth="7" fill="none" strokeLinecap="round"
          strokeDasharray={circ}
          initial={false}
          animate={{ strokeDashoffset: offset, opacity: provisional ? 0.55 : 1 }}
          transition={reduce ? { duration: 0 } : { duration: 0.9, ease: [0.34, 1.2, 0.64, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[15px] font-extrabold text-[var(--dash-ink)]">
        {value}%
      </div>
    </div>
  )
}

// ─── DetailsPanel ─────────────────────────────────────────────────────────────

function DetailsPanel({
  thread,
  loading,
}: {
  thread: ThreadData | null
  loading: boolean
}) {
  const confidence = useCopilot((s) => s.confidence)
  const stage = useCopilot((s) => s.confidenceStage)
  const status = useCopilot((s) => s.status)
  const citations = useCopilot((s) => s.citations)
  const hitl = useCopilot((s) => s.hitl)
  const latencyMs = useCopilot((s) => s.latencyMs)

  return (
    <DashCard
      title="Details"
      icon={<Sparkles className="w-[18px] h-[18px]" />}
      padded={false}
    >
      {loading ? (
        <div className="p-4 space-y-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex justify-between items-center">
              <div className="skeleton h-3 w-16 rounded" />
              <div className="skeleton h-3 w-24 rounded" />
            </div>
          ))}
        </div>
      ) : !thread ? (
        <div className="py-12 px-4 text-center">
          <Sparkles className="w-8 h-8 mx-auto text-[var(--dash-ink-faint)] mb-2.5 opacity-30" />
          <p className="text-[12px] text-[var(--dash-ink-faint)]">
            Select a conversation to view details.
          </p>
        </div>
      ) : (
        <div className="p-4 space-y-5 overflow-y-auto max-h-[700px]">
          {/* Customer section */}
          {thread.customerName && (
            <section>
              <SectionLabel>Customer</SectionLabel>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-full bg-[#FEE2E2] text-[#991B1B] flex items-center justify-center text-[11px] font-bold shrink-0">
                  {initials(thread.customerName)}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--dash-ink)] truncate">
                    {thread.customerName}
                  </div>
                  {thread.customerEmail && (
                    <div className="text-[11px] text-[var(--dash-ink-soft)] truncate">
                      {thread.customerEmail}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                {thread.customerCompany && (
                  <DetailRow
                    icon={<Building2 className="w-3.5 h-3.5" />}
                    label="Company"
                    value={thread.customerCompany}
                  />
                )}
                {thread.customerTier && (
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[var(--dash-ink-faint)]">Tier</span>
                    <span
                      className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${TIER_STYLES[thread.customerTier] ?? ""}`}
                    >
                      {thread.customerTier}
                    </span>
                  </div>
                )}
                {thread.customerCsatAvg && (
                  <DetailRow
                    icon={<Star className="w-3.5 h-3.5" />}
                    label="CSAT"
                    value={`${thread.customerCsatAvg} / 5.0`}
                  />
                )}
              </div>
            </section>
          )}

          <Divider />

          {/* Ticket section */}
          <section>
            <SectionLabel>Ticket</SectionLabel>
            {thread.ticketSubject && (
              <p className="text-[12.5px] font-semibold text-[var(--dash-ink)] mb-3 leading-snug">
                {thread.ticketSubject}
              </p>
            )}
            <div className="space-y-2">
              {thread.ticketStatus && (
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-[var(--dash-ink-faint)]">Status</span>
                  <span
                    className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[thread.ticketStatus] ?? ""}`}
                  >
                    {thread.ticketStatus}
                  </span>
                </div>
              )}
              {thread.ticketPriority && (
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-[var(--dash-ink-faint)]">Priority</span>
                  <span
                    className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full capitalize ${PRIORITY_STYLES[thread.ticketPriority] ?? ""}`}
                  >
                    {thread.ticketPriority}
                  </span>
                </div>
              )}
              <DetailRow
                icon={CHANNEL_ICONS[thread.channel]}
                label="Channel"
                value={thread.channel}
              />
            </div>
          </section>

          <Divider />

          {/* Conversation section */}
          <section>
            <SectionLabel>Conversation</SectionLabel>
            <div className="space-y-2">
              <DetailRow
                icon={<Hash className="w-3.5 h-3.5" />}
                label="ID"
                value={`#${thread.id.slice(0, 8)}`}
              />
              <DetailRow
                icon={<MessageSquare className="w-3.5 h-3.5" />}
                label="Messages"
                value={String(thread.messages.length)}
              />
              <DetailRow
                icon={<Clock className="w-3.5 h-3.5" />}
                label="Created"
                value={relativeTime(thread.createdAt)}
              />
            </div>
          </section>

          <Divider />

          {/* AI Reasoning section */}
          <section>
            <SectionLabel>AI Reasoning</SectionLabel>
            
            <div className="flex items-center gap-3.5 mb-4 rounded-xl border dash-border bg-[var(--dash-bg-deep)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
              <ConfidenceRing value={confidence ?? 0} provisional={stage === "retrieval"} />
              <div className="text-[12px] leading-[1.6] text-[var(--dash-ink-soft)] min-w-0 flex-1">
                {confidence === null ? (
                  status === "streaming" ? "Analyzing sources…" : "Generate a draft to see reasoning."
                ) : (
                  <>
                    <div className={`font-bold ${
                      confidence >= 85 ? "text-[var(--dash-sage)]"
                      : confidence >= 70 ? "text-[var(--dash-amber)]"
                      : "text-[var(--dash-rose)]"
                    }`}>
                      {confidence}% confidence{stage === "retrieval" ? " (provisional)" : ""}
                    </div>
                    {hitl?.required ? (
                      <span className="inline-flex items-center gap-1 text-[var(--dash-amber)] text-[11px] font-semibold">
                        <AlertTriangle className="h-3 w-3 shrink-0" /> HITL required
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[var(--dash-sage)] text-[11px] font-semibold">
                        <CheckCircle2 className="h-3 w-3 shrink-0" /> Agent ready
                      </span>
                    )}
                    {latencyMs ? <span className="font-mono text-[10.5px]"> · {latencyMs}ms</span> : null}
                  </>
                )}
              </div>
            </div>

            <div className="mt-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)] mb-2">
                Sources cited
              </div>
              {citations.length > 0 ? (
                <ul className="space-y-1.5">
                  {citations.map((c, i) => (
                    <li
                      key={c.sourceId || i}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg border dash-border-soft bg-white hover:dash-shadow-sm transition"
                    >
                      <span className="w-5 h-5 rounded-md bg-[var(--dash-accent-wash)] flex items-center justify-center shrink-0">
                        <BookOpen className="w-3 h-3 text-[var(--dash-accent-deep)]" />
                      </span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-[11px] font-semibold text-[var(--dash-ink)] leading-snug">{c.title}</span>
                        <span className="block truncate text-[10px] text-[var(--dash-ink-faint)] leading-normal">{c.snippet}</span>
                      </span>
                      <span className="text-[10px] font-bold text-[var(--dash-sage)] bg-[var(--dash-sage-wash)] rounded px-1.5 py-0.5 shrink-0">
                        {c.confidence}%
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-lg border dash-border-soft bg-white px-3 py-3.5 text-center">
                  <BookOpen className="mx-auto mb-1.5 h-4.5 w-5 text-[var(--dash-ink-faint)] opacity-60" />
                  <p className="text-[11px] leading-relaxed text-[var(--dash-ink-faint)]">
                    Sources will appear here after a draft is grounded against the knowledge base.
                  </p>
                </div>
              )}
            </div>

            <Link
              href="/dashboard/tap-box"
              className="mt-3.5 inline-flex items-center gap-1 text-[11px] font-bold text-[var(--dash-accent-deep)] hover:underline"
            >
              Open full Tap Box →
            </Link>
          </section>
        </div>
      )}
    </DashCard>
  )
}

// ─── Micro-components ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)] mb-2.5">
      {children}
    </div>
  )
}

function Divider() {
  return <div className="border-t dash-border-soft" />
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="flex items-center gap-1.5 text-[var(--dash-ink-faint)]">
        {icon}
        {label}
      </span>
      <span className="font-semibold text-[var(--dash-ink)] capitalize max-w-[140px] truncate text-right">
        {value}
      </span>
    </div>
  )
}

function EmptySelect() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[var(--dash-accent-wash)] flex items-center justify-center mb-4">
        <MessageSquare className="w-7 h-7 text-[var(--dash-accent)]" />
      </div>
      <h3 className="text-[15px] font-bold text-[var(--dash-ink)] mb-1.5">
        Select a conversation
      </h3>
      <p className="text-[13px] text-[var(--dash-ink-soft)] max-w-[210px]">
        Pick a conversation from the inbox to review messages and reply.
      </p>
    </div>
  )
}

function ThreadSkeleton() {
  return (
    <div className="space-y-5">
      {[false, true, false, true].map((right, i) => (
        <div
          key={i}
          className={`flex flex-col gap-1.5 ${right ? "items-end" : "items-start"}`}
        >
          <div className={`flex items-center gap-2 ${right ? "flex-row-reverse" : ""}`}>
            <div className="skeleton w-[22px] h-[22px] rounded-full" />
            <div className="skeleton h-3 w-20 rounded" />
          </div>
          <div
            className={`skeleton rounded-xl ${right ? "w-52 h-12" : "w-64 h-16"}`}
          />
        </div>
      ))}
    </div>
  )
}

/** Animated dot for the visitor-is-typing indicator in the agent dashboard. */
function TypingDot({ delay }: { delay: string }) {
  return (
    <span
      className="w-1.5 h-1.5 rounded-full bg-[var(--dash-ink-faint)]"
      style={{
        animation: "dash-bounce 1.2s infinite",
        animationDelay: delay,
      }}
    />
  )
}
