import type { Metadata } from 'next'
import { LegalPage } from '@/components/shared/LegalPage'
import { SELLER_AGREEMENT } from '@/lib/legal/sellerAgreement'

export const metadata: Metadata = { title: `${SELLER_AGREEMENT.title} — Solomon Bharat` }

export default function Page() {
  return <LegalPage doc={SELLER_AGREEMENT} />
}
