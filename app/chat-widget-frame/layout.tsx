/**
 * Nested layout for the embeddable chat widget frame.
 *
 * The application root layout already owns <html> and <body>. A nested
 * layout must not render a second document shell because that can break
 * hydration and prevent the client widget effects from starting.
 */
export default function ChatWidgetFrameLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
