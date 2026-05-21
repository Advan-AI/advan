"use client"

import { useCallback, useRef, useState } from "react"
import { motion, useMotionValue } from "framer-motion"
import {
  MessageSquare,
  Brain,
  BookOpen,
  UserCheck,
  ArrowUpRight,
  Database,
  PlayCircle,
  CheckCircle2,
  Loader2,
  Plus,
  ZoomIn,
  ZoomOut,
  GitBranch,
  Hand,
} from "lucide-react"
import { DashPageHeader } from "@/components/dashboard/page-header"

type NodeId = "msg" | "ai" | "kb" | "human" | "esc" | "crm"
type Variant = "msg" | "ai" | "kb" | "human" | "esc" | "crm"

interface NodeDef {
  id: NodeId
  label: string
  kind: string
  variant: Variant
  icon: React.ElementType
  x: number
  y: number
}

const NODE_W = 156
const NODE_H = 64

const INITIAL_NODES: NodeDef[] = [
  { id: "msg",   label: "Customer Message",    kind: "Trigger · email · chat", variant: "msg",   icon: MessageSquare, x: 20,  y: 110 },
  { id: "ai",    label: "AI Intent Detection", kind: "Model · 98% accuracy",   variant: "ai",    icon: Brain,         x: 220, y: 30 },
  { id: "kb",    label: "Knowledge Retrieval", kind: "Docs · KB · Tickets",    variant: "kb",    icon: BookOpen,      x: 220, y: 200 },
  { id: "human", label: "Human Approval",      kind: "Gate · policy v2.3",     variant: "human", icon: UserCheck,     x: 420, y: 110 },
  { id: "esc",   label: "Escalation",          kind: "Threshold · low conf.",  variant: "esc",   icon: ArrowUpRight,  x: 620, y: 230 },
  { id: "crm",   label: "CRM Update",          kind: "Salesforce · HubSpot",   variant: "crm",   icon: Database,      x: 620, y: 30 },
]

const EDGES: Array<{ from: NodeId; to: NodeId }> = [
  { from: "msg", to: "ai" },
  { from: "msg", to: "kb" },
  { from: "ai", to: "human" },
  { from: "kb", to: "human" },
  { from: "human", to: "crm" },
  { from: "human", to: "esc" },
]

const VARIANT_BG: Record<Variant, string> = {
  msg:   "dash-bg-blue-wash",
  ai:    "dash-bg-accent-wash",
  kb:    "dash-bg-blue-wash",
  human: "dash-bg-amber-wash",
  esc:   "dash-bg-rose-wash",
  crm:   "dash-bg-sage-wash",
}
const VARIANT_ICON: Record<Variant, string> = {
  msg:   "text-[var(--dash-blue)]",
  ai:    "text-[var(--dash-accent)]",
  kb:    "text-[var(--dash-blue)]",
  human: "text-[var(--dash-amber)]",
  esc:   "text-[var(--dash-rose)]",
  crm:   "text-[var(--dash-sage)]",
}
const VARIANT_PORT: Record<Variant, string> = {
  msg:   "border-[var(--dash-blue)]",
  ai:    "border-[var(--dash-accent)]",
  kb:    "border-[var(--dash-blue)]",
  human: "border-[var(--dash-amber)]",
  esc:   "border-[var(--dash-rose)]",
  crm:   "border-[var(--dash-sage)]",
}

export default function OrchestrationPage() {
  const [nodes, setNodes] = useState<NodeDef[]>(INITIAL_NODES)
  const [deploy, setDeploy] = useState<"idle" | "deploying" | "deployed">("idle")
  const [zoom, setZoom] = useState(1)

  const moveNode = useCallback((id: NodeId, dx: number, dy: number) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, x: n.x + dx, y: n.y + dy } : n)))
  }, [])

  function nodeCenter(n: NodeDef) {
    return { x: n.x + NODE_W / 2, y: n.y + NODE_H / 2 }
  }

  function runDeploy() {
    if (deploy !== "idle") return
    setDeploy("deploying")
    setTimeout(() => setDeploy("deployed"), 1600)
    setTimeout(() => setDeploy("idle"), 5000)
  }

  return (
    <div>
      <DashPageHeader
        eyebrow="Automation"
        title="Agent Orchestration Builder"
        subtitle="Drag and drop nodes to build your support workflow. Wire intent detection, retrieval, human approval, and downstream systems — no code, no ops."
        actions={
          <>
            <button className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border dash-border bg-[var(--dash-card)] text-[13px] font-semibold text-[var(--dash-ink-soft)] hover:dash-shadow-sm transition">
              <PlayCircle className="w-4 h-4" /> Test Workflow
            </button>
            <button
              onClick={runDeploy}
              disabled={deploy !== "idle"}
              className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-white transition shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] ${
                deploy === "deployed"
                  ? "bg-gradient-to-br from-[#5C9A70] to-[#3f7a52]"
                  : "bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] hover:-translate-y-px"
              }`}
            >
              {deploy === "idle" && <><PlayCircle className="w-4 h-4" /> Deploy Workflow</>}
              {deploy === "deploying" && <><Loader2 className="w-4 h-4 animate-spin" /> Deploying…</>}
              {deploy === "deployed" && <><CheckCircle2 className="w-4 h-4" /> Deployed</>}
            </button>
          </>
        }
      />

      <div className="dash-card overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b dash-border-soft">
          <div className="flex items-center gap-2 text-[14px] font-bold text-[var(--dash-ink)]">
            <GitBranch className="w-[18px] h-[18px] text-[var(--dash-accent)]" />
            webhook-support-v2
          </div>
          <span className="text-[11.5px] text-[var(--dash-ink-faint)] font-mono">draft · last saved 2m ago</span>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[var(--dash-bg)] border dash-border rounded-lg p-0.5">
              <ZoomBtn onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}><ZoomOut className="w-3.5 h-3.5" /></ZoomBtn>
              <span className="text-[11px] font-bold text-[var(--dash-ink-soft)] px-2 select-none">
                {Math.round(zoom * 100)}%
              </span>
              <ZoomBtn onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))}><ZoomIn className="w-3.5 h-3.5" /></ZoomBtn>
            </div>
            <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border dash-border bg-[var(--dash-bg)] hover:dash-shadow-sm text-[12px] font-semibold text-[var(--dash-ink-soft)] transition">
              <Hand className="w-3.5 h-3.5" /> Pan
            </button>
          </div>
        </div>

        <div className="flex" style={{ minHeight: 380 }}>
          {/* Palette */}
          <div className="w-[188px] shrink-0 border-r dash-border-soft p-3.5 dash-bg-sidebar flex flex-col gap-2">
            <div className="text-[10.5px] font-bold tracking-[0.1em] uppercase text-[var(--dash-ink-faint)] mb-1">
              Palette
            </div>
            {[
              { label: "Customer Message",    variant: "msg",   icon: MessageSquare },
              { label: "AI Intent",            variant: "ai",    icon: Brain },
              { label: "Knowledge Retrieval", variant: "kb",    icon: BookOpen },
              { label: "Human Approval",      variant: "human", icon: UserCheck },
              { label: "Escalation",          variant: "esc",   icon: ArrowUpRight },
              { label: "CRM Update",          variant: "crm",   icon: Database },
            ].map((p) => {
              const Icon = p.icon
              const v = p.variant as Variant
              return (
                <div
                  key={p.label}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white border dash-border cursor-grab active:cursor-grabbing select-none hover:-translate-y-px hover:dash-shadow-sm transition"
                >
                  <span className={`w-[26px] h-[26px] rounded-md ${VARIANT_BG[v]} flex items-center justify-center`}>
                    <Icon className={`w-3.5 h-3.5 ${VARIANT_ICON[v]}`} />
                  </span>
                  <span className="text-[12px] font-semibold text-[var(--dash-ink)]">{p.label}</span>
                </div>
              )
            })}

            <button className="mt-2 inline-flex items-center justify-center gap-1.5 h-8 rounded-lg border border-dashed dash-border text-[12px] font-semibold text-[var(--dash-ink-soft)] hover:bg-white transition">
              <Plus className="w-3.5 h-3.5" /> New node
            </button>
          </div>

          {/* Canvas */}
          <div
            className="relative flex-1 overflow-hidden dash-bg-deep"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(120,108,80,.18) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
              minHeight: 380,
            }}
            data-testid="orchestration-canvas"
          >
            <div className="absolute inset-0 origin-top-left" style={{ transform: `scale(${zoom})` }}>
              <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" aria-hidden>
                <defs>
                  <marker id="dash-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L6,3 z" fill="#B6A98C" />
                  </marker>
                  <marker id="dash-arrow-flow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L6,3 z" fill="var(--dash-accent)" />
                  </marker>
                </defs>
                {EDGES.map((edge, i) => {
                  const from = nodes.find((n) => n.id === edge.from)
                  const to = nodes.find((n) => n.id === edge.to)
                  if (!from || !to) return null
                  const a = nodeCenter(from)
                  const b = nodeCenter(to)
                  const mx = (a.x + b.x) / 2
                  const flow = deploy !== "idle" && i % 2 === 0
                  return (
                    <motion.path
                      key={`${edge.from}-${edge.to}`}
                      d={`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`}
                      stroke={flow ? "var(--dash-accent)" : "#B6A98C"}
                      strokeWidth={flow ? 2.4 : 2.2}
                      fill="none"
                      className={flow ? "dash-edge-flow" : ""}
                      strokeDasharray={flow ? undefined : "0"}
                      markerEnd={flow ? "url(#dash-arrow-flow)" : "url(#dash-arrow)"}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 1.1, ease: "easeInOut" }}
                    />
                  )
                })}
              </svg>

              {nodes.map((n) => (
                <CanvasNode key={n.id} node={n} onDrag={(dx, dy) => moveNode(n.id, dx, dy)} />
              ))}
            </div>
          </div>

          {/* Deploy / stats */}
          <div className="w-[200px] shrink-0 border-l dash-border-soft p-4 dash-bg-sidebar flex flex-col gap-3">
            <button
              onClick={runDeploy}
              disabled={deploy !== "idle"}
              className={`w-full h-10 rounded-lg text-[13.5px] font-bold text-white inline-flex items-center justify-center gap-2 transition ${
                deploy === "deployed"
                  ? "bg-gradient-to-br from-[#5C9A70] to-[#3f7a52] shadow-[0_6px_18px_rgba(92,154,112,.42)]"
                  : "bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] shadow-[0_6px_18px_rgba(107,92,214,.4)] hover:-translate-y-px"
              }`}
            >
              {deploy === "idle" && <><PlayCircle className="w-4 h-4" /> Deploy</>}
              {deploy === "deploying" && <><Loader2 className="w-4 h-4 animate-spin" /> Deploying…</>}
              {deploy === "deployed" && <><CheckCircle2 className="w-4 h-4" /> Deployed</>}
            </button>

            <div className="space-y-2 text-[11.5px]">
              <Stat k="Nodes" v={String(nodes.length)} />
              <Stat k="Edges" v={String(EDGES.length)} />
              <Stat k="Status" v={deploy === "deployed" ? "Live" : "Draft"} tone={deploy === "deployed" ? "sage" : "amber"} />
              <Stat k="Last run" v="—" />
              <Stat k="p95 latency" v="3.6s" />
            </div>

            <button className="text-[11.5px] font-bold text-[var(--dash-accent-deep)] inline-flex items-center gap-1 hover:underline">
              View deployment history →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ZoomBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-7 h-6 rounded-md hover:bg-white text-[var(--dash-ink-soft)] inline-flex items-center justify-center transition"
    >
      {children}
    </button>
  )
}

function Stat({ k, v, tone }: { k: string; v: string; tone?: "sage" | "amber" }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b dash-border-soft last:border-b-0">
      <span className="text-[var(--dash-ink-faint)] font-medium">{k}</span>
      <span
        className={`font-bold ${
          tone === "sage"
            ? "text-[var(--dash-sage)]"
            : tone === "amber"
            ? "text-[var(--dash-amber)]"
            : "text-[var(--dash-ink)]"
        }`}
      >
        {v}
      </span>
    </div>
  )
}

function CanvasNode({ node, onDrag }: { node: NodeDef; onDrag: (dx: number, dy: number) => void }) {
  const Icon = node.icon
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const last = useRef({ x: 0, y: 0 })

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0}
      style={{
        position: "absolute",
        left: node.x,
        top: node.y,
        width: NODE_W,
        minHeight: NODE_H,
        x,
        y,
      }}
      whileDrag={{ scale: 1.04, zIndex: 20 }}
      onDragStart={() => { last.current = { x: x.get(), y: y.get() } }}
      onDragEnd={() => {
        const dx = x.get() - last.current.x
        const dy = y.get() - last.current.y
        onDrag(dx, dy)
        x.set(0)
        y.set(0)
        last.current = { x: 0, y: 0 }
      }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35 }}
      data-testid={`node-${node.id}`}
      className="cursor-grab active:cursor-grabbing"
    >
      <div
        className="relative bg-white border-[1.5px] dash-border rounded-[11px] px-2.5 py-2 dash-shadow-sm hover:dash-shadow-md hover:border-[#C9BFA6] transition"
      >
        <div className={`absolute -left-1.5 top-1/2 -translate-y-1/2 w-[11px] h-[11px] rounded-full bg-white border-2 ${VARIANT_PORT[node.variant]}`} />
        <div className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-[11px] h-[11px] rounded-full bg-white border-2 ${VARIANT_PORT[node.variant]}`} />
        <div className="flex items-center gap-2">
          <span className={`w-[26px] h-[26px] rounded-md ${VARIANT_BG[node.variant]} flex items-center justify-center shrink-0`}>
            <Icon className={`w-3.5 h-3.5 ${VARIANT_ICON[node.variant]}`} />
          </span>
          <div className="min-w-0">
            <div className="text-[11.5px] font-bold leading-tight text-[var(--dash-ink)] truncate">{node.label}</div>
            <div className="text-[9.5px] text-[var(--dash-ink-faint)] truncate">{node.kind}</div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
