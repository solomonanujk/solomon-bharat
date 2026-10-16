import { logger } from '../../config/logger';

/** An example photo from the open web, shown in the guide chat with its credit. */
export interface GuideWebPhoto {
  query: string;
  title: string;
  image: string;
  link: string;
  credit: string;
  license: string;
}

interface OpenverseResult {
  id: string;
  title?: string;
  thumbnail?: string;
  url?: string;
  foreign_landing_url?: string;
  creator?: string;
  license?: string;
  license_version?: string;
}

const cache = new Map<string, { at: number; photo: GuideWebPhoto | null }>();
const DAY = 24 * 60 * 60 * 1000;

async function openverse(query: string): Promise<GuideWebPhoto | null> {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=5&mature=false`;
  const res = await fetch(url, { headers: { 'User-Agent': 'SolomonBharatGuide/1.0' }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Openverse ${res.status}`);
  const body = (await res.json()) as { results?: OpenverseResult[] };
  const hit = body.results?.find((r) => r.thumbnail || r.url);
  if (!hit) return null;
  return {
    query,
    title: hit.title?.slice(0, 80) || query,
    image: hit.thumbnail || hit.url!,
    link: hit.foreign_landing_url || hit.url || '',
    credit: hit.creator?.slice(0, 60) || 'Unknown',
    license: `CC ${(hit.license ?? '').toUpperCase()}${hit.license_version ? ` ${hit.license_version}` : ''}`.trim(),
  };
}

/** Finds one openly licensed photo per search phrase (Openverse). Never throws: a failed search is skipped. */
export async function findWebPhotos(queries: string[]): Promise<GuideWebPhoto[]> {
  const found = await Promise.all(
    queries.slice(0, 4).map(async (raw) => {
      const query = raw.toLowerCase().replace(/[^a-z0-9 -]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
      if (!query) return null;
      const hit = cache.get(query);
      if (hit && Date.now() - hit.at < DAY) return hit.photo;
      try {
        // If the exact phrase finds nothing, try again without its first word ("block print tote" → "print tote").
        let photo = await openverse(query);
        const shorter = query.split(' ').slice(1).join(' ');
        if (!photo && shorter.includes(' ')) photo = await openverse(shorter);
        cache.set(query, { at: Date.now(), photo });
        return photo;
      } catch (err) {
        logger.warn({ err, query }, 'Guide photo search failed');
        return null;
      }
    }),
  );
  const seen = new Set<string>();
  return found.filter((p): p is GuideWebPhoto => {
    if (!p || seen.has(p.image)) return false;
    seen.add(p.image);
    return true;
  });
}
