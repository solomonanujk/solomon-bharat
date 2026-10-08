import Image from 'next/image'
import { ABOUT_PROMISES } from '@/components/homepage/homepageContent'

// ─── About preview ────────────────────────────────────────────────────────────
// Forest band: story + promise rows beside an illustrative photo (1:1 split,
// 56px desktop gap). On mobile the text comes before the photo.

const ABOUT_IMAGE_SRC =
  'https://res.cloudinary.com/dxnqyvcdl/image/upload/v1788845176/homepage/1788845110281-retailer-storefront.png'

export function RetailerHighlightSection() {
  return (
    <section className="on-forest bg-forest sb-section" aria-labelledby="home-about-heading">
      <div className="sb-container grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-center">
        <div className="min-w-0">
          <h2 id="home-about-heading" className="type-h2 text-white">
            We&apos;re <span className="text-brass">Solomon Bharat</span>. The platform for retailers.
          </h2>
          <p className="type-body text-light-text mt-4 max-w-[560px]">
            We make it easy for you to discover and source unique Indian products.
          </p>

          <ul className="mt-6 border-t border-light-text/25 divide-y divide-light-text/25">
            {ABOUT_PROMISES.map((promise) => (
              <li key={promise} className="py-4 type-body text-light-text">
                {promise}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[6px] bg-forest-hover">
          <Image
            src={ABOUT_IMAGE_SRC}
            alt="Illustrative retail storefront"
            fill
            sizes="(max-width: 1023px) 100vw, 560px"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  )
}
