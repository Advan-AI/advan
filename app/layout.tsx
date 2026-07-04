import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Advan AI - Trust Infrastructure for AI Customer Support',
  description:
    'Advan is the trust infrastructure layer for AI customer support, with source-cited drafting, confidence thresholds, policy validation, human approval gates, and audit trails.',
  generator: 'Advan AI',
  metadataBase: new URL('https://advan.ai'),
  keywords: [
    'AI customer support',
    'trust infrastructure',
    'explainable AI',
    'AI governance',
    'source cited AI',
    'human in the loop',
    'B2B SaaS',
  ],
  openGraph: {
    title: 'Advan AI - Trust Infrastructure for AI Customer Support',
    description:
      'Explainable and governable AI support with source-cited answers, policy gates, and human-in-the-loop review.',
    type: 'website',
    url: 'https://advan.ai',
    siteName: 'Advan AI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Advan AI - Trust Infrastructure for AI Customer Support',
    description:
      'Explainable and governable AI support with source-cited answers, policy gates, and human-in-the-loop review.',
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#101512',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className="font-sans antialiased min-h-screen bg-background text-foreground"
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
