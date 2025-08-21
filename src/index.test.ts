import { describe, expect, it } from 'vitest';
import app from './index';

// Simple mocks for bindings
const bindings = {
  D1_DB: {
    prepare() {
      return {
        bind() {
          return { async run() {} };
        }
      };
    }
  } as any,
  KV: { async get() {}, async put() {}, async delete() {} } as any,
  LOGS_BUCKET: { async put() {} } as any,
  AI: { async run() { return { response: 'diag' }; } } as any,
  WEBSOCKET_SERVER: {
    idFromName() {
      return {} as any;
    },
    get() {
      return { fetch: () => new Response('not implemented', { status: 501 }) } as any;
    }
  } as any
};
const ctx = { waitUntil() {} } as any;

describe('Alexa REST API scaffold', () => {
  it('responds to health check', async () => {
    const res = await app.request('/health', {}, bindings, ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it('returns stub device scan', async () => {
    const res = await app.request('/v1/devices/scan', { method: 'POST' }, bindings, ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.data).toEqual({ added: 0, updated: 0, total: 0, reportUrl: null });
  });

  it('accepts log webhook', async () => {
    const res = await app.request(
      '/v1/webhooks/logs',
      { method: 'POST', body: JSON.stringify({ level: 'ERROR', message: 'fail' }) },
      bindings,
      ctx
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.data?.key).toBeDefined();
  });
});
