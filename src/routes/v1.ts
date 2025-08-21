import { Hono } from 'hono';
import { ok } from '../lib/response';
import type { Env } from '../index';
import { haFetch } from '../lib/homeAssistant';

export const v1 = new Hono<{ Bindings: Env }>();

// NOTE: All are stubs. Real logic (LAN scan, Protect, D1, R2) comes next PR.

v1.post('/devices/scan', async (c) => {
  return c.json(ok('stub: device scan', { added: 0, updated: 0, total: 0, reportUrl: null }));
});

v1.get('/devices', async (c) => {
  return c.json(ok('stub: list devices', { items: [], total: 0 }));
});

v1.get('/devices/:id', async (c) => {
  const { id } = c.req.param();
  return c.json(ok(`stub: device detail for ${id}`, { id, mac: null, ip: null, lastSeenTs: null }));
});

v1.post('/protect/sync', async (c) => {
  return c.json(ok('stub: protect sync', { total: 0, online: 0, updated: 0, snapshotCount: 0 }));
});

v1.get('/protect/cameras', async (c) => {
  return c.json(ok('stub: list cameras', { total: 0, online: 0, offline: [], items: [] }));
});

v1.post('/protect/cameras/:id/snapshot', async (c) => {
  const { id } = c.req.param();
  return c.json(ok(`stub: camera snapshot for ${id}`, { imageUrl: null, camera: id }));
});

v1.post('/webhooks/logs', async (c) => {
  const log = await c.req.json();
  const key = `logs/${Date.now()}-${Math.random().toString(16).slice(2)}.json`;
  await c.env.LOGS_BUCKET.put(key, JSON.stringify(log));

  if (/error/i.test(JSON.stringify(log))) {
    try {
      const analysis = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt: `Analyze Home Assistant log and provide diagnostics:\n${JSON.stringify(log)}`,
        max_tokens: 256
      });
      const id = crypto.randomUUID();
      await c.env.D1_DB.prepare(
        'INSERT INTO log_diagnostics (id, log_key, analysis, created_at) VALUES (?, ?, ?, ?)' 
      ).bind(id, key, analysis.response, Date.now()).run();
    } catch (err) {
      // swallow errors to avoid failing webhook
    }
  }

  return c.json(ok('log stored', { key }));
});

v1.get('/worker/state/:key', async (c) => {
  const { key } = c.req.param();
  const value = await c.env.CONFIG_KV.get(key);
  return c.json(ok('state retrieved', { key, value }));
});

v1.put('/worker/state/:key', async (c) => {
  const { key } = c.req.param();
  const value = await c.req.text();
  await c.env.CONFIG_KV.put(key, value);
  return c.json(ok('state stored', { key }));
});

v1.get('/ha/:instanceId/states/:entityId', async (c) => {
  const { instanceId, entityId } = c.req.param();
  const res = await haFetch(c.env, instanceId, `/api/states/${entityId}`);
  const data = await res.json();
  return c.json(ok('state', data));
});

v1.put('/ha/:instanceId/states/:entityId', async (c) => {
  const { instanceId, entityId } = c.req.param();
  const body = await c.req.json();
  const res = await haFetch(c.env, instanceId, `/api/states/${entityId}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }
  });
  const data = await res.json();
  return c.json(ok('state updated', data));
});

v1.post('/ha/:instanceId/services/:domain/:service', async (c) => {
  const { instanceId, domain, service } = c.req.param();
  const body = await c.req.json();
  const res = await haFetch(c.env, instanceId, `/api/services/${domain}/${service}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }
  });
  const data = await res.json();
  return c.json(ok('service called', data));
});
