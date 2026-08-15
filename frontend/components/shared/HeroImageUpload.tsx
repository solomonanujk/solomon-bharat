'use client'

import { useEffect, useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'

interface HeroImageUploadProps {
  /** URL of the currently-saved image (edit mode), if any. */
  existingUrl?: string | null
  /** Newly-selected file awaiting upload on submit. */
  file: File | null
  onFileChange: (file: File | null) => void
  /** Called when the user removes the existing saved image (edit mode only). */
  onRemoveExisting?: () => void
  disabled?: boolean
  label?: string
}

/** Single-image upload widget — click-or-drag dropzone with a preview, replacing
 *  the old "paste an image URL" text inputs across the admin portal. */
export function HeroImageUpload({
  existingUrl,
  file,
  onFileChange,
  onRemoveExisting,
  disabled,
  label = 'Image',
}: HeroImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function handleFiles(files: FileList | null) {
    const picked = files?.[0]
    if (picked && picked.type.startsWith('image/')) onFileChange(picked)
  }

  const displayUrl = preview ?? existingUrl

  return (
    <div>
      <label className="block text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.05em] mb-1.5">
        {label} <span className="normal-case font-[400] text-muted-text/70">(optional)</span>
      </label>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled}
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); if (inputRef.current) inputRef.current.value = '' }}
      />
      {displayUrl ? (
        <div className="relative w-full max-w-[200px] aspect-video rounded overflow-hidden border border-border-warm bg-muted-bg group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={displayUrl} alt="" className="w-full h-full object-cover" />
          {!disabled && (
            <button
              type="button"
              onClick={() => {
                if (preview) onFileChange(null)
                else onRemoveExisting?.()
              }}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Remove image"
            >
              <X size={12} />
            </button>
          )}
        </div>
      ) : (
        !disabled && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-border-warm rounded p-4 flex flex-col items-center gap-1.5 text-center cursor-pointer hover:border-accent hover:bg-accent/5 transition-colors"
          >
            <Upload size={16} className="text-muted-text" />
            <p className="text-[12px] font-[500] font-public-sans text-primary">Click or drag an image here</p>
            <p className="text-[11px] font-public-sans text-muted-text">JPG, PNG or WebP</p>
          </div>
        )
      )}
    </div>
  )
}
