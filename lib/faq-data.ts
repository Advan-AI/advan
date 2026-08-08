export interface FaqItem {
  question: string
  answer: string
}

export const faqs: FaqItem[] = [
  {
    question: "What does “transparent AI support” actually mean?",
    answer:
      "Every answer Advan generates comes with the source it pulled from, a confidence score, and a clear reason for that score. You and your customers can see exactly why the AI answered the way it did — and if it isn't confident, a human reviews it before anything is sent.",
  },
  {
    question: "Does Advan work with our existing helpdesk?",
    answer:
      "Yes. Advan connects to the tools you already use — Zendesk, Intercom, Salesforce, Slack, Gmail, HubSpot, and more — and syncs both ways. You keep your existing inbox; Advan adds the AI layer on top.",
  },
  {
    question: "Is Advan built for a team our size?",
    answer:
      "Advan is built for growing B2B SaaS companies, not just large enterprises. It's priced and packaged to be affordable for a lean support team, and simple enough to deploy without engineering help.",
  },
  {
    question: "How long does it take to go live?",
    answer:
      "Most teams are live in under two weeks. We connect your knowledge base and helpdesk, set your confidence threshold, and run in shadow mode against real tickets before turning on auto-resolve.",
  },
  {
    question: "Will Advan replace our support agents?",
    answer:
      "No. Advan handles repetitive, well-documented questions automatically and drafts the rest for your team. Agents stay in control of complex or sensitive conversations, and spend less time on repeat questions.",
  },
]
