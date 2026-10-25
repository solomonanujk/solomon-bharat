'use client'

import { useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WhatsAppPreview } from '@/components/admin/bulk/WhatsAppPreview'
import { Field, RadioCard, Steps, inputCls, textareaCls } from '@/components/admin/bulk/formParts'
import {
  useSaveBulkTemplate,
  useSubmitBulkTemplate,
  type BulkTemplate,
  type BulkTemplateCategory,
  type TemplateButton,
  type TemplateInput,
} from '@/hooks/queries/useBulkMessages'
import {
  LANGUAGES,
  LIMITS,
  NAME_PATTERN,
  bodyIssues,
  countPlaceholders,
  exampleIssues,
  slugifyName,
} from '@/lib/bulkTemplate'

const STEPS = ['Basics', 'Message', 'Examples', 'Review']

interface FormState {
  name: string
  category: BulkTemplateCategory
  language: string
  headerText: string
  body: string
  footer: string
  buttons: TemplateButton[]
  examples: string[]
}

function initialState(t?: BulkTemplate): FormState {
  return {
    name: t?.name ?? '',
    category: t?.category ?? 'UTILITY',
    language: t?.language ?? 'en',
    headerText: t?.headerText ?? '',
    body: t?.body ?? '',
    footer: t?.footer ?? '',
    buttons: (t?.buttons as TemplateButton[] | null) ?? [],
    examples: (t?.variableExamples as string[] | undefined) ?? [],
  }
}

function buttonIssue(b: TemplateButton): string | null {
  if (!b.text.trim()) return 'Every button needs a label'
  if (b.type === 'URL' && !/^https:\/\/\S+$/.test(b.url ?? '')) return `The "${b.text}" button needs an https:// link`
  if (b.type === 'PHONE_NUMBER' && !/^\+\d{8,15}$/.test(b.phone ?? '')) return `The "${b.text}" button needs a number like +919812345678`
  return null
}

/** Returns the first problem on a step, or null. */
function validateStep(step: number, f: FormState): string | null {
  if (step === 0) {
    if (!NAME_PATTERN.test(f.name)) return 'Name the template with lowercase letters, digits and underscores, for example festival_offer'
  }
  if (step === 1) {
    const issues = bodyIssues(f.body, f.headerText)
    if (issues.length > 0) return issues[0]
    for (const b of f.buttons) {
      const issue = buttonIssue(b)
      if (issue) return issue
    }
  }
  if (step === 2) {
    const issues = exampleIssues(f.body, f.examples)
    if (issues.length > 0) return issues[0]
  }
  return null
}

export function TemplateWizard({
  initial,
  onDone,
  onCancel,
}: {
  initial?: BulkTemplate
  onDone: () => void
  onCancel: () => void
}) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>(() => initialState(initial))
  const [error, setError] = useState<string | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const save = useSaveBulkTemplate()
  const submit = useSubmitBulkTemplate()

  const placeholders = countPlaceholders(form.body)
  const examples = Array.from({ length: placeholders }, (_, i) => form.examples[i] ?? '')
  const busy = save.isPending || submit.isPending

  function patch(fields: Partial<FormState>) {
    setForm((f) => ({ ...f, ...fields }))
    setError(null)
  }

  function insertVariable() {
    const next = placeholders + 1
    if (next > LIMITS.examples) return
    const token = `{{${next}}}`
    const el = bodyRef.current
    const at = el?.selectionStart ?? form.body.length
    const end = el?.selectionEnd ?? at
    patch({ body: `${form.body.slice(0, at)}${token}${form.body.slice(end)}` })
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(at + token.length, at + token.length)
    })
  }

  function updateButton(i: number, fields: Partial<TemplateButton>) {
    patch({ buttons: form.buttons.map((b, idx) => (idx === i ? { ...b, ...fields } : b)) })
  }

  function toInput(): TemplateInput {
    return {
      name: form.name,
      category: form.category,
      language: form.language,
      headerText: form.headerText.trim() || null,
      body: form.body.trim(),
      footer: form.footer.trim() || null,
      buttons: form.buttons.length > 0 ? form.buttons : null,
      variableExamples: examples.map((e) => e.trim()),
    }
  }

  function next() {
    const problem = validateStep(step, form)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setStep((s) => s + 1)
  }

  async function saveDraft(thenSubmit: boolean) {
    for (let s = 0; s < STEPS.length - 1; s += 1) {
      const problem = validateStep(s, form)
      if (problem) {
        setStep(s)
        setError(problem)
        return
      }
    }
    try {
      const saved = await save.mutateAsync({ id: initial?.id, input: toInput() })
      if (thenSubmit) await submit.mutateAsync(saved.id)
      onDone()
    } catch {
      // The hooks already showed the reason (for example Meta's explanation); stay on this step.
    }
  }

  return (
    <div className="bg-white border border-[#D9E2DA] rounded-xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-[18px] font-[600] font-sans text-[#0F241D]">{initial ? 'Edit template' : 'New template'}</h2>
          <p className="text-[13px] font-sans text-[#183D33B3] mt-0.5">
            Meta reviews every template before it can be sent. Utility templates are usually approved fastest.
          </p>
        </div>
        <button type="button" onClick={onCancel} className="text-[13px] font-[600] font-sans text-[#183D33B3] hover:text-[#0F241D]">
          Cancel
        </button>
      </div>

      <Steps labels={STEPS} current={step} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 mt-6">
        <div className="space-y-5 min-w-0">
          {step === 0 && (
            <>
              <Field label="Template name" hint="Lowercase letters, digits and underscores. Used by Meta, not shown to sellers." error={error}>
                <input
                  className={inputCls}
                  value={form.name}
                  onChange={(e) => patch({ name: slugifyName(e.target.value) })}
                  placeholder="festival_offer"
                  maxLength={60}
                  disabled={!!initial && initial.status !== 'DRAFT'}
                />
              </Field>
              <Field label="Category">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <RadioCard
                    selected={form.category === 'UTILITY'}
                    onSelect={() => patch({ category: 'UTILITY' })}
                    title="Utility"
                    description="Updates about something the seller already does with us: orders, payouts, approvals, account or policy changes."
                  />
                  <RadioCard
                    selected={form.category === 'MARKETING'}
                    onSelect={() => patch({ category: 'MARKETING' })}
                    title="Marketing"
                    description="Announcements, offers and campaigns. Costs more per message and sellers can mute them."
                  />
                </div>
              </Field>
              <Field label="Language" hint="Sellers receive the template in the language it was written in.">
                <select className={inputCls} value={form.language} onChange={(e) => patch({ language: e.target.value })}>
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <Field label="Header (optional)" counter={`${form.headerText.length}/${LIMITS.header}`} hint="A short bold line above the message. No variables.">
                <input className={inputCls} value={form.headerText} maxLength={LIMITS.header} onChange={(e) => patch({ headerText: e.target.value })} />
              </Field>
              <Field label="Message" counter={`${form.body.length}/${LIMITS.body}`} error={error}>
                <textarea
                  ref={bodyRef}
                  className={textareaCls}
                  rows={7}
                  value={form.body}
                  maxLength={LIMITS.body}
                  onChange={(e) => patch({ body: e.target.value })}
                  placeholder="Hello {{1}}, our festival buyers' list opens on {{2}}. Reply to know more."
                />
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button type="button" variant="ghost" size="sm" onClick={insertVariable} disabled={placeholders >= LIMITS.examples}>
                    <Plus size={14} aria-hidden="true" /> Add variable {`{{${placeholders + 1}}}`}
                  </Button>
                  <span className="text-[12px] font-sans text-[#183D33B3]">
                    A variable is filled in for each seller (their name, a date, an amount). It cannot be the first or last thing in the message.
                  </span>
                </div>
              </Field>
              <Field label="Footer (optional)" counter={`${form.footer.length}/${LIMITS.footer}`}>
                <input className={inputCls} value={form.footer} maxLength={LIMITS.footer} onChange={(e) => patch({ footer: e.target.value })} placeholder="Solomon Bharat" />
              </Field>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-[600] font-sans text-[#0F241D]">Buttons (optional, up to {LIMITS.buttons})</p>
                  {form.buttons.length < LIMITS.buttons && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => patch({ buttons: [...form.buttons, { type: 'QUICK_REPLY', text: '' }] })}>
                      <Plus size={14} aria-hidden="true" /> Add button
                    </Button>
                  )}
                </div>
                {form.buttons.map((b, i) => (
                  <div key={i} className="grid grid-cols-1 sm:grid-cols-[150px_1fr_1fr_auto] gap-2 items-start">
                    <select
                      className={inputCls}
                      value={b.type}
                      onChange={(e) => updateButton(i, { type: e.target.value as TemplateButton['type'], url: undefined, phone: undefined })}
                      aria-label="Button type"
                    >
                      <option value="QUICK_REPLY">Quick reply</option>
                      <option value="URL">Open a link</option>
                      <option value="PHONE_NUMBER">Call a number</option>
                    </select>
                    <input
                      className={inputCls}
                      value={b.text}
                      maxLength={LIMITS.button}
                      onChange={(e) => updateButton(i, { text: e.target.value })}
                      placeholder="Button label"
                      aria-label="Button label"
                    />
                    {b.type === 'URL' ? (
                      <input className={inputCls} value={b.url ?? ''} onChange={(e) => updateButton(i, { url: e.target.value })} placeholder="https://..." aria-label="Link" />
                    ) : b.type === 'PHONE_NUMBER' ? (
                      <input className={inputCls} value={b.phone ?? ''} onChange={(e) => updateButton(i, { phone: e.target.value })} placeholder="+919812345678" aria-label="Phone number" />
                    ) : (
                      <p className="text-[12px] font-sans text-[#183D33B3] self-center">The seller&apos;s tap comes back to you under Replies.</p>
                    )}
                    <button
                      type="button"
                      onClick={() => patch({ buttons: form.buttons.filter((_, idx) => idx !== i) })}
                      className="h-9 w-9 flex items-center justify-center rounded-lg border border-[#D9E2DA] text-[#183D33B3] hover:text-error"
                      aria-label="Remove button"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              {placeholders === 0 ? (
                <p className="text-[13px] font-sans text-[#183D33B3]">This message has no variables, so there is nothing to give examples for.</p>
              ) : (
                <>
                  <p className="text-[13px] font-sans text-[#183D33B3]">
                    Meta needs a sample for each variable to review the template. These are only samples; real values are filled in when you send.
                  </p>
                  {examples.map((value, i) => (
                    <Field key={i} label={`Example for {{${i + 1}}}`} error={i === 0 ? error : null}>
                      <input
                        className={inputCls}
                        value={value}
                        maxLength={200}
                        onChange={(e) => {
                          const copy = [...examples]
                          copy[i] = e.target.value
                          patch({ examples: copy })
                        }}
                        placeholder={i === 0 ? 'Asha' : 'Friday 7 November'}
                      />
                    </Field>
                  ))}
                </>
              )}
            </>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-[13px] font-sans">
                <dt className="text-[#183D33B3]">Name</dt>
                <dd className="text-[#0F241D] font-[600]">{form.name}</dd>
                <dt className="text-[#183D33B3]">Category</dt>
                <dd className="text-[#0F241D]">{form.category === 'MARKETING' ? 'Marketing' : 'Utility'}</dd>
                <dt className="text-[#183D33B3]">Language</dt>
                <dd className="text-[#0F241D]">{LANGUAGES.find((l) => l.code === form.language)?.label ?? form.language}</dd>
                <dt className="text-[#183D33B3]">Variables</dt>
                <dd className="text-[#0F241D]">{placeholders}</dd>
              </dl>
              <p className="text-[13px] font-sans text-[#183D33B3]">
                Save as a draft to keep working on it, or submit to Meta now. After you submit, the text cannot be changed; make a new template instead.
              </p>
              {error && <p role="alert" className="text-[12px] font-sans text-error">{error}</p>}
            </div>
          )}
        </div>

        <aside className="min-w-0">
          <p className="text-[12px] font-[600] font-sans text-[#183D33B3] uppercase tracking-[0.06em] mb-2">Preview</p>
          <WhatsAppPreview headerText={form.headerText} body={form.body} footer={form.footer} buttons={form.buttons} values={examples} />
        </aside>
      </div>

      <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-[#D9E2DA]">
        <Button type="button" variant="ghost" size="sm" onClick={() => (step === 0 ? onCancel() : setStep(step - 1))} disabled={busy}>
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" size="sm" onClick={next}>
            Next
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => void saveDraft(false)} disabled={busy}>
              Save as draft
            </Button>
            <Button type="button" size="sm" onClick={() => void saveDraft(true)} loading={busy}>
              Submit to Meta
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
