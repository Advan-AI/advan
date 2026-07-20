/**
 * Bare layout for the embeddable chat widget frame.
 * Intentionally contains no nav, header, footer, or marketing chrome —
 * this page is always displayed inside a sandboxed <iframe>.
 */
export default function ChatWidgetFrameLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
