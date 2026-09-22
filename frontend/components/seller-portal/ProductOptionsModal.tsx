'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'

const AXIS_TYPES = ['Size', 'Color', 'Material', 'Style', 'Scent', 'Product language'] as const
type AxisType = (typeof AXIS_TYPES)[number]

// Our variant engine only carries one Size axis plus one other named axis at a
// time — matches the reference's own dynamic row list, capped at what the data
// model actually supports instead of silently accepting rows that go nowhere.
const MAX_ROWS = 2

interface OptionRow {
  id: string
  type: string
  values: string[]
  newValue: string
}

function uid() {
  return Math.random().toString(36).slice(2)
}

function emptyRow(): OptionRow {
  return { id: uid(), type: '', values: [], newValue: '' }
}

interface ProductOptionsModalProps {
  sizeValues: string[]
  axisType: string
  axisValues: string[]
  disabled?: boolean
  onCancel: () => void
  onSave: (result: { size: string[]; axisType: string; axisValues: string[] }) => void
}

function PillInput({ pills, onRemove, inputValue, onInputChange, onInputKeyDown, placeholder, disabled }: {
  pills: string[]
  onRemove: (v: string) => void
  inputValue: string
  onInputChange: (v: string) => void
  onInputKeyDown: (e: React.KeyboardEvent) => void
  placeholder: string
  disabled?: boolean
}) {
  return (
    <div className={`border border-border-warm rounded-md px-2.5 py-2 flex flex-wrap gap-2 items-center ${disabled ? 'bg-muted-bg/30' : ''}`}>
      {pills.map((v) => (
        <span key={v} className="inline-flex items-center gap-2 bg-primary text-white rounded-full pl-3.5 pr-1.5 py-1.5 text-[13px] font-sans">
          {v}
          <button type="button" onClick={() => onRemove(v)} aria-label={`Remove ${v}`}
            className="w-4.5 h-4.5 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
            <X size={11} />
          </button>
        </span>
      ))}
      <input type="text" value={inputValue} disabled={disabled} onChange={(e) => onInputChange(e.target.value)} onKeyDown={onInputKeyDown}
        placeholder={placeholder}
        className="flex-1 min-w-[140px] border-none outline-none text-[13px] font-sans bg-transparent text-primary placeholder:text-muted-text/50 disabled:cursor-not-allowed" />
    </div>
  )
}

function OptionTypeDropdown({ value, usedTypes, disabled, onChange }: {
  value: string; usedTypes: Set<string>; disabled?: boolean; onChange: (t: AxisType) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])
  const choices = AXIS_TYPES.filter((t) => t === value || !usedTypes.has(t))
  return (
    <div ref={ref} className="relative">
      <button type="button" disabled={disabled} onClick={() => setOpen((o) => !o)}
        className="w-full h-10 px-3 rounded border border-border-warm bg-surface text-[14px] font-sans flex items-center justify-between disabled:opacity-50">
        <span className={value ? 'text-primary' : 'text-muted-text/50'}>{value || 'Select option type'}</span>
        <span className="text-muted-text">&#9662;</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-surface border border-border-warm rounded shadow-lg py-1">
          {choices.map((t) => (
            <button key={t} type="button" onClick={() => { onChange(t); setOpen(false) }}
              className="w-full text-left px-4 py-2.5 text-[14px] font-sans text-primary hover:bg-muted-bg/60 transition-colors">
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** "Add product options" modal — a dynamic list of rows (starting empty, not
 *  pre-filled), each freely choosing its own option type from the same dropdown
 *  (Size included) via "+ Add product option", capped at MAX_ROWS since the
 *  variant engine only carries one Size axis plus one other named axis at a time. */
export function ProductOptionsModal({ sizeValues, axisType, axisValues, disabled, onCancel, onSave }: ProductOptionsModalProps) {
  const [rows, setRows] = useState<OptionRow[]>(() => {
    const initial: OptionRow[] = []
    if (sizeValues.length > 0) initial.push({ id: uid(), type: 'Size', values: sizeValues, newValue: '' })
    if (axisType && axisValues.length > 0) initial.push({ id: uid(), type: axisType, values: axisValues, newValue: '' })
    return initial.length > 0 ? initial : [emptyRow()]
  })

  const usedTypes = new Set(rows.map((r) => r.type).filter(Boolean))

  function updateRow(id: string, patch: Partial<OptionRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }
  function addValue(id: string) {
    setRows((prev) => prev.map((r) => {
      if (r.id !== id) return r
      const v = r.newValue.trim()
      if (!v || r.values.includes(v)) return { ...r, newValue: '' }
      return { ...r, values: [...r.values, v], newValue: '' }
    }))
  }
  function removeRow(id: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : [emptyRow()]))
  }
  function addRow() {
    setRows((prev) => (prev.length < MAX_ROWS ? [...prev, emptyRow()] : prev))
  }

  function handleSave() {
    const sizeRow = rows.find((r) => r.type === 'Size')
    const otherRow = rows.find((r) => r.type && r.type !== 'Size')
    onSave({
      size: sizeRow?.values ?? [],
      axisType: otherRow?.type ?? '',
      axisValues: otherRow?.values ?? [],
    })
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/45" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="bg-surface rounded-xl p-9 max-w-2xl w-full max-h-[90vh] overflow-y-auto relative" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onCancel} aria-label="Close"
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-muted-text hover:text-primary hover:bg-muted-bg transition-colors">
          <X size={16} />
        </button>

        <h2 className="text-[22px] font-[600] font-display text-primary mb-5">Add product options</h2>

        <div className="bg-warning/10 rounded-md px-4 py-3.5 text-[13px] font-sans text-primary mb-6">
          List size options in order from smallest to largest.
        </div>

        <div className="grid mb-2" style={{ gridTemplateColumns: '24px 1fr 1.6fr 24px', gap: '10px 14px' }}>
          <div />
          <div className="text-[13px] font-[600] font-sans text-primary">Option</div>
          <div className="text-[13px] font-[600] font-sans text-primary">Option values</div>
          <div />

          {rows.map((row, i) => (
            <div key={row.id} className="contents">
              <div className="w-6 h-6 rounded-full bg-primary text-white text-[12px] font-sans flex items-center justify-center self-start mt-1">
                {i + 1}
              </div>
              <OptionTypeDropdown value={row.type} usedTypes={usedTypes} disabled={disabled}
                onChange={(t) => updateRow(row.id, { type: t })} />
              <PillInput pills={row.values} onRemove={(v) => updateRow(row.id, { values: row.values.filter((x) => x !== v) })}
                inputValue={row.newValue} onInputChange={(v) => updateRow(row.id, { newValue: v })}
                onInputKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addValue(row.id) } }}
                placeholder={row.type ? `Add a new "${row.type}" value` : 'Add a variant of the existing products'}
                disabled={disabled || !row.type} />
              <button type="button" disabled={disabled} onClick={() => removeRow(row.id)} aria-label="Remove option"
                className="text-muted-text hover:text-red-600 transition-colors self-start mt-2 disabled:opacity-40">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        {rows.length < MAX_ROWS && (
          <button type="button" disabled={disabled} onClick={addRow}
            className="inline-flex items-center gap-2 text-[13px] font-[600] font-sans text-primary hover:text-accent transition-colors disabled:opacity-50 mt-2">
            <Plus size={18} className="rounded-full border border-current p-0.5 box-content" />
            Add product option
          </button>
        )}

        <div className="flex flex-col items-center gap-3.5 mt-8">
          <button type="button" disabled={disabled} onClick={handleSave}
            className="w-full h-12 rounded bg-primary text-white text-[14px] font-[600] font-sans hover:bg-primary/90 transition-colors disabled:opacity-50">
            Save &amp; continue
          </button>
          <button type="button" onClick={onCancel}
            className="text-[13px] font-[500] font-sans text-primary underline hover:text-accent transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export type { AxisType }
