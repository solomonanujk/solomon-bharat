import { lookup as dnsLookup } from 'dns/promises';
import { request as httpRequest, RequestOptions } from 'http';
import { request as httpsRequest } from 'https';
import type { LookupOptions } from 'dns';
import { BlockList, isIP } from 'net';
import { logger } from '../../config/logger';
import { MAX_IMAGE_FILE_SIZE_BYTES } from '../../middleware/upload';

/**
 * Downloads a product image from a URL taken from an uploaded spreadsheet.
 *
 * Those URLs are seller-controlled, so this is an SSRF surface: only http(s), only
 * hosts that resolve to public addresses (vetted inside the socket's own lookup, so the
 * address checked is the address connected to — no DNS-rebinding window — on every redirect hop), a hard
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

/** Syntax-level vetting only (scheme, credentials, localhost, IP literals). Hostnames are
 *  vetted at connect time by {@link createVettedLookup}, so the checked address IS the one used. */
export function parseImageUrl(rawUrl: string): URL | null {
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
  if (isIP(host) && isBlockedAddress(host)) return null;
  return url;
}

type LookupAddress = { address: string; family: number };
type Resolver = (hostname: string) => Promise<LookupAddress[]>;
type LookupCallback = (err: NodeJS.ErrnoException | null, address?: string | LookupAddress[], family?: number) => void;
export type SafeLookup = (hostname: string, options: LookupOptions | number | undefined, cb: LookupCallback) => void;

const defaultResolver: Resolver = (hostname) => dnsLookup(hostname, { all: true, verbatim: true });

/**
 * A `lookup` for http(s).request: resolves the hostname, rejects when ANY returned
 * address is non-public, and hands the socket only a vetted address. Because the socket
 * connects to exactly what was checked, a DNS-rebinding answer cannot swap in a private IP.
 */
export function createVettedLookup(resolve: Resolver = defaultResolver, isBlocked: (a: string) => boolean = isBlockedAddress): SafeLookup {
  return (hostname, options, cb) => {
    const opts = typeof options === 'object' && options !== null ? options : {};
    resolve(hostname).then(
      (addresses) => {
        if (addresses.length === 0 || addresses.some((a) => isBlocked(a.address))) {
          const err: NodeJS.ErrnoException = new Error(`Blocked address for ${hostname}`);
          err.code = 'EBLOCKED';
          cb(err);
          return;
        }
        if (opts.all) cb(null, addresses);
        else cb(null, addresses[0].address, addresses[0].family);
      },
      (err: NodeJS.ErrnoException) => cb(err),
    );
  };
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

interface HopResponse {
  status: number;
  location: string | null;
  contentLength: number;
  /** null when the body was oversize (aborted) */
  body: Buffer | null;
}

function requestOnce(url: URL, lookup: SafeLookup, maxBytes: number): Promise<HopResponse> {
  return new Promise((resolve, reject) => {
    const doRequest = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = doRequest(
      url,
      {
        method: 'GET',
        agent: false,
        lookup: lookup as RequestOptions['lookup'],
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { accept: 'image/jpeg,image/png,image/webp,image/*;q=0.8' },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = typeof res.headers.location === 'string' ? res.headers.location : null;
        const contentLength = Number(res.headers['content-length']);
        if (status < 200 || status >= 300) {
          res.resume();
          resolve({ status, location, contentLength, body: Buffer.alloc(0) });
          return;
        }
        if (Number.isFinite(contentLength) && contentLength > maxBytes) {
          res.destroy();
          resolve({ status, location, contentLength, body: null });
          return;
        }
        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', (chunk: Buffer) => {
          total += chunk.length;
          if (total > maxBytes) {
            res.destroy();
            resolve({ status, location, contentLength, body: null });
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => resolve({ status, location, contentLength, body: Buffer.concat(chunks) }));
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.end();
  });
}

export interface FetchImageOptions {
  /** Injectable for tests; defaults to a DNS lookup that rejects non-public addresses. */
  lookup?: SafeLookup;
}

export async function fetchRemoteImage(rawUrl: string, options: FetchImageOptions = {}): Promise<FetchedImage | null> {
  const lookup = options.lookup ?? createVettedLookup();
  let current = rawUrl;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const url = parseImageUrl(current);
      if (!url) {
        logger.warn({ url: current }, 'Product import: image URL not allowed, skipping');
        return null;
      }
      // eslint-disable-next-line no-await-in-loop
      const res = await requestOnce(url, lookup, MAX_IMAGE_FILE_SIZE_BYTES);

      if (res.status >= 300 && res.status < 400) {
        if (!res.location) break;
        current = new URL(res.location, url).toString();
        continue;
      }
      if (res.status < 200 || res.status >= 300) {
        logger.warn({ url: current, status: res.status }, 'Product import: image fetch failed, skipping');
        return null;
      }
      if (!res.body || res.body.length === 0) {
        logger.warn({ url: current }, 'Product import: image too large or empty, skipping');
        return null;
      }
      const extension = sniffImageExtension(res.body);
      if (!extension) {
        logger.warn({ url: current }, 'Product import: not a JPEG/PNG/WebP image, skipping');
        return null;
      }
      return { buffer: res.body, extension };
    }
    logger.warn({ url: rawUrl }, 'Product import: too many redirects, skipping');
    return null;
  } catch (err) {
    logger.warn({ err, url: current }, 'Product import: image fetch threw, skipping');
    return null;
  }
}
