import { lookup } from 'dns/promises';
import { BlockList, isIP } from 'net';
import { logger } from '../../config/logger';
import { MAX_IMAGE_FILE_SIZE_BYTES } from '../../middleware/upload';

/**
 * Downloads a product image from a URL taken from an uploaded spreadsheet.
 *
 * Those URLs are seller-controlled, so this is an SSRF surface: only http(s), only
 * hosts that resolve to public addresses (re-checked on every redirect hop), a hard
 * timeout, a streamed size cap, and the body must actually be a JPEG/PNG/WebP (the
 * same types the regular product image upload accepts). Never throws — a bad photo
 * is logged and skipped so it can't abort an import.
 */

const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

export type ImageExtension = 'jpg' | 'png' | 'webp';

export interface FetchedImage {
  buffer: Buffer;
  extension: ImageExtension;
}

const blocked = new BlockList();
// IPv4 — "this network", private, CGNAT, loopback, link-local (cloud metadata),
// IETF protocol assignments, TEST-NETs, benchmarking, multicast, reserved, broadcast.
for (const [net, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blocked.addSubnet(net, prefix, 'ipv4');
}
// IPv6 — unspecified, loopback, unique-local, link-local, multicast, documentation.
blocked.addAddress('::', 'ipv6');
blocked.addAddress('::1', 'ipv6');
blocked.addSubnet('fc00::', 7, 'ipv6');
blocked.addSubnet('fe80::', 10, 'ipv6');
blocked.addSubnet('ff00::', 8, 'ipv6');
blocked.addSubnet('2001:db8::', 32, 'ipv6');

export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return blocked.check(address, 'ipv4');
  if (family === 6) {
    // IPv4-mapped (::ffff:10.0.0.1) — judge by the embedded IPv4 address.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
    if (mapped) return blocked.check(mapped[1], 'ipv4');
    return blocked.check(address, 'ipv6');
  }
  return true;
}

/** Resolves and vets one URL; returns null when it must not be fetched. */
export async function vetImageUrl(rawUrl: string): Promise<URL | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;

  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!host || host.toLowerCase() === 'localhost' || host.toLowerCase().endsWith('.localhost')) return null;

  if (isIP(host)) return isBlockedAddress(host) ? null : url;
  try {
    const addresses = await lookup(host, { all: true, verbatim: true });
    if (addresses.length === 0 || addresses.some((a) => isBlockedAddress(a.address))) return null;
  } catch {
    return null;
  }
  return url;
}

export function sniffImageExtension(buffer: Buffer): ImageExtension | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'webp';
  }
  return null;
}

async function readCapped(res: Response, maxBytes: number): Promise<Buffer | null> {
  if (!res.body) return null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function fetchRemoteImage(rawUrl: string): Promise<FetchedImage | null> {
  let current = rawUrl;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      // eslint-disable-next-line no-await-in-loop
      const url = await vetImageUrl(current);
      if (!url) {
        logger.warn({ url: current }, 'Product import: image URL not allowed, skipping');
        return null;
      }
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { accept: 'image/jpeg,image/png,image/webp,image/*;q=0.8' },
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        await res.body?.cancel().catch(() => undefined);
        if (!location) break;
        current = new URL(location, url).toString();
        continue;
      }
      if (!res.ok) {
        logger.warn({ url: current, status: res.status }, 'Product import: image fetch failed, skipping');
        await res.body?.cancel().catch(() => undefined);
        return null;
      }
      const declared = Number(res.headers.get('content-length'));
      if (Number.isFinite(declared) && declared > MAX_IMAGE_FILE_SIZE_BYTES) {
        logger.warn({ url: current }, 'Product import: image too large, skipping');
        await res.body?.cancel().catch(() => undefined);
        return null;
      }
      // eslint-disable-next-line no-await-in-loop
      const buffer = await readCapped(res, MAX_IMAGE_FILE_SIZE_BYTES);
      if (!buffer) {
        logger.warn({ url: current }, 'Product import: image too large or empty, skipping');
        return null;
      }
      const extension = sniffImageExtension(buffer);
      if (!extension) {
        logger.warn({ url: current }, 'Product import: not a JPEG/PNG/WebP image, skipping');
        return null;
      }
      return { buffer, extension };
    }
    logger.warn({ url: rawUrl }, 'Product import: too many redirects, skipping');
    return null;
  } catch (err) {
    logger.warn({ err, url: current }, 'Product import: image fetch threw, skipping');
    return null;
  }
}
