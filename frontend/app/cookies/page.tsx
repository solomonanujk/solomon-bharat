import type { Metadata } from 'next'
import { LegalPage } from '@/components/shared/LegalPage'
import { COOKIES } from '@/lib/legal/cookies'

export const metadata: Metadata = { title: `${COOKIES.title} — Solomon Bharat` }

export default function Page() {
  return <LegalPage doc={COOKIES} />
}
