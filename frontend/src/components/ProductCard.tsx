import Image from 'next/image';
import Link from 'next/link';
import { formatCurrency } from '@/utils/formatCurrency';

export interface ProductCardProps {
  readonly slug: string;
  readonly name: string;
  readonly adminPrice: string;
  readonly moq: number;
  readonly imageUrl: string | null;
}

export function ProductCard({ slug, name, adminPrice, moq, imageUrl }: ProductCardProps) {
  return (
    <Link href={`/products/${slug}`} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-bg-surface">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="(min-width: 768px) 25vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-fill-subtle" />
        )}
      </div>
      <p className="mt-3 font-serif text-base text-text-primary">{name}</p>
      <p className="text-sm text-text-muted">
        {formatCurrency(adminPrice)} &middot; MOQ {moq}
      </p>
    </Link>
  );
}