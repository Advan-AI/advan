"use client"

import { useState } from "react"
import { Mail, Copy, Check, RefreshCw, Info } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api/trpc-client"
import { DashCard } from "@/components/dashboard/page-header"

export function EmailForwardingSettings() {
  const { data, isLoading } = api.integrations.getOrganization.useQuery()
  const [copied, setCopied] = useState(false)

  if (isLoading) {
    return (
      <DashCard title="Email Forwarding" icon={<Mail className="w-[18px] h-[18px]" />} padded>
        <div className="flex items-center gap-2 text-[13px] text-[var(--dash-ink-soft)] font-medium">
          <RefreshCw className="w-4 h-4 animate-spin text-[var(--dash-accent)]" />
          <span>Loading email settings...</span>
        </div>
      </DashCard>
    )
  }

  const org = data?.org
  const inboundDomain = data?.inboundDomain || "mail.yourdomain.com"
  
  // Construct the alias
  const alias = org?.inboundEmailAlias || `support+${org?.slug || "org"}`
  const inboundEmailAddress = `${alias}@${inboundDomain}`

  const handleCopy = () => {
    navigator.clipboard.writeText(inboundEmailAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success("Inbound email address copied!")
  }

  return (
    <DashCard title="Email Inbound Channel" icon={<Mail className="w-[18px] h-[18px]" />} padded>
      <div className="space-y-5 sm:space-y-6 max-w-2xl 3xl:max-w-3xl 4xl:max-w-4xl">
        <p className="text-[13px] text-[var(--dash-ink-soft)] leading-relaxed">
          Route your support emails directly into Advan. When customers send emails to your dedicated inbound address, our AI agent will automatically run ground-truth triage, draft response options, and present them inside your team conversation workspace.
        </p>

        {/* Unique Forwarding Address */}
        <div className="space-y-2">
          <label className="text-[13px] font-bold text-[var(--dash-ink)]">Your Dedicated Inbound Address</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 flex items-center justify-between gap-2 border dash-border-soft rounded-lg px-3 sm:px-3.5 py-2.5 bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
              <span className="min-w-0 text-[12px] sm:text-[13.5px] font-mono select-all text-[var(--dash-ink-soft)] tracking-tight font-semibold break-all">
                {inboundEmailAddress}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex min-h-9 min-w-9 h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--dash-ink-faint)] hover:text-[var(--dash-ink)] transition-colors hover:bg-[var(--dash-bg-deep)]"
                title="Copy address"
                aria-label="Copy inbound address"
              >
                {copied ? <Check className="w-4 h-4 text-[var(--dash-sage)]" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <p className="text-[11.5px] text-[var(--dash-ink-faint)] leading-normal">
            First-contact inbound emails sent to this unique alias will resolve securely to your organization without any cross-tenant contamination.
          </p>
        </div>

        {/* Setup Guide / Instructions */}
        <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.02] p-3.5 sm:p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1 min-w-0">
              <h4 className="text-[12.5px] font-bold text-amber-900 leading-none">How to set up custom forwarding</h4>
              <p className="text-[11.5px] text-amber-800/80 leading-normal">
                To keep your public support address looking clean (e.g., <code className="break-all">support@yourdomain.com</code>), configure automatic forwarding rules inside your email provider.
              </p>
            </div>
          </div>
          <ul className="text-[11px] text-[var(--dash-ink-soft)] space-y-2 list-disc pl-5 leading-normal">
            <li>
              <strong>Google Workspace (Gmail):</strong> Go to Gmail Admin &gt; Routing &gt; Add a rule to forward incoming mail to <code className="break-all">{inboundEmailAddress}</code>.
            </li>
            <li>
              <strong>Microsoft 365 (Exchange):</strong> Go to Exchange Admin Center &gt; Mail Flow &gt; Rules &gt; Add a rule to redirect support messages to <code className="break-all">{inboundEmailAddress}</code>.
            </li>
          </ul>
        </div>
      </div>
    </DashCard>
  )
}
