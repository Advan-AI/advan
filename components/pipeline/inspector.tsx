"use client"

import { z } from "zod"
import { Copy, GitBranch, Trash2 } from "lucide-react"
import { usePipelineStore } from "@/lib/pipeline/use-pipeline-store"
import { nodeRegistry } from "@/lib/pipeline/registry"

/**
 * Inspector — generic, schema-driven config form.
 *
 * Introspects the selected node type's Zod `configSchema` and renders an
 * appropriate control per field (enum → select, number → number input,
 * boolean → checkbox, string → text). A new node type gets a config UI for free.
 */
export function PipelineInspector() {
  const selectedId = usePipelineStore((s) => s.selectedId)
  const selectedEdgeId = usePipelineStore((s) => s.selectedEdgeId)
  const node = usePipelineStore((s) => s.nodes.find((n) => n.id === s.selectedId))
  const edge = usePipelineStore((s) => s.edges.find((e) => e.id === s.selectedEdgeId))
  const nodes = usePipelineStore((s) => s.nodes)
  const update = usePipelineStore((s) => s.updateNodeConfig)
  const duplicateNode = usePipelineStore((s) => s.duplicateNode)
  const deleteNode = usePipelineStore((s) => s.deleteNode)
  const deleteEdge = usePipelineStore((s) => s.deleteEdge)
  const reconnectEdgeToNode = usePipelineStore((s) => s.reconnectEdgeToNode)

  if (selectedEdgeId && edge) {
    return (
      <div className="w-full h-full overflow-y-auto p-4 dash-bg-sidebar">
        <div className="mb-1 flex items-center gap-1.5 text-[13px] font-bold text-[var(--dash-ink)]">
          <GitBranch className="h-4 w-4 text-[var(--dash-accent)]" />
          Wire connection
        </div>
        <p className="mb-3 text-[11px] leading-[1.5] text-[var(--dash-ink-faint)]">
          Reassign either end of this wire, detach it, or drag an endpoint on the canvas.
        </p>

        <div className="space-y-3 rounded-xl border dash-border-soft bg-white p-3">
          <WireSelect
            label="From"
            value={edge.source}
            port={edge.sourceHandle ?? "out"}
            nodes={nodes.filter((item) => item.id !== edge.target)}
            onChange={(nodeId) => reconnectEdgeToNode(edge.id, "source", nodeId)}
          />
          <WireSelect
            label="To"
            value={edge.target}
            port={edge.targetHandle ?? "in"}
            nodes={nodes.filter((item) => item.id !== edge.source)}
            onChange={(nodeId) => reconnectEdgeToNode(edge.id, "target", nodeId)}
          />
        </div>

        <button
          type="button"
          onClick={() => deleteEdge(edge.id)}
          className="mt-3 inline-flex min-h-11 h-11 sm:h-9 w-full items-center justify-center gap-1.5 rounded-lg border dash-border bg-white text-[12px] font-bold text-[var(--dash-rose)] transition hover:dash-shadow-sm"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Detach wire
        </button>
      </div>
    )
  }

  if (!selectedId || !node || !node.type || !nodeRegistry.has(node.type)) {
    return (
      <div className="w-full h-full border-0 p-4 dash-bg-sidebar">
        <p className="text-[12.5px] text-[var(--dash-ink-faint)]">Select a node to configure it.</p>
      </div>
    )
  }

  const def = nodeRegistry.get(node.type)
  const shape = getObjectShape(def.configSchema)
  const data = (node.data ?? {}) as Record<string, unknown>

  const setField = (key: string, value: unknown) => update(node.id, { ...data, [key]: value })

  return (
    <div className="w-full h-full overflow-y-auto p-4 dash-bg-sidebar">
      <div className="mb-1 text-[13px] font-bold text-[var(--dash-ink)]">{def.label}</div>
      <p className="mb-3 text-[11px] leading-[1.5] text-[var(--dash-ink-faint)]">{def.description}</p>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => duplicateNode(node.id)}
          className="inline-flex min-h-11 h-11 sm:h-8 items-center justify-center gap-1 rounded-lg border dash-border bg-white text-[11.5px] font-bold text-[var(--dash-ink-soft)] transition hover:text-[var(--dash-ink)] hover:dash-shadow-sm"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy
        </button>
        <button
          type="button"
          onClick={() => deleteNode(node.id)}
          className="inline-flex min-h-11 h-11 sm:h-8 items-center justify-center gap-1 rounded-lg border dash-border bg-white text-[11.5px] font-bold text-[var(--dash-rose)] transition hover:dash-shadow-sm"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {Object.entries(shape).map(([key, fieldSchema]) => (
          <Field key={key} name={key} schema={fieldSchema} value={data[key]} onChange={(v) => setField(key, v)} />
        ))}
      </div>
    </div>
  )
}

function nodeLabel(node: { type?: string; id: string } | undefined): string {
  if (!node?.type || !nodeRegistry.has(node.type)) return node?.id ?? "Missing node"
  return nodeRegistry.get(node.type).label
}

function WireSelect({
  label,
  value,
  port,
  nodes,
  onChange,
}: {
  label: string
  value: string
  port: string
  nodes: { id: string; type?: string }[]
  onChange: (nodeId: string) => void
}) {
  return (
    <div>
      <label htmlFor={`wire-${label}`} className="text-[10px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">
        {label}
      </label>
      <select
        id={`wire-${label}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 sm:h-8 w-full rounded-lg border dash-border bg-white px-2 text-[12px] font-bold text-[var(--dash-ink)] outline-none focus:border-[var(--dash-accent)]"
      >
        {nodes.map((node) => (
          <option key={node.id} value={node.id}>
            {nodeLabel(node)}
          </option>
        ))}
      </select>
      <div className="mt-0.5 font-mono text-[10.5px] text-[var(--dash-ink-faint)]">port: {port}</div>
    </div>
  )
}

function Field({
  name,
  schema,
  value,
  onChange,
}: {
  name: string
  schema: z.ZodTypeAny
  value: unknown
  onChange: (v: unknown) => void
}) {
  const kind = unwrap(schema)
  const label = name.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())

  const labelEl = (
    <label htmlFor={`field-${name}`} className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[var(--dash-ink-soft)]">
      {label}
    </label>
  )

  const base =
    "w-full h-11 sm:h-8 px-2.5 rounded-lg border dash-border bg-white text-[12.5px] text-[var(--dash-ink)] outline-none focus:border-[var(--dash-accent)]"

  if (kind.type === "enum") {
    return (
      <div>
        {labelEl}
        <select id={`field-${name}`} className={base} value={String(value ?? kind.options[0])} onChange={(e) => onChange(e.target.value)}>
          {kind.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    )
  }

  if (kind.type === "number") {
    return (
      <div>
        {labelEl}
        <input
          id={`field-${name}`}
          type="number"
          className={base}
          value={Number(value ?? 0)}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
    )
  }

  if (kind.type === "boolean") {
    return (
      <label className="flex min-h-11 items-center gap-2 text-[12.5px] text-[var(--dash-ink)]">
        <input type="checkbox" className="h-4 w-4" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
    )
  }

  return (
    <div>
      {labelEl}
      <input id={`field-${name}`} type="text" className={base} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

// ── Zod introspection helpers ────────────────────────────────────────────────

type FieldKind =
  | { type: "enum"; options: string[] }
  | { type: "number" }
  | { type: "boolean" }
  | { type: "string" }

function getObjectShape(schema: z.ZodType): Record<string, z.ZodTypeAny> {
  const def = (schema as unknown as { _def?: { typeName?: string; shape?: () => Record<string, z.ZodTypeAny> } })._def
  if (def?.typeName === "ZodObject" && typeof def.shape === "function") return def.shape()
  return {}
}

function unwrap(schema: z.ZodTypeAny): FieldKind {
  // Peel ZodDefault / ZodOptional / ZodNullable wrappers.
  let s: z.ZodTypeAny = schema
  for (let i = 0; i < 5; i++) {
    const def = (s as unknown as { _def?: { typeName?: string; innerType?: z.ZodTypeAny; values?: string[] } })._def
    const tn = def?.typeName
    if (tn === "ZodDefault" || tn === "ZodOptional" || tn === "ZodNullable") {
      s = def!.innerType as z.ZodTypeAny
      continue
    }
    if (tn === "ZodEnum") return { type: "enum", options: (def?.values as string[]) ?? [] }
    if (tn === "ZodNumber") return { type: "number" }
    if (tn === "ZodBoolean") return { type: "boolean" }
    return { type: "string" }
  }
  return { type: "string" }
}
