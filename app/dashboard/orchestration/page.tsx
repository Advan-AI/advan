"use client"

import { DashPageHeader } from "@/components/dashboard/page-header"
import { PipelineBuilder } from "@/components/pipeline/pipeline-builder"

export default function OrchestrationPage() {
  return (
    <div>
      <DashPageHeader
        eyebrow="Automation"
        title="Agent Orchestration Builder"
        subtitle="Drag nodes from the palette, connect them into an acyclic pipeline, and deploy. Cycles are blocked automatically; new node types plug in without touching the engine."
      />
      <PipelineBuilder />
    </div>
  )
}
