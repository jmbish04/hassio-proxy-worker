import { Hono } from 'hono';
import { ok } from '../lib/response';
import type { Env } from '../index';
import { haFetch } from '../lib/homeAssistant';
import { getHaClient } from '../lib/homeAssistantWs';
import { createWorkersAI } from 'workers-ai-provider';
import { generateText } from 'ai';
import { logger } from '../lib/logger';


export const v1 = new Hono<{ Bindings: Env }>();

v1.use('*', async (c, next) => {
  logger.debug('[v1]', c.req.method, c.req.path);
  await next();
});

// NOTE: All are stubs. Real logic (LAN scan, Protect, D1, R2) comes next PR.

v1.post('/devices/scan', async (c) => {
  logger.debug('devices/scan invoked');
  return c.json(ok('stub: device scan', { added: 0, updated: 0, total: 0, reportUrl: null }));
});

v1.get('/devices', async (c) => {
  logger.debug('devices list requested');
  return c.json(ok('stub: list devices', { items: [], total: 0 }));
});

v1.get('/devices/:id', async (c) => {
  const { id } = c.req.param();
  logger.debug('device detail requested', id);
  return c.json(ok(`stub: device detail for ${id}`, { id, mac: null, ip: null, lastSeenTs: null }));
});

v1.post('/protect/sync', async (c) => {
  logger.debug('protect sync invoked');
  return c.json(ok('stub: protect sync', { total: 0, online: 0, updated: 0, snapshotCount: 0 }));
});

v1.get('/protect/cameras', async (c) => {
  logger.debug('protect cameras list requested');
  return c.json(ok('stub: list cameras', { total: 0, online: 0, offline: [], items: [] }));
});

v1.post('/protect/cameras/:id/snapshot', async (c) => {
  const { id } = c.req.param();
  logger.debug('camera snapshot requested', id);
  return c.json(ok(`stub: camera snapshot for ${id}`, { imageUrl: null, camera: id }));
});

v1.post('/ai/summary', async (c) => {
  const { prompt } = await c.req.json<{ prompt: string }>();
  logger.debug('ai summary requested', prompt);
  const workersai = createWorkersAI({ binding: c.env.AI });
  const result = await generateText({
    model: workersai('@cf/openai/gpt-oss-120b') as any,
    prompt
  });
  logger.debug('ai summary response', result.text);
  return c.json(ok('ai summary', { text: result.text }));
});

v1.post('/ai/voice', async (c) => {
  const { audio: audioBase64 } = await c.req.json<{ audio: string }>();
  logger.debug('voice agent request');

  const binaryString = atob(audioBase64);
  const audio = Uint8Array.from(binaryString, c => c.charCodeAt(0));

  // Speech to text
  const sttRes: { text?: string } = await c.env.AI.run('@cf/openai/whisper', {
    audio
  });
  const transcript: string = sttRes.text || '';

  let reply = '';
  if (/status/i.test(transcript)) {
    try {
      const states: any[] = await getHaClient(c.env).getStates();
      reply = `There are ${states?.length ?? 0} entities reported by Home Assistant.`;
    } catch (err) {
      logger.error('HA status error', err);
      reply = 'Unable to retrieve Home Assistant status.';
    }
  } else {
    const workersai = createWorkersAI({ binding: c.env.AI });
    const result = await generateText({
      model: workersai('@cf/openai/gpt-oss-120b') as any,
      prompt: transcript
    });
    reply = result.text;
  }

  // Text to speech
  const ttsRes: { audio_base64?: string } = await c.env.AI.run('@cf/openai/gpt-4o-mini-tts', {
    text: reply,
    voice: 'alloy'
  });

  return c.json(ok('voice', { transcript, reply, audio: ttsRes.audio_base64 }));
});

v1.post('/webhooks/logs', async (c) => {
  const log = await c.req.json();
  const key = `logs/${Date.now()}-${crypto.randomUUID()}.json`;
  await c.env.LOGS_BUCKET.put(key, JSON.stringify(log));

  if (typeof log?.level === 'string' && log.level.toUpperCase() === 'ERROR') {
    try {
      const analysis = await c.env.AI.run('@cf/openai/gpt-oss-120b', {
        prompt: `Analyze Home Assistant log and provide diagnostics:\n${JSON.stringify(log)}`,
        max_tokens: 256
      });
      const id = crypto.randomUUID();
      await c.env.D1_DB.prepare(
        'INSERT INTO log_diagnostics (id, log_key, analysis, created_at) VALUES (?, ?, ?, ?)'
      ).bind(id, key, analysis.response, Date.now()).run();
    } catch (err) {
      // swallow errors to avoid failing webhook
      logger.error('Error during log analysis:', err);
    }
  }

  logger.debug('log stored', key);
  return c.json(ok('log stored', { key }));
});

v1.get('/worker/state/:key', async (c) => {
  const { key } = c.req.param();
  const value = await c.env.CONFIG_KV.get(key);
  logger.debug('state retrieved', key);
  return c.json(ok('state retrieved', { key, value }));
});

v1.put('/worker/state/:key', async (c) => {
  const { key } = c.req.param();
  const value = await c.req.text();
  await c.env.CONFIG_KV.put(key, value);
  logger.debug('state stored', key);
  return c.json(ok('state stored', { key }));
});

v1.get('/ha/:instanceId/states/:entityId', async (c) => {
  const { instanceId, entityId } = c.req.param();
  logger.debug('HA state fetch', instanceId, entityId);
  const res = await haFetch(c.env, instanceId, `/api/states/${entityId}`);
  const data = await res.json();
  return c.json(ok('state', data));
});

v1.put('/ha/:instanceId/states/:entityId', async (c) => {
  const { instanceId, entityId } = c.req.param();
  const body = await c.req.json();
  logger.debug('HA state update', instanceId, entityId, body);
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
  logger.debug('HA service call', instanceId, domain, service, body);
  const res = await haFetch(c.env, instanceId, `/api/services/${domain}/${service}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }
  });
  const data = await res.json();
  return c.json(ok('service called', data));
});

// Generic Home Assistant WebSocket command endpoint using worker-configured instance
v1.post('/ha/ws', async (c) => {
  const command = await c.req.json();
  logger.debug('HA WS command', command);
  if (typeof command !== 'object' || command === null || Array.isArray(command)) {
    return c.json({ ok: false, error: 'Request body must be a JSON object' }, 400);
  }
  const data = await getHaClient(c.env).send(command);
  logger.debug('HA WS response', data);
  return c.json(ok('ws response', data));
});
