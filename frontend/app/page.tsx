import Image from 'next/image'

const styles = `
  .sb-cta:hover { background: #D9E2DA !important; }
  .sb-cta-outline:hover { border-color: rgba(217,226,218,0.85) !important; background: rgba(217,226,218,0.08) !important; }
  .sb-cta, .sb-cta-outline { transition: background 0.18s, border-color 0.18s, transform 0.14s; }
  .sb-cta:hover, .sb-cta-outline:hover { transform: translateY(-1px); }
`

// ─── Launching Soon ───────────────────────────────────────────────────────────
// The full marketplace is not yet open. This page is the only public surface:
// it shows the brand, teases the launch, and directs visitors to Instagram.

export default function HomePage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-16"
      style={{ background: 'linear-gradient(160deg, #0F241D 0%, #183D33 55%, #2a4f3f 100%)' }}
    >
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      {/* Logo */}
      <div className="mb-10 flex items-center justify-center">
        <Image
          src="/branding/solomon-bharat-logo.png"
          alt="Solomon Bharat"
          width={180}
          height={60}
          className="object-contain brightness-0 invert"
          priority
        />
      </div>

      {/* Headline */}
      <h1
        className="text-center text-white mb-4 leading-tight"
        style={{
          fontFamily: 'var(--font-playfair), Georgia, serif',
          fontSize: 'clamp(2.2rem, 6vw, 4rem)',
          fontWeight: 500,
          letterSpacing: '-0.02em',
        }}
      >
        Something beautiful<br />is coming.
      </h1>

      {/* Sub-copy */}
      <p
        className="text-center mb-12 max-w-md"
        style={{
          fontFamily: 'var(--font-public-sans), Arial, sans-serif',
          fontSize: 'clamp(0.95rem, 2vw, 1.1rem)',
          color: 'rgba(217,226,218,0.80)',
          lineHeight: 1.65,
        }}
      >
        We&apos;re curating the finest handmade &amp; artisan products from across India —
        a wholesale marketplace built for global retailers. Stay tuned.
      </p>

      {/* CTAs */}
      <div
        className="flex flex-wrap items-center justify-center gap-4"
        style={{ marginBottom: 0 }}
      >
        {/* Instagram */}
        <a
          href="https://www.instagram.com/pranjalsagrawal"
          target="_blank"
          rel="noopener noreferrer"
          className="sb-cta inline-flex items-center gap-3 rounded-full px-7 py-4 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white"
          style={{
            fontFamily: 'var(--font-public-sans), Arial, sans-serif',
            fontSize: '1rem',
            background: '#FFFFFF',
            color: '#183D33',
            boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <circle cx="12" cy="12" r="4.5" />
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
          </svg>
          Follow on Instagram
        </a>

        {/* Catalog */}
        <a
          href="https://drive.google.com/drive/folders/1mVPMmwTwjyDEn8FKW6E4SJQ6OqOosXqa?usp=sharing"
          target="_blank"
          rel="noopener noreferrer"
          className="sb-cta-outline inline-flex items-center gap-3 rounded-full px-7 py-4 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white"
          style={{
            fontFamily: 'var(--font-public-sans), Arial, sans-serif',
            fontSize: '1rem',
            background: 'transparent',
            color: '#FFFFFF',
            border: '1.5px solid rgba(217,226,218,0.45)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          See our Catalog
        </a>
      </div>

      {/* Procurement note */}
      <p
        className="mt-10 text-center max-w-sm"
        style={{
          fontFamily: 'var(--font-public-sans), Arial, sans-serif',
          fontSize: '0.88rem',
          color: 'rgba(217,226,218,0.60)',
          lineHeight: 1.7,
        }}
      >
        Looking to source from India?{' '}
        <a
          href="https://www.instagram.com/pranjalsagrawal"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#D9E2DA', textDecoration: 'underline', textUnderlineOffset: '3px' }}
        >
          DM Pranjal S. Agrawal
        </a>{' '}
        on Instagram or call{' '}
        <a
          href="tel:+919588007925"
          style={{ color: '#D9E2DA', textDecoration: 'underline', textUnderlineOffset: '3px' }}
        >
          +91 95880 07925
        </a>
        .
      </p>

      {/* Fine print */}
      <p
        className="mt-8 text-center"
        style={{
          fontFamily: 'var(--font-public-sans), Arial, sans-serif',
          fontSize: '0.78rem',
          color: 'rgba(217,226,218,0.45)',
        }}
      >
        © {new Date().getFullYear()} Solomon Bharat. All rights reserved.
      </p>
    </div>
  )
}
