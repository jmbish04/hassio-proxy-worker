import { Hono } from 'hono'

// Define expected bindings for the worker environment
interface Env {
  KV: KVNamespace
}

// Initialize Hono app with typed bindings
const app = new Hono<{ Bindings: Env }>()

// Basic health endpoint
app.get('/health', (c) => {
  return c.json({ ok: true })
})

// Echo endpoint demonstrating MCP-style tool behaviour
app.post('/v1/echo', async (c) => {
  const body = await c.req.json<{ message: string }>()
  // Store last message asynchronously using KV to leverage edge workers
  c.executionCtx.waitUntil(c.env.KV.put('lastMessage', body.message))
  return c.json({ ok: true, echo: body.message })
})

// Time endpoint showcasing fast edge response
app.get('/v1/time', () => {
  return new Response(JSON.stringify({ ok: true, time: new Date().toISOString() }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'max-age=60' },
  })
})

// Export default for Cloudflare Worker
export default app
