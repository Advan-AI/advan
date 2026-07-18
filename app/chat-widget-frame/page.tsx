"use client"

/**
 * /chat-widget-frame
 *
 * Standalone React page rendered inside a sandboxed <iframe> by the
 * widget embed loader (public/widget.js).
 *
 * URL params:
 *   key     — widgetKey (required); matches widget_configs.widgetKey
 *   origin  — the embedding page's origin forwarded to the session endpoint
 *             so allowedOrigins is checked against the actual embedding site
 *
 * Flow:
 *   1. GET /api/chat/availability → agentsOnline, preChatFormEnabled
 *   2. If preChatFormEnabled && !agentsOnline → show pre-chat form (name+email)
 *   3. POST /api/chat/session → { token, visitorSessionId }
 *   4. POST /api/chat/intake  → { conversationId }  (first message or form submit)
 *   5. Connect socket.io /chat-widget with { token, conversationId }
 *   6. Subsequent messages → socket emit visitor:message
 *
 * postMessage to parent:
 *   { type: 'advan:close' }  — close the panel
 *   { type: 'advan:ready' }  — widget mounted
 */

import { useEffect, useRef, useState, useCallback, KeyboardEvent } from "react"
import * as SocketIO from "socket.io-client"
import {
  AgentAvatar,
  AgentPresenceStack,
  VisitorAvatar,
  presenceTitle,
  type PresenceAgent,
} from "./presence"

// ── Types ──────────────────────────────────────────────────────────────────────

type Phase =
  | "loading"       // fetching availability
  | "pre-chat"      // offline pre-chat form
  | "chatting"      // live conversation
  | "offline-sent"  // offline form submitted
  | "error"

interface Message {
  id: string
  role: "user" | "agent"
  content: string
  ts: Date
  pending?: boolean
}

interface SessionState {
  token: string
  visitorSessionId: string
  orgId: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const SOCKET_URL =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_SOCKET_URL
    ? (process.env.NEXT_PUBLIC_SOCKET_URL as string)
    : typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:3002`
      : "http://localhost:3002"

const LS_SESSION = "advan_widget_vsid"
const LS_CONV    = "advan_widget_cid"

// ── Helpers ────────────────────────────────────────────────────────────────────

function postToParent(msg: Record<string, unknown>) {
  try { window.parent.postMessage(msg, "*") } catch { /* sandboxed — best effort */ }
}

function lsGet(k: string): string | null {
  try { return localStorage.getItem(k) } catch { return null }
}
function lsSet(k: string, v: string) {
  try { localStorage.setItem(k, v) } catch { /* ignore */ }
}

function getValidSessionId(): string | undefined {
  const id = lsGet(LS_SESSION)
  if (!id) return undefined
  const isValid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  if (!isValid) {
    try { localStorage.removeItem(LS_SESSION) } catch {}
    return undefined
  }
  return id
}

function localId() {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** Decode the public JWT payload (not secret — just org metadata). */
function jwtPayload(jwt: string): Record<string, unknown> {
  try {
    const [, b64] = jwt.split(".")
    return JSON.parse(atob(b64.replace(/-/g, "+").replace(/_/g, "/")))
  } catch {
    return {}
  }
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ChatWidgetFrame() {
  // URL params
  const [widgetKey, setWidgetKey]           = useState<string | null>(null)
  const [embeddingOrigin, setEmbeddingOrigin] = useState<string | null>(null)

  // App state
  const [phase, setPhase]     = useState<Phase>("loading")
  const [errMsg, setErrMsg]   = useState<string | null>(null)
  const [agentOnline, setAgentOnline]   = useState(false)
  const [agentCount, setAgentCount]     = useState(0)
  const [teamName, setTeamName]         = useState("Support")
  const [agents, setAgents]             = useState<PresenceAgent[]>([])
  const [preChatEnabled, setPreChatEnabled] = useState(false)
  const [agentTyping, setAgentTyping]   = useState(false)
  const [messages, setMessages]         = useState<Message[]>([])

  // Session
  const sessionRef  = useRef<SessionState | null>(null)
  const convIdRef   = useRef<string | null>(null)

  // Pre-chat form
  const [formName, setFormName]   = useState("")
  const [formEmail, setFormEmail] = useState("")

  // Composer
  const [input, setInput]     = useState("")
  const [sending, setSending] = useState(false)

  // Refs
  const socketRef      = useRef<ReturnType<typeof SocketIO.connect> | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTyping       = useRef(false)
  const textareaRef    = useRef<HTMLTextAreaElement>(null)

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const p      = new URLSearchParams(window.location.search)
    const key    = p.get("key")?.trim() ?? null
    const origin = p.get("origin")?.trim() ?? window.location.origin
    setWidgetKey(key)
    setEmbeddingOrigin(origin)
    postToParent({ type: "advan:ready" })
  }, [])

  // ── Step 1: Availability ───────────────────────────────────────────────────
  useEffect(() => {
    if (!widgetKey) return
    ;(async () => {
      try {
        const r = await fetch(`/api/chat/availability?widgetKey=${encodeURIComponent(widgetKey)}`)
        if (r.status === 404) { fail("Widget not configured."); return }
        if (!r.ok)            { fail("Unable to load chat."); return }
        const data = await r.json() as {
          agentsOnline: boolean
          agentCount?: number
          teamName?: string
          agents?: PresenceAgent[]
          preChatFormEnabled: boolean
        }
        setAgentOnline(data.agentsOnline)
        setAgentCount(data.agentCount ?? (data.agentsOnline ? 1 : 0))
        setTeamName(data.teamName?.trim() || "Support")
        setAgents(Array.isArray(data.agents) ? data.agents : [])
        setPreChatEnabled(data.preChatFormEnabled)

        if (data.preChatFormEnabled && !data.agentsOnline) {
          setPhase("pre-chat")
        } else {
          // Agents online (or no form required) — start session and connect.
          await initSession()
        }
      } catch {
        fail("Network error. Please try again.")
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetKey, embeddingOrigin])

  // ── Session init ───────────────────────────────────────────────────────────
  const initSession = useCallback(async () => {
    if (!widgetKey || !embeddingOrigin) return null
    try {
      const r = await fetch("/api/chat/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widgetKey,
          origin: embeddingOrigin,
          visitorSessionId: getValidSessionId(),
        }),
      })
      if (!r.ok) { fail("Session error. Please refresh."); return null }
      const { token, visitorSessionId, conversationId, previousMessages } = await r.json()
      const { orgId } = jwtPayload(token) as { orgId: string }
      const sess: SessionState = { token, visitorSessionId, orgId }
      sessionRef.current = sess
      lsSet(LS_SESSION, visitorSessionId)

      // Reconnect: restore previous conversationId if available.
      const activeCid = conversationId || lsGet(LS_CONV) || undefined
      convIdRef.current = activeCid ?? null
      if (activeCid) {
        lsSet(LS_CONV, activeCid)
      }

      if (Array.isArray(previousMessages) && previousMessages.length > 0) {
        setMessages(
          previousMessages.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            ts: new Date(m.ts),
          }))
        )
      } else {
        setMessages([])
      }

      connectSocket(token, activeCid)
      setPhase("chatting")
      return sess
    } catch {
      fail("Could not start session.")
      return null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetKey, embeddingOrigin])

  // ── Socket ─────────────────────────────────────────────────────────────────
  const connectSocket = useCallback((token: string, convId?: string) => {
    socketRef.current?.disconnect()
    socketRef.current = null

    // Connect directly to the /chat-widget namespace.
    // socket.io-client v4 accepts the full URL with namespace path.
    const chatNs = SocketIO.connect(`${SOCKET_URL}/chat-widget`, {
      auth: { token, conversationId: convId },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 8,
    })
    socketRef.current = chatNs

    chatNs.on("session:ready", (d: { conversationId: string | null }) => {
      if (d.conversationId) {
        convIdRef.current = d.conversationId
        lsSet(LS_CONV, d.conversationId)
      }
    })

    chatNs.on("agent:message", (d: { messageId: string; content: string }) => {
      setAgentTyping(false)
      addMessage({ id: d.messageId, role: "agent", content: d.content, ts: new Date() })
    })

    chatNs.on("triage:pending", () => {
      addMessage({
        id: "triage-pending",
        role: "agent",
        content: "Someone from the team will reply shortly.",
        ts: new Date(),
      })
    })

    chatNs.on("typing:start",  (d: { role: string }) => { if (d.role === "agent") setAgentTyping(true)  })
    chatNs.on("typing:stop",   (d: { role: string }) => { if (d.role === "agent") setAgentTyping(false) })
    chatNs.on("presence:agent-online", (d: { online: boolean; count?: number }) => {
      setAgentOnline(d.online)
      if (typeof d.count === "number") setAgentCount(d.count)
      else setAgentCount(d.online ? 1 : 0)
    })

    return chatNs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => { socketRef.current?.disconnect() }, [])

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, agentTyping])

  // ── Helpers ────────────────────────────────────────────────────────────────
  function fail(msg: string) {
    setErrMsg(msg)
    setPhase("error")
  }

  function addMessage(m: Message) {
    setMessages((prev) => {
      if (prev.some((msg) => msg.id === m.id)) return prev
      return [...prev, m]
    })
  }

  function emitTypingStart() {
    if (!isTyping.current) { socketRef.current?.emit("typing:start"); isTyping.current = true }
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(emitTypingStop, 800)
  }

  function emitTypingStop() {
    if (isTyping.current) { socketRef.current?.emit("typing:stop"); isTyping.current = false }
    if (typingTimer.current) { clearTimeout(typingTimer.current); typingTimer.current = null }
  }

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || sending) return
    setSending(true)
    emitTypingStop()

    const tmpId = localId()
    addMessage({ id: tmpId, role: "user", content: content.trim(), ts: new Date(), pending: true })

    try {
      const sess = sessionRef.current
      if (!sess) { setSending(false); return }

      const cid = convIdRef.current

      if (cid && socketRef.current?.connected) {
        // Conversation exists → route through socket so the server logs the
        // message and the AI pipeline can reply in real-time.
        socketRef.current.emit("visitor:message", { conversationId: cid, content: content.trim() })
        setMessages((prev) => prev.map((m) => (m.id === tmpId ? { ...m, pending: false } : m)))
      } else {
        // No conversationId yet (first message) — call REST intake to create it.
        const r = await fetch("/api/chat/intake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: sess.token,
            content: content.trim(),
            // orgId is derived server-side from the verified JWT — do not send it.
          }),
        })
        if (!r.ok) throw new Error("intake failed")
        const { conversationId } = await r.json()
        convIdRef.current = conversationId
        lsSet(LS_CONV, conversationId)

        // Reconnect socket with conversationId so replies reach this client.
        connectSocket(sess.token, conversationId)
        setMessages((prev) => prev.map((m) => (m.id === tmpId ? { ...m, pending: false } : m)))
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tmpId))
    } finally {
      setSending(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sending, connectSocket])

  // ── Pre-chat form submit ────────────────────────────────────────────────────
  const submitForm = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!widgetKey || !embeddingOrigin || !formEmail.trim()) return
    setSending(true)
    try {
      // 1. Session
      const sr = await fetch("/api/chat/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widgetKey,
          origin: embeddingOrigin,
          visitorSessionId: getValidSessionId(),
        }),
      })
      if (!sr.ok) { fail("Session failed."); return }
      const { token, visitorSessionId } = await sr.json()
      const { orgId } = jwtPayload(token) as { orgId: string }
      sessionRef.current = { token, visitorSessionId, orgId }
      lsSet(LS_SESSION, visitorSessionId)

      // 2. Intake with email (creates conversation + marks chatOfflineDelivery)
      const ir = await fetch("/api/chat/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          content: "Hi, I need some help.",
          visitorEmail: formEmail.trim(),
          visitorName:  formName.trim() || undefined,
          // orgId and visitorSessionId are derived server-side from the JWT.
        }),
      })
      if (!ir.ok) { fail("Could not submit. Try again."); return }
      const { conversationId } = await ir.json()
      convIdRef.current = conversationId
      if (conversationId) lsSet(LS_CONV, conversationId)
      connectSocket(token, conversationId)
      setPhase("offline-sent")
    } catch {
      fail("Network error.")
    } finally {
      setSending(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetKey, embeddingOrigin, formName, formEmail, connectSocket])

  // ── Composer ───────────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const v = input.trim()
    if (!v) return
    setInput("")
    if (textareaRef.current) { textareaRef.current.style.height = "36px" }
    sendMessage(v)
  }, [input, sendMessage])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
  }, [handleSend])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-dvh bg-background text-foreground overflow-hidden select-none"
         style={{ fontFamily: "var(--font-sans, system-ui, sans-serif)" }}>

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <AgentPresenceStack
            online={agentOnline}
            agents={agents}
            agentCount={agentCount}
            teamName={teamName}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug truncate">
              {agentOnline ? presenceTitle(agents, teamName, agentCount) : teamName}
            </p>
            <p className="text-[11px] leading-snug flex items-center gap-1.5 opacity-80">
              <span
                className={`w-1.5 h-1.5 rounded-full inline-block flex-shrink-0 ${
                  agentOnline ? "bg-emerald-400 shadow-[0_0_0_2px_rgba(52,211,153,0.25)]" : "bg-amber-300"
                }`}
              />
              <span className="truncate">
                {agentOnline
                  ? agentCount > 1
                    ? `${agentCount} teammates online`
                    : "We're online"
                  : "Offline — we'll email you"}
              </span>
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close chat"
          onClick={() => postToParent({ type: "advan:close" })}
          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/15 transition-colors flex-shrink-0"
        >
          <IconX className="w-4 h-4" />
        </button>
      </header>

      {/* Body */}
      <main className="flex-1 overflow-hidden flex flex-col min-h-0">

        {/* Loading */}
        {phase === "loading" && (
          <div className="flex-1 flex items-center justify-center">
            <TypingDots />
          </div>
        )}

        {/* Error */}
        {phase === "error" && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
            <IconAlert className="w-8 h-8 text-destructive" />
            <p className="text-sm font-medium">{errMsg ?? "Something went wrong."}</p>
            <p className="text-xs text-muted-foreground">Please refresh the page or try again later.</p>
          </div>
        )}

        {/* Pre-chat form */}
        {phase === "pre-chat" && (
          <div className="flex-1 overflow-y-auto px-4 py-5">
            <p className="text-sm text-muted-foreground mb-5">
              Our team is offline right now. Leave your details and we&apos;ll
              reply by email as soon as possible.
            </p>
            <form onSubmit={submitForm} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Your name <span className="opacity-50">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Email address <span className="text-destructive">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <button
                type="submit"
                disabled={sending || !formEmail.trim()}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? "Submitting…" : "Start conversation"}
              </button>
            </form>
          </div>
        )}

        {/* Offline sent */}
        {phase === "offline-sent" && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <IconCheck className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-sm font-semibold">Message sent!</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We&apos;ll reply to <span className="font-medium">{formEmail}</span> as soon
              as an agent is available.
            </p>
          </div>
        )}

        {/* Chatting */}
        {phase === "chatting" && (
          <>
            {/* Message list */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
              {messages.length === 0 && (
                <div className="flex items-start gap-2">
                  <AgentAvatar initials={agents[0]?.initials} name={agents[0]?.name} />
                  <div className="max-w-[80%] bg-card border border-border rounded-2xl rounded-tl-sm px-3 py-2 text-sm shadow-sm">
                    How can we help?
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  {msg.role === "agent" && (
                    <AgentAvatar initials={agents[0]?.initials} name={agents[0]?.name} />
                  )}
                  <div
                    className={[
                      "max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm whitespace-pre-wrap break-words",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-card border border-border text-foreground rounded-bl-sm",
                      msg.pending ? "opacity-60" : "",
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

            {/* Composer */}
            <div className="flex-shrink-0 border-t border-border bg-background px-3 py-2.5">
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value)
                    emitTypingStart()
                    const el = e.target
                    el.style.height = "auto"
                    el.style.height = `${Math.min(el.scrollHeight, 100)}px`
                  }}
                  onKeyDown={handleKeyDown}
                  onBlur={emitTypingStop}
                  placeholder="Type a message…"
                  disabled={sending}
                  className="flex-1 resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 overflow-y-auto"
                  style={{ minHeight: "36px", maxHeight: "100px" }}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  aria-label="Send message"
                  className="flex-shrink-0 w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <IconSend className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-1.5 opacity-60">
                Typically replies in a few minutes
              </p>
            </div>
          </>
        )}
      </main>

      {/* Typing animation keyframes — scoped inside the iframe */}
      <style>{`
        @keyframes advan-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%            { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

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

// Minimal inline icons — no external import needed.
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
function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}
