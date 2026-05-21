"use client"

import { Plug, Plus, CheckCircle2 } from "lucide-react"
import { DashPageHeader, DashCard } from "@/components/dashboard/page-header"

const INTEGRATIONS = [
  { name: "Salesforce", category: "CRM",           connected: true,  events: "Auto-sync on resolve" },
  { name: "HubSpot",    category: "CRM",           connected: false, events: "Optional sync" },
  { name: "Zendesk",    category: "Ticketing",     connected: true,  events: "Two-way ticket mirror" },
  { name: "Slack",      category: "Channel",       connected: true,  events: "Live escalation alerts" },
  { name: "Gmail",      category: "Channel",       connected: true,  events: "Inbound + outbound" },
  { name: "Notion",     category: "Knowledge",     connected: false, events: "Sync docs into KB" },
  { name: "Confluence", category: "Knowledge",     connected: false, events: "Sync docs into KB" },
  { name: "Okta",       category: "Identity",      connected: true,  events: "SSO + SCIM" },
  { name: "Stripe",     category: "Billing",       connected: true,  events: "Refunds + invoice lookup" },
]

const CATS = Array.from(new Set(INTEGRATIONS.map((i) => i.category)))

export default function IntegrationsPage() {
  return (
    <div>
      <DashPageHeader
        eyebrow="Connections"
        title="Integrations"
        subtitle="Wire Advan into the rest of your stack. CRM, identity, channels, knowledge — all source-cited."
        actions={
          <button className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-white bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] hover:-translate-y-px transition">
            <Plus className="w-4 h-4" /> Browse marketplace
          </button>
        }
      />

      <div className="space-y-4">
        {CATS.map((cat) => (
          <DashCard key={cat} title={cat} icon={<Plug className="w-[18px] h-[18px]" />} padded={false}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
              {INTEGRATIONS.filter((i) => i.category === cat).map((i) => (
                <div
                  key={i.name}
                  className="rounded-xl border dash-border-soft bg-white p-4 hover:dash-shadow-sm transition"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-lg dash-bg-deep flex items-center justify-center text-[14px] font-bold text-[var(--dash-ink-soft)]">
                      {i.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-bold text-[var(--dash-ink)]">{i.name}</div>
                      <div className="text-[11px] text-[var(--dash-ink-faint)]">{i.events}</div>
                    </div>
                    {i.connected ? (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-[#2f5d3f] bg-[var(--dash-sage-wash)] rounded-md px-1.5 py-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Connected
                      </span>
                    ) : (
                      <button className="text-[11.5px] font-bold text-[var(--dash-accent-deep)] hover:underline">
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </DashCard>
        ))}
      </div>
    </div>
  )
}
