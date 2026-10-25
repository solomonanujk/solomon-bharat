'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { WhatsAppPreview } from '@/components/admin/bulk/WhatsAppPreview'
import { Field, RadioCard, Steps, inputCls } from '@/components/admin/bulk/formParts'
import {
  useBulkCampaignAction,
  useBulkTemplates,
  useBulkTestSend,
  useCreateBulkCampaign,
  usePreviewAudience,
  type AudienceMode,
  type AudiencePreview,
  type AudienceSpec,
  type BulkTemplate,
} from '@/hooks/queries/useBulkMessages'
import { useWhatsAppAdminSellers } from '@/hooks/queries/useWhatsApp'
import { countPlaceholders } from '@/lib/bulkTemplate'
import { parseCsv, type ParsedCsv } from '@/lib/parseCsv'
import { cn } from '@/lib/utils'

const STEPS = ['Template', 'Audience', 'Variables', 'Test', 'Review']
const CSV_ROW_CAP = 5000
/** Matches the server default (BULK_SEND_PER_SECOND); only used for the "about how long" hint. */
const SENDS_PER_SECOND = 5

type VarSource = { kind: 'businessName' | 'contactName' | 'fixed' | 'csv'; text: string; column: string }

const SKIP_LABEL: Record<keyof AudiencePreview['skipped'], string> = {
  notLinked: 'have not linked WhatsApp',
  optedOut: 'asked not to get announcements',
  suspended: 'are suspended',
  unmatched: 'CSV rows matched no registered seller',
  duplicate: 'CSV rows repeated a seller',
}

function toMapping(v: VarSource): string {
  if (v.kind === 'businessName') return 'seller.businessName'
  if (v.kind === 'contactName') return 'seller.contactName'
  if (v.kind === 'fixed') return `fixed:${v.text.trim()}`
  return `csv:${v.column}`
}

function varIssue(v: VarSource, csvMode: boolean): string | null {
  if (v.kind === 'fixed' && !v.text.trim()) return 'Type the text for every fixed variable'
  if (v.kind === 'csv' && (!csvMode || !v.column)) return 'Choose a CSV column for every CSV variable'
  return null
}

function duration(count: number): string {
  const seconds = Math.ceil(count / SENDS_PER_SECOND)
  if (seconds < 90) return `${seconds} seconds`
  return `about ${Math.round(seconds / 60)} minutes`
}

export function CampaignWizard({ onCancel }: { onCancel: () => void }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const [template, setTemplate] = useState<BulkTemplate | null>(null)

  const [mode, setMode] = useState<AudienceMode>('ALL_LINKED')
  const [sellerType, setSellerType] = useState<'' | 'CURATED' | 'MARKETPLACE'>('')
  const [listedByChat, setListedByChat] = useState(false)
  const [filterSearch, setFilterSearch] = useState('')
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [pickInput, setPickInput] = useState('')
  const [pickSearch, setPickSearch] = useState('')
  const [csv, setCsv] = useState<(ParsedCsv & { fileName: string; keyColumn: string }) | null>(null)
  const [preview, setPreview] = useState<{ key: string; data: AudiencePreview } | null>(null)

  const [vars, setVars] = useState<VarSource[]>([])
  const [testPhone, setTestPhone] = useState('')
  const [name, setName] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const templates = useBulkTemplates({ status: 'APPROVED', limit: 50 })
  const pickList = useWhatsAppAdminSellers({ search: pickSearch || undefined, limit: 8 })
  const previewMut = usePreviewAudience()
  const testMut = useBulkTestSend()
  const createMut = useCreateBulkCampaign()
  const actionMut = useBulkCampaignAction()

  useEffect(() => {
    const t = setTimeout(() => setPickSearch(pickInput.trim()), 300)
    return () => clearTimeout(t)
  }, [pickInput])

  const placeholders = template ? countPlaceholders(template.body) : 0

  const spec: AudienceSpec | null = useMemo(() => {
    if (mode === 'ALL_LINKED') return { mode }
    if (mode === 'FILTERED') {
      return {
        mode,
        filters: {
          ...(sellerType ? { sellerType } : {}),
          ...(listedByChat ? { listedByChat: true } : {}),
          ...(filterSearch.trim() ? { search: filterSearch.trim() } : {}),
        },
      }
    }
    if (mode === 'PICKED') return { mode, sellerIds: Object.keys(picked) }
    if (csv && csv.keyColumn) return { mode, csvRows: csv.rows.slice(0, CSV_ROW_CAP), csvKeyColumn: csv.keyColumn }
    return null
  }, [mode, sellerType, listedByChat, filterSearch, picked, csv])

  const specKey = spec ? JSON.stringify(spec) : ''
  const freshPreview = preview && preview.key === specKey ? preview.data : null

  function chooseTemplate(t: BulkTemplate) {
    setTemplate(t)
    setVars(Array.from({ length: countPlaceholders(t.body) }, () => ({ kind: 'contactName', text: '', column: '' })))
    setName(`${t.name} ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`)
    setError(null)
  }

  async function checkAudience() {
    if (!spec) {
      setError('Finish choosing the audience first')
      return
    }
    setError(null)
    try {
      const data = await previewMut.mutateAsync(spec)
      setPreview({ key: JSON.stringify(spec), data })
    } catch {
      // the hook showed the reason
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    const parsed = parseCsv(await file.text())
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      setError('That file has no rows. Use a CSV with a header row.')
      return
    }
    const guess = parsed.headers.find((h) => /phone|mobile|whatsapp|email/i.test(h)) ?? parsed.headers[0]
    setCsv({ ...parsed, fileName: file.name, keyColumn: guess })
    setError(null)
  }

  /** What each {{n}} would be for the first sample seller: used by the preview and the test message. */
  function sampleValues(): string[] {
    const seller = freshPreview?.sample[0]
    return vars.map((v) => {
      if (v.kind === 'businessName') return seller?.businessName ?? 'Business name'
      if (v.kind === 'contactName') return seller?.contactName ?? 'Contact name'
      if (v.kind === 'fixed') return v.text.trim() || '…'
      return csv?.rows[0]?.[v.column] || '…'
    })
  }

  function next() {
    setError(null)
    if (step === 0 && !template) return setError('Choose an approved template')
    if (step === 1) {
      if (!freshPreview) return setError('Check the audience first')
      if (freshPreview.eligible === 0) return setError('No eligible sellers in this audience')
      if (freshPreview.tooMany) return setError(`That is more than ${freshPreview.maxRecipients} sellers; narrow the audience`)
    }
    if (step === 2) {
      for (const v of vars) {
        const issue = varIssue(v, mode === 'CSV')
        if (issue) return setError(issue)
      }
    }
    setStep((s) => s + 1)
  }

  async function send() {
    if (!template || !spec) return
    try {
      const campaign = await createMut.mutateAsync({
        name: name.trim() || template.name,
        templateId: template.id,
        audience: spec,
        variableMapping: vars.map(toMapping),
      })
      await actionMut.mutateAsync({ id: campaign.id, action: 'start' })
      router.push(`/admin/bulk-messages/${campaign.id}`)
    } catch {
      setConfirmOpen(false)
    }
  }

  const eligible = freshPreview?.eligible ?? 0
  const skippedEntries = freshPreview ? (Object.entries(freshPreview.skipped) as [keyof AudiencePreview['skipped'], number][]).filter(([, n]) => n > 0) : []

  return (
    <div className="bg-white border border-[#D9E2DA] rounded-xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-[18px] font-[600] font-sans text-[#0F241D]">New campaign</h2>
          <p className="text-[13px] font-sans text-[#183D33B3] mt-0.5">Only registered sellers with a verified WhatsApp number can receive a message.</p>
        </div>
        <button type="button" onClick={onCancel} className="text-[13px] font-[600] font-sans text-[#183D33B3] hover:text-[#0F241D]">
          Cancel
        </button>
      </div>

      <Steps labels={STEPS} current={step} />

      <div className="mt-6 space-y-5">
        {step === 0 && (
          <Field label="Choose a template" hint="Only templates Meta has approved can be sent." error={error}>
            {templates.isLoading ? (
              <p className="text-[13px] font-sans text-[#183D33B3]">Loading…</p>
            ) : (templates.data?.items.length ?? 0) === 0 ? (
              <p className="text-[13px] font-sans text-[#183D33B3]">No approved templates yet. Create one on the Templates tab and wait for Meta to approve it.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.data!.items.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => chooseTemplate(t)}
                    aria-pressed={template?.id === t.id}
                    className={cn(
                      'text-left rounded-xl border p-3 space-y-2 transition-colors',
                      template?.id === t.id ? 'border-[#183D33] bg-[#E7EDE7]/60' : 'border-[#D9E2DA] hover:bg-[#E7EDE7]/30',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-[600] font-sans text-[#0F241D] break-all">{t.name}</span>
                      <span className="text-[11px] font-sans text-[#183D33B3]">{t.category === 'MARKETING' ? 'Marketing' : 'Utility'}</span>
                    </div>
                    <WhatsAppPreview headerText={t.headerText} body={t.body} footer={t.footer} buttons={t.buttons} values={t.variableExamples} />
                  </button>
                ))}
              </div>
            )}
          </Field>
        )}

        {step === 1 && (
          <>
            <Field label="Who should get it?">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <RadioCard selected={mode === 'ALL_LINKED'} onSelect={() => setMode('ALL_LINKED')} title="All sellers" description="Every registered seller with a verified WhatsApp number." />
                <RadioCard selected={mode === 'FILTERED'} onSelect={() => setMode('FILTERED')} title="Filter sellers" description="By seller type, whether they have listed by chat, or a name search." />
                <RadioCard selected={mode === 'PICKED'} onSelect={() => setMode('PICKED')} title="Pick sellers" description="Search and tick the sellers yourself." />
                <RadioCard selected={mode === 'CSV'} onSelect={() => setMode('CSV')} title="Upload a CSV" description="A list that picks registered sellers by number or email. Other numbers are never messaged." />
              </div>
            </Field>

            {mode === 'FILTERED' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Seller type">
                  <select className={inputCls} value={sellerType} onChange={(e) => setSellerType(e.target.value as typeof sellerType)}>
                    <option value="">Any</option>
                    <option value="CURATED">Curated</option>
                    <option value="MARKETPLACE">Marketplace</option>
                  </select>
                </Field>
                <Field label="Name contains">
                  <input className={inputCls} value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} placeholder="brass" />
                </Field>
                <Field label="Listing">
                  <label className="flex items-center gap-2 h-9 text-[13px] font-sans text-[#0F241D]">
                    <input type="checkbox" className="w-4 h-4 accent-[#183D33]" checked={listedByChat} onChange={(e) => setListedByChat(e.target.checked)} />
                    Has listed a product by WhatsApp
                  </label>
                </Field>
              </div>
            )}

            {mode === 'PICKED' && (
              <div className="space-y-2">
                <input className={cn(inputCls, 'max-w-[320px]')} value={pickInput} onChange={(e) => setPickInput(e.target.value)} placeholder="Search by business or number…" />
                <div className="border border-[#D9E2DA] rounded-lg divide-y divide-[#D9E2DA] max-w-[520px]">
                  {(pickList.data?.items ?? []).map((s) => (
                    <label key={s.sellerId} className="flex items-center gap-3 px-3 py-2 text-[13px] font-sans cursor-pointer hover:bg-[#E7EDE7]/30">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-[#183D33]"
                        checked={s.sellerId in picked}
                        onChange={(e) =>
                          setPicked((p) => {
                            const copy = { ...p }
                            if (e.target.checked) copy[s.sellerId] = s.businessName
                            else delete copy[s.sellerId]
                            return copy
                          })
                        }
                      />
                      <span className="text-[#0F241D]">{s.businessName}</span>
                      <span className="text-[#183D33B3] ml-auto">{s.whatsappNumber}</span>
                    </label>
                  ))}
                  {pickList.data && pickList.data.items.length === 0 && <p className="px-3 py-3 text-[13px] font-sans text-[#183D33B3]">No linked sellers match.</p>}
                </div>
                <p className="text-[12px] font-sans text-[#183D33B3]">
                  {Object.keys(picked).length} picked{Object.keys(picked).length > 0 ? `: ${Object.values(picked).slice(0, 4).join(', ')}${Object.keys(picked).length > 4 ? '…' : ''}` : ''}
                </p>
              </div>
            )}

            {mode === 'CSV' && (
              <div className="space-y-3">
                <input type="file" accept=".csv,text/csv" onChange={(e) => void onFile(e.target.files?.[0])} className="text-[13px] font-sans" />
                {csv && (
                  <div className="space-y-2">
                    <p className="text-[12px] font-sans text-[#183D33B3]">
                      {csv.fileName}: {csv.rows.length.toLocaleString()} rows{csv.rows.length > CSV_ROW_CAP ? `. Only the first ${CSV_ROW_CAP} are used.` : ''}
                    </p>
                    <Field label="Which column names the seller?" hint="A WhatsApp number, registered phone or email address. Extra columns can fill template variables.">
                      <select className={cn(inputCls, 'max-w-[280px]')} value={csv.keyColumn} onChange={(e) => setCsv({ ...csv, keyColumn: e.target.value })}>
                        {csv.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="secondary" size="sm" onClick={() => void checkAudience()} loading={previewMut.isPending} disabled={!spec}>
                Check audience
              </Button>
              {preview && !freshPreview && <span className="text-[12px] font-sans text-warning">You changed the audience. Check it again.</span>}
            </div>

            {freshPreview && (
              <div className="rounded-xl border border-[#D9E2DA] bg-[#E7EDE7]/30 p-4 space-y-2">
                <p className="text-[14px] font-[600] font-sans text-[#0F241D]">{freshPreview.eligible.toLocaleString()} sellers will get this message</p>
                {skippedEntries.length > 0 && (
                  <ul className="text-[12px] font-sans text-[#183D33B3] list-disc pl-4">
                    {skippedEntries.map(([key, n]) => (
                      <li key={key}>
                        {n.toLocaleString()} {SKIP_LABEL[key]} (skipped)
                      </li>
                    ))}
                  </ul>
                )}
                {freshPreview.tooMany && <p className="text-[12px] font-sans text-error">One campaign can reach at most {freshPreview.maxRecipients.toLocaleString()} sellers.</p>}
                {freshPreview.sample.length > 0 && (
                  <p className="text-[12px] font-sans text-[#183D33B3]">
                    For example: {freshPreview.sample.map((s) => s.businessName).join(', ')}
                  </p>
                )}
              </div>
            )}
            {error && <p role="alert" className="text-[12px] font-sans text-error">{error}</p>}
          </>
        )}

        {step === 2 && template && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
            <div className="space-y-4">
              {placeholders === 0 ? (
                <p className="text-[13px] font-sans text-[#183D33B3]">This template has no variables. Everyone gets the same message.</p>
              ) : (
                vars.map((v, i) => (
                  <div key={i} className="rounded-xl border border-[#D9E2DA] p-3 space-y-2">
                    <p className="text-[12px] font-[600] font-sans text-[#0F241D]">
                      {`{{${i + 1}}}`} <span className="text-[#183D33B3] font-[400]">(example: {template.variableExamples[i]})</span>
                    </p>
                    <select
                      className={inputCls}
                      value={v.kind}
                      onChange={(e) => setVars((all) => all.map((x, idx) => (idx === i ? { ...x, kind: e.target.value as VarSource['kind'] } : x)))}
                      aria-label={`Value for variable ${i + 1}`}
                    >
                      <option value="contactName">The seller&apos;s contact name</option>
                      <option value="businessName">The seller&apos;s business name</option>
                      <option value="fixed">The same text for everyone</option>
                      {mode === 'CSV' && <option value="csv">A column from the CSV</option>}
                    </select>
                    {v.kind === 'fixed' && (
                      <input
                        className={inputCls}
                        value={v.text}
                        maxLength={200}
                        onChange={(e) => setVars((all) => all.map((x, idx) => (idx === i ? { ...x, text: e.target.value } : x)))}
                        placeholder="Friday 7 November"
                      />
                    )}
                    {v.kind === 'csv' && (
                      <select
                        className={inputCls}
                        value={v.column}
                        onChange={(e) => setVars((all) => all.map((x, idx) => (idx === i ? { ...x, column: e.target.value } : x)))}
                      >
                        <option value="">Choose a column</option>
                        {(csv?.headers ?? []).map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))
              )}
              {error && <p role="alert" className="text-[12px] font-sans text-error">{error}</p>}
            </div>
            <aside>
              <p className="text-[12px] font-[600] font-sans text-[#183D33B3] uppercase tracking-[0.06em] mb-2">Preview for the first seller</p>
              <WhatsAppPreview headerText={template.headerText} body={template.body} footer={template.footer} buttons={template.buttons} values={sampleValues()} />
            </aside>
          </div>
        )}

        {step === 3 && template && (
          <div className="space-y-3 max-w-[480px]">
            <p className="text-[13px] font-sans text-[#183D33B3]">
              Send the message to one number first to check how it looks. This step is optional. While you are on Meta&apos;s free test number, the number must be on the test recipient list.
            </p>
            <Field label="WhatsApp number">
              <input className={inputCls} value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="+919812345678" />
            </Field>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={testMut.isPending}
              disabled={!testPhone.trim()}
              onClick={() => testMut.mutate({ templateId: template.id, phone: testPhone.trim(), variables: sampleValues() })}
            >
              Send a test
            </Button>
          </div>
        )}

        {step === 4 && template && (
          <div className="space-y-4 max-w-[560px]">
            <Field label="Campaign name" hint="Only you see this.">
              <input className={inputCls} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
            </Field>
            <dl className="grid grid-cols-[130px_1fr] gap-y-2 text-[13px] font-sans">
              <dt className="text-[#183D33B3]">Template</dt>
              <dd className="text-[#0F241D] flex items-center gap-2">
                {template.name} <StatusBadge status={template.status} />
              </dd>
              <dt className="text-[#183D33B3]">Sellers</dt>
              <dd className="text-[#0F241D] font-[600]">{eligible.toLocaleString()}</dd>
              <dt className="text-[#183D33B3]">Skipped</dt>
              <dd className="text-[#0F241D]">{skippedEntries.reduce((n, [, c]) => n + c, 0).toLocaleString()}</dd>
              <dt className="text-[#183D33B3]">Takes about</dt>
              <dd className="text-[#0F241D]">{duration(eligible)}. You can pause or cancel while it runs.</dd>
            </dl>
            {template.category === 'MARKETING' && (
              <p className="text-[12px] font-sans text-[#183D33B3]">
                Meta charges for each delivered marketing message, and may not deliver to a seller who already got several marketing messages recently.
              </p>
            )}
            {error && <p role="alert" className="text-[12px] font-sans text-error">{error}</p>}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-[#D9E2DA]">
        <Button type="button" variant="ghost" size="sm" onClick={() => (step === 0 ? onCancel() : setStep(step - 1))}>
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" size="sm" onClick={next}>
            {step === 3 ? (testMut.isSuccess ? 'Next' : 'Skip the test') : 'Next'}
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={() => (name.trim() ? setConfirmOpen(true) : setError('Give the campaign a name'))} disabled={eligible === 0}>
            Send to {eligible.toLocaleString()} sellers
          </Button>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Send to {eligible.toLocaleString()} sellers?</DialogTitle>
            <DialogDescription>
              The message goes out right away on WhatsApp. You can pause or cancel it from the campaign page, but messages already sent cannot be taken back.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)} disabled={createMut.isPending || actionMut.isPending}>
              Not yet
            </Button>
            <Button size="sm" onClick={() => void send()} loading={createMut.isPending || actionMut.isPending}>
              Send now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
