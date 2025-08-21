import { describe, expect, it } from 'vitest';
import app from './index';

// Simple mocks for bindings
const bindings = {
  D1_DB: {} as any,
  KV: { async get() {}, async put() {}, async delete() {} } as any,
  R2_BUCKET: {} as any
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
});
