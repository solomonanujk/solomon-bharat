import type { Metadata } from 'next'
import { LegalPage } from '@/components/shared/LegalPage'
import { CAREERS } from '@/lib/content/helpPages'

export const metadata: Metadata = { title: `${CAREERS.title} — Solomon Bharat` }

export default function Page() {
  return <LegalPage doc={CAREERS} />
}
