'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { CategoryCard } from '@/components/CategoryCard';
import { CollectionCard } from '@/components/CollectionCard';
import { PublicShell } from '@/components/PublicShell';
import { useCategories } from '@/modules/categories';
import { useFeaturedCollections } from '@/modules/collections';

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

export default function HomePage() {
  const { data: categories } = useCategories();
  const { data: collections } = useFeaturedCollections();

  return (
    <PublicShell>
      <section className="relative flex min-h-[480px] items-center overflow-hidden md:min-h-[600px]">
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
              'linear-gradient(to right, rgba(242,230,201,0.95) 0%, rgba(242,230,201,0.75) 50%, rgba(242,230,201,0.25) 80%, rgba(242,230,201,0) 100%)',
          }}
          aria-hidden="true"
        />
        <div className="relative z-10 mx-auto w-full max-w-content px-margin-mobile md:px-margin-desktop">
          <div className="max-w-xl">
            <p className="text-caption font-semibold uppercase tracking-[0.1em] text-accent-primary">
              B2B Wholesale Marketplace
            </p>
            <h1 className="mt-4 font-serif text-hero leading-tight text-text-primary md:text-display">
              Sourcing Quality Goods from India for Wholesale Export
            </h1>
            <p className="mt-6 max-w-lg text-body-lg text-text-muted">
              Solomon Bharat curates artisanal and industrial goods from trusted Indian suppliers, ready for
              international wholesale buyers.
            </p>
            <Button asChild size="lg" className="mt-8 inline-flex">
              <Link href="/collections">Browse Collections</Link>
            </Button>
          </div>
        </div>
      </section>

      {categories && categories.length > 0 && (
        <section className="mx-auto max-w-content px-margin-mobile py-section-mobile md:px-margin-desktop md:py-section-desktop">
          <h2 className="font-serif text-h2 text-text-primary">Categories</h2>
          <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
            {categories.map((category) => (
              <CategoryCard
                key={category.id}
                slug={category.slug}
                name={category.name}
                heroImage={category.heroImage}
                productCount={category.productCount}
              />
            ))}
          </div>
        </section>
      )}

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
    </PublicShell>
  );
}