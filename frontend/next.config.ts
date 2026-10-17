import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The marketplace (brand) model was removed in Oct 2026: old brand storefront and brand
  // invite links go to the catalogue; the old seller-portal brand pages go to the dashboard.
  async redirects() {
    return [
      { source: '/brands', destination: '/products', permanent: false },
      { source: '/brands/:path*', destination: '/products', permanent: false },
      { source: '/invite/:code', destination: '/signup', permanent: false },
      { source: '/portal/brand', destination: '/portal', permanent: false },
      { source: '/portal/invite', destination: '/portal', permanent: false },
      { source: '/admin/brands', destination: '/admin/sellers', permanent: false },
    ]
  },
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
  images: {
    // Next.js 16 blocks the image optimizer from fetching local/private IPs by
    // default (SSRF hardening) — the backend genuinely runs on localhost in dev.
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        // Seed / placeholder images (replace with real Cloudinary URLs in production)
        protocol: "https",
        hostname: "picsum.photos",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "source.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.pexels.com",
        pathname: "/**",
      },
      {
        // Allow any HTTPS host — seller product images come from arbitrary domains
        protocol: "https",
        hostname: "**",
        pathname: "/**",
      },
      {
        // Local backend uploads (CLOUDINARY_URL unset in dev — images are served
        // from the backend's own /uploads static route instead)
        protocol: "http",
        hostname: "localhost",
        port: "4000",
        pathname: "/uploads/**",
      },
    ],
  },
};

export default nextConfig;
