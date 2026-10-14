import type { Metadata } from 'next'
import { LegalPage } from '@/components/shared/LegalPage'
import { FAQS } from '@/lib/content/helpPages'

export const metadata: Metadata = { title: `${FAQS.title} — Solomon Bharat` }

export default function Page() {
  return <LegalPage doc={FAQS} />
}
