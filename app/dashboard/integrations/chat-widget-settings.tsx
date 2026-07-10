"use client"

import { useState } from "react"
import { Eye, EyeOff, Copy, RefreshCw, Trash2, Globe, Plus, X } from "lucide-react"
import { api } from "@/lib/api/trpc-client"
import { DashCard } from "@/components/dashboard/page-header"

export function ChatWidgetSettings() {
  const { data: config, isLoading, refetch } = api.integrations.getWidgetConfig.useQuery()

  const createMut = api.integrations.createWidgetConfig.useMutation({
    onSuccess: () => refetch(),
  })
  const updateMut = api.integrations.updateWidgetOrigins.useMutation({
    onSuccess: () => refetch(),
  })
  const rotateMut = api.integrations.rotateWidgetKey.useMutation({
    onSuccess: () => refetch(),
  })
  const deleteMut = api.integrations.deleteWidgetConfig.useMutation({
    onSuccess: () => refetch(),
  })

  const [showKey, setShowKey] = useState(false)
  const [newOrigin, setNewOrigin] = useState("")

  if (isLoading) {
    return (
      <DashCard title="Chat Widget" icon={<Globe className="w-[18px] h-[18px]" />} padded>
        <div className="text-[13px] text-muted-foreground">Loading widget settings...</div>
      </DashCard>
    )
  }

  if (!config) {
    return (
      <DashCard title="Chat Widget" icon={<Globe className="w-[18px] h-[18px]" />} padded>
        <div className="flex flex-col items-start gap-3">
          <p className="text-[13px] text-muted-foreground leading-relaxed max-w-lg">
            Deploy the Advan Chat Widget to your website to engage visitors and generate tickets directly.
          </p>
          <button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
            className="h-8 px-4 border border-input rounded-md text-[13px] font-medium hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
          >
            {createMut.isPending ? "Creating..." : "Set up chat widget"}
          </button>
        </div>
      </DashCard>
    )
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const handleAddOrigin = (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = new URL(newOrigin)
      const origin = url.origin
      if (!config.allowedOrigins.includes(origin)) {
        updateMut.mutate({ allowedOrigins: [...config.allowedOrigins, origin] })
      }
      setNewOrigin("")
    } catch {
      alert("Please enter a valid URL (e.g. https://example.com)")
    }
  }

  const handleRemoveOrigin = (index: number) => {
    const newOrigins = [...config.allowedOrigins]
    newOrigins.splice(index, 1)
    updateMut.mutate({ allowedOrigins: newOrigins })
  }

  const handleRotate = () => {
    if (confirm("Are you sure? This will break your existing widget snippet immediately.")) {
      rotateMut.mutate()
      setShowKey(true)
    }
  }

  const handleDelete = () => {
    if (confirm("Are you sure? This will disable the widget entirely.")) {
      deleteMut.mutate()
    }
  }

  const embedSnippet = `<script src="https://example.com/widget.js"></script>\n<script>\n  window.AdvanChat = { key: "${config.widgetKey}" };\n</script>`

  return (
    <DashCard title="Chat Widget" icon={<Globe className="w-[18px] h-[18px]" />} padded>
      <div className="space-y-6 max-w-2xl">
        {/* Widget Key */}
        <div className="space-y-2">
          <label className="text-[13px] font-bold text-foreground">Widget Key</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center justify-between border border-input rounded-md px-3 py-2 bg-muted/30">
              <span className="text-[13px] font-mono select-all">
                {showKey ? config.widgetKey : "wk_live_••••••••••••••••••••••••••••••••"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Reveal key"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleCopy(config.widgetKey)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Copy key"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            <button
              onClick={handleRotate}
              disabled={rotateMut.isPending}
              className="px-3 py-2 text-[13px] font-medium border border-input rounded-md hover:bg-accent transition-colors disabled:opacity-50"
              title="Rotate Key"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[12px] text-muted-foreground">
            Use this key in your embed snippet to identify your organization. Keep it safe.
          </p>
        </div>

        {/* Allowed Origins */}
        <div className="space-y-3">
          <label className="text-[13px] font-bold text-foreground">Allowed Origins</label>
          <div className="space-y-2">
            {config.allowedOrigins.length === 0 && (
              <p className="text-[13px] text-muted-foreground italic">No origins added yet.</p>
            )}
            {config.allowedOrigins.map((origin: string, i: number) => (
              <div key={i} className="flex items-center justify-between border border-input rounded-md px-3 py-1.5 bg-background">
                <span className="text-[13px] font-mono text-muted-foreground">{String(origin)}</span>
                <button
                  onClick={() => handleRemoveOrigin(i)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <form onSubmit={handleAddOrigin} className="flex gap-2">
            <input
              type="text"
              placeholder="https://yourwebsite.com"
              value={newOrigin}
              onChange={(e) => setNewOrigin(e.target.value)}
              className="flex-1 text-[13px] border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={!newOrigin || updateMut.isPending}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-[13px] font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </form>
          <p className="text-[12px] text-muted-foreground">
            Strictly specify which domains are allowed to host your chat widget.
          </p>
        </div>

        {/* Embed Snippet */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-bold text-foreground">Embed Snippet</label>
            <button
              onClick={() => handleCopy(embedSnippet)}
              className="text-[12px] font-medium text-primary hover:underline flex items-center gap-1"
            >
              <Copy className="w-3.5 h-3.5" /> Copy code
            </button>
          </div>
          <pre className="text-[12px] p-3 rounded-md bg-zinc-950 text-zinc-50 overflow-x-auto border border-zinc-900 leading-relaxed font-mono">
            {embedSnippet}
          </pre>
          <p className="text-[12px] text-muted-foreground">
            Paste this snippet into the <code>&lt;head&gt;</code> of your website.
          </p>
        </div>

        <div className="pt-4 border-t border-border flex justify-end">
          <button
            onClick={handleDelete}
            disabled={deleteMut.isPending}
            className="flex items-center gap-2 px-3 py-2 text-destructive border border-destructive/20 hover:bg-destructive/10 rounded-md text-[13px] font-medium transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Disable widget
          </button>
        </div>
      </div>
    </DashCard>
  )
}
