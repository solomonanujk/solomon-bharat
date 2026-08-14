import type { Metadata } from 'next'
import { Trirong, Quattrocento_Sans } from 'next/font/google'
import './globals.css'
import { Providers } from '@/providers/Providers'

// Editorial serif — homepage hero and other large editorial moments only
const trirong = Trirong({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-playfair',
  display: 'swap',
})

// UI sans — all marketplace interface text (Quattrocento Sans: 400 + 700 only)
const quattrocentoSans = Quattrocento_Sans({
  subsets: ['latin'],
  weight: ['400', '700'],
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
    <html lang="en" className={`${trirong.variable} ${quattrocentoSans.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
