import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import type { AddressInfo } from 'net';
import { createVettedLookup, fetchRemoteImage, isBlockedAddress, parseImageUrl, sniffImageExtension } from './product-import.images';

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);

describe('isBlockedAddress', () => {
  it.each(['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1', 'not-an-ip'])(
    'blocks %s',
    (ip) => expect(isBlockedAddress(ip)).toBe(true),
  );
  it.each(['93.184.216.34', '8.8.8.8', '2606:4700:4700::1111'])('allows %s', (ip) => expect(isBlockedAddress(ip)).toBe(false));
});

describe('parseImageUrl', () => {
  it('rejects non-http(s), credentials, localhost and private IP literals', () => {
    for (const url of [
      'ftp://x.test/a.jpg',
      'https://u:p@x.test/a.jpg',
      'http://localhost/a.jpg',
      'http://127.0.0.1/a.jpg',
      'http://[::1]/a.jpg',
      'http://[::ffff:10.0.0.1]/a.jpg',
      'nonsense',
    ]) {
      expect(parseImageUrl(url)).toBeNull();
    }
  });
  it('allows public hosts and literals', () => {
    expect(parseImageUrl('https://cdn.shopify.com/a.jpg')?.hostname).toBe('cdn.shopify.com');
    expect(parseImageUrl('http://93.184.216.34/a.jpg')).not.toBeNull();
  });
});

describe('createVettedLookup', () => {
  const run = (resolver: () => Promise<{ address: string; family: number }[]>, opts: object = {}) =>
    new Promise<{ err: NodeJS.ErrnoException | null; address?: unknown; family?: number }>((resolve) => {
      createVettedLookup(resolver)('h.test', opts, (err, address, family) => resolve({ err, address, family }));
    });

  it('returns the vetted public address', async () => {
    const r = await run(() => Promise.resolve([{ address: '93.184.216.34', family: 4 }]));
    expect(r).toMatchObject({ err: null, address: '93.184.216.34', family: 4 });
  });

  it('returns the address list when all is requested', async () => {
    const r = await run(() => Promise.resolve([{ address: '93.184.216.34', family: 4 }]), { all: true });
    expect(r.address).toEqual([{ address: '93.184.216.34', family: 4 }]);
  });

  it.each(['10.0.0.5', '127.0.0.1', '169.254.169.254', 'fd00::1', '::ffff:192.168.0.1'])('rejects %s', async (ip) => {
    const r = await run(() => Promise.resolve([{ address: ip, family: ip.includes(':') ? 6 : 4 }]));
    expect(r.err?.code).toBe('EBLOCKED');
  });

  it('rejects when any returned address is private', async () => {
    const r = await run(() =>
      Promise.resolve([
        { address: '93.184.216.34', family: 4 },
        { address: '10.0.0.5', family: 4 },
      ]),
    );
    expect(r.err?.code).toBe('EBLOCKED');
  });

  it('propagates resolution failures', async () => {
    const r = await run(() => Promise.reject(Object.assign(new Error('nx'), { code: 'ENOTFOUND' })));
    expect(r.err?.code).toBe('ENOTFOUND');
  });
});

describe('sniffImageExtension', () => {
  it('detects jpeg/png/webp and rejects others', () => {
    expect(sniffImageExtension(JPEG_BYTES)).toBe('jpg');
    expect(sniffImageExtension(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png');
    expect(sniffImageExtension(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'binary'))).toBe('webp');
    expect(sniffImageExtension(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniffImageExtension(Buffer.from('GIF89a'))).toBeNull();
  });
});

describe('fetchRemoteImage', () => {
  let server: Server;
  let port: number;
  let hits: string[];
  let handler: (req: IncomingMessage, res: ServerResponse) => void;

  beforeAll(async () => {
    server = createServer((req, res) => {
      hits.push(req.url ?? '');
      handler(req, res);
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));
  beforeEach(() => {
    hits = [];
    handler = (_req, res) => res.end(JPEG_BYTES);
  });

  // Hostnames here are fake; the lookup maps them to the local test server. The isBlocked
  // argument lets a case declare 127.0.0.1 "public" so the server is reachable.
  const toLocal = (isBlocked: (a: string) => boolean) =>
    createVettedLookup(() => Promise.resolve([{ address: '127.0.0.1', family: 4 }]), isBlocked);
  const url = (path: string) => `http://img.test:${port}${path}`;

  it('downloads an image whose hostname resolves to a public address', async () => {
    const image = await fetchRemoteImage(url('/a.jpg'), { lookup: toLocal(() => false) });
    expect(image?.extension).toBe('jpg');
    expect(image?.buffer.equals(JPEG_BYTES)).toBe(true);
  });

  it('refuses a hostname that resolves to a private address without ever connecting', async () => {
    expect(await fetchRemoteImage(url('/a.jpg'), { lookup: toLocal(isBlockedAddress) })).toBeNull();
    expect(hits).toEqual([]);
  });

  it('closes the DNS-rebinding gap: only one resolution, and it is the one connected to', async () => {
    // First answer is public (an unroutable documentation-free address), any later one is
    // private. A check-then-fetch design would pass the check then connect to the private one;
    // here the single vetted answer is what the socket uses, so the private answer is never used.
    let calls = 0;
    const rebinding = createVettedLookup(() => {
      calls += 1;
      return Promise.resolve([{ address: calls === 1 ? '127.0.0.1' : '10.0.0.1', family: 4 }]);
    }, (a) => a === '10.0.0.1');
    const image = await fetchRemoteImage(url('/a.jpg'), { lookup: rebinding });
    expect(image).not.toBeNull();
    expect(calls).toBe(1);
  });

  it('rebinding simulated on connect: a lookup answering private at connect time is refused', async () => {
    const lookup = createVettedLookup(() => Promise.resolve([{ address: '10.0.0.1', family: 4 }]));
    expect(await fetchRemoteImage(url('/a.jpg'), { lookup })).toBeNull();
    expect(hits).toEqual([]);
  });

  it('refuses a redirect to a private literal', async () => {
    handler = (_req, res) => {
      res.statusCode = 302;
      res.setHeader('location', 'http://169.254.169.254/latest');
      res.end();
    };
    expect(await fetchRemoteImage(url('/a.jpg'), { lookup: toLocal(() => false) })).toBeNull();
    expect(hits).toHaveLength(1);
  });

  it('re-vets the hostname on every redirect hop', async () => {
    let calls = 0;
    const lookup = createVettedLookup(
      () => Promise.resolve([{ address: '127.0.0.1', family: 4 }]),
      () => {
        calls += 1;
        return calls > 1;
      },
    );
    handler = (_req, res) => {
      res.statusCode = 302;
      res.setHeader('location', `http://other.test:${port}/b.jpg`);
      res.end();
    };
    expect(await fetchRemoteImage(url('/a.jpg'), { lookup })).toBeNull();
    expect(hits).toHaveLength(1);
  });

  it('follows a relative redirect', async () => {
    handler = (req, res) => {
      if (req.url === '/a.jpg') {
        res.statusCode = 301;
        res.setHeader('location', '/b.jpg');
        res.end();
      } else res.end(JPEG_BYTES);
    };
    expect(await fetchRemoteImage(url('/a.jpg'), { lookup: toLocal(() => false) })).not.toBeNull();
    expect(hits).toEqual(['/a.jpg', '/b.jpg']);
  });

  it('gives up after 3 redirects', async () => {
    handler = (_req, res) => {
      res.statusCode = 302;
      res.setHeader('location', '/loop');
      res.end();
    };
    expect(await fetchRemoteImage(url('/a.jpg'), { lookup: toLocal(() => false) })).toBeNull();
    expect(hits).toHaveLength(4);
  });

  it('skips non-OK responses, non-images and oversize bodies', async () => {
    const lookup = toLocal(() => false);
    handler = (_req, res) => {
      res.statusCode = 404;
      res.end('nope');
    };
    expect(await fetchRemoteImage(url('/a.jpg'), { lookup })).toBeNull();

    handler = (_req, res) => res.end('<html></html>');
    expect(await fetchRemoteImage(url('/a.jpg'), { lookup })).toBeNull();

    handler = (_req, res) => res.end(Buffer.concat([JPEG_BYTES, Buffer.alloc(5 * 1024 * 1024)]));
    expect(await fetchRemoteImage(url('/a.jpg'), { lookup })).toBeNull();
  });

  it('returns null when resolution fails', async () => {
    const lookup = createVettedLookup(() => Promise.reject(new Error('ENOTFOUND')));
    expect(await fetchRemoteImage('https://nope.test/a.jpg', { lookup })).toBeNull();
  });
});
