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
  CONFIG_KV: {
    store: {} as Record<string, string>,
    async get(key: string) {
      return this.store[key];
    },
    async put(key: string, value: string) {
      this.store[key] = value;
    },
    async delete(key: string) {
      delete this.store[key];
    }
  } as any,
  SESSIONS_KV: { async get() {}, async put() {}, async delete() {} } as any,
  CACHE_KV: { async get() {}, async put() {}, async delete() {} } as any,
  LOGS_BUCKET: { async put() {} } as any,
  AI: { async run() { return { response: 'diag' }; } } as any,
  WEBSOCKET_SERVER: {
    idFromName() {
      return {} as any;
    },
    get() {
      return { fetch: () => new Response('not implemented', { status: 501 }) } as any;
    }
  } as any,
  HASSIO_ENDPOINT_URI: 'https://ha',
  HASSIO_TOKEN: 'token'
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

  it('stores and retrieves worker state', async () => {
    const putRes = await app.request(
      '/v1/worker/state/test',
      { method: 'PUT', body: 'value' },
      bindings,
      ctx
    );
    expect(putRes.status).toBe(200);

    const res = await app.request('/v1/worker/state/test', {}, bindings, ctx);
    const data = await res.json();
    expect(data.data).toEqual({ key: 'test', value: 'value' });
  });

  it('proxies Home Assistant state', async () => {
    bindings.CONFIG_KV.store['instance:abc'] = JSON.stringify({ baseUrl: 'https://ha', token: 't' });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: any, init?: any) => {
      expect(url).toBe('https://ha/api/states/light.kitchen');
      expect(init.headers.Authorization).toBe('Bearer t');
      return new Response(JSON.stringify({ state: 'on' }), { status: 200 });
    };

    const res = await app.request('/v1/ha/abc/states/light.kitchen', {}, bindings, ctx);
    const data = await res.json();
    expect(data.data.state).toBe('on');
    globalThis.fetch = originalFetch;
  });
});