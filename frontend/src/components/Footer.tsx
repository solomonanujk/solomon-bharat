import Image from 'next/image';
import Link from 'next/link';

const LOGO_URL = 'https://res.cloudinary.com/dxnqyvcdl/image/upload/v1781610714/solomon-logo1_inmwov.png';

const MARKETPLACE_LINKS = [
  { href: '/categories', label: 'Categories' },
  { href: '/collections', label: 'Collections' },
];

const COMPANY_LINKS = [
  { href: '/about', label: 'About Us' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/export-regulations', label: 'Export Regulations' },
  { href: '/contact', label: 'Contact Support' },
];

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-primary/40">{title}</p>
      <nav className="flex flex-col gap-2.5" aria-label={title}>
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="text-sm leading-snug text-text-muted transition-colors hover:text-text-primary">
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-bg-surface">
      <div className="mx-auto max-w-content px-margin-mobile py-10 md:px-margin-desktop lg:py-16">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col sm:col-span-2">
            <Link href="/" className="shrink-0">
              <Image src={LOGO_URL} alt="Solomon Bharat" width={220} height={56} className="h-14 w-auto object-contain" />
            </Link>
            <p className="mt-3 max-w-[280px] text-sm leading-relaxed text-text-muted">
              A curated wholesale export marketplace connecting global buyers to quality goods from India.
            </p>
          </div>

          <FooterColumn title="Marketplace" links={MARKETPLACE_LINKS} />
          <FooterColumn title="Company" links={COMPANY_LINKS} />
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto max-w-content px-margin-mobile py-5 md:px-margin-desktop">
          <p className="text-xs text-text-muted/60">&copy; {new Date().getFullYear()} Solomon Bharat. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
