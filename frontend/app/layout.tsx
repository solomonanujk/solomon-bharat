import type { Metadata } from 'next'
import { Fraunces, Hanken_Grotesk } from 'next/font/google'
import './globals.css'
import { Providers } from '@/providers/Providers'

// Editorial serif — homepage hero and other large editorial moments only.
// Fraunces is a free, open-license stand-in for Faire's Nantes: same warm,
// generous-x-height serif character, without the commercial licensing.
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-playfair',
  display: 'swap',
})

// UI sans — all marketplace interface text. Hanken Grotesk is a free,
// open-license stand-in for Faire's Graphik: the same clean geometric-grotesk
// proportions, without the commercial licensing.
const hankenGrotesk = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-public-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Solomon Bharat — Premium Indian Exports, Wholesale',
  description:
    'B2B wholesale export marketplace connecting international buyers with authentic Indian products, sold and fulfilled by Solomon Bharat.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${hankenGrotesk.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
