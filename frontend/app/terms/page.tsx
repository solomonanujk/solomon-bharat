import type { Metadata } from 'next'
import { LegalPage } from '@/components/shared/LegalPage'
import { TERMS } from '@/lib/legal/terms'

export const metadata: Metadata = { title: `${TERMS.title} — Solomon Bharat` }

export default function Page() {
  return <LegalPage doc={TERMS} />
}
