"use client"

import { useState } from "react"
import { Eye, EyeOff, Copy, RefreshCw, Trash2, Globe, Plus, X, AlertTriangle, Check, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api/trpc-client"
import { DashCard } from "@/components/dashboard/page-header"

export function ChatWidgetSettings() {
  const { data: config, isLoading, refetch } = api.widgetConfig.get.useQuery()

  const createMut = api.widgetConfig.create.useMutation({
    onSuccess: () => {
      toast.success("Chat widget set up successfully!")
      refetch()
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create widget config.")
    },
  })

  const updateMut = api.widgetConfig.updateOrigins.useMutation({
    onSuccess: () => {
      toast.success("Allowed origins updated successfully.")
      refetch()
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update origins.")
    },
  })

  const rotateMut = api.widgetConfig.rotateKey.useMutation({
    onSuccess: () => {
      toast.success("Widget key rotated successfully! Please update your embed snippets.")
      refetch()
    },
    onError: (err) => {
      toast.error(err.message || "Failed to rotate key.")
    },
  })

  const deleteMut = api.widgetConfig.delete.useMutation({
    onSuccess: () => {
      toast.success("Chat widget disabled and configuration removed.")
      refetch()
    },
    onError: (err) => {
      toast.error(err.message || "Failed to disable widget.")
    },
  })

  const updateQuestionsMut = api.widgetConfig.updatePreChatQuestions.useMutation({
    onSuccess: () => {
      toast.success("Pre-chat questions updated successfully.")
      refetch()
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update questions.")
    },
  })

  const toggleFormMut = api.widgetConfig.togglePreChatForm.useMutation({
    onSuccess: () => {
      toast.success("Pre-chat form setting updated.")
      refetch()
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update setting.")
    },
  })

  const [showKey, setShowKey] = useState(false)
  const [newOrigin, setNewOrigin] = useState("")
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedSnippet, setCopiedSnippet] = useState(false)
  const [copiedDirectUrl, setCopiedDirectUrl] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<{
    id?: string
    text: string
    type: "preset" | "custom"
    options: string[]
    required: boolean
  } | null>(null)
  const [newOption, setNewOption] = useState("")

  if (isLoading) {
    return (
      <DashCard title="Chat Widget" icon={<Globe className="w-[18px] h-[18px]" />} padded>
        <div className="flex items-center gap-2 text-[13px] text-[var(--dash-ink-soft)] font-medium">
          <RefreshCw className="w-4 h-4 animate-spin text-[var(--dash-accent)]" />
          <span>Loading widget settings...</span>
        </div>
      </DashCard>
    )
  }

  if (!config) {
    return (
      <DashCard title="Chat Widget" icon={<Globe className="w-[18px] h-[18px]" />} padded>
        <div className="flex flex-col items-stretch sm:items-start gap-3.5 max-w-xl">
          <p className="text-[13px] text-[var(--dash-ink-soft)] leading-relaxed">
            Deploy the Advan Chat Widget to your website to engage visitors, run automated ground-truth AI triage, and generate tracking tickets directly in your inbox.
          </p>
          <button
            type="button"
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
            className="inline-flex min-h-11 h-11 sm:h-9 w-full sm:w-auto items-center justify-center rounded-lg bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] px-4 text-[13px] font-semibold text-white shadow-[0_4px_12px_-5px_rgba(107,92,214,0.4)] hover:-translate-y-px transition active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createMut.isPending ? "Configuring..." : "Set up chat widget"}
          </button>
        </div>
      </DashCard>
    )
  }

  const handleCopy = (text: string, isSnippet: boolean) => {
    navigator.clipboard.writeText(text)
    if (isSnippet) {
      setCopiedSnippet(true)
      setTimeout(() => setCopiedSnippet(false), 2000)
    } else {
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    }
    toast.success(isSnippet ? "Embed snippet copied!" : "Widget key copied!")
  }

  const handleAddOrigin = (e: React.FormEvent) => {
    e.preventDefault()
    let trimmed = newOrigin.trim()
    if (!trimmed) return

    // Normalise/Format check: Ensure it has protocol. Default to https:// if missing
    if (!/^https?:\/\//i.test(trimmed)) {
      trimmed = "https://" + trimmed
    }

    try {
      const url = new URL(trimmed)
      const origin = url.origin
      
      // Basic validation: ensure it has a proper host (not just e.g. https://)
      if (!url.hostname || url.hostname.indexOf(".") === -1 && url.hostname !== "localhost") {
        throw new Error("Invalid hostname")
      }

      if (config.allowedOrigins.includes(origin)) {
        toast.error("This origin is already added.")
        return
      }

      updateMut.mutate({ allowedOrigins: [...config.allowedOrigins, origin] })
      setNewOrigin("")
    } catch {
      toast.error("Please enter a valid domain origin (e.g. https://example.com)")
    }
  }

  const handleRemoveOrigin = (index: number) => {
    const newOrigins = [...config.allowedOrigins]
    newOrigins.splice(index, 1)
    updateMut.mutate({ allowedOrigins: newOrigins })
  }

  const handleRotate = () => {
    if (confirm("WARNING: Rotating your Widget Key will IMMEDIATELY break any live website integrations running your current snippet. Are you sure you want to proceed?")) {
      rotateMut.mutate()
      setShowKey(true)
    }
  }

  const handleDelete = () => {
    if (confirm("WARNING: Disabling the Chat Widget will permanently delete its configuration and block any in-flight visitor sessions. Are you sure?")) {
      deleteMut.mutate()
    }
  }

  const handleAddQuestion = () => {
    setEditingQuestion({
      text: "",
      type: "custom",
      options: [],
      required: false,
    })
  }

  const handleSaveQuestion = () => {
    if (!editingQuestion || !editingQuestion.text.trim()) {
      toast.error("Question text is required.")
      return
    }

    const questions = config.preChatQuestions || []
    const newQuestion = {
      id: editingQuestion.id || `q_${Date.now()}`,
      text: editingQuestion.text.trim(),
      type: editingQuestion.type,
      options: editingQuestion.type === "preset" ? editingQuestion.options : undefined,
      required: editingQuestion.required,
    }

    const updated = editingQuestion.id
      ? questions.map(q => q.id === editingQuestion.id ? newQuestion : q)
      : [...questions, newQuestion]

    updateQuestionsMut.mutate({ questions: updated })
    setEditingQuestion(null)
  }

  const handleDeleteQuestion = (questionId: string) => {
    const questions = (config.preChatQuestions || []).filter(q => q.id !== questionId)
    updateQuestionsMut.mutate({ questions })
  }

  const handleAddOption = () => {
    if (!editingQuestion || !newOption.trim()) return
    setEditingQuestion({
      ...editingQuestion,
      options: [...editingQuestion.options, newOption.trim()],
    })
    setNewOption("")
  }

  const handleRemoveOption = (index: number) => {
    if (!editingQuestion) return
    const options = [...editingQuestion.options]
    options.splice(index, 1)
    setEditingQuestion({ ...editingQuestion, options })
  }

  const embedSnippet = `<script src="https://example.com/widget.js"></script>\n<script>\n  window.AdvanChat = { key: "${config.widgetKey}" };\n</script>`
  const directChatUrl = typeof window !== "undefined" ? `${window.location.origin}/chat/${config.widgetKey}` : `/chat/${config.widgetKey}`

  return (
    <DashCard title="Chat Widget" icon={<Globe className="w-[18px] h-[18px]" />} padded>
      <div className="space-y-5 sm:space-y-6 max-w-2xl 3xl:max-w-3xl 4xl:max-w-4xl">
        {/* Widget Key */}
        <div className="space-y-2">
          <label className="text-[13px] font-bold text-[var(--dash-ink)]">Widget Key</label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex-1 min-w-0 flex items-center justify-between gap-2 border dash-border-soft rounded-lg px-3 sm:px-3.5 py-2.5 bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
              <span className="min-w-0 text-[12px] sm:text-[13px] font-mono select-all text-[var(--dash-ink-soft)] tracking-tight break-all">
                {showKey ? config.widgetKey : "wk_live_••••••••••••••••••••••••••••••••"}
              </span>
              <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="flex min-h-9 min-w-9 h-9 w-9 items-center justify-center rounded-md text-[var(--dash-ink-faint)] hover:text-[var(--dash-ink)] hover:bg-[var(--dash-bg)] transition-colors"
                  title={showKey ? "Hide key" : "Reveal key"}
                  aria-label={showKey ? "Hide key" : "Reveal key"}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(config.widgetKey, false)}
                  className="flex min-h-9 min-w-9 h-9 w-9 items-center justify-center rounded-md text-[var(--dash-ink-faint)] hover:text-[var(--dash-ink)] hover:bg-[var(--dash-bg)] transition-colors"
                  title="Copy key"
                  aria-label="Copy key"
                >
                  {copiedKey ? <Check className="w-4 h-4 text-[var(--dash-sage)]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRotate}
              disabled={rotateMut.isPending}
              className="inline-flex min-h-11 h-11 sm:h-[38px] w-full sm:w-[38px] items-center justify-center gap-1.5 border dash-border-soft bg-white text-[var(--dash-ink-soft)] rounded-lg hover:bg-[var(--dash-bg-deep)] transition active:scale-95 disabled:opacity-50"
              title="Rotate Key (Breaks old snippet)"
              aria-label="Rotate widget key"
            >
              <RefreshCw className={`w-4 h-4 ${rotateMut.isPending ? "animate-spin text-[var(--dash-accent)]" : ""}`} />
              <span className="sm:hidden text-[13px] font-semibold">Rotate key</span>
            </button>
          </div>
          <p className="text-[11.5px] text-[var(--dash-ink-faint)] leading-normal">
            Your public key maps the widget&apos;s customer sessions straight to your organization account. Rotate only if your script is compromised.
          </p>
        </div>

        {/* Allowed Origins */}
        <div className="space-y-3">
          <label className="text-[13px] font-bold text-[var(--dash-ink)]">Allowed Origins</label>
          <div className="space-y-1.5">
            {config.allowedOrigins.length === 0 && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3 sm:p-3.5 text-amber-800 text-[12.5px] leading-relaxed shadow-[0_2px_8px_-4px_rgba(245,158,11,0.15)]">
                <AlertTriangle className="w-[18px] h-[18px] text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="font-bold text-amber-900 block mb-0.5">Widget is Locked (Fails Closed)</span>
                  No allowed origins have been specified. For security, the widget will block any incoming sessions and fail closed until you add at least one verified origin domain below (e.g. <code className="break-all">https://example.com</code> or <code className="break-all">http://localhost:3000</code>).
                </div>
              </div>
            )}
            {config.allowedOrigins.map((origin: string, i: number) => (
              <div key={i} className="flex items-center justify-between gap-2 border border-transparent hover:border-[var(--dash-line)] rounded-lg px-3 py-2 sm:py-1.5 bg-[var(--dash-bg-deep)] transition min-w-0">
                <span className="min-w-0 text-[12px] sm:text-[12.5px] font-mono text-[var(--dash-ink-soft)] break-all">{String(origin)}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveOrigin(i)}
                  className="flex min-h-9 min-w-9 h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--dash-ink-faint)] hover:text-[var(--dash-rose)] hover:bg-white transition-colors"
                  title="Remove Origin"
                  aria-label={`Remove ${origin}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          
          <form onSubmit={handleAddOrigin} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="https://yourwebsite.com"
              value={newOrigin}
              onChange={(e) => setNewOrigin(e.target.value)}
              className="flex-1 min-h-11 sm:min-h-9 h-11 sm:h-9 text-[13px] border dash-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#6B5CD6]/15] focus:border-[#9D91EA] transition"
            />
            <button
              type="submit"
              disabled={!newOrigin.trim() || updateMut.isPending}
              className="inline-flex items-center justify-center gap-1.5 px-4 min-h-11 h-11 sm:h-9 bg-[var(--dash-accent)] text-white hover:bg-[var(--dash-accent-deep)] rounded-lg text-[13px] font-bold transition disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </form>
          <p className="text-[11.5px] text-[var(--dash-ink-faint)] leading-normal">
            Enforce a strict exact-match domain allowlist (e.g. <code className="break-all">https://example.com</code> or <code className="break-all">http://localhost:3000</code>) to block unauthorized embeds or session hijackers.
          </p>
        </div>

        {/* Pre-chat Questions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[13px] font-bold text-[var(--dash-ink)]">Pre-Chat Questions</label>
            <button
              type="button"
              onClick={() => toggleFormMut.mutate({ enabled: !config.preChatFormEnabled })}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition ${
                config.preChatFormEnabled
                  ? "bg-[var(--dash-sage-wash)] text-[var(--dash-sage)]"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {config.preChatFormEnabled ? "Enabled" : "Disabled"}
            </button>
          </div>
          <p className="text-[11.5px] text-[var(--dash-ink-faint)] leading-normal">
            Ask visitors questions before the chat starts to generate better ticket titles and gather context. Questions are shown when the widget opens.
          </p>

          {config.preChatFormEnabled && (
            <>
              <div className="space-y-2">
                {(config.preChatQuestions || []).map((question) => (
                  <div
                    key={question.id}
                    className="flex items-start justify-between gap-3 border dash-border rounded-lg p-3 bg-white"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[12.5px] font-semibold text-[var(--dash-ink)]">
                          {question.text}
                        </span>
                        {question.required && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                            REQUIRED
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[var(--dash-ink-faint)]">
                        <span className="font-mono">
                          {question.type === "preset" ? "Dropdown" : "Free text"}
                        </span>
                        {question.type === "preset" && question.options && question.options.length > 0 && (
                          <span>· {question.options.length} options</span>
                        )}
                      </div>
                      {question.type === "preset" && question.options && question.options.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {question.options.map((opt, i) => (
                            <span
                              key={i}
                              className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--dash-bg-deep)] text-[var(--dash-ink-soft)]"
                            >
                              {opt}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingQuestion({
                            ...question,
                            options: question.options ?? [],
                            required: question.required ?? true,
                          })
                        }
                        className="flex min-h-9 min-w-9 h-9 w-9 items-center justify-center rounded-md text-[var(--dash-ink-faint)] hover:text-[var(--dash-accent)] hover:bg-[var(--dash-bg)] transition-colors"
                        title="Edit question"
                      >
                        <Plus className="w-4 h-4 rotate-45" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(question.id)}
                        className="flex min-h-9 min-w-9 h-9 w-9 items-center justify-center rounded-md text-[var(--dash-ink-faint)] hover:text-[var(--dash-rose)] hover:bg-white transition-colors"
                        title="Remove question"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {!editingQuestion && (
                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="inline-flex items-center justify-center gap-1.5 px-4 h-9 bg-white border dash-border rounded-lg text-[13px] font-bold text-[var(--dash-accent)] hover:bg-[var(--dash-bg)] transition"
                >
                  <Plus className="w-4 h-4" /> Add question
                </button>
              )}

              {editingQuestion && (
                <div className="border-2 border-[var(--dash-accent)]/20 rounded-lg p-4 bg-[var(--dash-accent)]/[0.02] space-y-3">
                  <div className="space-y-2">
                    <label className="text-[12px] font-bold text-[var(--dash-ink)]">Question Text</label>
                    <input
                      type="text"
                      value={editingQuestion.text}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, text: e.target.value })}
                      placeholder="What do you need help with?"
                      className="w-full h-9 text-[13px] border dash-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#6B5CD6]/15 focus:border-[#9D91EA] transition"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[12px] font-bold text-[var(--dash-ink)]">Question Type</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingQuestion({ ...editingQuestion, type: "custom", options: [] })}
                        className={`flex-1 h-9 text-[12px] font-bold rounded-lg transition ${
                          editingQuestion.type === "custom"
                            ? "bg-[var(--dash-accent)] text-white"
                            : "bg-white border dash-border text-[var(--dash-ink-soft)]"
                        }`}
                      >
                        Free Text
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingQuestion({ ...editingQuestion, type: "preset" })}
                        className={`flex-1 h-9 text-[12px] font-bold rounded-lg transition ${
                          editingQuestion.type === "preset"
                            ? "bg-[var(--dash-accent)] text-white"
                            : "bg-white border dash-border text-[var(--dash-ink-soft)]"
                        }`}
                      >
                        Dropdown Options
                      </button>
                    </div>
                  </div>

                  {editingQuestion.type === "preset" && (
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-[var(--dash-ink)]">Options</label>
                      {editingQuestion.options.length > 0 && (
                        <div className="space-y-1">
                          {editingQuestion.options.map((opt, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="flex-1 text-[12px] text-[var(--dash-ink-soft)]">{opt}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveOption(i)}
                                className="flex h-7 w-7 items-center justify-center rounded text-[var(--dash-ink-faint)] hover:text-[var(--dash-rose)]"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newOption}
                          onChange={(e) => setNewOption(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddOption())}
                          placeholder="Add option..."
                          className="flex-1 h-9 text-[12px] border dash-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#6B5CD6]/15 focus:border-[#9D91EA]"
                        />
                        <button
                          type="button"
                          onClick={handleAddOption}
                          disabled={!newOption.trim()}
                          className="h-9 px-3 text-[12px] font-bold bg-white border dash-border rounded-lg hover:bg-[var(--dash-bg)] disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="required"
                      checked={editingQuestion.required}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, required: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-[var(--dash-accent)] focus:ring-[var(--dash-accent)]"
                    />
                    <label htmlFor="required" className="text-[12px] font-semibold text-[var(--dash-ink-soft)]">
                      Required field
                    </label>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t dash-border-soft">
                    <button
                      type="button"
                      onClick={() => setEditingQuestion(null)}
                      className="h-9 px-4 text-[13px] font-bold text-[var(--dash-ink-soft)] hover:bg-white rounded-lg transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveQuestion}
                      disabled={!editingQuestion.text.trim() || updateQuestionsMut.isPending}
                      className="h-9 px-4 text-[13px] font-bold bg-[var(--dash-accent)] text-white rounded-lg hover:bg-[var(--dash-accent-deep)] disabled:opacity-50 transition"
                    >
                      {updateQuestionsMut.isPending ? "Saving..." : "Save Question"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Embed Snippet */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-[13px] font-bold text-[var(--dash-ink)]">Embed Snippet</label>
            <button
              type="button"
              onClick={() => handleCopy(embedSnippet, true)}
              className="min-h-9 inline-flex text-[12px] font-bold text-[var(--dash-accent-deep)] hover:underline items-center gap-1 px-1"
            >
              {copiedSnippet ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[var(--dash-sage)]" /> Snippet copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy code
                </>
              )}
            </button>
          </div>
          <div className="relative">
            <pre className="text-[11px] sm:text-[11.5px] p-3 sm:p-4 rounded-xl bg-zinc-950 text-zinc-50 overflow-x-auto overscroll-x-contain border border-zinc-900 leading-relaxed font-mono max-w-full">
              {embedSnippet}
            </pre>
          </div>
          <p className="text-[11.5px] text-[var(--dash-ink-faint)] leading-normal">
            Paste this snippet into the HTML body or <code>&lt;head&gt;</code> script header of any allowed origin site.
          </p>
        </div>

        {/* Direct Hosted Chat Page URL */}
        <div className="space-y-2.5 pt-4 border-t dash-border-soft">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <label className="text-[13px] font-bold text-[var(--dash-ink)]">Direct Hosted Chat URL</label>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]">
                Hosted Link
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(directChatUrl)
                  setCopiedDirectUrl(true)
                  setTimeout(() => setCopiedDirectUrl(false), 2000)
                  toast.success("Direct chat URL copied!")
                }}
                className="min-h-9 inline-flex text-[12px] font-bold text-[var(--dash-accent-deep)] hover:underline items-center gap-1 px-1"
              >
                {copiedDirectUrl ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[var(--dash-sage)]" /> URL copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copy link
                  </>
                )}
              </button>
              <a
                href={directChatUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-9 inline-flex text-[12px] font-bold text-[var(--dash-ink-soft)] hover:text-[var(--dash-ink)] items-center gap-1 px-2.5 py-1 rounded-lg border dash-border bg-white hover:bg-[var(--dash-bg)] transition"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[var(--dash-accent)]" /> Open chat page
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2 border dash-border-soft rounded-lg px-3 py-2 bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] min-w-0">
            <Globe className="w-4 h-4 shrink-0 text-[var(--dash-accent)]" />
            <span className="text-[12px] sm:text-[12.5px] font-mono text-[var(--dash-ink-soft)] select-all truncate">
              {directChatUrl}
            </span>
          </div>
          <p className="text-[11.5px] text-[var(--dash-ink-faint)] leading-normal">
            Share this direct link with customers via email, SMS, or support tickets to let them interact with your AI agent on a dedicated full-page interface without embedding any code.
          </p>
        </div>

        {/* Danger Zone */}
        <div className="pt-5 border-t dash-border-soft flex justify-stretch sm:justify-end">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteMut.isPending}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-4 min-h-11 h-11 sm:h-9 text-[var(--dash-rose)] border border-[var(--dash-rose)]/20 hover:bg-[var(--dash-rose-wash)] rounded-lg text-[13px] font-bold transition"
          >
            <Trash2 className="w-4 h-4" /> Disable widget
          </button>
        </div>
      </div>
    </DashCard>
  )
}
