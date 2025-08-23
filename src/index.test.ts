import { describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@cloudflare/workers-types';

vi.mock('ai', () => ({
  generateText: async () => ({ text: 'mocked summary' })
}));

import app from './index';
import type { Env } from './index';

// Improved typed mocks - removing unnecessary 'as any' casts where possible
const configKVStore: Record<string, string> = {};

const createKVMock = (store: Record<string, string> = {}) => ({
  async get(key: string) {
    return store[key] || null;
  },
  async put(key: string, value: string) {
    store[key] = value;
  },
  async delete(key: string) {
    delete store[key];
  }
});

const executionContextMock: ExecutionContext = {
  waitUntil() {},
  passThroughOnException() {},
  props: {}
};

// Create the bindings object with better typing - only use 'as any' where absolutely necessary
const bindings: Env = {
  D1_DB: {
    prepare() {
      return {
        bind() {
          return { async run() {} };
        }
      };
    }
  } as any, // Keep this as any since we're not testing D1 functionality
  CONFIG_KV: createKVMock(configKVStore) as any,
  SESSIONS_KV: createKVMock() as any,
  CACHE_KV: createKVMock() as any,
  LOGS_BUCKET: { async put() {} } as any,
  AI: { async run() { return { response: 'diag' }; } } as any,
  WEBSOCKET_SERVER: {
    idFromName() {
      return {} as any;
    },
    get() {
      return { fetch: () => new Response('not implemented', { status: 501 }) };
    }
  } as any,
  HASSIO_ENDPOINT_URI: 'https://ha',
  HASSIO_TOKEN: 'token'
};

describe('Alexa REST API scaffold', () => {
  it('responds to health check', async () => {
    const res = await app.request('/health', {}, bindings, executionContextMock);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it('returns stub device scan', async () => {
    const res = await app.request('/v1/devices/scan', { method: 'POST' }, bindings, executionContextMock);
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
      executionContextMock
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
      executionContextMock
    );
    expect(putRes.status).toBe(200);

    const res = await app.request('/v1/worker/state/test', {}, bindings, executionContextMock);
    const data = await res.json();
    expect(data.data).toEqual({ key: 'test', value: 'value' });
  });

  it('generates AI summary', async () => {
    const res = await app.request(
      '/v1/ai/summary',
      { method: 'POST', body: JSON.stringify({ prompt: 'hi' }) },
      bindings,
      executionContextMock
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toEqual({ text: 'mocked summary' });
  });

  it('proxies Home Assistant state', async () => {
    configKVStore['instance:abc'] = JSON.stringify({ baseUrl: 'https://ha', token: 't' });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: any, init?: any) => {
      expect(url).toBe('https://ha/api/states/light.kitchen');
      expect(init.headers.Authorization).toBe('Bearer t');
      return new Response(JSON.stringify({ state: 'on' }), { status: 200 });
    };

    const res = await app.request('/v1/ha/abc/states/light.kitchen', {}, bindings, executionContextMock);
    const data = await res.json();
    expect(data.data.state).toBe('on');
    globalThis.fetch = originalFetch;
  });

  it('validates WebSocket command is a JSON object', async () => {
    // Test with invalid input - string instead of object
    let res = await app.request(
      '/v1/ha/ws',
      { method: 'POST', body: JSON.stringify('invalid string') },
      bindings,
      executionContextMock
    );
    expect(res.status).toBe(400);
    let data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe('Request body must be a JSON object');

    // Test with invalid input - array instead of object
    res = await app.request(
      '/v1/ha/ws',
      { method: 'POST', body: JSON.stringify(['invalid', 'array']) },
      bindings,
      executionContextMock
    );
    expect(res.status).toBe(400);
    data = await res.json();
    expect(data.ok).toBe(false);
    
    // Test with invalid input - null
    res = await app.request(
      '/v1/ha/ws',
      { method: 'POST', body: JSON.stringify(null) },
      bindings,
      executionContextMock
    );
    expect(res.status).toBe(400);
    data = await res.json();
    expect(data.ok).toBe(false);
  });
});