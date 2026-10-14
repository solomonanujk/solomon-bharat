import type { Metadata } from 'next'
import { LegalPage } from '@/components/shared/LegalPage'
import { CONTACT } from '@/lib/content/helpPages'

export const metadata: Metadata = { title: `${CONTACT.title} — Solomon Bharat` }

export default function Page() {
  return <LegalPage doc={CONTACT} />
}
