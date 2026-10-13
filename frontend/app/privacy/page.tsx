import type { Metadata } from 'next'
import { LegalPage } from '@/components/shared/LegalPage'
import { PRIVACY } from '@/lib/legal/privacy'

export const metadata: Metadata = { title: `${PRIVACY.title} — Solomon Bharat` }

export default function Page() {
  return <LegalPage doc={PRIVACY} />
}
