'use client'

import { Check, AlertCircle } from 'lucide-react'

export interface ListingScoreInput {
  name: string
  description: string
  categoryId: string
  tags: string
  weight: string
  placeOfOrigin: string
  howItIsMade: string
  artisanName: string
  imageCount: number
  hasPricing: boolean
}

interface ScoreRule {
  label: string
  points: number
  earned: number
  passing: boolean
}

export function calcListingScore(input: ListingScoreInput): { score: number; maxScore: number; rules: ScoreRule[] } {
  const wordCount = input.description.trim().split(/\s+/).filter(Boolean).length
  const tagCount = input.tags.split(',').map((t) => t.trim()).filter(Boolean).length

  const rules: ScoreRule[] = [
    { label: 'Product name (5+ chars)', points: 10, earned: input.name.trim().length >= 5 ? 10 : 0, passing: input.name.trim().length >= 5 },
    { label: 'Category selected', points: 10, earned: input.categoryId ? 10 : 0, passing: !!input.categoryId },
    { label: 'Description (50+ words)', points: 10, earned: wordCount >= 100 ? 10 : wordCount >= 50 ? 5 : 0, passing: wordCount >= 50 },
    { label: 'Description detail (100+)', points: 10, earned: wordCount >= 100 ? 10 : 0, passing: wordCount >= 100 },
    { label: 'At least 3 product images', points: 15, earned: input.imageCount >= 5 ? 15 : input.imageCount >= 3 ? 10 : input.imageCount >= 1 ? 5 : 0, passing: input.imageCount >= 3 },
    { label: '3+ tags added', points: 5, earned: tagCount >= 3 ? 5 : tagCount >= 1 ? 2 : 0, passing: tagCount >= 3 },
    { label: 'Volume pricing set', points: 10, earned: input.hasPricing ? 10 : 0, passing: input.hasPricing },
    { label: 'Weight filled', points: 5, earned: Number(input.weight) > 0 ? 5 : 0, passing: Number(input.weight) > 0 },
    { label: 'Place of origin filled', points: 5, earned: input.placeOfOrigin.trim().length > 0 ? 5 : 0, passing: input.placeOfOrigin.trim().length > 0 },
    { label: 'How it is made (story)', points: 10, earned: input.howItIsMade.trim().split(/\s+/).filter(Boolean).length >= 20 ? 10 : input.howItIsMade.trim().length > 0 ? 5 : 0, passing: input.howItIsMade.trim().length > 0 },
    { label: 'Artisan name provided', points: 5, earned: input.artisanName.trim().length > 0 ? 5 : 0, passing: input.artisanName.trim().length > 0 },
  ]

  const score = rules.reduce((s, r) => s + r.earned, 0)
  const maxScore = rules.reduce((s, r) => s + r.points, 0)
  return { score, maxScore, rules }
}

function ScoreRing({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = maxScore > 0 ? score / maxScore : 0
  const r = 44
  const circ = 2 * Math.PI * r
  const dash = pct * circ
  const color = pct >= 0.7 ? '#22c55e' : pct >= 0.5 ? '#f59e0b' : '#ef4444'
  return (
    <div className="relative w-[120px] h-[120px] flex-shrink-0">
      <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#f0ebe3" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.4s ease, stroke 0.4s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-playfair text-[28px] font-[600] text-primary leading-none">{score}</span>
        <span className="font-public-sans text-[11px] text-muted-text mt-0.5">/ {maxScore}</span>
      </div>
    </div>
  )
}

/**
 * Informational only — unlike solomon-bharat2, submission isn't gated on this score,
 * because a human admin review is already the quality gate before anything goes live.
 */
export function ListingScoreWidget({ input }: { input: ListingScoreInput }) {
  const { score, maxScore, rules } = calcListingScore(input)
  const failing = rules.filter((r) => !r.passing)
  return (
    <div className="bg-surface border border-border-warm rounded p-5 space-y-4">
      <h3 className="text-[14px] font-[600] font-public-sans text-primary">Listing Score</h3>
      <div className="flex items-center gap-4">
        <ScoreRing score={score} maxScore={maxScore} />
        <div className="flex-1">
          <p className="text-[12px] font-public-sans text-muted-text">
            A more complete listing gets reviewed and approved faster.
          </p>
        </div>
      </div>
      {failing.length > 0 && (
        <div className="space-y-1.5 border-t border-border-warm pt-3">
          <p className="text-[11px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.06em]">Improve to boost score</p>
          {failing.map((r) => (
            <div key={r.label} className="flex items-start gap-2">
              <AlertCircle size={12} className="text-error flex-shrink-0 mt-0.5" />
              <span className="text-[12px] font-public-sans text-primary leading-snug flex-1">{r.label}</span>
              <span className="text-[11px] font-[600] font-public-sans text-muted-text flex-shrink-0">+{r.points}</span>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-1.5 border-t border-border-warm pt-3">
        {rules.filter((r) => r.passing).map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            <Check size={12} className="text-[#22c55e] flex-shrink-0" />
            <span className="text-[12px] font-public-sans text-muted-text leading-snug flex-1">{r.label}</span>
            <span className="text-[11px] font-[600] font-public-sans text-[#22c55e] flex-shrink-0">+{r.earned}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
