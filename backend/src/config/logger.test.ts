import { describe, it, expect } from 'vitest';
import { Writable } from 'stream';
import express from 'express';
import request from 'supertest';
import pinoHttp from 'pino-http';
import { createLogger, REDACT_CENSOR } from './logger';

function capture() {
  const lines: Record<string, Record<string, Record<string, unknown>>>[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(JSON.parse(chunk.toString()));
      cb();
    },
  });
  return { lines, stream };
}

describe('logger redaction', () => {
  it('redacts credential headers on a logged request/response, leaving others intact', () => {
    const { lines, stream } = capture();
    const log = createLogger(stream);
    log.info(
      {
        req: {
          method: 'GET',
          headers: {
            authorization: 'Bearer secret-token',
            cookie: 'refresh=abc',
            'x-csrf-token': 'csrf-secret',
            'user-agent': 'vitest',
          },
        },
        res: { statusCode: 200, headers: { 'set-cookie': ['refresh=new; HttpOnly'], 'content-type': 'application/json' } },
      },
      'request completed',
    );
    const out = lines[0];
    expect(out.req.headers.authorization).toBe(REDACT_CENSOR);
    expect(out.req.headers.cookie).toBe(REDACT_CENSOR);
    expect(out.req.headers['x-csrf-token']).toBe(REDACT_CENSOR);
    expect(out.res.headers['set-cookie']).toBe(REDACT_CENSOR);
    expect(out.req.headers['user-agent']).toBe('vitest');
    expect(out.res.headers['content-type']).toBe('application/json');
    expect(JSON.stringify(out)).not.toMatch(/secret-token|refresh=|csrf-secret/);
  });

  it('redacts real request/response headers logged by pino-http', async () => {
    const { lines, stream } = capture();
    const app = express();
    app.use(pinoHttp({ logger: createLogger(stream) }));
    app.get('/x', (_req, res) => {
      res.setHeader('Set-Cookie', 'refresh=new; HttpOnly');
      res.json({ ok: true });
    });
    await request(app)
      .get('/x')
      .set('Authorization', 'Bearer secret-token')
      .set('Cookie', 'refresh=abc')
      .set('X-CSRF-Token', 'csrf-secret');
    const out = lines.find((l) => l.res);
    expect(out).toBeDefined();
    expect(out!.req.headers.authorization).toBe(REDACT_CENSOR);
    expect(out!.req.headers.cookie).toBe(REDACT_CENSOR);
    expect(out!.req.headers['x-csrf-token']).toBe(REDACT_CENSOR);
    expect(out!.res.headers['set-cookie']).toBe(REDACT_CENSOR);
    expect(JSON.stringify(out)).not.toMatch(/secret-token|refresh=|csrf-secret/);
  });
});
