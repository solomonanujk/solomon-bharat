import { describe, it, expect, beforeEach } from 'vitest';
import { readCookie } from './cookies';

describe('readCookie', () => {
  beforeEach(() => {
    document.cookie.split(';').forEach((c) => {
      const name = c.split('=')[0]?.trim();
      if (name) document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    });
  });

  it('returns null when the cookie is not present', () => {
    expect(readCookie('missing')).toBeNull();
  });

  it('reads a simple cookie value', () => {
    document.cookie = 'csrf_token=abc123';
    expect(readCookie('csrf_token')).toBe('abc123');
  });

  it('decodes URI-encoded cookie values', () => {
    document.cookie = `session_note=${encodeURIComponent('hello world')}`;
    expect(readCookie('session_note')).toBe('hello world');
  });

  it('distinguishes between cookies with similar names', () => {
    document.cookie = 'refresh_token=r1';
    document.cookie = 'refresh_token_extra=r2';
    expect(readCookie('refresh_token')).toBe('r1');
  });
});
