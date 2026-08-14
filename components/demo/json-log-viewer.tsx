"use client"

import { useState } from "react"
import { Check, Copy, Terminal } from "lucide-react"

function highlightJsonLine(line: string) {
  const indentMatch = line.match(/^(\s*)/)
  const indent = indentMatch?.[1] ?? ""
  const rest = line.slice(indent.length)

  if (rest === "{" || rest === "}" || rest === "}," || rest === "[" || rest === "]" || rest === "],") {
    return (
      <>
        {indent}
        <span className="text-white/40">{rest}</span>
      </>
    )
  }

  const kv = rest.match(/^"([^"]+)": (.*)$/)
  if (kv) {
    const value = kv[2].replace(/,$/, "")
    const comma = kv[2].endsWith(",")
    return (
      <>
        {indent}
        <span className="text-[#89b4fa]">&quot;{kv[1]}&quot;</span>
        <span className="text-white/35">: </span>
        {colorValue(value)}
        {comma ? <span className="text-white/35">,</span> : null}
      </>
    )
  }

  const lone = rest.replace(/,$/, "")
  const comma = rest.endsWith(",")
  return (
    <>
      {indent}
      {colorValue(lone)}
      {comma ? <span className="text-white/35">,</span> : null}
    </>
  )
}

function colorValue(raw: string) {
  if (raw === "true" || raw === "false" || raw === "null") {
    return <span className="text-[#cba6f7]">{raw}</span>
  }
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    return <span className="text-[#fab387]">{raw}</span>
  }
  if (raw.startsWith('"') && raw.endsWith('"')) {
    return <span className="text-[#a6e3a1]">{raw}</span>
  }
  return <span className="text-white/80">{raw}</span>
}

export function JsonLogViewer({
  events,
  title = "Structured logs / checkpoints",
}: {
  events: Array<Record<string, unknown>>
  title?: string
}) {
  const [copied, setCopied] = useState(false)
  const pretty = events.map((event) => JSON.stringify(event, null, 2)).join("\n\n")

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(pretty)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-black/[0.08] bg-[#171a17] overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-white/10">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-white/50">
          <Terminal className="w-3.5 h-3.5" />
          {title}
        </div>
        <button
          type="button"
          onClick={() => void copyAll()}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-white/45 hover:text-white/80"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied" : "Copy JSON"}
        </button>
      </div>
      <div className="max-h-[28rem] overflow-auto px-5 py-4">
        <ol className="space-y-4">
          {events.map((event, index) => {
            const key =
              typeof event.seq === "number"
                ? `seq-${event.seq}`
                : typeof event.ts === "string"
                  ? `${event.ts}-${index}`
                  : `event-${index}`
            const lines = JSON.stringify(event, null, 2).split("\n")
            return (
              <li key={key}>
                <pre className="text-[11px] leading-[1.55] font-mono whitespace-pre">
                  {lines.map((line, lineIndex) => (
                    <span key={`${key}-${lineIndex}`} className="block">
                      {highlightJsonLine(line)}
                    </span>
                  ))}
                </pre>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
