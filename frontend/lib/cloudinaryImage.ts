/**
 * Requests an AI-subject-aware cropped derivative of a Cloudinary-hosted image at
 * render time — no upload-time transform, no backend/database change. Cloudinary
 * generates and CDN-caches the derivative on first request, applying retroactively
 * to every already-uploaded image too, not just new ones.
 *
 * Returns the URL unchanged for any non-Cloudinary source (local-disk dev uploads,
 * seed/demo images from other hosts, arbitrary seller-supplied URLs) — those keep
 * relying on the object-contain + background-fill fallback already in place.
 */
export function cloudinaryFill(url: string, width: number, height: number): string {
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url
  return url.replace('/upload/', `/upload/c_fill,g_auto,w_${width},h_${height},q_auto,f_auto/`)
}

/**
 * Scales the image DOWN to fit within a bounding box without cropping anything —
 * unlike cloudinaryFill's `c_fill,g_auto`, which picks its own crop server-side
 * (Cloudinary's AI subject-detection, not the seller's choice). Use this wherever
 * a manually-chosen focal point drives the actual crop client-side (`object-fit:
 * cover` + `object-position`) — e.g. color swatch thumbnails — so the full image
 * content is still there for that focal point to crop into, instead of the crop
 * having already happened server-side around whatever Cloudinary decided was the
 * subject.
 */
export function cloudinaryFit(url: string, size: number): string {
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url
  return url.replace('/upload/', `/upload/c_limit,w_${size},h_${size},q_auto,f_auto/`)
}
