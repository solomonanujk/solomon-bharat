'use client'

import { useState } from 'react'
import { Bookmark, ExternalLink, Heart, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

/** A product Solomon AI recommends: from the catalogue, or an idea shown with a web photo. */
export interface GuidePick {
  key: string
  source: 'catalogue' | 'idea'
  name: string
  image: string | null
  link: string | null
  credit?: string
  category?: string
  origin?: string
  moq?: number
  weightKg?: number
  story: string
  why: string
  cost?: string
  shipping?: string
  duty?: string
  landed?: string
  sell?: string
}

export interface GuideSavedItem {
  key: string
  name: string
  image: string | null
  link: string | null
  liked: boolean
  saved: boolean
}

function CostRow({ label, value, strong }: { label: string; value?: string; strong?: boolean }) {
  if (!value) return null
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={cn('text-[12px]', strong ? 'text-[#0F241D] font-[600]' : 'text-[#6B7E72]')}>{label}</span>
      <span className={cn('text-[12.5px] text-right tabular-nums', strong ? 'text-[#0F241D] font-[700]' : 'text-[#3D5248]')}>{value}</span>
    </div>
  )
}

export function GuidePickCard({
  pick,
  state,
  onToggle,
}: {
  pick: GuidePick
  state?: GuideSavedItem
  onToggle: (pick: GuidePick, kind: 'liked' | 'saved', on: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const [broken, setBroken] = useState(false)
  const liked = !!state?.liked
  const saved = !!state?.saved
  const hasCosts = pick.cost || pick.shipping || pick.duty || pick.landed || pick.sell
  const meta = [pick.category, pick.moq ? `MOQ ${pick.moq}` : null, pick.weightKg ? `${pick.weightKg < 1 ? `${Math.round(pick.weightKg * 1000)} g` : `${+pick.weightKg.toFixed(2)} kg`}` : null].filter(Boolean).join(' · ')

  return (
    <article className="shrink-0 w-[272px] sm:w-[300px] snap-start rounded-2xl bg-white border border-[#E3E8E1] overflow-hidden flex flex-col shadow-[0_8px_24px_-16px_rgba(15,36,29,0.35)]">
      <div className="relative aspect-[4/3] bg-[#EEF1EC]">
        {pick.image && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pick.image} alt={pick.name} loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full grid place-items-center text-[12px] text-[#8D9B92]">No photo yet</div>
        )}
        <span
          className={cn(
            'absolute top-2.5 left-2.5 text-[10.5px] font-[700] uppercase tracking-[0.06em] px-2 py-1 rounded-full backdrop-blur',
            pick.source === 'catalogue' ? 'bg-[#183D33]/90 text-white' : 'bg-white/90 text-[#3D5248]',
          )}
        >
          {pick.source === 'catalogue' ? 'Ready to source' : 'Idea'}
        </span>
        <div className="absolute top-2 right-2 flex gap-1.5">
          <button
            type="button"
            aria-label={liked ? 'Unlike' : 'Like'}
            aria-pressed={liked}
            onClick={() => onToggle(pick, 'liked', !liked)}
            className="w-8 h-8 rounded-full bg-white/95 grid place-items-center shadow-sm hover:scale-105 transition-transform"
          >
            <Heart size={16} className={liked ? 'fill-[#E0475B] text-[#E0475B]' : 'text-[#3D5248]'} />
          </button>
          <button
            type="button"
            aria-label={saved ? 'Remove from saved' : 'Save'}
            aria-pressed={saved}
            onClick={() => onToggle(pick, 'saved', !saved)}
            className="w-8 h-8 rounded-full bg-white/95 grid place-items-center shadow-sm hover:scale-105 transition-transform"
          >
            <Bookmark size={16} className={saved ? 'fill-[#183D33] text-[#183D33]' : 'text-[#3D5248]'} />
          </button>
        </div>
      </div>

      <div className="p-3.5 flex flex-col gap-2.5 flex-1">
        <div>
          <h3 className="text-[15px] font-[600] text-[#0F241D] leading-snug">{pick.name}</h3>
          {(pick.origin || meta) && (
            <p className="mt-0.5 text-[11.5px] text-[#6B7E72] flex items-center gap-1">
              {pick.origin && <MapPin size={11} aria-hidden="true" />}
              {[pick.origin, meta].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        {pick.story && (
          <p className={cn('text-[13px] leading-[1.5] text-[#3D5248]', !open && 'line-clamp-3')}>
            {pick.story}
          </p>
        )}
        {pick.story.length > 140 && (
          <button type="button" onClick={() => setOpen((o) => !o)} className="self-start -mt-1.5 text-[12px] font-[600] text-[#183D33] hover:underline">
            {open ? 'Show less' : 'Read the story'}
          </button>
        )}

        {pick.why && (
          <p className="text-[12.5px] leading-[1.45] text-[#183D33] bg-[#EEF5F0] rounded-xl px-3 py-2">
            <span className="font-[600]">Why it fits you: </span>
            {pick.why}
          </p>
        )}

        {hasCosts && (
          <div className="rounded-xl border border-[#E3E8E1] px-3 py-2.5 flex flex-col gap-1.5">
            <CostRow label="Cost in India" value={pick.cost} />
            <CostRow label="Shipping" value={pick.shipping} />
            <CostRow label="Duty & VAT" value={pick.duty} />
            {pick.landed && <div className="h-px bg-[#E3E8E1] my-0.5" />}
            <CostRow label="Landed cost" value={pick.landed} strong />
            <CostRow label="Sell at" value={pick.sell} strong />
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-0.5">
          {pick.link ? (
            <a
              href={pick.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12.5px] font-[600] text-[#183D33] hover:underline"
            >
              {pick.source === 'catalogue' ? 'View product' : 'Photo source'} <ExternalLink size={12} aria-hidden="true" />
            </a>
          ) : (
            <span />
          )}
          {pick.credit && <span className="text-[10px] text-[#8D9B92] truncate max-w-[55%]">Photo: {pick.credit}</span>}
        </div>
      </div>
    </article>
  )
}
