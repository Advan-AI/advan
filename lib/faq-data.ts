export interface FaqItem {
  question: string
  answer: string
}

export const faqs: FaqItem[] = [
  {
    question: "What does “transparent AI support” actually mean?",
    answer:
      "Every answer Advan generates ships with the source documents it pulled from, a confidence score, and a full reasoning trace. Agents and customers can click through to see exactly why the model answered the way it did. Nothing is fabricated — and if confidence is low, a human is brought in before any reply leaves.",
  },
  {
    question: "Where does Advan fit alongside our existing helpdesk?",
    answer:
      "Advan sits on top of your existing stack — Zendesk, Intercom, Salesforce Service Cloud, Front, Help Scout — and syncs both directions. You keep your inbox of record. Advan adds explainable AI on top.",
  },
  {
    question: "What about security and data residency?",
    answer:
      "Advan is SOC 2 Type II, GDPR-aligned, and HIPAA-ready. Tenant data never trains shared models. You can run with BYOK encryption, VPC peering, and EU or US data residency. Full reasoning audit logs export to your SIEM.",
  },
  {
    question: "How long does it take to roll out?",
    answer:
      "Most teams are live in 1–2 weeks. Week one: connect your data sources, set policy gates, and ingest your KB. Week two: shadow mode against real tickets, then enable auto-resolve on the intents you trust.",
  },
  {
    question: "Will Advan replace my support agents?",
    answer:
      "No. Advan is a copilot. It handles repetitive work and pre-drafts answers for everything else. Agents stay in control of complex, sensitive, and high-empathy conversations — and become measurably faster on the rest.",
  },
]
