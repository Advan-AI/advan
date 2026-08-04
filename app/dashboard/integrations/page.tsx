"use client"

import { Plug, Plus, CheckCircle2 } from "lucide-react"
import { DashPageHeader, DashCard } from "@/components/dashboard/page-header"
import { ChatWidgetSettings } from "./chat-widget-settings"
import { EmailForwardingSettings } from "./email-forwarding-settings"
import { TeamSettings } from "./team-settings"

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
    <div className="integrations-page min-w-0 w-full max-w-full">
      <DashPageHeader
        eyebrow="Connections"
        title="Integrations"
        subtitle="Wire Advan into the rest of your stack. CRM, identity, channels, knowledge — all source-cited."
        actions={
          <button
            type="button"
            className="inline-flex min-h-10 h-10 sm:h-9 w-full sm:w-auto items-center justify-center gap-1.5 px-4 rounded-lg text-[13px] font-semibold text-white bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] hover:-translate-y-px transition"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="truncate sm:hidden">Marketplace</span>
            <span className="hidden sm:inline truncate">Browse marketplace</span>
          </button>
        }
      />

      <div className="space-y-3 sm:space-y-4">
        <TeamSettings />
        <ChatWidgetSettings />
        <EmailForwardingSettings />

        {CATS.map((cat) => (
          <DashCard key={cat} title={cat} icon={<Plug className="w-[18px] h-[18px]" />} padded={false}>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 4xl:grid-cols-4 gap-2.5 sm:gap-3 p-3 sm:p-4">
              {INTEGRATIONS.filter((i) => i.category === cat).map((i) => (
                <div
                  key={i.name}
                  className="rounded-xl border dash-border-soft bg-white p-3.5 sm:p-4 hover:dash-shadow-sm transition min-w-0"
                >
                  <div className="flex items-start sm:items-center gap-2.5">
                    <div className="w-10 h-10 shrink-0 rounded-lg dash-bg-deep flex items-center justify-center text-[14px] font-bold text-[var(--dash-ink-soft)]">
                      {i.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-bold text-[var(--dash-ink)] truncate">{i.name}</div>
                      <div className="text-[11px] text-[var(--dash-ink-faint)] line-clamp-2 sm:truncate">{i.events}</div>
                    </div>
                    {i.connected ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-[10.5px] font-bold text-[#2f5d3f] bg-[var(--dash-sage-wash)] rounded-md px-1.5 py-0.5">
                        <CheckCircle2 className="w-3 h-3" />
                        <span className="sm:hidden">On</span>
                        <span className="hidden sm:inline">Connected</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="shrink-0 min-h-9 px-2.5 rounded-md text-[11.5px] font-bold text-[var(--dash-accent-deep)] hover:bg-[var(--dash-accent-wash)] transition"
                      >
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
