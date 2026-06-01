"use client"

import { useState } from "react"
import { BookOpen, Plus, Search, Sparkles, FileText, FolderTree, Trash2 } from "lucide-react"
import { DashPageHeader, DashCard } from "@/components/dashboard/page-header"
import { api } from "@/lib/api/trpc-client"

const STATUS_TONE: Record<string, string> = {
  completed: "bg-[var(--dash-sage-wash)] text-[#2f5d3f]",
  pending:   "bg-[var(--dash-amber-wash)] text-[#8a5a1e]",
  processing:"bg-[var(--dash-blue-wash)] text-[#244e8a]",
  failed:    "bg-[var(--dash-rose-wash)] text-[#8a3e3e]",
}

export default function KnowledgeBasePage() {
  const [search, setSearch] = useState("")

  const { data: sources, isLoading, refetch } = api.knowledge.list.useQuery({ limit: 50 })
  const deleteMutation = api.knowledge.delete.useMutation({ onSuccess: () => refetch() })

  const filtered = sources?.filter((s) =>
    !search || s.title.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  const completedCount = sources?.filter((s) => s.embeddingStatus === "completed").length ?? 0
  const pendingCount = sources?.filter((s) => s.embeddingStatus === "pending").length ?? 0

  return (
    <div>
      <DashPageHeader
        eyebrow="Library"
        title="Knowledge Base"
        subtitle="Every article the AI cites. Add, version, and audit sources from one place."
        actions={
          <>
            <button className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border dash-border bg-[var(--dash-card)] text-[13px] font-semibold text-[var(--dash-ink-soft)] hover:dash-shadow-sm transition">
              <Sparkles className="w-4 h-4" /> Suggest from drafts
            </button>
            <button className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-white bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] hover:-translate-y-px transition">
              <Plus className="w-4 h-4" /> New article
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {[
          { k: "Total sources", v: isLoading ? "—" : String(sources?.length ?? 0) },
          { k: "Indexed",       v: isLoading ? "—" : String(completedCount) },
          { k: "Pending embed", v: isLoading ? "—" : String(pendingCount) },
          { k: "Types",         v: "Docs · Web · Tickets" },
        ].map((c) => (
          <div key={c.k} className="dash-card p-4">
            <div className="text-[11.5px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">{c.k}</div>
            <div className="mt-0.5 text-[18px] font-bold tracking-tight text-[var(--dash-ink)]">{c.v}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        <DashCard title="Sources" icon={<FolderTree className="w-[18px] h-[18px]" />} padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="text-left text-[11px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">
                <tr>
                  <th className="px-4 py-2.5">Title</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-t dash-border-soft">
                        <td className="px-4 py-3"><div className="skeleton h-4 w-48 rounded" /></td>
                        <td className="px-4 py-3"><div className="skeleton h-4 w-20 rounded" /></td>
                        <td className="px-4 py-3"><div className="skeleton h-5 w-24 rounded" /></td>
                        <td />
                      </tr>
                    ))
                  : filtered.map((s) => (
                      <tr key={s.id} className="border-t dash-border-soft hover:bg-[rgba(107,92,214,0.04)] transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-md dash-bg-accent-wash flex items-center justify-center">
                              <BookOpen className="w-4 h-4 text-[var(--dash-accent-deep)]" />
                            </div>
                            <div>
                              <div className="font-bold text-[13px] text-[var(--dash-ink)]">{s.title}</div>
                              {s.url && <div className="text-[10.5px] text-[var(--dash-ink-faint)] font-mono truncate max-w-[260px]">{s.url}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 capitalize text-[var(--dash-ink-soft)]">{s.sourceType}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10.5px] font-bold rounded-md px-1.5 py-0.5 capitalize ${STATUS_TONE[s.embeddingStatus ?? "pending"]}`}>
                            {s.embeddingStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => deleteMutation.mutate({ id: s.id })}
                            disabled={deleteMutation.isPending}
                            className="text-[var(--dash-ink-faint)] hover:text-[var(--dash-rose)] transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-[13px] text-[var(--dash-ink-faint)]">
                      No knowledge sources yet. Add your first article above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DashCard>

        <DashCard
          title="Recent updates"
          icon={<FileText className="w-[18px] h-[18px]" />}
          right={
            <div className="flex items-center gap-2 dash-bg-card border dash-border rounded-lg px-2 py-1">
              <Search className="w-3.5 h-3.5 text-[var(--dash-ink-faint)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find…"
                className="bg-transparent outline-none text-[12px] text-[var(--dash-ink)] placeholder:text-[var(--dash-ink-faint)] w-[140px]"
              />
            </div>
          }
        >
          <ul className="divide-y dash-border-soft">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <li key={i} className="py-2.5 flex items-center gap-3">
                    <div className="skeleton w-8 h-8 rounded-md" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-3.5 w-40 rounded" />
                      <div className="skeleton h-3 w-24 rounded" />
                    </div>
                  </li>
                ))
              : filtered.slice(0, 8).map((r) => (
                  <li key={r.id} className="py-2.5 flex items-center gap-3">
                    <span className="w-8 h-8 rounded-md dash-bg-blue-wash flex items-center justify-center text-[var(--dash-blue)]">
                      <FileText className="w-4 h-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[13px] text-[var(--dash-ink)] truncate">{r.title}</div>
                      <div className="text-[11px] text-[var(--dash-ink-faint)]">
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}
                      </div>
                    </div>
                    <span className={`text-[10.5px] font-bold rounded-md px-1.5 py-0.5 capitalize ${STATUS_TONE[r.embeddingStatus ?? "pending"]}`}>
                      {r.embeddingStatus}
                    </span>
                  </li>
                ))}
          </ul>
        </DashCard>
      </div>
    </div>
  )
}
