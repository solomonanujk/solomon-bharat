'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DEFAULT_PHONE_COUNTRY,
  MAX_NATIONAL_NUMBER_LENGTH,
  MIN_NATIONAL_NUMBER_LENGTH,
  PHONE_COUNTRY_CODES,
} from '@/lib/phoneCountryCodes'

/** Splits a stored phone value ("+91 9876543210") into its dial code and
 *  digits-only national number. Falls back to the default country when the
 *  value has no recognizable "+<digits>" prefix (e.g. empty, or legacy data
 *  saved before this field had a country picker). */
export function parsePhoneValue(value: string): { dialCode: string; nationalNumber: string } {
  const match = value.trim().match(/^(\+\d{1,4})[\s-]*(.*)$/)
  if (match) return { dialCode: match[1], nationalNumber: match[2].replace(/\D/g, '') }
  return { dialCode: DEFAULT_PHONE_COUNTRY.dialCode, nationalNumber: value.replace(/\D/g, '') }
}

/** Deliberately simple: a digit-count range (6–14) rather than a full
 *  per-country format library, for one checkout field. */
export function isValidPhoneNumber(value: string): boolean {
  const { nationalNumber } = parsePhoneValue(value)
  return nationalNumber.length >= MIN_NATIONAL_NUMBER_LENGTH && nationalNumber.length <= MAX_NATIONAL_NUMBER_LENGTH
}

export function PhoneInput({
  value,
  onChange,
  disabled,
  id,
  showError,
}: {
  /** Full combined value, e.g. "+91 9876543210". */
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  id?: string
  /** Forces the invalid-number message on even before the field is touched —
   *  e.g. the caller attempted to submit the form. Blurring the field always
   *  shows it regardless, so this is just an additional trigger, not the only one. */
  showError?: boolean
}) {
  const { dialCode, nationalNumber } = parsePhoneValue(value)
  const selected = PHONE_COUNTRY_CODES.find((c) => c.dialCode === dialCode) ?? DEFAULT_PHONE_COUNTRY

  const [open, setOpen] = useState(false)
  const [touched, setTouched] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  function selectCountry(newDialCode: string) {
    onChange(`${newDialCode} ${nationalNumber}`.trim())
    setOpen(false)
  }

  function setNationalNumber(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, MAX_NATIONAL_NUMBER_LENGTH)
    onChange(`${dialCode} ${digits}`.trim())
  }

  const invalid = (touched || showError) && nationalNumber.length > 0 && !isValidPhoneNumber(value)

  return (
    <div>
      <div className="flex gap-2">
        <div ref={ref} className="relative flex-shrink-0">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={`Country code: ${selected.name} ${selected.dialCode}`}
            className="h-11 px-3 rounded border border-border-warm bg-surface text-[14px] font-sans text-primary flex items-center gap-1.5 focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
          >
            {selected.dialCode}
            <ChevronDown size={14} className="text-muted-text" aria-hidden="true" />
          </button>
          {open && (
            <div
              role="listbox"
              className="absolute top-full left-0 mt-1 z-30 w-64 max-h-64 overflow-y-auto bg-surface border border-border-warm rounded shadow-lg py-1"
            >
              {PHONE_COUNTRY_CODES.map((c) => (
                <button
                  key={c.iso2}
                  type="button"
                  role="option"
                  aria-selected={c.dialCode === dialCode}
                  onClick={() => selectCountry(c.dialCode)}
                  className={cn(
                    'w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-[13px] font-sans transition-colors hover:bg-muted-bg/60',
                    c.dialCode === dialCode ? 'text-primary font-[600]' : 'text-primary'
                  )}
                >
                  <span>{c.name}</span>
                  <span className="text-muted-text flex-shrink-0">{c.dialCode}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={nationalNumber}
          disabled={disabled}
          onChange={(e) => setNationalNumber(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="98765 43210"
          className={cn(
            'flex-1 min-w-0 h-11 px-3 rounded border bg-surface text-[14px] font-sans text-primary placeholder:text-muted-text/50 focus:outline-none transition-colors disabled:opacity-50',
            invalid ? 'border-error focus:border-error' : 'border-border-warm focus:border-accent'
          )}
        />
      </div>
      {invalid && (
        <p className="text-[12px] font-sans text-error mt-1.5" role="alert">
          Enter a valid mobile number ({MIN_NATIONAL_NUMBER_LENGTH}–{MAX_NATIONAL_NUMBER_LENGTH} digits).
        </p>
      )}
    </div>
  )
}
