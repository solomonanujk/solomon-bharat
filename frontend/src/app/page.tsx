'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Globe2, Package, ShieldCheck, Star, Truck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CategoryCard } from '@/components/CategoryCard';
import { CollectionCard } from '@/components/CollectionCard';
import { PublicShell } from '@/components/PublicShell';
import { useCategories } from '@/modules/categories';
import type { CategoryNode } from '@/modules/categories';
import { useFeaturedCollections } from '@/modules/collections';

const TRUST_POINTS = [
  { Icon: Globe2, label: 'Global Export Ready' },
  { Icon: Package, label: 'Wholesale MOQ Pricing' },
  { Icon: ShieldCheck, label: 'Admin-Verified Quality' },
  { Icon: Truck, label: 'Secure PayPal Checkout' },
];

const PROCUREMENT_STEPS = [
  { title: 'Browse Curated Goods', description: 'Explore quality products sourced from Indian suppliers, organized by category and collection.' },
  { title: 'Request & Order in Bulk', description: 'Place a wholesale order that meets each product’s minimum order quantity.' },
  { title: 'Ship Export-Ready', description: 'We handle procurement and prepare your order for international shipment.' },
];

const CRAFTS = [
  {
    src: 'https://images.unsplash.com/photo-1755408007655-9ac329cfa145?q=80&w=800&auto=format&fit=crop',
    alt: 'Carved wooden printing blocks used for hand block-printing',
    craft: 'Block Printing',
    place: 'Ahmedabad, Gujarat',
  },
  {
    src: 'https://images.unsplash.com/photo-1759738099669-d64b0656f6cf?q=80&w=800&auto=format&fit=crop',
    alt: 'Weaver working a traditional loom in a rustic workshop',
    craft: 'Handloom Weaving',
    place: 'Majuli, Assam',
  },
  {
    src: 'https://images.unsplash.com/photo-1751906491847-6f6712b145af?q=80&w=800&auto=format&fit=crop',
    alt: 'Handmade colorful ceramics displayed for sale',
    craft: 'Ceramics & Pottery',
    place: 'Ahmedabad, Gujarat',
  },
  {
    src: 'https://images.unsplash.com/photo-1779470703519-05af825e87cd?q=80&w=800&auto=format&fit=crop',
    alt: 'Colorful patterned textiles and scarves stacked for sale',
    craft: 'Textile Weaves',
    place: 'Ghoom, West Bengal',
  },
];

const FEATURED_TESTIMONIAL = {
  name: 'Sarah Mitchell',
  company: 'Home & Living Retailer',
  country: 'United Kingdom',
  avatar: 'https://picsum.photos/seed/sb-buyer-sarah/80/80',
  review:
    'Solomon Bharat transformed our sourcing entirely. We found incredible Indian-made goods at wholesale prices — the quality exceeded expectations and shipping was seamless.',
  rating: 5,
};

const OTHER_TESTIMONIALS = [
  {
    name: 'Marco Ferretti',
    company: 'Casa Mediterranea',
    country: 'Italy',
    avatar: 'https://picsum.photos/seed/sb-buyer-marco/80/80',
    review:
      "We've been importing Indian goods for years, but Solomon Bharat gave us a single trusted source with clear pricing and reasonable minimum order quantities.",
    rating: 5,
  },
  {
    name: 'Emily Chen',
    company: 'Jade & Jasmine Imports',
    country: 'United States',
    avatar: 'https://picsum.photos/seed/sb-buyer-emily/80/80',
    review:
      'Finding authentic Indian goods at wholesale prices was our biggest sourcing challenge. Solomon Bharat solved that completely, and ordering in bulk is effortless.',
    rating: 5,
  },
];

function Stars({ count }: { readonly count: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} size={14} className="fill-gold text-gold" aria-hidden="true" />
      ))}
    </div>
  );
}

function CategoryCarousel({ categories }: { readonly categories: CategoryNode[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const sync = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(sync);
    el.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, [sync, categories.length]);

  function scrollByCards(direction: 1 | -1) {
    scrollRef.current?.scrollBy({ left: direction * 296, behavior: 'smooth' });
  }

  return (
    <section className="mx-auto max-w-content px-margin-mobile py-section-mobile md:px-margin-desktop md:py-section-desktop">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2">
            <span className="h-px w-8 bg-accent-primary" aria-hidden="true" />
            <p className="text-caption font-bold uppercase tracking-[0.12em] text-accent-primary">Browse by Category</p>
          </div>
          <h2 className="mt-4 font-serif text-h2 text-text-primary">Every Product Category, One Platform</h2>
        </div>
        <Link
          href="/categories"
          className="hidden shrink-0 text-small font-semibold text-text-muted transition-colors hover:text-accent-primary sm:inline-flex"
        >
          View all
        </Link>
      </div>

      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          onClick={() => scrollByCards(-1)}
          disabled={!canScrollLeft}
          aria-label="Scroll categories left"
          className="shrink-0 text-text-primary transition-opacity disabled:pointer-events-none disabled:opacity-20"
        >
          <ChevronLeft size={28} aria-hidden="true" />
        </button>

        <div
          ref={scrollRef}
          className="flex flex-1 gap-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {categories.map((category) => (
            <div key={category.id} className="w-[220px] shrink-0">
              <CategoryCard
                slug={category.slug}
                name={category.name}
                heroImage={category.heroImage}
                productCount={category.productCount}
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => scrollByCards(1)}
          disabled={!canScrollRight}
          aria-label="Scroll categories right"
          className="shrink-0 text-text-primary transition-opacity disabled:pointer-events-none disabled:opacity-20"
        >
          <ChevronRight size={28} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

export default function HomePage() {
  const { data: categories } = useCategories();
  const { data: collections } = useFeaturedCollections();

  return (
    <PublicShell>
      <section className="relative flex min-h-[520px] items-center overflow-hidden md:min-h-[640px]">
        <Image
          src="https://images.unsplash.com/photo-1763291966927-740c48e6afe5?q=80&w=1920&auto=format&fit=crop"
          alt="Colorful textile stall in a street market in India"
          fill
          sizes="100vw"
          priority
          className="object-cover"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, rgba(242,230,201,0.95) 0%, rgba(242,230,201,0.78) 52%, rgba(242,230,201,0.3) 78%, rgba(242,230,201,0) 100%)',
          }}
          aria-hidden="true"
        />
        <div className="relative z-10 mx-auto w-full max-w-content px-margin-mobile md:px-margin-desktop">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-surface/70 px-3.5 py-1.5 backdrop-blur-sm">
              <svg width="12" height="12" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <path
                  d="M6.5 1L8.2 5.1H12.5L9.2 7.6L10.4 11.8L6.5 9.3L2.6 11.8L3.8 7.6L0.5 5.1H4.8L6.5 1Z"
                  fill="#4F6B4A"
                />
              </svg>
              <span className="text-caption font-semibold uppercase tracking-[0.1em] text-accent-primary">
                B2B Wholesale Marketplace
              </span>
            </div>

            <h1 className="mt-5 font-serif text-hero leading-[1.05] text-text-primary md:text-display">
              Sourcing Quality Goods from <span className="text-accent-primary">India</span> for Wholesale Export
            </h1>

            <p className="mt-6 max-w-lg text-body-lg text-text-muted">
              Solomon Bharat curates artisanal and industrial goods from trusted Indian suppliers, ready for
              international wholesale buyers.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/collections">Browse Collections</Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link href="/categories">Browse Categories</Link>
              </Button>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-6">
              {TRUST_POINTS.map(({ Icon, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-bg-surface/70">
                    <Icon size={15} className="text-accent-primary" aria-hidden="true" />
                  </div>
                  <p className="text-small font-medium leading-tight text-text-primary">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {categories && categories.length > 0 && <CategoryCarousel categories={categories} />}

      {collections && collections.length > 0 && (
        <section className="border-t border-border bg-bg-surface">
          <div className="mx-auto max-w-content px-margin-mobile py-section-mobile md:px-margin-desktop md:py-section-desktop">
            <h2 className="font-serif text-h2 text-text-primary">Curated Collections</h2>
            <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3">
              {collections.map((collection) => (
                <CollectionCard
                  key={collection.id}
                  slug={collection.slug}
                  name={collection.name}
                  heroImage={collection.heroImage}
                  editorialIntro={collection.editorialIntro}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-content px-margin-mobile py-section-mobile md:px-margin-desktop md:py-section-desktop">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2">
            <span className="h-px w-8 bg-accent-primary" aria-hidden="true" />
            <p className="text-caption font-bold uppercase tracking-[0.12em] text-accent-primary">
              Crafts we celebrate
            </p>
          </div>
          <h2 className="mt-4 font-serif text-h2 text-text-primary">Sourced from India&rsquo;s craft heartlands</h2>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-5 lg:grid-cols-4 lg:gap-6">
          {CRAFTS.map(({ src, alt, craft, place }) => (
            <div
              key={craft}
              className="group relative aspect-[3/4] overflow-hidden rounded-card border border-border bg-bg-surface shadow-sm transition-transform duration-300 hover:-translate-y-1"
            >
              <Image
                src={src}
                alt={alt}
                fill
                sizes="(max-width: 1024px) 50vw, 25vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-text-primary/80 via-text-primary/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="text-small font-bold leading-tight text-white">{craft}</p>
                <p className="mt-0.5 text-caption text-white/70">{place}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-bg-surface">
        <div className="mx-auto max-w-content px-margin-mobile py-section-mobile md:px-margin-desktop md:py-section-desktop">
          <h2 className="text-center font-serif text-h2 text-text-primary">Seamless Wholesale Procurement</h2>
          <div className="mt-10 grid grid-cols-1 gap-10 md:grid-cols-3">
            {PROCUREMENT_STEPS.map((step, index) => (
              <div key={step.title} className="text-center">
                <p className="font-serif text-h1 text-accent-primary">{index + 1}</p>
                <p className="mt-2 font-serif text-h4 text-text-primary">{step.title}</p>
                <p className="mt-2 text-small text-text-muted">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-section-mobile md:py-section-desktop">
        <div className="mx-auto max-w-content px-margin-mobile md:px-margin-desktop">
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_380px] lg:gap-16">
            <div>
              <p className="text-caption font-bold uppercase tracking-[0.12em] text-accent-primary">Buyer Reviews</p>
              <div className="mb-4 font-serif text-[100px] leading-[0.7] text-text-primary/[0.08] sm:text-[140px]" aria-hidden="true">
                &ldquo;
              </div>
              <Stars count={FEATURED_TESTIMONIAL.rating} />
              <blockquote className="mt-5 font-serif text-h3 leading-[1.4] text-text-primary md:text-h2">
                {FEATURED_TESTIMONIAL.review}
              </blockquote>
              <div className="mt-8 flex items-center gap-3">
                <Image
                  src={FEATURED_TESTIMONIAL.avatar}
                  alt={FEATURED_TESTIMONIAL.name}
                  width={44}
                  height={44}
                  className="h-11 w-11 shrink-0 rounded-full object-cover"
                />
                <div>
                  <p className="font-serif text-body-lg text-text-primary">{FEATURED_TESTIMONIAL.name}</p>
                  <p className="mt-0.5 text-caption text-text-muted">
                    {FEATURED_TESTIMONIAL.company} &middot; {FEATURED_TESTIMONIAL.country}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {OTHER_TESTIMONIALS.map((testimonial) => (
                <div key={testimonial.name} className="rounded-card border border-border bg-bg-surface p-5">
                  <Stars count={testimonial.rating} />
                  <p className="mb-4 mt-3 text-small leading-relaxed text-text-muted">
                    &ldquo;{testimonial.review}&rdquo;
                  </p>
                  <div className="flex items-center gap-2.5 border-t border-border pt-4">
                    <Image
                      src={testimonial.avatar}
                      alt={testimonial.name}
                      width={32}
                      height={32}
                      className="h-8 w-8 shrink-0 rounded-full object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-serif text-small text-text-primary">{testimonial.name}</p>
                      <p className="truncate text-caption text-text-muted">
                        {testimonial.company} &middot; {testimonial.country}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
