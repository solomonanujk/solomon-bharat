import type { Metadata } from 'next'
import { LegalPage } from '@/components/shared/LegalPage'
import { EXPORT_GUIDE } from '@/lib/content/helpPages'

export const metadata: Metadata = { title: `${EXPORT_GUIDE.title} — Solomon Bharat` }

export default function Page() {
  return <LegalPage doc={EXPORT_GUIDE} />
}
