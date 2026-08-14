import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { Providers } from './providers'
import { getEffectiveSession } from '@/lib/auth/effective-session'
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await getEffectiveSession()
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var g = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this;
              if (!g.crypto) {
                try { g.crypto = {}; } catch (e) {}
              }
              if (g.crypto && typeof g.crypto.randomUUID !== 'function') {
                var polyfill = function() {
                  try {
                    var buf = new Uint8Array(16);
                    if (g.crypto.getRandomValues) {
                      g.crypto.getRandomValues(buf);
                    } else {
                      for (var i = 0; i < 16; i++) buf[i] = (Math.random() * 256) | 0;
                    }
                    buf[6] = (buf[6] & 0x0f) | 0x40;
                    buf[8] = (buf[8] & 0x3f) | 0x80;
                    var hex = [];
                    for (var i = 0; i < 16; i++) {
                      var b = buf[i];
                      hex.push((b < 16 ? "0" : "") + b.toString(16));
                    }
                    return (
                      hex.slice(0, 4).join("") + "-" +
                      hex.slice(4, 6).join("") + "-" +
                      hex.slice(6, 8).join("") + "-" +
                      hex.slice(8, 10).join("") + "-" +
                      hex.slice(10, 16).join("")
                    );
                  } catch (e) {
                    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                      var r = (Math.random() * 16) | 0;
                      var v = c === 'x' ? r : (r & 0x3) | 0x8;
                      return v.toString(16);
                    });
                  }
                };
                try {
                  g.crypto.randomUUID = polyfill;
                } catch (e) {
                  try {
                    Object.defineProperty(g.crypto, 'randomUUID', {
                      value: polyfill,
                      configurable: true,
                      writable: true
                    });
                  } catch (e2) {}
                }
              }
            } catch (err) {}
          })();
        `}} />
      </head>
      <body
        className="font-sans antialiased min-h-screen bg-background text-foreground"
        suppressHydrationWarning
      >
        <Providers session={session}>{children}</Providers>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
