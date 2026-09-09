import Image from 'next/image'

export function RetailerHighlightSection() {
  return (
    <section className="bg-[#3A2530] tracking-[0.02em]">
      <div className="max-w-[1400px] mx-auto px-5 sm:px-6 lg:px-16 py-10 sm:py-14">

        {/* Header row */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 md:gap-10 mb-8 sm:mb-10">
          <div>
            <p className="font-playfair italic font-[500] text-[#E8DE9A] text-[26px] sm:text-[32px] lg:text-[38px] leading-[1.15]">
              We&apos;re Solomon Bharat.
            </p>
            <p className="font-public-sans font-[700] text-white text-[18px] sm:text-[22px] lg:text-[26px] leading-[1.3] tracking-[0.05em] mt-1">
              The platform for retailers.
            </p>
          </div>
          <p className="font-public-sans font-[700] text-white text-[15px] sm:text-[17px] lg:text-[18px] leading-[1.4] max-w-[600px] tracking-[0.1em]">
            We make it easy for you to discover and source unique Indian products with{' '}
            <span className="text-[#E8DE9A]">lower MOQs</span>, delivered to your doorstep within{' '}
            <span className="text-[#E8DE9A]">7–10 days</span>, with{' '}
            <span className="text-[#E8DE9A]">all customs and duties cleared</span>.
          </p>
        </div>

        {/* Photo */}
        <div className="relative w-full h-[240px] sm:h-[300px] lg:h-[360px] rounded overflow-hidden">
          <Image
            src="https://res.cloudinary.com/dxnqyvcdl/image/upload/v1788845176/homepage/1788845110281-retailer-storefront.png"
            alt="Solomon Bharat storefront"
            fill
            sizes="100vw"
            className="object-cover"
          />
        </div>

      </div>
    </section>
  )
}
