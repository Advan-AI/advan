"use client"

import { z } from "zod"
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
  const node = usePipelineStore((s) => s.nodes.find((n) => n.id === s.selectedId))
  const update = usePipelineStore((s) => s.updateNodeConfig)

  if (!selectedId || !node || !node.type || !nodeRegistry.has(node.type)) {
    return (
      <div className="w-[260px] shrink-0 border-l dash-border-soft p-4 dash-bg-sidebar">
        <p className="text-[12.5px] text-[var(--dash-ink-faint)]">Select a node to configure it.</p>
      </div>
    )
  }

  const def = nodeRegistry.get(node.type)
  const shape = getObjectShape(def.configSchema)
  const data = (node.data ?? {}) as Record<string, unknown>

  const setField = (key: string, value: unknown) => update(node.id, { ...data, [key]: value })

  return (
    <div className="w-[260px] shrink-0 overflow-y-auto border-l dash-border-soft p-4 dash-bg-sidebar">
      <div className="mb-1 text-[13px] font-bold text-[var(--dash-ink)]">{def.label}</div>
      <p className="mb-3 text-[11px] leading-[1.5] text-[var(--dash-ink-faint)]">{def.description}</p>

      <div className="flex flex-col gap-3">
        {Object.entries(shape).map(([key, fieldSchema]) => (
          <Field key={key} name={key} schema={fieldSchema} value={data[key]} onChange={(v) => setField(key, v)} />
        ))}
      </div>
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
    "w-full h-8 px-2.5 rounded-lg border dash-border bg-white text-[12.5px] text-[var(--dash-ink)] outline-none focus:border-[var(--dash-accent)]"

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
      <label className="flex items-center gap-2 text-[12.5px] text-[var(--dash-ink)]">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
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
