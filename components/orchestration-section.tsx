"use client"

import { useState, useRef, useCallback } from "react"
import { motion, useDragControls, useMotionValue } from "framer-motion"
import {
  MessageSquare,
  Brain,
  BookOpen,
  UserCheck,
  ArrowUpRight,
  Database,
  Zap,
  Plus,
  PlayCircle,
  CheckCircle2,
  Sparkles,
} from "lucide-react"
import { SectionHeader } from "@/components/section-primitives"
import { Button } from "@/components/ui/button"

const BOOKING_URL = "https://cal.com/day-nguyen"

/* ─── node definitions ────────────────────────────── */
type NodeId =
  | "ingest"
  | "intent"
  | "retrieval"
  | "approval"
  | "escalation"
  | "crm"

interface NodeDef {
  id: NodeId
  label: string
  sublabel: string
  icon: React.ElementType
  accent: string
  glow: string
  x: number
  y: number
}

const INITIAL_NODES: NodeDef[] = [
  {
    id: "ingest",
    label: "Customer Message",
    sublabel: "Email · Chat · Slack · Voice",
    icon: MessageSquare,
    accent: "from-cyan-400/20 to-cyan-400/5",
    glow: "rgba(34,211,238,0.5)",
    x: 20,
    y: 40,
  },
  {
    id: "intent",
    label: "AI Intent Detection",
    sublabel: "98% accuracy · 60ms",
    icon: Brain,
    accent: "from-violet-400/20 to-violet-400/5",
    glow: "rgba(167,139,250,0.5)",
    x: 230,
    y: 0,
  },
  {
    id: "retrieval",
    label: "Knowledge Retrieval",
    sublabel: "Docs · KB · Ticket history",
    icon: BookOpen,
    accent: "from-blue-400/20 to-blue-400/5",
    glow: "rgba(96,165,250,0.5)",
    x: 230,
    y: 130,
  },
  {
    id: "approval",
    label: "Human Approval",
    sublabel: "Copilot gate · Policy check",
    icon: UserCheck,
    accent: "from-emerald-400/20 to-emerald-400/5",
    glow: "rgba(52,211,153,0.5)",
    x: 440,
    y: 40,
  },
  {
    id: "escalation",
    label: "Escalation",
    sublabel: "Threshold-based routing",
    icon: ArrowUpRight,
    accent: "from-amber-400/20 to-amber-400/5",
    glow: "rgba(251,191,36,0.5)",
    x: 440,
    y: 175,
  },
  {
    id: "crm",
    label: "CRM Update",
    sublabel: "Salesforce · HubSpot · Zendesk",
    icon: Database,
    accent: "from-rose-400/20 to-rose-400/5",
    glow: "rgba(251,113,133,0.5)",
    x: 650,
    y: 40,
  },
]

// Static SVG edges (between node centre points, approximate)
// We'll draw them as simple bezier paths
const EDGES = [
  { from: "ingest", to: "intent" },
  { from: "ingest", to: "retrieval" },
  { from: "intent", to: "approval" },
  { from: "retrieval", to: "approval" },
  { from: "approval", to: "escalation" },
  { from: "approval", to: "crm" },
]

const NODE_W = 168
const NODE_H = 68

function nodeCentre(node: NodeDef) {
  return {
    x: node.x + NODE_W / 2,
    y: node.y + NODE_H / 2,
  }
}

/* ─── section ─────────────────────────────────────── */
export function OrchestrationSection() {
  const [deployed, setDeployed] = useState(false)
  const [nodes, setNodes] = useState<NodeDef[]>(INITIAL_NODES)

  const moveNode = useCallback((id: NodeId, dx: number, dy: number) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, x: n.x + dx, y: n.y + dy } : n))
    )
  }, [])

  return (
    <section id="orchestration" className="relative py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Agent Orchestration"
          title={
            <>
              Build support workflows —{" "}
              <span className="text-gradient-brand">no code, no ops</span>
            </>
          }
          lede="Drag nodes onto the canvas to wire your AI support pipeline. Set policy gates, approval thresholds, and escalation rules visually. Ship in minutes."
        />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="mt-14 relative"
        >
          <div className="rounded-3xl glass-strong overflow-hidden">
            {/* toolbar */}
            <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-white/40">
                <Zap className="w-3 h-3" />
                workflow-canvas / webhook-support-v2
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1 text-[11px] font-medium text-white/70 hover:text-white transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add node
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeployed(true)
                    setTimeout(() => setDeployed(false), 3000)
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-all ${
                    deployed
                      ? "bg-emerald-400/15 border border-emerald-400/40 text-emerald-200"
                      : "bg-white text-slate-900 hover:bg-white/90 shadow-[0_4px_16px_-6px_rgba(34,211,238,0.6)]"
                  }`}
                >
                  {deployed ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      Deployed!
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-3 h-3" />
                      Deploy workflow
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* canvas */}
            <div
              className="relative overflow-hidden"
              style={{ height: 340 }}
              data-testid="orchestration-canvas"
            >
              {/* grid */}
              <div
                className="absolute inset-0 grid-bg opacity-40"
                aria-hidden
              />

              {/* edges SVG */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                aria-hidden
              >
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L0,6 L6,3 z" fill="hsl(188 95% 60% / 0.5)" />
                  </marker>
                </defs>
                {EDGES.map((edge) => {
                  const fromNode = nodes.find((n) => n.id === edge.from)
                  const toNode = nodes.find((n) => n.id === edge.to)
                  if (!fromNode || !toNode) return null
                  const from = nodeCentre(fromNode)
                  const to = nodeCentre(toNode)
                  const mx = (from.x + to.x) / 2
                  return (
                    <motion.path
                      key={`${edge.from}-${edge.to}`}
                      d={`M ${from.x} ${from.y} C ${mx} ${from.y}, ${mx} ${to.y}, ${to.x} ${to.y}`}
                      stroke="hsl(188 95% 60% / 0.25)"
                      strokeWidth="1.5"
                      fill="none"
                      strokeDasharray="4 3"
                      markerEnd="url(#arrowhead)"
                      initial={{ pathLength: 0, opacity: 0 }}
                      whileInView={{ pathLength: 1, opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.2, ease: "easeInOut" }}
                    />
                  )
                })}
              </svg>

              {/* draggable nodes */}
              {nodes.map((node) => (
                <DraggableNode
                  key={node.id}
                  node={node}
                  onDrag={(dx, dy) => moveNode(node.id, dx, dy)}
                />
              ))}
            </div>
          </div>

          {/* hint */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="mt-4 text-center text-xs text-white/35 font-mono"
          >
            ↖ Drag nodes to rearrange · Click "Deploy workflow" to ship
          </motion.p>
        </motion.div>

        {/* CTA strip */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Sparkles className="w-4 h-4 text-cyan-300" />
            10+ pre-built workflow templates
          </div>
          <Button
            asChild
            className="group rounded-full bg-white text-slate-900 hover:bg-white/90 h-10 px-5 text-sm font-medium shadow-[0_8px_24px_-10px_rgba(34,211,238,0.6)]"
          >
            <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
              See live demo
              <ArrowUpRight className="ml-1.5 w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>
          </Button>
        </motion.div>
      </div>
    </section>
  )
}

/* ─── draggable node ──────────────────────────────── */
function DraggableNode({
  node,
  onDrag,
}: {
  node: NodeDef
  onDrag: (dx: number, dy: number) => void
}) {
  const Icon = node.icon
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const lastRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

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
        x,
        y,
        cursor: "grab",
      }}
      whileDrag={{ cursor: "grabbing", scale: 1.03, zIndex: 50 }}
      onDragStart={() => {
        lastRef.current = { x: x.get(), y: y.get() }
      }}
      onDragEnd={() => {
        const dx = x.get() - lastRef.current.x
        const dy = y.get() - lastRef.current.y
        onDrag(dx, dy)
        x.set(0)
        y.set(0)
        lastRef.current = { x: 0, y: 0 }
      }}
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      data-testid={`node-${node.id}`}
    >
      <div
        className={`relative rounded-xl bg-gradient-to-b ${node.accent} border border-white/[0.08] hover:border-white/20 transition-colors shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)] backdrop-blur-xl`}
        style={{
          boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 8px 24px -8px rgba(0,0,0,0.5)`,
        }}
      >
        <div className="flex items-center gap-2.5 px-3.5 py-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${node.glow.replace("0.5", "0.12")}`, border: `1px solid ${node.glow.replace("0.5", "0.25")}` }}
          >
            <Icon className="w-4 h-4" style={{ color: node.glow.replace("rgba(", "rgb(").replace(", 0.5)", ")") }} />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-white truncate">{node.label}</div>
            <div className="text-[9px] text-white/45 truncate">{node.sublabel}</div>
          </div>
        </div>
        {/* drag handle dots */}
        <div className="absolute top-1.5 right-1.5 grid grid-cols-2 gap-0.5 opacity-30">
          {[...Array(6)].map((_, i) => (
            <span key={i} className="w-0.5 h-0.5 rounded-full bg-white" />
          ))}
        </div>
      </div>
    </motion.div>
  )
}
