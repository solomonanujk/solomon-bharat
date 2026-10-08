import Link from 'next/link'
import Image from 'next/image'
import { cloudinaryFill } from '@/lib/cloudinaryImage'
import type { Collection } from '@/types'

/**
 * Collection card: wide photo above a white label row, whole card links to the
 * collection. White, 1px line border, 6px radius; hover = forest border, no
 * movement. Without a hero photo the image slot shows the collection's name as
 * type on ivory — real content, never an empty placeholder that reads as a
 * loading skeleton.
 */
export function CollectionCard({ collection, headingLevel = 'h2' }: { collection: Collection; headingLevel?: 'h2' | 'h3' }) {
  const Heading = headingLevel
  return (
    <Link
      href={`/collections/${collection.slug}`}
      className="group flex flex-col h-full bg-white border border-line rounded-[6px] overflow-hidden transition-colors duration-150 hover:border-forest"
    >
      <div className="relative aspect-[3/2] bg-ivory border-b border-line">
        {collection.heroImage ? (
          <Image
            src={cloudinaryFill(collection.heroImage, 900, 600)}
            alt={`${collection.name} collection`}
            fill
            sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 360px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center" aria-hidden="true">
            <span className="type-eyebrow text-brass-dark">Collection</span>
            <span className="font-display font-[500] text-[24px] leading-[30px] text-forest line-clamp-2">{collection.name}</span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 px-4 py-4">
        <Heading className="font-display font-[500] text-[18px] leading-[24px] text-ink">{collection.name}</Heading>
        {collection.editorialIntro && (
          <p className="type-caption text-muted line-clamp-2">{collection.editorialIntro}</p>
        )}
      </div>
    </Link>
  )
}

export function CollectionCardSkeleton() {
  return (
    <div className="flex flex-col bg-white border border-line rounded-[6px] overflow-hidden" aria-hidden="true">
      <div className="aspect-[3/2] bg-ivory animate-pulse" />
      <div className="flex flex-col gap-2 px-4 py-4">
        <div className="h-5 w-2/3 rounded-[2px] bg-ivory animate-pulse" />
        <div className="h-4 w-full rounded-[2px] bg-ivory animate-pulse" />
      </div>
    </div>
  )
}
