import Image from 'next/image'
import Link from 'next/link'

export function RetailerHighlightSection() {
  return (
    <section className="bg-[#4A5C2F] overflow-hidden">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-16">
        <div className="flex items-end gap-4 sm:gap-6 lg:gap-10">

          {/* Left image — anchored to bottom */}
          <div className="hidden md:block w-[220px] lg:w-[320px] flex-shrink-0">
            <div className="relative h-[260px] lg:h-[360px] rounded-t overflow-hidden">
              <Image
                src="https://res.cloudinary.com/dxnqyvcdl/image/upload/v1781611195/img2_ufqsb5.webp"
                alt="Artisan products"
                fill
                sizes="320px"
                className="object-cover"
              />
            </div>
          </div>

          {/* Center — vertically padded */}
          <div className="flex-1 text-center py-10 sm:py-14 lg:py-20">
            <h2 className="font-playfair font-[500] text-white text-[26px] sm:text-[34px] lg:text-[44px] leading-[1.15] mb-3 sm:mb-4">
              For any retailer,<br />
              no matter what you sell.
            </h2>
            <p className="font-public-sans text-[13px] sm:text-[14px] lg:text-[15px] font-[400] leading-[1.7] text-white/70 max-w-[340px] sm:max-w-[380px] mx-auto mb-6 sm:mb-8">
              Whether you buy for a home goods boutique or a lifestyle store, find all the Indian artisan products you need on Solomon Bharat.
            </p>
            <Link
              href="/categories"
              className="inline-flex items-center justify-center rounded bg-white text-primary font-[600] font-public-sans text-[14px] px-6 sm:px-7 py-3 hover:bg-white/90 transition-colors"
            >
              Browse Categories
            </Link>

            {/* Mobile-only images row */}
            <div className="flex md:hidden items-end justify-center gap-3 mt-8 -mx-5 sm:-mx-6">
              <div className="relative w-[45%] h-[180px] rounded-t overflow-hidden flex-shrink-0">
                <Image
                  src="https://res.cloudinary.com/dxnqyvcdl/image/upload/v1781611195/img2_ufqsb5.webp"
                  alt="Artisan products"
                  fill
                  sizes="45vw"
                  className="object-cover"
                />
              </div>
              <div className="relative w-[45%] h-[180px] rounded-t overflow-hidden flex-shrink-0">
                <Image
                  src="https://res.cloudinary.com/dxnqyvcdl/image/upload/v1781611195/img1_szdvos.webp"
                  alt="Retailer in store"
                  fill
                  sizes="45vw"
                  className="object-cover"
                />
              </div>
            </div>
          </div>

          {/* Right image — anchored to bottom */}
          <div className="hidden md:block w-[220px] lg:w-[320px] flex-shrink-0">
            <div className="relative h-[260px] lg:h-[360px] rounded-t overflow-hidden">
              <Image
                src="https://res.cloudinary.com/dxnqyvcdl/image/upload/v1781611195/img1_szdvos.webp"
                alt="Retailer in store"
                fill
                sizes="320px"
                className="object-cover"
              />
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
