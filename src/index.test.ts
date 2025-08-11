import { describe, expect, it } from 'vitest'
import app from './index'

// Simple KV mock for tests
const kvMock = {
  async get() { return null },
  async put() { },
  async delete() { }
}

const ctx = {
  waitUntil() { /* noop */ }
}

describe('MCP Worker', () => {
  it('responds to health check', async () => {
    const res = await app.request('/health', {}, { KV: kvMock } as any, ctx as any)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
  })

  it('echoes messages', async () => {
    const res = await app.request('/v1/echo', {
      method: 'POST',
      body: JSON.stringify({ message: 'hi' }),
      headers: { 'content-type': 'application/json' }
    }, { KV: kvMock } as any, ctx as any)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ ok: true, echo: 'hi' })
  })
})
