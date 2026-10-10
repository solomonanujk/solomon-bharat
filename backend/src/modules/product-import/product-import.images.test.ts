import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('dns/promises', () => ({ lookup: vi.fn() }));

import { lookup } from 'dns/promises';
import { fetchRemoteImage, isBlockedAddress, sniffImageExtension, vetImageUrl } from './product-import.images';

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const mockLookup = lookup as unknown as ReturnType<typeof vi.fn>;

function publicDns() {
  mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
}

describe('isBlockedAddress', () => {
  it.each(['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1', 'not-an-ip'])(
    'blocks %s',
    (ip) => expect(isBlockedAddress(ip)).toBe(true),
  );
  it.each(['93.184.216.34', '8.8.8.8', '2606:4700:4700::1111'])('allows %s', (ip) => expect(isBlockedAddress(ip)).toBe(false));
});

describe('vetImageUrl', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects non-http(s), credentials, localhost and private IP literals without DNS', async () => {
    for (const url of ['ftp://x.test/a.jpg', 'https://u:p@x.test/a.jpg', 'http://localhost/a.jpg', 'http://127.0.0.1/a.jpg', 'http://[::1]/a.jpg', 'nonsense']) {
      // eslint-disable-next-line no-await-in-loop
      expect(await vetImageUrl(url)).toBeNull();
    }
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it('rejects hostnames that resolve to a private address', async () => {
    mockLookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.5', family: 4 },
    ]);
    expect(await vetImageUrl('https://rebind.test/a.jpg')).toBeNull();
  });

  it('rejects hostnames that fail to resolve', async () => {
    mockLookup.mockRejectedValue(new Error('ENOTFOUND'));
    expect(await vetImageUrl('https://nope.test/a.jpg')).toBeNull();
  });

  it('allows public hosts', async () => {
    publicDns();
    expect((await vetImageUrl('https://cdn.shopify.com/a.jpg'))?.hostname).toBe('cdn.shopify.com');
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
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('downloads a public JPEG', async () => {
    publicDns();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JPEG_BYTES, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const image = await fetchRemoteImage('https://cdn.shopify.com/a.jpg');
    expect(image?.extension).toBe('jpg');
    expect(image?.buffer.equals(JPEG_BYTES)).toBe(true);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
  });

  it('re-vets every redirect hop and refuses a redirect to a private address', async () => {
    publicDns();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest' } }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchRemoteImage('https://cdn.shopify.com/a.jpg')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('follows a relative redirect to a public host', async () => {
    publicDns();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: '/b.jpg' } }))
      .mockResolvedValueOnce(new Response(JPEG_BYTES, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchRemoteImage('https://cdn.shopify.com/a.jpg')).not.toBeNull();
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://cdn.shopify.com/b.jpg');
  });

  it('gives up after too many redirects', async () => {
    publicDns();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(new Response(null, { status: 302, headers: { location: '/loop' } }))),
    );
    expect(await fetchRemoteImage('https://cdn.shopify.com/a.jpg')).toBeNull();
  });

  it('skips non-OK responses, non-images, oversize bodies and network errors', async () => {
    publicDns();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 404 })));
    expect(await fetchRemoteImage('https://x.test/a.jpg')).toBeNull();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html></html>', { status: 200 })));
    expect(await fetchRemoteImage('https://x.test/a.jpg')).toBeNull();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JPEG_BYTES, { status: 200, headers: { 'content-length': String(6 * 1024 * 1024) } })),
    );
    expect(await fetchRemoteImage('https://x.test/a.jpg')).toBeNull();

    const big = Buffer.concat([JPEG_BYTES, Buffer.alloc(5 * 1024 * 1024)]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(big, { status: 200 })));
    expect(await fetchRemoteImage('https://x.test/a.jpg')).toBeNull();

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));
    expect(await fetchRemoteImage('https://x.test/a.jpg')).toBeNull();
  });
});
