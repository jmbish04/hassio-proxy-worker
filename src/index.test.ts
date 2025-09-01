import { describe, expect, it, vi } from 'vitest';

vi.mock('ai', () => ({
  generateText: async () => ({ text: 'mocked summary' })
}));

vi.mock('./lib/homeAssistantWs', () => ({
  getHaClient: () => ({
    getStates: async () => []
  })
}));

import app from './index';
import type { Env } from './index';

// Simple mocks for bindings with minimal type fixes
const bindings: Env = {
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
      return (this as any).store[key];
    },
    async put(key: string, value: string) {
      (this as any).store[key] = value;
    },
    async delete(key: string) {
      delete (this as any).store[key];
    }
  } as any,
  SESSIONS_KV: { async get() {}, async put() {}, async delete() {} } as any,
  CACHE_KV: { async get() {}, async put() {}, async delete() {} } as any,
  LOGS_BUCKET: { async put() {} } as any,
  AI: {
    async run(model: string) {
      if (model.includes('whisper')) return { text: 'hello' } as any;
      if (model.includes('gpt-4o-mini-tts')) return { audio_base64: 'fakeaudio' } as any;
      return { response: 'diag' } as any;
    }
  } as any,
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

  it('generates AI summary', async () => {
    const res = await app.request(
      '/v1/ai/summary',
      { method: 'POST', body: JSON.stringify({ prompt: 'hi' }) },
      bindings,
      ctx
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toEqual({ text: 'mocked summary' });
  });
// Merged and resolved code block
it('handles voice interaction', async () => {
  const audioBase64 = Buffer.from('abc').toString('base64');
  const res = await app.request(
    '/v1/ai/voice',
    { method: 'POST', body: JSON.stringify({ audio: audioBase64 }) },
    bindings,
    ctx
  );
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.data.transcript).toBe('hello');
  expect(data.data.audio).toBe('fakeaudio');
});

  it('proxies Home Assistant state', async () => {
    (bindings.CONFIG_KV as any).store['instance:abc'] = JSON.stringify({ baseUrl: 'https://ha', token: 't' });
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

  it('validates WebSocket command is a JSON object', async () => {
    // Test with invalid input - string instead of object
    let res = await app.request(
      '/v1/ha/ws',
      { method: 'POST', body: JSON.stringify('invalid string') },
      bindings,
      ctx
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
      ctx
    );
    expect(res.status).toBe(400);
    data = await res.json();
    expect(data.ok).toBe(false);
    
    // Test with invalid input - null
    res = await app.request(
      '/v1/ha/ws',
      { method: 'POST', body: JSON.stringify(null) },
      bindings,
      ctx
    );
    expect(res.status).toBe(400);
    data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe('Request body must be a JSON object');
  });
});