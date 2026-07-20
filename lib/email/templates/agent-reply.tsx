export interface AgentReplyTemplateInput {
  agentMessage: string
  agentName?: string
  ticketSubject: string
  organizationName?: string
}

export interface AgentReplyTemplateOutput {
  html: string
  text: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function paragraphsToHtml(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br />")}</p>`)
    .join("\n")
}

function paragraphsToText(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .join("\n\n")
}

/**
 * Multipart agent reply — HTML + plain-text alternative for clients and spam filters.
 */
export function renderAgentReplyEmail(input: AgentReplyTemplateInput): AgentReplyTemplateOutput {
  const org = input.organizationName?.trim() || "Support"
  const agentLabel = input.agentName?.trim() || "Support Agent"
  const bodyHtml = paragraphsToHtml(input.agentMessage)
  const bodyText = paragraphsToText(input.agentMessage)

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.ticketSubject)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #1a1a1a; max-width: 640px; margin: 0 auto; padding: 24px;">
  <div style="margin-bottom: 24px;">
    ${bodyHtml}
  </div>
  <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
  <p style="font-size: 13px; color: #666;">
    ${escapeHtml(agentLabel)} · ${escapeHtml(org)}<br />
    Reply to this email to continue the conversation.
  </p>
</body>
</html>`

  const text = `${bodyText}

--
${agentLabel} · ${org}
Reply to this email to continue the conversation.`

  return { html, text }
}

/** React component alias for plan compatibility — delegates to renderAgentReplyEmail. */
export function AgentReplyEmail(props: AgentReplyTemplateInput) {
  const { html } = renderAgentReplyEmail(props)
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}
