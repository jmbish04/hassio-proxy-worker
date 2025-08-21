import { Hono } from 'hono';
import { v1 } from './routes/v1';
import type { HomeAssistantWebSocket } from './durable-objects/homeAssistant';

export interface Env {
  D1_DB: D1Database;
  CONFIG_KV: KVNamespace;
  SESSIONS_KV: KVNamespace;
  CACHE_KV: KVNamespace;
  LOGS_BUCKET: R2Bucket;
  AI: Ai;
  WEBSOCKET_SERVER: DurableObjectNamespace<HomeAssistantWebSocket>;
}

const app = new Hono<{ Bindings: Env }>();

app.get('/health', (c) => {
  return c.json({ ok: true, uptime: (process as any).uptime?.() ?? null, env: { ready: true } });
});

// Minimal docs
app.get('/', (c) => {
  return c.text('hassio-proxy-worker up. See /openapi.json and /v1/*');
});

// OpenAPI placeholder
app.get('/openapi.json', (c) => {
  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'Alexa Skill REST API',
      version: '0.1.0',
      description:
        'Minimal Alexa-friendly API. All responses use { ok, speech, card?, data }. Stubbed for draft.'
    },
    servers: [{ url: 'https://example.workers.dev' }],
    paths: {
      '/v1/devices/scan': {
        post: {
          summary: 'Scan LAN and update device inventory (stub)',
          responses: { '200': { description: 'OK' } }
        }
      },
      '/v1/devices': {
        get: { summary: 'List devices (stub)', responses: { '200': { description: 'OK' } } }
      },
      '/v1/devices/{id}': {
        get: {
          summary: 'Get device detail (stub)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'OK' } }
        }
      },
      '/v1/protect/sync': {
        post: { summary: 'Sync UniFi Protect cameras (stub)', responses: { '200': { description: 'OK' } } }
      },
      '/v1/protect/cameras': {
        get: { summary: 'List cameras (stub)', responses: { '200': { description: 'OK' } } }
      },
      '/v1/protect/cameras/{id}/snapshot': {
        post: {
          summary: 'Capture snapshot (stub)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'OK' } }
        }
      }
    }
  };
  return c.json(spec);
});

// Mount /v1 group
app.route('/v1', v1);

app.get('/ws/:instanceId', (c) => {
  const { instanceId } = c.req.param();
  const id = c.env.WEBSOCKET_SERVER.idFromName(instanceId);
  const stub = c.env.WEBSOCKET_SERVER.get(id);
  return stub.fetch(c.req.raw);
});

export default app;
