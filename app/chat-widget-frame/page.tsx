"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as SocketIO from "socket.io-client"
import { AgentAvatar, AgentPresenceStack, VisitorAvatar, presenceTitle, type PresenceAgent } from "./presence"

type View = "loading" | "session-list" | "new-session" | "chat" | "error"

type SessionSummary = {
  conversationId: string
  customerDisplayName: string | null
  status: "active" | "waiting" | "resolved"
  lastMessagePreview: string
  lastActivityAt: string
  hasUnreadAgentReply: boolean
}

type ChatMessage = {
  id: string
  role: "user" | "agent"
  content: string
  createdAt: string
}

type PreChatQuestion = {
  id: string
  text: string
  type: "preset" | "custom"
  options?: string[]
  required?: boolean
}

type SessionState = {
  token: string
  visitorId: string
  widgetConfig?: {
    preChatFormEnabled: boolean
    preChatQuestions: PreChatQuestion[]
  }
}

const getSocketUrl = () => {
  const envUrl = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SOCKET_URL : null
  if (envUrl && !envUrl.includes("localhost:3002") && !envUrl.includes("127.0.0.1:3002")) {
    return envUrl
  }
  if (typeof window === "undefined") return "http://localhost:3002"
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname === "0.0.0.0"
  return isLocal
    ? `${window.location.protocol}//${window.location.hostname}:3002`
    : `${window.location.protocol}//${window.location.hostname}`
}

const SOCKET_URL = getSocketUrl()

function postToParent(msg: Record<string, unknown>) {
  try {
    window.parent.postMessage(msg, "*")
  } catch {
    // best effort in sandboxed iframe
  }
}

function parseLastViewedMap(raw: string | null): Record<string, string> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, string>
    if (!parsed || typeof parsed !== "object") return {}
    return parsed
  } catch {
    return {}
  }
}

function relativeTime(d: string): string {
  const ms = Date.now() - new Date(d).getTime()
  if (ms < 60_000) return "just now"
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  if (ms < 604_800_000) return `${Math.floor(ms / 86_400_000)}d ago`
  return new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" })
}

function truncate(input: string, max = 44): string {
  const value = input.trim()
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}...`
}

function nextId() {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function ChatWidgetFrame() {
  const [view, setView] = useState<View>("loading")
  const [errorText, setErrorText] = useState<string | null>(null)

  const [widgetKey, setWidgetKey] = useState<string | null>(null)
  const [origin, setOrigin] = useState<string | null>(null)
  const [visitorIdFromParent, setVisitorIdFromParent] = useState<string | null>(null)
  const [lastViewedMap, setLastViewedMap] = useState<Record<string, string>>({})

  const [session, setSession] = useState<SessionState | null>(null)
  const [sessionList, setSessionList] = useState<SessionSummary[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [activeDisplayName, setActiveDisplayName] = useState<string | null>(null)
  const [activeStatus, setActiveStatus] = useState<SessionSummary["status"] | null>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [agentTyping, setAgentTyping] = useState(false)

  const [displayName, setDisplayName] = useState("")
  const [initialMessage, setInitialMessage] = useState("")
  const [nameError, setNameError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [preChatAnswers, setPreChatAnswers] = useState<Record<string, string>>({})

  const [agentOnline, setAgentOnline] = useState(false)
  const [agentCount, setAgentCount] = useState(0)
  const [teamName, setTeamName] = useState("Support")
  const [agents, setAgents] = useState<PresenceAgent[]>([])

  const socketRef = useRef<ReturnType<typeof SocketIO.connect> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const activeConversationIdRef = useRef<string | null>(null)
  const lastViewedMapRef = useRef<Record<string, string>>({})
  const visitorIdRef = useRef<string | null>(null)

  const showBack = view === "chat" && sessionList.length > 1

  const activeSessionSummary = useMemo(
    () => sessionList.find((s) => s.conversationId === activeConversationId) ?? null,
    [sessionList, activeConversationId],
  )

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId
  }, [activeConversationId])

  useEffect(() => {
    lastViewedMapRef.current = lastViewedMap
  }, [lastViewedMap])

  const markViewed = useCallback((conversationId: string) => {
    const nowIso = new Date().toISOString()
    setLastViewedMap((prev) => {
      const next = { ...prev, [conversationId]: nowIso }
      lastViewedMapRef.current = next
      postToParent({ type: "advan:last_viewed_update", conversationId, lastViewedAt: nowIso })
      return next
    })
  }, [])

  const loadSessionList = useCallback(async (token: string, viewedMap?: Record<string, string>) => {
    const qp = new URLSearchParams()
    qp.set("lastViewedAtByConversation", JSON.stringify(viewedMap ?? lastViewedMapRef.current))

    const res = await fetch(`/api/chat/sessions?${qp.toString()}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error("sessions_failed")

    const body = await res.json() as { sessions: SessionSummary[] }
    setSessionList(body.sessions)
    return body.sessions
  }, [])

  const loadConversationMessages = useCallback(async (token: string, conversationId: string) => {
    const res = await fetch(`/api/chat/sessions/${conversationId}/messages?limit=100&page=0`, {
      headers: { authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error("messages_failed")

    const body = await res.json() as {
      messages: Array<{ id: string; role: "user" | "assistant" | "agent"; content: string; createdAt: string }>
    }

    const mapped: ChatMessage[] = body.messages.map((m) => ({
      id: m.id,
      role: m.role === "user" ? "user" : "agent",
      content: m.content,
      createdAt: m.createdAt,
    }))

    setMessages(mapped)
    markViewed(conversationId)
    return mapped
  }, [markViewed])

  /**
   * Socket delivery can miss auto-replies (race before join, brief disconnect).
   * Poll briefly after send / open so the widget still shows agent messages.
   */
  const pollForAgentReply = useCallback((token: string, conversationId: string) => {
    let cancelled = false
    let attempts = 0
    const maxAttempts = 12 // ~36s at 3s interval — covers slow local Ollama
    const startedAt = Date.now()

    const tick = async () => {
      if (cancelled) return
      attempts += 1
      try {
        const mapped = await loadConversationMessages(token, conversationId)
        const hasNewAgent = mapped.some(
          (m) => m.role === "agent" && new Date(m.createdAt).getTime() >= startedAt - 2000,
        )
        if (hasNewAgent || attempts >= maxAttempts) return
      } catch {
        if (attempts >= maxAttempts) return
      }
      if (!cancelled && attempts < maxAttempts) {
        window.setTimeout(() => void tick(), 3000)
      }
    }

    window.setTimeout(() => void tick(), 1500)
    return () => {
      cancelled = true
    }
  }, [loadConversationMessages])

  const joinConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit("join:conversation", { conversationId })
  }, [])

  const leaveConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit("leave:conversation", { conversationId })
  }, [])

  const openConversation = useCallback(async (conversation: SessionSummary) => {
    if (!session) return

    const previousId = activeConversationIdRef.current
    if (previousId && previousId !== conversation.conversationId) {
      leaveConversation(previousId)
    }

    setActiveConversationId(conversation.conversationId)
    setActiveDisplayName(conversation.customerDisplayName)
    setActiveStatus(conversation.status)
    setView("chat")

    joinConversation(conversation.conversationId)
    await loadConversationMessages(session.token, conversation.conversationId)
    pollForAgentReply(session.token, conversation.conversationId)
  }, [session, leaveConversation, joinConversation, loadConversationMessages, pollForAgentReply])

  const connectSocket = useCallback((token: string) => {
    socketRef.current?.disconnect()
    socketRef.current = null

    const socket = SocketIO.connect(`${SOCKET_URL}/chat-widget`, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 8,
    })

    socketRef.current = socket

    socket.on("session:ready", () => {
      const conversationId = activeConversationIdRef.current
      if (conversationId) {
        socket.emit("join:conversation", { conversationId })
      }
    })

    socket.on("agent:message", (payload: { conversationId: string; messageId: string; content: string }) => {
      if (payload.conversationId !== activeConversationIdRef.current) return
      setAgentTyping(false)
      setMessages((prev) => [...prev, { id: payload.messageId, role: "agent", content: payload.content, createdAt: new Date().toISOString() }])
      markViewed(payload.conversationId)
    })

    socket.on("typing:start", (d: { role: string }) => {
      if (d.role === "agent") setAgentTyping(true)
    })

    socket.on("typing:stop", (d: { role: string }) => {
      if (d.role === "agent") setAgentTyping(false)
    })

    socket.on("presence:agent-online", (d: { online: boolean; count?: number }) => {
      setAgentOnline(d.online)
      setAgentCount(typeof d.count === "number" ? d.count : d.online ? 1 : 0)
    })

    return socket
  }, [markViewed])

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const key = p.get("key")?.trim() ?? null
    const incomingOrigin = p.get("origin")?.trim() ?? window.location.origin
    const incomingVisitorId = p.get("visitorId")?.trim() ?? null
    const incomingLastViewed = parseLastViewedMap(p.get("lastViewedMap"))

    setWidgetKey(key)
    setOrigin(incomingOrigin)
    setVisitorIdFromParent(incomingVisitorId)
    visitorIdRef.current = incomingVisitorId
    setLastViewedMap(incomingLastViewed)
    lastViewedMapRef.current = incomingLastViewed
    postToParent({ type: "advan:ready" })
  }, [])

  // Bootstrap once when widget key/origin are ready.
  // Do NOT depend on lastViewedMap, connectSocket, or visitorId remints — those
  // change after "Start conversation" and were resetting the view back to the form.
  useEffect(() => {
    if (!widgetKey || !origin) return

    let cancelled = false

    ;(async () => {
      try {
        const availability = await fetch(`/api/chat/availability?widgetKey=${encodeURIComponent(widgetKey)}`)
        if (!availability.ok) throw new Error("availability_failed")
        const availabilityData = await availability.json() as {
          agentsOnline: boolean
          agentCount?: number
          teamName?: string
          agents?: PresenceAgent[]
        }
        if (cancelled) return

        setAgentOnline(availabilityData.agentsOnline)
        setAgentCount(availabilityData.agentCount ?? (availabilityData.agentsOnline ? 1 : 0))
        setTeamName(availabilityData.teamName?.trim() || "Support")
        setAgents(Array.isArray(availabilityData.agents) ? availabilityData.agents : [])

        const sessionRes = await fetch("/api/chat/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            widgetKey,
            origin,
            visitorId: visitorIdRef.current ?? undefined,
          }),
        })
        if (!sessionRes.ok) throw new Error("session_failed")

        const sessionBody = await sessionRes.json() as {
          token: string
          visitorId: string
          widgetConfig?: {
            preChatFormEnabled: boolean
            preChatQuestions: PreChatQuestion[]
          }
        }
        if (cancelled) return

        const nextSession = {
          token: sessionBody.token,
          visitorId: sessionBody.visitorId,
          widgetConfig: sessionBody.widgetConfig,
        }
        setSession(nextSession)

        if (sessionBody.visitorId && sessionBody.visitorId !== visitorIdRef.current) {
          visitorIdRef.current = sessionBody.visitorId
          setVisitorIdFromParent(sessionBody.visitorId)
          postToParent({ type: "advan:visitor_id", visitorId: sessionBody.visitorId })
        }

        connectSocket(nextSession.token)

        const sessions = await loadSessionList(nextSession.token, lastViewedMapRef.current)
        if (cancelled) return
        setView(sessions.length > 0 ? "session-list" : "new-session")
      } catch {
        if (cancelled) return
        setErrorText("Unable to load chat right now.")
        setView("error")
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable bootstrap; see comment above
  }, [widgetKey, origin])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, agentTyping])

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect()
    }
  }, [])

  const submitNewSession = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session) return

    const cleanName = displayName.trim()
    if (!cleanName) {
      setNameError("Please enter your name.")
      return
    }

    // Build subject from first pre-chat answer if available
    const questions = session.widgetConfig?.preChatQuestions || []
    const firstQuestion = questions[0]
    const subject = firstQuestion ? preChatAnswers[firstQuestion.id]?.trim() : undefined

    setNameError(null)
    setCreating(true)

    try {
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          displayName: cleanName,
          initialMessage: initialMessage.trim() || undefined,
          subject,
        }),
      })

      if (!res.ok) throw new Error("create_session_failed")
      const body = await res.json() as { conversationId: string }

      const sessions = await loadSessionList(session.token)
      const created =
        sessions.find((s) => s.conversationId === body.conversationId) ?? {
          conversationId: body.conversationId,
          customerDisplayName: cleanName,
          status: "active" as const,
          lastMessagePreview: initialMessage.trim(),
          lastActivityAt: new Date().toISOString(),
          hasUnreadAgentReply: false,
        }

      setDisplayName("")
      setInitialMessage("")
      await openConversation(created)
    } catch {
      setErrorText("Could not create conversation. Please try again.")
      setView("error")
    } finally {
      setCreating(false)
    }
  }, [session, displayName, initialMessage, loadSessionList, openConversation])

  const backToSessionList = useCallback(() => {
    if (activeConversationId) {
      markViewed(activeConversationId)
      leaveConversation(activeConversationId)
    }
    setView("session-list")
  }, [activeConversationId, markViewed, leaveConversation])

  const sendMessage = useCallback(async () => {
    if (!activeConversationId || !session || !input.trim() || sending) return

    const text = input.trim()
    const optimisticId = nextId()
    setInput("")
    setSending(true)

    setMessages((prev) => [...prev, {
      id: optimisticId,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    }])

    try {
      socketRef.current?.emit("visitor:message", {
        conversationId: activeConversationId,
        content: text,
      })
      // Fallback if Redis/socket fan-out misses the auto-reply.
      pollForAgentReply(session.token, activeConversationId)
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
    } finally {
      setSending(false)
    }
  }, [activeConversationId, session, input, sending, pollForAgentReply])

  const activeHeaderLabel =
    activeDisplayName?.trim() ||
    truncate(activeSessionSummary?.lastMessagePreview || "Chat visitor")

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground select-none" style={{ fontFamily: "var(--font-sans, system-ui, sans-serif)" }}>
      <header className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {showBack && (
            <button
              type="button"
              onClick={backToSessionList}
              className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-white/15 transition-colors"
              aria-label="Back to conversation list"
            >
              <IconBack className="w-4 h-4" />
            </button>
          )}

          <AgentPresenceStack
            online={agentOnline}
            agents={agents}
            agentCount={agentCount}
            teamName={teamName}
          />

          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug truncate">
              {view === "chat" ? activeHeaderLabel : (agentOnline ? presenceTitle(agents, teamName, agentCount) : teamName)}
            </p>
            <p className="text-[11px] leading-snug flex items-center gap-1.5 opacity-80">
              <span className={`w-1.5 h-1.5 rounded-full inline-block ${agentOnline ? "bg-emerald-400" : "bg-amber-300"}`} />
              <span className="truncate">
                {agentOnline ? (agentCount > 1 ? `${agentCount} teammates online` : "We're online") : "Offline"}
              </span>
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-label="Close chat"
          onClick={() => postToParent({ type: "advan:close" })}
          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/15 transition-colors"
        >
          <IconX className="w-4 h-4" />
        </button>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {view === "loading" && <div className="flex-1 flex items-center justify-center"><TypingDots /></div>}

        {view === "error" && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
            <IconAlert className="w-8 h-8 text-destructive" />
            <p className="text-sm font-medium">{errorText ?? "Something went wrong."}</p>
          </div>
        )}

        {view === "session-list" && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="p-3 border-b border-border">
              <button
                type="button"
                onClick={() => setView("new-session")}
                className="w-full rounded-lg bg-primary text-primary-foreground py-2 text-sm font-medium hover:bg-primary/90"
              >
                New conversation
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {sessionList.map((sessionRow) => {
                const label = sessionRow.customerDisplayName?.trim() || truncate(sessionRow.lastMessagePreview || "Chat visitor")
                return (
                  <button
                    key={sessionRow.conversationId}
                    type="button"
                    onClick={() => void openConversation(sessionRow)}
                    className="w-full text-left rounded-xl border border-border bg-card px-3 py-2.5 hover:border-primary/40 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{label}</p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{relativeTime(sessionRow.lastActivityAt)}</span>
                    </div>

                    <div className="mt-1.5 flex items-center gap-2">
                      <span className={[
                        "text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize",
                        sessionRow.status === "active" ? "bg-[#DCFCE7] text-[#166534]" :
                        sessionRow.status === "waiting" ? "bg-[#FEF3C7] text-[#92400E]" :
                        "bg-[var(--dash-bg-deep)] text-[var(--dash-ink-soft)]",
                      ].join(" ")}>{sessionRow.status}</span>

                      {sessionRow.hasUnreadAgentReply && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-primary font-semibold">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                          New reply
                        </span>
                      )}
                    </div>

                    {sessionRow.lastMessagePreview && (
                      <p className="mt-1.5 text-[11px] text-muted-foreground line-clamp-2">{sessionRow.lastMessagePreview}</p>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {view === "new-session" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <form onSubmit={(e) => void submitNewSession(e)} className="flex flex-col h-full">
              {/* Scrollable content area */}
              <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 space-y-3">
                {/* Name Field - Always visible */}
                <div>
                  <label className="block text-[11px] font-semibold text-foreground mb-1">Your name *</label>
                  <input
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value)
                      if (nameError) setNameError(null)
                    }}
                    placeholder="Jane Smith"
                    className="w-full px-2.5 py-1.5 rounded-md border border-border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                  {nameError && <p className="mt-0.5 text-[10px] text-destructive">{nameError}</p>}
                </div>

                {/* Pre-chat Questions */}
                {session?.widgetConfig?.preChatFormEnabled &&
                  session.widgetConfig.preChatQuestions.map((question) => (
                    <div key={question.id}>
                      <label className="block text-[11px] font-semibold text-foreground mb-1">
                        {question.text}
                        {question.required && <span className="text-destructive ml-0.5">*</span>}
                      </label>
                      {question.type === "preset" && question.options && question.options.length > 0 ? (
                        <select
                          value={preChatAnswers[question.id] || ""}
                          onChange={(e) =>
                            setPreChatAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))
                          }
                          required={question.required}
                          className="w-full px-2.5 py-1.5 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                        >
                          <option value="">Select...</option>
                          {question.options.map((opt, idx) => (
                            <option key={idx} value={opt}>
                              {opt}
                            </option>
                          ))}
                          <option value="__other__">Other</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={preChatAnswers[question.id] || ""}
                          onChange={(e) =>
                            setPreChatAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))
                          }
                          required={question.required}
                          placeholder="Type here..."
                          className="w-full px-2.5 py-1.5 rounded-md border border-border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                        />
                      )}
                    </div>
                  ))}

                {/* Additional Message - Compact */}
                <div>
                  <label className="block text-[11px] font-semibold text-foreground mb-1">
                    Additional details <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={initialMessage}
                    onChange={(e) => setInitialMessage(e.target.value)}
                    rows={2}
                    placeholder="Describe your issue..."
                    className="w-full px-2.5 py-1.5 rounded-md border border-border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
                  />
                </div>
              </div>

              {/* Fixed Submit Button */}
              <div className="px-4 pb-4 pt-2 border-t border-border bg-background/80 backdrop-blur-sm">
                <button
                  type="submit"
                  disabled={creating}
                  className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 shadow-sm transition-colors"
                >
                  {creating ? "Starting..." : "Start conversation"}
                </button>
              </div>
            </form>
          </div>
        )}

        {view === "chat" && (
          <>
            {activeStatus === "resolved" && (
              <div className="mx-3 mt-3 rounded-lg border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground">
                This was marked resolved — sending a message will reopen it.
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
              {messages.length === 0 && (
                <div className="flex items-start gap-2">
                  <AgentAvatar initials={agents[0]?.initials} name={agents[0]?.name} />
                  <div className="max-w-[80%] bg-card border border-border rounded-2xl rounded-tl-sm px-3 py-2 text-sm shadow-sm">
                    How can we help?
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div key={msg.id} className={`flex items-end gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  {msg.role === "agent" && (
                    <AgentAvatar initials={agents[0]?.initials} name={agents[0]?.name} />
                  )}
                  <div
                    className={[
                      "max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm whitespace-pre-wrap break-words",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-card border border-border text-foreground rounded-bl-sm",
                    ].join(" ")}
                  >
                    {msg.content}
                  </div>
                  {msg.role === "user" && <VisitorAvatar />}
                </div>
              ))}

              {agentTyping && (
                <div className="flex items-end gap-2">
                  <AgentAvatar initials={agents[0]?.initials} name={agents[0]?.name} />
                  <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-3 py-3 shadow-sm">
                    <TypingDots />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="flex-shrink-0 border-t border-border bg-background px-3 py-2.5">
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value)
                    const el = e.target
                    el.style.height = "auto"
                    el.style.height = `${Math.min(el.scrollHeight, 100)}px`
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      void sendMessage()
                    }
                  }}
                  placeholder="Type a message..."
                  disabled={sending}
                  className="flex-1 resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 overflow-y-auto"
                  style={{ minHeight: "36px", maxHeight: "100px" }}
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={!input.trim() || sending}
                  className="flex-shrink-0 w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40"
                  aria-label="Send message"
                >
                  <IconSend className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      <style>{`
        @keyframes advan-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function TypingDots() {
  return (
    <span className="flex items-center gap-[3px]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60"
          style={{ animation: `advan-bounce 1.2s infinite ${i * 0.2}s` }}
        />
      ))}
    </span>
  )
}

function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function IconSend({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function IconAlert({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

function IconBack({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}
