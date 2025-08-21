import { Hono } from 'hono';
import { ok } from '../lib/response';

export const v1 = new Hono();

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
