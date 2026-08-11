import Image from 'next/image';
import Link from 'next/link';

export interface CategoryCardProps {
  readonly slug: string;
  readonly name: string;
  readonly heroImage: string | null;
  readonly productCount: number;
}

export function CategoryCard({ slug, name, heroImage, productCount }: CategoryCardProps) {
  return (
    <Link
      href={`/categories/${slug}`}
      className="group block overflow-hidden rounded-card border border-border bg-bg-surface transition-shadow duration-200 hover:shadow-sm"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-fill-subtle">
        {heroImage ? (
          <Image
            src={heroImage}
            alt={name}
            fill
            sizes="(min-width: 768px) 25vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-fill-subtle" />
        )}
      </div>
      <div className="p-4">
        <p className="font-serif text-lg leading-snug text-text-primary">{name}</p>
        <p className="mt-1 text-small text-text-muted">{productCount} products</p>
      </div>
    </Link>
  );
}