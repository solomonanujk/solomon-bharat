import type { Metadata } from 'next'
import { LegalPage } from '@/components/shared/LegalPage'
import { HELP } from '@/lib/content/helpPages'

export const metadata: Metadata = { title: `${HELP.title} — Solomon Bharat` }

export default function Page() {
  return <LegalPage doc={HELP} />
}
