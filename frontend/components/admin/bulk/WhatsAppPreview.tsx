import { ExternalLink, Phone, Reply } from 'lucide-react'
import { fillPlaceholders } from '@/lib/bulkTemplate'
import type { TemplateButton } from '@/hooks/queries/useBulkMessages'

/** How the message will look on a seller's phone. Variables show their example or chosen value. */
export function WhatsAppPreview({
  headerText,
  body,
  footer,
  buttons,
  values = [],
}: {
  headerText?: string | null
  body: string
  footer?: string | null
  buttons?: TemplateButton[] | null
  values?: string[]
}) {
  return (
    <div className="rounded-xl bg-[#E5DDD5] p-4">
      <div className="max-w-[320px] rounded-lg rounded-tl-none bg-white shadow-sm overflow-hidden">
        <div className="px-3 pt-2 pb-1.5">
          {headerText && <p className="text-[14px] font-[700] font-sans text-[#0F241D] mb-1 break-words">{headerText}</p>}
          <p className="text-[13px] leading-[1.45] font-sans text-[#0F241D] whitespace-pre-wrap break-words">
            {body ? fillPlaceholders(body, values) : <span className="text-[#183D33B3]">Your message appears here</span>}
          </p>
          {footer && <p className="text-[11px] font-sans text-[#183D33B3] mt-1.5 break-words">{footer}</p>}
          <p className="text-[10px] font-sans text-[#183D33B3] text-right mt-1">now</p>
        </div>
        {buttons && buttons.length > 0 && (
          <div className="border-t border-[#D9E2DA] divide-y divide-[#D9E2DA]">
            {buttons.map((b, i) => (
              <div key={i} className="flex items-center justify-center gap-1.5 py-2 text-[13px] font-[600] font-sans text-[#027EB5]">
                {b.type === 'URL' ? <ExternalLink size={13} aria-hidden="true" /> : b.type === 'PHONE_NUMBER' ? <Phone size={13} aria-hidden="true" /> : <Reply size={13} aria-hidden="true" />}
                {b.text || 'Button'}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
