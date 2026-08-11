const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? 'http://localhost:4000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      // Seed data uses picsum.photos as placeholder imagery — safe to drop once real
      // product/collection images are uploaded to Cloudinary.
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      // Homepage editorial imagery reused from the solomon-bharat2 design (hero, craft grid,
      // maker story, testimonials).
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  /**
   * The refresh_token/csrf_token cookies are httpOnly and set by the backend. If the browser
   * talked to the backend directly (a different origin/port in dev, and typically a different
   * subdomain in prod), those cookies would live on the backend's origin and never reach
   * requests made to the frontend — which is exactly what Next.js middleware needs to read them
   * for server-side route protection. Proxying /api/* through the frontend's own origin makes
   * the cookies same-origin so both the browser and middleware can see them.
   */
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
