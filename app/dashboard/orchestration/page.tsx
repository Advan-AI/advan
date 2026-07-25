"use client"

import { DashPageHeader } from "@/components/dashboard/page-header"
import { PipelineBuilder } from "@/components/pipeline/pipeline-builder"

export default function OrchestrationPage() {
  return (
    <div className="orchestration-page min-w-0 w-full max-w-full">
      <DashPageHeader
        eyebrow="Automation"
        title={
          <>
            <span className="sm:hidden">Orchestration</span>
            <span className="hidden sm:inline">Agent Orchestration Builder</span>
          </>
        }
        subtitle="Drag nodes from the palette, connect them into an acyclic pipeline, and deploy. Cycles are blocked automatically; new node types plug in without touching the engine."
      />
      <PipelineBuilder />
    </div>
  )
}
