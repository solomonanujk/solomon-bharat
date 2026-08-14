import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
