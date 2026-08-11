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
    <Link href={`/categories/${slug}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-bg-surface">
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
      <p className="mt-3 font-serif text-lg text-text-primary">{name}</p>
      <p className="text-sm text-text-muted">{productCount} products</p>
    </Link>
  );
}