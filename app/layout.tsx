import type { Metadata, Viewport } from 'next'
import { Inter, Playfair_Display, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' })

export const metadata: Metadata = {
  title: 'Advan AI — Transparent AI Support for Better Customer Experiences',
  description:
    'Advan delivers explainable AI customer support that preserves context across channels, reduces wait times, and lets every agent see exactly how the AI reached its answer.',
  generator: 'Advan AI',
  metadataBase: new URL('https://advan.ai'),
  keywords: [
    'AI customer support',
    'transparent AI',
    'explainable AI',
    'customer experience',
    'AI copilot',
    'B2B SaaS',
  ],
  openGraph: {
    title: 'Advan AI — Transparent AI Support for Better Customer Experiences',
    description:
      'Explainable AI support that preserves context, reduces wait times, and earns customer trust.',
    type: 'website',
    url: 'https://advan.ai',
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#080b10',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${geistMono.variable} dark`} suppressHydrationWarning>
      <body className="font-sans antialiased min-h-screen bg-background text-foreground">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
