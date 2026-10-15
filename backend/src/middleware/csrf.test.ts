import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { csrfProtection } from './csrf';

function run(req: Partial<Request>) {
  const next = vi.fn();
  csrfProtection({ method: 'POST', path: '/sellers/apply', headers: {}, cookies: {}, ...req } as Request, {} as Response, next);
  return next.mock.calls[0][0];
}

describe('csrfProtection', () => {
  it('lets a logged-out visitor submit a public form even with a stale csrf cookie', () => {
    expect(run({ cookies: { csrf_token: 'old' } })).toBeUndefined();
  });

  it('still rejects a signed-in request whose header does not match the cookie', () => {
    const err = run({ headers: { authorization: 'Bearer x' }, cookies: { csrf_token: 'a' } });
    expect(err).toMatchObject({ statusCode: 403 });
  });

  it('accepts a signed-in request with the matching header', () => {
    expect(run({ headers: { authorization: 'Bearer x', 'x-csrf-token': 'a' }, cookies: { csrf_token: 'a' } })).toBeUndefined();
  });

  it('skips safe methods and /auth/*', () => {
    expect(run({ method: 'GET', headers: { authorization: 'Bearer x' }, cookies: { csrf_token: 'a' } })).toBeUndefined();
    expect(run({ path: '/auth/login', headers: { authorization: 'Bearer x' }, cookies: { csrf_token: 'a' } })).toBeUndefined();
  });
});
