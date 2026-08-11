import Image from 'next/image';
import Link from 'next/link';

export interface CollectionCardProps {
  readonly slug: string;
  readonly name: string;
  readonly heroImage: string | null;
  readonly editorialIntro: string | null;
}

export function CollectionCard({ slug, name, heroImage, editorialIntro }: CollectionCardProps) {
  return (
    <Link href={`/collections/${slug}`} className="group block">
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-bg-surface">
        {heroImage ? (
          <Image
            src={heroImage}
            alt={name}
            fill
            sizes="(min-width: 768px) 33vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-fill-subtle" />
        )}
      </div>
      <p className="mt-4 font-serif text-2xl text-text-primary">{name}</p>
      {editorialIntro && <p className="mt-1 text-sm text-text-muted">{editorialIntro}</p>}
    </Link>
  );
}