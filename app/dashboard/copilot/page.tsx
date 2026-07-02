"use client"

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { useHotkeys } from "react-hotkeys-hook"
import { toast } from "sonner"
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Box,
  BookOpen,
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquare,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  ThumbsDown,
  Trash2,
  UserRound,
  X,
} from "lucide-react"
import { DashPageHeader, DashCard } from "@/components/dashboard/page-header"
import { Kbd } from "@/components/ui/kbd"
import { api } from "@/lib/api/trpc-client"
import { useCopilot } from "@/lib/copilot/store"
import { useCopilotStream } from "@/lib/copilot/use-copilot-stream"

const PAGE_SIZE = 30

type DbRole = "user" | "assistant" | "agent"
type Channel = "email" | "chat" | "voice" | "slack" | "portal"
type TicketPriority = "low" | "medium" | "high" | "urgent"

type MessageMeta = {
  citations?: Array<{ source: string; url?: string; confidence: number }>
  confidence?: number
  policyChecks?: Array<{ rule: string; passed: boolean }>
  latencyMs?: number
  model?: string
  isInternal?: boolean
  email?: {
    deliveryStatus?: "queued" | "sent" | "delivered" | "failed" | "bounced" | "suppressed"
    error?: string
  }
}

type ThreadMessage = {
  id: string
  conversationId: string
  role: DbRole
  content: string
  metadata: MessageMeta | null
  createdAt: string | Date
}

type WorkbenchConversation = {
  id: string
  orgId: string
  ticketId: string
  channel: Channel
  customerId: string | null
  title: string | null
  pinnedAt: string | Date | null
  archivedAt: string | Date | null
  unreadCount: number
  tags: string[]
  createdAt: string | Date
  updatedAt: string | Date
  ticketSubject: string | null
  ticketStatus: "open" | "pending" | "resolved" | "closed" | null
  ticketPriority: TicketPriority | null
  customerName: string | null
  customerEmail: string | null
  customerTier: "free" | "growth" | "enterprise" | null
  lastMessage: ThreadMessage | null
}

type ThreadData = {
  id: string
  orgId: string
  ticketId: string
  channel: Channel
  customerId: string | null
  createdAt: string | Date
  ticketSubject: string | null
  ticketStatus: "open" | "pending" | "resolved" | "closed" | null
  ticketPriority: TicketPriority | null
  customerName: string | null
  customerEmail: string | null
  customerTier: "free" | "growth" | "enterprise" | null
  customerCompany: string | null
  customerCsatAvg: string | null
  messages: ThreadMessage[]
}

type CreateDraft = {
  title: string
  initialMessage: string
  priority: TicketPriority
}

function displayTitle(conversation: Pick<WorkbenchConversation, "title" | "ticketSubject" | "customerName" | "id">) {
  return conversation.title ?? conversation.ticketSubject ?? conversation.customerName ?? `Conversation #${conversation.id.slice(0, 6)}`
}

function relativeTime(value: string | Date | null | undefined): string {
  if (!value) return "never"
  const ms = Date.now() - new Date(value).getTime()
  if (ms < 30_000) return "just now"
  if (ms < 3_600_000) return `${Math.max(1, Math.floor(ms / 60_000))}m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  if (ms < 604_800_000) return `${Math.floor(ms / 86_400_000)}d ago`
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function buildCopilotInput(thread: ThreadData, guidance: string): string {
  const recent = thread.messages
    .slice(-12)
    .map((message) => {
      const speaker = message.role === "user" ? "Customer" : message.role === "agent" ? "Agent" : "AI"
      return `${speaker}: ${message.content}`
    })
    .join("\n")

  return [
    "Draft a concise customer-support reply for the selected real conversation.",
    `Ticket: ${thread.ticketSubject ?? thread.id}`,
    `Priority: ${thread.ticketPriority ?? "medium"}`,
    `Channel: ${thread.channel}`,
    `Customer: ${thread.customerName ?? thread.customerEmail ?? "Unknown customer"}`,
    guidance.trim() ? `Agent guidance: ${guidance.trim()}` : "Agent guidance: Use the available context and cite sources.",
    "Conversation:",
    recent || "No customer messages yet. Ask one focused clarifying question.",
  ].join("\n")
}

function sortConversations(items: WorkbenchConversation[]) {
  return [...items].sort((a, b) => {
    const pinned = Number(Boolean(b.pinnedAt)) - Number(Boolean(a.pinnedAt))
    if (pinned) return pinned
    return new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()
  })
}

function channelLabel(channel: Channel) {
  return channel.charAt(0).toUpperCase() + channel.slice(1)
}

function priorityTone(priority: TicketPriority | null) {
  if (priority === "urgent" || priority === "high") return "rose"
  if (priority === "medium") return "amber"
  return "muted"
}

export default function CopilotPage() {
  const utils = api.useUtils()
  const { start, stop } = useCopilotStream()
  const [coPilotOn, setCoPilotOn] = useState(true)
  const [guidance, setGuidance] = useState("")
  const [search, setSearch] = useState("")
  const [showArchived, setShowArchived] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createDraft, setCreateDraft] = useState<CreateDraft>({
    title: "",
    initialMessage: "",
    priority: "medium",
  })
  const requestSeq = useRef(0)

  const status = useCopilot((s) => s.status)
  const error = useCopilot((s) => s.error)
  const hitl = useCopilot((s) => s.hitl)
  const draft = useCopilot((s) => s.draft)
  const edited = useCopilot((s) => s.edited)
  const confidence = useCopilot((s) => s.confidence)
  const citations = useCopilot((s) => s.citations)
  const latencyMs = useCopilot((s) => s.latencyMs)
  const suggestionId = useCopilot((s) => s.suggestionId)

  const listQuery = api.conversations.listWorkbench.useQuery(
    { limit: PAGE_SIZE, offset: 0, archived: showArchived },
    { refetchInterval: 20_000, refetchIntervalInBackground: false }
  )

  const conversations = useMemo(
    () => sortConversations(((listQuery.data?.items ?? []) as WorkbenchConversation[])),
    [listQuery.data?.items]
  )

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((conversation) => {
      const haystack = [
        displayTitle(conversation),
        conversation.customerName,
        conversation.customerEmail,
        conversation.lastMessage?.content,
        conversation.channel,
        conversation.ticketPriority,
        ...(conversation.tags ?? []),
      ].filter(Boolean).join(" ").toLowerCase()
      return haystack.includes(q)
    })
  }, [conversations, search])

  const activeConversation = conversations.find((conversation) => conversation.id === activeId) ?? null

  const threadQuery = api.conversations.getById.useQuery(
    { id: activeId! },
    { enabled: Boolean(activeId), refetchInterval: 12_000, refetchIntervalInBackground: false }
  )
  const thread = (threadQuery.data ?? null) as ThreadData | null

  const createThread = api.conversations.createSupportThread.useMutation()
  const pinThread = api.conversations.setPinned.useMutation()
  const archiveThread = api.conversations.setArchived.useMutation()
  const deleteThreads = api.conversations.deleteMany.useMutation()
  const markRead = api.conversations.markRead.useMutation()
  const addMessage = api.conversations.addMessage.useMutation()
  const decide = api.copilot.decide.useMutation()

  useEffect(() => {
    if (!activeId && conversations[0]?.id) setActiveId(conversations[0].id)
  }, [activeId, conversations])

  useEffect(() => {
    if (!activeId) return
    const seq = ++requestSeq.current
    const timer = window.setTimeout(() => {
      if (seq !== requestSeq.current) return
      markRead.mutate({ id: activeId }, { onSettled: () => void utils.conversations.listWorkbench.invalidate() })
    }, 150)
    return () => window.clearTimeout(timer)
  }, [activeId, markRead, utils.conversations.listWorkbench])

  useEffect(() => stop, [stop])

  const runStream = () => {
    if (!coPilotOn) return
    if (!thread) {
      toast.error("Select a conversation before generating a draft.")
      return
    }
    start(buildCopilotInput(thread, guidance), { ticketId: thread.ticketId, threshold: 85 })
  }

  useHotkeys("mod+enter", () => handleDecision("accept"), { enableOnFormTags: ["TEXTAREA", "INPUT"] }, [
    thread,
    suggestionId,
    edited,
    draft,
  ])
  useHotkeys("mod+shift+backspace", () => handleDecision("reject"), { enableOnFormTags: ["TEXTAREA", "INPUT"] }, [
    thread,
    suggestionId,
  ])

  async function selectConversation(id: string) {
    requestSeq.current += 1
    stop()
    useCopilot.getState().reset()
    setActiveId(id)
  }

  async function handleDecision(action: "accept" | "reject" | "modify") {
    const s = useCopilot.getState()
    if (s.status !== "ready" || !s.suggestionId || s.decision === "sending") return

    if (action !== "reject" && !thread) {
      toast.error("Select a conversation before sending.")
      return
    }

    const finalText = action === "reject" ? undefined : s.edited.trim()
    const optimistic = action === "reject" ? "rejected" : "accepted"
    s.setDecision("sending")

    try {
      await decide.mutateAsync({
        suggestionId: s.suggestionId,
        action: action === "accept" && finalText !== s.draft.trim() ? "modify" : action,
        finalText,
        hitlId: s.hitl.hitlId,
      })

      if (action !== "reject" && thread && finalText) {
        await addMessage.mutateAsync({
          conversationId: thread.id,
          role: "agent",
          content: finalText,
          metadata: {
            citations: citations.map((citation) => ({
              source: citation.title,
              url: citation.url,
              confidence: citation.confidence,
            })),
            confidence: confidence ?? undefined,
            latencyMs: latencyMs ?? undefined,
            model: "advan-copilot-v1",
          },
        })
      }

      s.setDecision(optimistic)
      await Promise.all([
        thread ? utils.conversations.getById.invalidate({ id: thread.id }) : Promise.resolve(),
        utils.conversations.listWorkbench.invalidate(),
        utils.analytics.overview.invalidate(),
      ])
      toast.success(action === "reject" ? "Suggestion rejected" : thread?.channel === "email" ? "Reply queued for delivery" : "Reply sent")
    } catch (err) {
      s.setDecision("none")
      toast.error(err instanceof Error ? err.message : "Decision failed")
    }
  }

  async function createConversation() {
    const title = createDraft.title.trim()
    if (!title) {
      toast.error("Add a conversation title first.")
      return
    }

    try {
      const created = (await createThread.mutateAsync({
        title,
        initialMessage: createDraft.initialMessage.trim() || undefined,
        priority: createDraft.priority,
        channel: "portal",
      })) as WorkbenchConversation
      setCreateDraft({ title: "", initialMessage: "", priority: "medium" })
      setCreateOpen(false)
      await utils.conversations.listWorkbench.invalidate()
      setActiveId(created.id)
      toast.success("Conversation created")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create conversation")
    }
  }

  async function togglePinned(conversation: WorkbenchConversation) {
    const previous = utils.conversations.listWorkbench.getData({ limit: PAGE_SIZE, offset: 0, archived: showArchived })
    const pinned = !conversation.pinnedAt
    utils.conversations.listWorkbench.setData({ limit: PAGE_SIZE, offset: 0, archived: showArchived }, (old) => {
      if (!old) return old
      return {
        ...old,
        items: old.items.map((item) => (
          item.id === conversation.id ? { ...item, pinnedAt: pinned ? new Date().toISOString() : null } : item
        )),
      }
    })

    try {
      await pinThread.mutateAsync({ id: conversation.id, pinned })
    } catch (err) {
      utils.conversations.listWorkbench.setData({ limit: PAGE_SIZE, offset: 0, archived: showArchived }, previous)
      toast.error(err instanceof Error ? err.message : "Pin update failed")
    }
  }

  async function archiveConversation(conversation: WorkbenchConversation) {
    const previous = utils.conversations.listWorkbench.getData({ limit: PAGE_SIZE, offset: 0, archived: showArchived })
    utils.conversations.listWorkbench.setData({ limit: PAGE_SIZE, offset: 0, archived: showArchived }, (old) => {
      if (!old) return old
      return { ...old, items: old.items.filter((item) => item.id !== conversation.id) }
    })
    if (activeId === conversation.id) setActiveId(null)

    try {
      await archiveThread.mutateAsync({ ids: [conversation.id], archived: !showArchived })
      toast.success(showArchived ? "Conversation restored" : "Conversation archived")
    } catch (err) {
      utils.conversations.listWorkbench.setData({ limit: PAGE_SIZE, offset: 0, archived: showArchived }, previous)
      toast.error(err instanceof Error ? err.message : "Archive action failed")
    }
  }

  async function deleteConversation(conversation: WorkbenchConversation) {
    const ok = window.confirm(`Delete "${displayTitle(conversation)}"? This removes the conversation history.`)
    if (!ok) return

    const previous = utils.conversations.listWorkbench.getData({ limit: PAGE_SIZE, offset: 0, archived: showArchived })
    utils.conversations.listWorkbench.setData({ limit: PAGE_SIZE, offset: 0, archived: showArchived }, (old) => {
      if (!old) return old
      return { ...old, items: old.items.filter((item) => item.id !== conversation.id) }
    })
    if (activeId === conversation.id) setActiveId(null)

    try {
      await deleteThreads.mutateAsync({ ids: [conversation.id] })
      toast.success("Conversation deleted")
    } catch (err) {
      utils.conversations.listWorkbench.setData({ limit: PAGE_SIZE, offset: 0, archived: showArchived }, previous)
      toast.error(err instanceof Error ? err.message : "Delete failed")
    }
  }

  return (
    <div>
      <DashPageHeader
        eyebrow="AI Copilot"
        title="Co-pilot for support agents"
        subtitle="Real-time sourced drafts from your knowledge base. Approve, edit, or escalate — always in control."
        actions={
          <Link
            href="/dashboard/tap-box"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border dash-border bg-[var(--dash-card)] text-[13px] font-semibold text-[var(--dash-ink-soft)] hover:dash-shadow-sm transition"
          >
            <Box className="w-4 h-4" /> Inspect with Tap Box
          </Link>
        }
      />

      <ConversationContext
        conversations={filteredConversations}
        allCount={conversations.length}
        activeId={activeId}
        activeConversation={activeConversation}
        thread={thread}
        search={search}
        showArchived={showArchived}
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        createOpen={createOpen}
        createDraft={createDraft}
        creating={createThread.isPending}
        onSearch={setSearch}
        onToggleArchived={() => {
          setShowArchived((value) => !value)
          setActiveId(null)
        }}
        onRetry={() => void listQuery.refetch()}
        onSelect={(id) => void selectConversation(id)}
        onTogglePinned={(conversation) => void togglePinned(conversation)}
        onArchive={(conversation) => void archiveConversation(conversation)}
        onDelete={(conversation) => void deleteConversation(conversation)}
        onCreateOpen={setCreateOpen}
        onCreateDraft={setCreateDraft}
        onCreate={() => void createConversation()}
      />

      <div className="mb-4 rounded-xl border dash-border bg-[var(--dash-card)] shadow-[0_14px_34px_-28px_rgba(42,37,32,0.55)] p-2">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="flex min-w-0 items-center gap-2 px-2">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
              thread ? "border-[#D7CFF2] bg-[#ECE9FB] text-[#4E3FB6]" : "border-[var(--dash-line-soft)] bg-[var(--dash-bg)] text-[var(--dash-ink-faint)]"
            }`}>
              <MessageSquare className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--dash-ink-faint)]">
                Draft target
              </div>
              <div className="truncate text-[12.5px] font-bold text-[var(--dash-ink)]">
                {activeConversation ? displayTitle(activeConversation) : "No conversation selected"}
              </div>
            </div>
          </div>
          <div className="relative min-w-0 flex-1">
            <input
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) runStream()
              }}
              placeholder={thread ? "Add guidance: tone, outcome, details to include..." : "Select a real conversation to generate a sourced reply..."}
              aria-label="Agent guidance for AI draft"
              className="h-10 w-full rounded-lg border dash-border bg-white px-3 text-[13px] text-[var(--dash-ink)] placeholder:text-[var(--dash-ink-faint)] outline-none transition focus:border-[var(--dash-accent)] focus:shadow-[0_0_0_3px_var(--dash-accent-wash)]"
            />
          </div>
          <button
            onClick={runStream}
            disabled={status === "streaming" || !thread || !coPilotOn}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] px-4 text-[13px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(107,92,214,0.75)] transition hover:-translate-y-px hover:shadow-[0_14px_30px_-14px_rgba(107,92,214,0.85)] disabled:translate-y-0 disabled:opacity-55"
          >
            {status === "streaming" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {status === "streaming" ? "Generating" : "Generate Draft"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        <DashCard
          title="AI Copilot"
          icon={<Sparkles className="w-[18px] h-[18px]" />}
          right={
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[var(--dash-accent-deep)] bg-[var(--dash-accent-wash)] rounded-full px-2.5 py-0.5">
                Co-Pilot Mode
              </span>
              <button
                aria-pressed={coPilotOn}
                aria-label="Toggle Co-Pilot mode"
                onClick={() => { setCoPilotOn((v) => !v); stop() }}
                className={`relative w-[38px] h-[21px] rounded-full transition ${coPilotOn ? "bg-[var(--dash-accent)]" : "bg-[var(--dash-ink-faint)]"}`}
              >
                <span className={`absolute top-[3px] w-[15px] h-[15px] rounded-full bg-white shadow transition-all ${coPilotOn ? "left-[3px]" : "left-[20px]"}`} />
              </button>
            </div>
          }
        >
          <DraftPanel error={error} coPilotOn={coPilotOn} hasThread={Boolean(thread)} />

          {hitl.required && (
            <div className="mt-2 flex items-center gap-2 p-2.5 rounded-lg bg-[var(--dash-amber-wash)] border border-[#E5D2A8] text-[12px] text-[#5a3e1c]">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span><b>Human review required:</b> {hitl.reason}</span>
            </div>
          )}

          <EditPanel onDecision={handleDecision} />
        </DashCard>

        <ReasoningPanel />
      </div>
    </div>
  )
}

function ConversationContext({
  conversations,
  allCount,
  activeId,
  activeConversation,
  thread,
  search,
  showArchived,
  isLoading,
  isError,
  createOpen,
  createDraft,
  creating,
  onSearch,
  onToggleArchived,
  onRetry,
  onSelect,
  onTogglePinned,
  onArchive,
  onDelete,
  onCreateOpen,
  onCreateDraft,
  onCreate,
}: {
  conversations: WorkbenchConversation[]
  allCount: number
  activeId: string | null
  activeConversation: WorkbenchConversation | null
  thread: ThreadData | null
  search: string
  showArchived: boolean
  isLoading: boolean
  isError: boolean
  createOpen: boolean
  createDraft: CreateDraft
  creating: boolean
  onSearch: (value: string) => void
  onToggleArchived: () => void
  onRetry: () => void
  onSelect: (id: string) => void
  onTogglePinned: (conversation: WorkbenchConversation) => void
  onArchive: (conversation: WorkbenchConversation) => void
  onDelete: (conversation: WorkbenchConversation) => void
  onCreateOpen: (value: boolean) => void
  onCreateDraft: (value: CreateDraft) => void
  onCreate: () => void
}) {
  return (
    <DashCard
      title="Live conversation context"
      icon={<BookOpen className="w-[18px] h-[18px]" />}
      right={
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleArchived}
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border dash-border bg-transparent text-[12px] font-semibold text-[var(--dash-ink-soft)] hover:bg-[var(--dash-bg)] transition"
          >
            {showArchived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
            {showArchived ? "Archived" : "Active"}
          </button>
          <button
            onClick={() => onCreateOpen(!createOpen)}
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-[12px] font-semibold text-white bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] transition"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-3">
        <div className="rounded-xl border dash-border-soft bg-white overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
          <div className="p-3 border-b dash-border-soft bg-[linear-gradient(180deg,#fff,rgba(252,250,244,0.72))]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--dash-ink-faint)]" />
              <input
                value={search}
                onChange={(event) => onSearch(event.target.value)}
                placeholder="Search conversations..."
                className="w-full h-9 pl-8 pr-3 rounded-lg border border-transparent bg-[var(--dash-bg)] text-[12.5px] text-[var(--dash-ink)] placeholder:text-[var(--dash-ink-faint)] outline-none transition focus:border-[var(--dash-accent)] focus:bg-white focus:shadow-[0_0_0_3px_var(--dash-accent-wash)]"
              />
            </div>
          </div>

          <div className="max-h-[224px] overflow-y-auto">
            {isLoading ? (
              <div className="p-3 space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="skeleton h-12 rounded-lg" />
                ))}
              </div>
            ) : isError ? (
              <div className="p-4 text-center">
                <p className="text-[12px] text-[var(--dash-rose)] mb-2">Could not load conversations.</p>
                <button onClick={onRetry} className="text-[12px] font-bold text-[var(--dash-accent-deep)] hover:underline">Retry</button>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-5 text-center">
                <p className="text-[12px] font-semibold text-[var(--dash-ink-soft)]">{search ? "No matches found" : "No conversations yet"}</p>
                <p className="text-[11px] text-[var(--dash-ink-faint)] mt-1">{search ? "Try another search term." : "Create one to test the full flow."}</p>
              </div>
            ) : (
              <ul>
                {conversations.map((conversation) => {
                  const active = conversation.id === activeId
                  return (
                    <li key={conversation.id} className="px-2 py-1 first:pt-2 last:pb-2">
                      <button
                        onClick={() => onSelect(conversation.id)}
                        className={`relative w-full rounded-lg text-left px-3 py-2.5 transition focus:outline-none focus:shadow-[0_0_0_3px_var(--dash-accent-wash)] ${
                          active
                            ? "bg-[var(--dash-accent-wash)] shadow-[inset_3px_0_0_var(--dash-accent)]"
                            : "hover:bg-[var(--dash-bg)]"
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          {conversation.pinnedAt && <Pin className="w-3.5 h-3.5 text-[var(--dash-accent-deep)] shrink-0" />}
                          <span className="truncate text-[12.5px] font-bold text-[var(--dash-ink)]">{displayTitle(conversation)}</span>
                          {conversation.unreadCount > 0 && (
                            <span className="ml-auto shrink-0 text-[10px] font-bold rounded-full bg-[var(--dash-accent)] text-white px-1.5">
                              {conversation.unreadCount}
                            </span>
                          )}
                        </span>
                        <span className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[var(--dash-ink-faint)]">
                          <UserRound className="h-3 w-3 shrink-0" />
                          <span className="truncate">{conversation.customerName ?? conversation.customerEmail ?? channelLabel(conversation.channel)}</span>
                          <Clock className="ml-auto h-3 w-3 shrink-0" />
                          <span className="shrink-0">{relativeTime(conversation.updatedAt)}</span>
                        </span>
                        <span className="mt-2 flex items-center gap-1.5">
                          <MetaPill tone="blue">{channelLabel(conversation.channel)}</MetaPill>
                          {conversation.ticketPriority && (
                            <MetaPill tone={priorityTone(conversation.ticketPriority)}>{conversation.ticketPriority}</MetaPill>
                          )}
                          {conversation.customerTier && <MetaPill>{conversation.customerTier}</MetaPill>}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="rounded-xl border dash-border-soft bg-white p-4 min-h-[224px] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
          {createOpen ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[12px] font-bold text-[var(--dash-ink)]">Create real conversation</div>
                  <div className="text-[11px] text-[var(--dash-ink-faint)]">Use this for manual QA or portal-originated requests.</div>
                </div>
                <button onClick={() => onCreateOpen(false)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--dash-ink-faint)] transition hover:bg-[var(--dash-bg)] hover:text-[var(--dash-ink)] focus:outline-none focus:shadow-[0_0_0_3px_var(--dash-accent-wash)]">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_150px] gap-2 mb-2">
                <input
                  value={createDraft.title}
                  onChange={(event) => onCreateDraft({ ...createDraft, title: event.target.value })}
                  placeholder="Ticket subject"
                  className="h-9 px-3 rounded-lg border dash-border bg-[var(--dash-card)] text-[13px] text-[var(--dash-ink)] outline-none focus:border-[var(--dash-accent)]"
                />
                <select
                  value={createDraft.priority}
                  onChange={(event) => onCreateDraft({ ...createDraft, priority: event.target.value as TicketPriority })}
                  className="h-9 px-2 rounded-lg border dash-border bg-[var(--dash-card)] text-[13px] text-[var(--dash-ink)] outline-none focus:border-[var(--dash-accent)]"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <textarea
                value={createDraft.initialMessage}
                onChange={(event) => onCreateDraft({ ...createDraft, initialMessage: event.target.value })}
                placeholder="Customer message"
                rows={3}
                className="w-full px-3 py-2 rounded-lg border dash-border bg-[var(--dash-card)] text-[13px] text-[var(--dash-ink)] outline-none resize-none focus:border-[var(--dash-accent)]"
              />
              <button
                onClick={onCreate}
                disabled={creating}
                className="mt-2 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[13px] font-semibold text-white bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] shadow-[0_8px_18px_-12px_rgba(107,92,214,0.7)] disabled:opacity-60 transition"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create
              </button>
            </div>
          ) : activeConversation ? (
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <MetaPill tone="blue">{channelLabel(activeConversation.channel)}</MetaPill>
                    {activeConversation.ticketPriority && (
                      <MetaPill tone={priorityTone(activeConversation.ticketPriority)}>{activeConversation.ticketPriority}</MetaPill>
                    )}
                    {activeConversation.ticketStatus && <MetaPill>{activeConversation.ticketStatus}</MetaPill>}
                  </div>
                  <h3 className="truncate text-[18px] font-bold tracking-tight text-[var(--dash-ink)]">{displayTitle(activeConversation)}</h3>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--dash-ink-faint)]">
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <UserRound className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{activeConversation.customerName ?? activeConversation.customerEmail ?? "Unknown customer"}</span>
                    </span>
                    <span className="font-mono">#{activeConversation.ticketId.slice(0, 8)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onTogglePinned(activeConversation)}
                    className="inline-flex w-8 h-8 items-center justify-center rounded-lg border dash-border bg-transparent text-[var(--dash-ink-soft)] hover:bg-[var(--dash-bg)] transition focus:outline-none focus:shadow-[0_0_0_3px_var(--dash-accent-wash)]"
                    aria-label={activeConversation.pinnedAt ? "Unpin conversation" : "Pin conversation"}
                  >
                    {activeConversation.pinnedAt ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => onArchive(activeConversation)}
                    className="inline-flex w-8 h-8 items-center justify-center rounded-lg border dash-border bg-transparent text-[var(--dash-ink-soft)] hover:bg-[var(--dash-bg)] transition focus:outline-none focus:shadow-[0_0_0_3px_var(--dash-accent-wash)]"
                    aria-label={showArchived ? "Restore conversation" : "Archive conversation"}
                  >
                    {showArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => onDelete(activeConversation)}
                    className="inline-flex w-8 h-8 items-center justify-center rounded-lg border dash-border bg-transparent text-[var(--dash-rose)] hover:bg-[var(--dash-bg)] transition focus:outline-none focus:shadow-[0_0_0_3px_var(--dash-rose-wash)]"
                    aria-label="Delete conversation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <Stat icon={<MessageSquare className="h-3.5 w-3.5" />} label="Messages" value={String(thread?.messages.length ?? "—")} />
                <Stat icon={<Sparkles className="h-3.5 w-3.5" />} label="AI basis" value={thread ? "Thread" : "Loading"} />
                <Stat icon={<Clock className="h-3.5 w-3.5" />} label="Updated" value={relativeTime(activeConversation.updatedAt)} />
              </div>

              <div className="mt-3 rounded-xl bg-[var(--dash-bg)] border dash-border-soft p-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--dash-ink-soft)]">Latest customer context</div>
                  <span className="text-[10.5px] font-bold text-[var(--dash-sage)] dash-bg-sage-wash rounded-md px-1.5 py-0.5">
                    Ready for draft
                  </span>
                </div>
                <p className="text-[12px] leading-[1.55] text-[var(--dash-ink-soft)] line-clamp-3">
                  {activeConversation.lastMessage?.content ?? "No messages yet."}
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-center">
              <div>
                <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl border dash-border-soft bg-[var(--dash-bg)]">
                  <Sparkles className="w-5 h-5 text-[var(--dash-ink-faint)]" />
                </span>
                <p className="text-[13px] font-semibold text-[var(--dash-ink-soft)]">
                  {allCount === 0 ? "Create or receive a conversation to start." : "Select a conversation to generate a reply."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashCard>
  )
}

function MetaPill({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "blue" | "amber" | "rose" }) {
  const styles = {
    muted: "bg-[var(--dash-bg)] text-[var(--dash-ink-soft)] border-[var(--dash-line-soft)]",
    blue: "dash-bg-blue-wash text-[var(--dash-blue)] border-[#C7D4E8]",
    amber: "dash-bg-amber-wash text-[var(--dash-amber)] border-[#E5D2A8]",
    rose: "dash-bg-rose-wash text-[var(--dash-rose)] border-[#E5C5C3]",
  }

  return (
    <span className={`inline-flex h-5 items-center rounded-md border px-1.5 text-[10px] font-bold uppercase tracking-[0.08em] ${styles[tone]}`}>
      {children}
    </span>
  )
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-lg border dash-border-soft bg-[var(--dash-bg)] px-2.5 py-2">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">
        {icon && <span className="text-[var(--dash-accent-deep)]">{icon}</span>}
        {label}
      </div>
      <div className="text-[12.5px] font-bold text-[var(--dash-ink)] truncate">{value}</div>
    </div>
  )
}

function DraftPanel({ error, coPilotOn, hasThread }: { error: string | null; coPilotOn: boolean; hasThread: boolean }) {
  const draft = useCopilot((s) => s.draft)
  const status = useCopilot((s) => s.status)
  const confidence = useCopilot((s) => s.confidence)
  const streaming = status === "streaming"

  const confColor =
    confidence === null ? "text-[var(--dash-ink-faint)]"
    : confidence >= 85 ? "text-[var(--dash-sage)]"
    : confidence >= 70 ? "text-[var(--dash-amber)]"
    : "text-[var(--dash-rose)]"

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2 text-[12px] font-bold text-[var(--dash-ink)]">
        <span className="inline-flex h-6 items-center gap-1.5 rounded-md dash-bg-accent-wash px-2 text-[11px] font-bold text-[var(--dash-accent-deep)]">
          <Sparkles className="h-3.5 w-3.5" />
          Suggested response
        </span>
        <span className="font-medium text-[var(--dash-ink-faint)] text-[11px]">AI draft</span>
        {confidence !== null && (
          <span className={`ml-auto text-[11px] font-bold rounded-md border px-2 py-0.5 ${
            confidence >= 85 ? "dash-bg-sage-wash border-[#CBE0CF]" : confidence >= 70 ? "dash-bg-amber-wash border-[#E5D2A8]" : "dash-bg-rose-wash border-[#E5C5C3]"
          } ${confColor}`}>
            {confidence}% confidence
          </span>
        )}
      </div>

      <div
        className="rounded-xl border dash-border bg-[linear-gradient(180deg,#fff,rgba(252,250,244,0.82))] p-4 min-h-[156px] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
        aria-live="polite"
        aria-busy={streaming}
      >
        {error ? (
          <p className="text-[13px] text-[var(--dash-rose)]">{error}</p>
        ) : streaming && !draft ? (
          <TypingDots />
        ) : draft ? (
          <p className="text-[13.5px] leading-[1.68] text-[var(--dash-ink)] whitespace-pre-line">
            {draft}
            {streaming && (
              <span className="inline-block w-[8px] h-[14px] bg-[var(--dash-accent)] ml-0.5 align-middle animate-pulse" />
            )}
          </p>
        ) : (
          <div className="flex min-h-[112px] items-center justify-center text-center">
            <p className="max-w-sm text-[12.5px] leading-5 text-[var(--dash-ink-faint)]">
              {!hasThread
                ? "Select a real conversation to generate a sourced reply."
                : coPilotOn
                ? "Generate a draft to preview source-backed response text here."
                : "Co-Pilot is paused. Re-enable to generate a sourced reply."}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function EditPanel({ onDecision }: { onDecision: (a: "accept" | "reject" | "modify") => void }) {
  const edited = useCopilot((s) => s.edited)
  const draft = useCopilot((s) => s.draft)
  const setEdited = useCopilot((s) => s.setEdited)
  const decision = useCopilot((s) => s.decision)
  const status = useCopilot((s) => s.status)
  const ready = status === "ready"

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-[12px] font-bold text-[var(--dash-ink)]">
        Edit response
        <span className="rounded-md dash-bg-sage-wash px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--dash-sage)]">
          Agent controlled
        </span>
      </div>

      <div className="rounded-xl border-2 border-[var(--dash-accent)] bg-white shadow-[0_0_0_3px_var(--dash-accent-wash),0_18px_40px_-34px_rgba(42,37,32,0.65)] overflow-hidden">
        <textarea
          value={edited}
          onChange={(e) => setEdited(e.target.value)}
          rows={9}
          aria-label="Editable AI response"
          className="w-full px-4 py-3.5 text-[13.5px] leading-[1.65] text-[var(--dash-ink)] outline-none bg-transparent resize-none placeholder:text-[var(--dash-ink-faint)]"
          placeholder="Your approved reply will appear here after generation."
        />
        <div className="flex items-center gap-3.5 px-3 py-2 border-t dash-border-soft bg-[var(--dash-bg)]">
          <span className="text-[11px] font-semibold text-[var(--dash-ink-faint)]">
            Review, edit, then send from the selected thread.
          </span>
          <span className="ml-auto rounded-md bg-white px-1.5 py-0.5 text-[11px] font-mono text-[var(--dash-ink-faint)] border dash-border-soft">{edited.length} chars</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2.5">
        <button
          onClick={() => setEdited(draft)}
          disabled={!ready}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border dash-border bg-transparent text-[13px] font-semibold text-[var(--dash-ink-soft)] hover:bg-[var(--dash-bg)] transition disabled:opacity-50"
        >
          <X className="w-4 h-4" /> Reset
        </button>
        <button
          onClick={() => onDecision("reject")}
          disabled={!ready || decision === "sending"}
          aria-keyshortcuts="Control+Shift+Backspace"
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border dash-border bg-[var(--dash-card)] text-[13px] font-semibold text-[var(--dash-rose)] hover:dash-shadow-sm transition disabled:opacity-50"
        >
          <ThumbsDown className="w-4 h-4" /> Reject
        </button>
        <button
          onClick={() => onDecision("accept")}
          disabled={!ready || decision === "sending" || !edited.trim()}
          aria-keyshortcuts="Control+Enter"
          className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-white transition shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] ${
            decision === "accepted"
              ? "bg-gradient-to-br from-[#5C9A70] to-[#3f7a52]"
              : "bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] hover:-translate-y-px"
          } disabled:opacity-60`}
        >
          {decision === "none" && <><Send className="w-4 h-4" /> Send Reply <Kbd className="ml-0.5">⌘↵</Kbd></>}
          {decision === "sending" && <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>}
          {decision === "accepted" && <><CheckCircle2 className="w-4 h-4" /> Sent</>}
          {decision === "rejected" && <><Pencil className="w-4 h-4" /> Rejected</>}
        </button>
      </div>
    </div>
  )
}

function ReasoningPanel() {
  const confidence = useCopilot((s) => s.confidence)
  const stage = useCopilot((s) => s.confidenceStage)
  const status = useCopilot((s) => s.status)
  const citations = useCopilot((s) => s.citations)
  const hitl = useCopilot((s) => s.hitl)
  const latencyMs = useCopilot((s) => s.latencyMs)

  const confColor =
    confidence === null ? "text-[var(--dash-ink-faint)]"
    : confidence >= 85 ? "text-[var(--dash-sage)]"
    : confidence >= 70 ? "text-[var(--dash-amber)]"
    : "text-[var(--dash-rose)]"

  return (
    <DashCard title="AI reasoning" icon={<Sparkles className="w-[18px] h-[18px]" />}>
      <div className="flex items-center gap-4 mb-4 rounded-xl border dash-border-soft bg-white px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
        <ConfidenceRing value={confidence ?? 0} provisional={stage === "retrieval"} />
        <div className="text-[12px] leading-[1.6] text-[var(--dash-ink-soft)]">
          {confidence === null ? (
            status === "streaming" ? "Analysing sources…" : "Generate a draft to see reasoning."
          ) : (
            <>
              <div className={`font-bold ${confColor}`}>{confidence}% confidence{stage === "retrieval" ? " (provisional)" : ""}</div>
              {hitl.required ? (
                <span className="inline-flex items-center gap-1 text-[var(--dash-amber)]">
                  <AlertTriangle className="h-3.5 w-3.5" /> HITL review required
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[var(--dash-sage)]">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Agent approval ready
                </span>
              )}
              {latencyMs ? <span className="font-mono"> · {latencyMs}ms</span> : null}
            </>
          )}
        </div>
      </div>

      <div className="mt-2">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--dash-ink-soft)]">
            Sources cited
          </div>
          {citations.length > 0 && (
            <span className="rounded-md dash-bg-blue-wash px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--dash-blue)]">
              {citations.length}
            </span>
          )}
        </div>
        {citations.length > 0 ? (
          <ul className="space-y-2">
            {citations.map((c) => (
              <li
                key={c.sourceId}
                className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg border dash-border-soft bg-white hover:dash-shadow-sm transition"
              >
                <span className="w-6 h-6 rounded-md dash-bg-blue-wash flex items-center justify-center">
                  <BookOpen className="w-3.5 h-3.5 text-[var(--dash-blue)]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-semibold text-[var(--dash-ink)]">{c.title}</span>
                  <span className="block truncate text-[10.5px] text-[var(--dash-ink-faint)]">{c.snippet}</span>
                </span>
                <span className="text-[10.5px] font-bold text-[var(--dash-sage)] dash-bg-sage-wash rounded-md px-1.5 py-0.5">
                  {c.confidence}%
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-lg border dash-border-soft bg-white px-3 py-4 text-center">
            <BookOpen className="mx-auto mb-2 h-5 w-5 text-[var(--dash-ink-faint)] opacity-60" />
            <p className="text-[12px] leading-5 text-[var(--dash-ink-faint)]">
              Sources will appear here after a draft is grounded against the knowledge base.
            </p>
          </div>
        )}
      </div>

      <Link
        href="/dashboard/tap-box"
        className="mt-4 inline-flex items-center gap-1 text-[12px] font-bold text-[var(--dash-accent-deep)] hover:underline"
      >
        Open full Tap Box →
      </Link>
    </DashCard>
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
          <linearGradient id="copilot-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={color[0]} />
            <stop offset="1" stopColor={color[1]} />
          </linearGradient>
        </defs>
        <circle cx="33" cy="33" r={R} stroke="var(--dash-line)" strokeWidth="7" fill="none" />
        <motion.circle
          cx="33" cy="33" r={R}
          stroke="url(#copilot-ring)" strokeWidth="7" fill="none" strokeLinecap="round"
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

function TypingDots() {
  const reduce = useReducedMotion()
  return (
    <div className="flex items-center gap-1 py-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-2 h-2 rounded-full bg-[var(--dash-accent)]"
          animate={reduce ? undefined : { y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
        />
      ))}
    </div>
  )
}
