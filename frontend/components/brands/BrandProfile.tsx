'use client'

import Image from 'next/image'
import { Globe, AtSign, MapPin, ShieldCheck } from 'lucide-react'
import { BrandLogo, VerifiedBadge } from '@/components/brands/BrandTag'
import { FollowBrandButton } from '@/components/brands/FollowBrandButton'
import { cloudinaryFill } from '@/lib/cloudinaryImage'
import type { PublicBrand } from '@/types'

function safeUrl(value: string | null): string | null {
  if (!value) return null
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`
  try {
    return new URL(withProtocol).toString()
  } catch {
    return null
  }
}

function instagramUrl(value: string | null): string | null {
  if (!value) return null
  if (/^https?:\/\//i.test(value)) return safeUrl(value)
  return `https://www.instagram.com/${value.replace(/^@/, '').replace(/^\/+|\/+$/g, '')}/`
}

const linkClass =
  'inline-flex items-center gap-2 min-h-11 text-[14px] leading-[20px] font-[600] text-forest underline underline-offset-4 hover:text-forest-hover'

/** Banner, identity, story, links, return policy and follow control for a brand storefront. */
export function BrandProfile({ brand }: { brand: PublicBrand }) {
  const website = safeUrl(brand.website)
  const instagram = instagramUrl(brand.instagram)

  return (
    <section aria-label={`About ${brand.name}`} className="mt-6">
      {brand.bannerUrl && (
        <div className="relative aspect-[3/1] min-h-[120px] overflow-hidden rounded-[6px] border border-line bg-white">
          <Image
            src={cloudinaryFill(brand.bannerUrl, 1600, 533)}
            alt={`${brand.name} banner`}
            fill
            priority
            sizes="(max-width: 1199px) 100vw, 1152px"
            className="object-cover"
          />
        </div>
      )}

      <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <BrandLogo brand={brand} size={56} />
            <div className="min-w-0 flex flex-wrap items-center gap-x-3 gap-y-1">
              {brand.isVerified && (
                <span className="inline-flex items-center gap-1 text-[14px] leading-[20px] font-[600] text-forest">
                  <VerifiedBadge size={18} />
                  Verified brand
                </span>
              )}
              {brand.country && (
                <span className="inline-flex items-center gap-1 text-[14px] leading-[20px] text-muted">
                  <MapPin size={14} aria-hidden="true" />
                  {brand.country}
                </span>
              )}
            </div>
          </div>
          {brand.story && <p className="mt-4 max-w-[660px] type-body text-muted whitespace-pre-line">{brand.story}</p>}

          {(website || instagram) && (
            <div className="mt-2 flex flex-wrap gap-x-6">
              {website && (
                <a href={website} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  <Globe size={16} aria-hidden="true" />
                  Website
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
              {instagram && (
                <a href={instagram} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  <AtSign size={16} aria-hidden="true" />
                  Instagram
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 lg:mt-0 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <FollowBrandButton slug={brand.slug} name={brand.name} isFollowing={brand.isFollowing} />
            <p className="text-[14px] leading-[20px] text-muted">
              <span className="font-[600] text-ink tabular-nums">{brand.followerCount.toLocaleString()}</span>{' '}
              {brand.followerCount === 1 ? 'follower' : 'followers'}
            </p>
          </div>

          {brand.returnPolicy && (
            <div className="rounded-[6px] border border-line bg-white p-4">
              <h2 className="flex items-center gap-2 text-[14px] leading-[20px] font-[600] text-ink">
                <ShieldCheck size={16} className="text-forest" aria-hidden="true" />
                Return policy
              </h2>
              <p className="mt-2 text-[14px] leading-[20px] text-muted whitespace-pre-line break-words">{brand.returnPolicy}</p>
              <p className="mt-2 type-caption text-muted">Set by {brand.name}.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
