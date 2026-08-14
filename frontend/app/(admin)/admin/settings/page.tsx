'use client'

import { useEffect, useState } from 'react'
import { Plus, Settings as SettingsIcon } from 'lucide-react'
import { usePlatformSettings, useUpdatePlatformSetting } from '@/hooks/queries/useAdmin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/shared/EmptyState'
import type { PlatformSetting } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Renders any `unknown` setting value as an editable string. */
function valueToText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/** Parses the text back into JSON when it looks like JSON, otherwise sends the raw string. */
function textToValue(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) return ''
  const looksLikeJson =
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
    trimmed === 'true' ||
    trimmed === 'false' ||
    trimmed === 'null' ||
    /^-?\d+(\.\d+)?$/.test(trimmed)
  if (looksLikeJson) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return text
    }
  }
  return text
}

// ─── Existing setting row ─────────────────────────────────────────────────────

function SettingRow({ setting }: { setting: PlatformSetting }) {
  const [value, setValue] = useState(() => valueToText(setting.value))
  const updateSetting = useUpdatePlatformSetting()

  useEffect(() => {
    setValue(valueToText(setting.value))
  }, [setting.value])

  const dirty = value !== valueToText(setting.value)

  return (
    <div className="flex items-end gap-3 py-3.5 px-4 border-b border-border-warm last:border-0">
      <div className="flex-1 min-w-0">
        <Label className="mb-1">{setting.key}</Label>
        <Input value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <Button
        variant="primary"
        size="sm"
        disabled={!dirty || updateSetting.isPending}
        onClick={() => updateSetting.mutate({ key: setting.key, value: textToValue(value) })}
      >
        {updateSetting.isPending ? 'Saving…' : 'Save'}
      </Button>
    </div>
  )
}

// ─── Add-setting form ─────────────────────────────────────────────────────────

function AddSettingForm() {
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const updateSetting = useUpdatePlatformSetting()

  function handleAdd() {
    if (!key.trim()) return
    updateSetting.mutate(
      { key: key.trim(), value: textToValue(value) },
      { onSuccess: () => { setKey(''); setValue('') } }
    )
  }

  return (
    <div className="bg-surface border border-border-warm rounded p-6 space-y-4">
      <h2 className="text-[16px] font-[600] font-public-sans text-primary pb-3 border-b border-border-warm flex items-center gap-2">
        <Plus size={15} aria-hidden="true" />
        Add setting
      </h2>
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <Label htmlFor="new-setting-key">Key</Label>
          <Input
            id="new-setting-key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="e.g. maintenanceMode"
          />
        </div>
        <div className="flex-1 min-w-[180px]">
          <Label htmlFor="new-setting-value">Value</Label>
          <Input
            id="new-setting-value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. true, 10, or free text"
          />
        </div>
        <Button
          variant="primary"
          size="md"
          disabled={!key.trim() || updateSetting.isPending}
          onClick={handleAdd}
        >
          {updateSetting.isPending ? 'Adding…' : 'Add'}
        </Button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  const { data: settings = [], isLoading } = usePlatformSettings()

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-[28px] leading-[1.3] font-[500] font-playfair text-primary">Settings</h1>
        <p className="text-[14px] font-public-sans text-muted-text mt-1">
          Platform-wide key/value configuration
        </p>
      </div>

      <div className="bg-surface border border-border-warm rounded overflow-hidden mb-6">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted-bg rounded animate-pulse" />
            ))}
          </div>
        ) : settings.length === 0 ? (
          <EmptyState
            title="No settings configured yet"
            description="Add one below to get started."
          />
        ) : (
          settings.map((s) => <SettingRow key={s.key} setting={s} />)
        )}
      </div>

      <AddSettingForm />

      <p className="text-[12px] font-public-sans text-muted-text mt-4 flex items-center gap-1.5">
        <SettingsIcon size={12} aria-hidden="true" />
        Values are stored as JSON when they look like a number, boolean, object, or array — otherwise as plain text.
      </p>
    </div>
  )
}
