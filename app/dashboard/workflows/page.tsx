"use client"

import Link from "next/link"
import { LayoutGrid, Plus, PlayCircle, Pause, GitBranch } from "lucide-react"
import { DashPageHeader, DashCard } from "@/components/dashboard/page-header"
import { api } from "@/lib/api/trpc-client"
import { EMPTY_PIPELINE } from "@/lib/pipeline/schema"

const STATUS_TONE: Record<string, string> = {
  active:   "bg-[var(--dash-sage-wash)] text-[#2f5d3f]",
  draft:    "bg-[var(--dash-amber-wash)] text-[#8a5a1e]",
  inactive: "bg-[var(--dash-rose-wash)] text-[#8a3e3e]",
}

export default function WorkflowsPage() {
  const { data: workflows, isLoading, refetch } = api.orchestration.getWorkflows.useQuery()

  const saveWorkflow = api.orchestration.saveWorkflow.useMutation({
    onSuccess: () => refetch(),
  })

  return (
    <div>
      <DashPageHeader
        eyebrow="Automation"
        title="Workflows"
        subtitle="Pre-built and custom support flows wired into Advan. Edit any node, deploy in seconds."
        actions={
          <>
            <Link
              href="/dashboard/orchestration"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border dash-border bg-[var(--dash-card)] text-[13px] font-semibold text-[var(--dash-ink-soft)] hover:dash-shadow-sm transition"
            >
              <GitBranch className="w-4 h-4" /> Open builder
            </Link>
            <button
              onClick={() =>
                saveWorkflow.mutate({
                  name: "New workflow",
                  definition: EMPTY_PIPELINE,
                })
              }
              disabled={saveWorkflow.isPending}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-white bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] hover:-translate-y-px disabled:opacity-60 transition"
            >
              <Plus className="w-4 h-4" /> New workflow
            </button>
          </>
        }
      />

      <DashCard title="All workflows" icon={<LayoutGrid className="w-[18px] h-[18px]" />} padded={false}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border dash-border-soft bg-white p-4">
                  <div className="skeleton h-9 w-full rounded-lg mb-3" />
                  <div className="skeleton h-4 w-24 rounded" />
                </div>
              ))
            : (workflows ?? []).length === 0
            ? (
              <div className="col-span-2 py-12 text-center text-[13px] text-[var(--dash-ink-faint)]">
                No workflows yet.{" "}
                <button
                  onClick={() => saveWorkflow.mutate({ name: "My first workflow", definition: EMPTY_PIPELINE })}
                  className="text-[var(--dash-accent-deep)] font-semibold hover:underline"
                >
                  Create one →
                </button>
              </div>
            )
            : workflows!.map((w) => {
                const status = (w as any).status ?? "draft"
                const def = (w.definition as any) ?? {}
                const nodeCount = Array.isArray(def.nodes) ? def.nodes.length : "—"

                return (
                  <div
                    key={w.id}
                    className="rounded-xl border dash-border-soft bg-white p-4 hover:dash-shadow-sm transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg dash-bg-accent-wash flex items-center justify-center">
                        <GitBranch className="w-4 h-4 text-[var(--dash-accent-deep)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-bold text-[var(--dash-ink)] truncate">{w.name}</div>
                        <div className="text-[11px] text-[var(--dash-ink-faint)]">{nodeCount} nodes</div>
                      </div>
                      <span className={`text-[10.5px] font-bold rounded-md px-1.5 py-0.5 capitalize ${STATUS_TONE[status] ?? STATUS_TONE.draft}`}>
                        {status}
                      </span>
                    </div>
                    <div className="mt-3 text-[11.5px] text-[var(--dash-ink-faint)]">
                      Created {new Date((w as any).createdAt ?? Date.now()).toLocaleDateString()}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border dash-border bg-[var(--dash-card)] text-[12px] font-semibold text-[var(--dash-ink-soft)] hover:dash-shadow-sm transition">
                        {status === "inactive" ? <PlayCircle className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                        {status === "inactive" ? "Resume" : "Pause"}
                      </button>
                      <Link
                        href="/dashboard/orchestration"
                        className="ml-auto text-[11.5px] font-bold text-[var(--dash-accent-deep)] hover:underline"
                      >
                        Open →
                      </Link>
                    </div>
                  </div>
                )
              })}
        </div>
      </DashCard>
    </div>
  )
}
