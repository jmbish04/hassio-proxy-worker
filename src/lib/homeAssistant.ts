import type { WorkerEnv } from '../index';
import { logger } from './logger';

export interface InstanceConfig {
  baseUrl: string;
  token: string;
}

export async function getInstanceConfig(env: WorkerEnv, instanceId: string): Promise<InstanceConfig | null> {
  const raw = await env.CONFIG_KV.get(`instance:${instanceId}`);
  if (raw) {
    logger.debug('Instance config loaded', instanceId);
  } else {
    logger.warn('Instance config missing', instanceId);
  }
  return raw ? JSON.parse(raw) : null;
}

export async function haFetch(env: WorkerEnv, instanceId: string, path: string, init: RequestInit = {}): Promise<Response> {
  const config = await getInstanceConfig(env, instanceId);
  if (!config) {
    logger.error('Instance not configured', instanceId);
    return new Response('instance not configured', { status: 404 });
  }
  const url = `${config.baseUrl}${path}`;
  const headers = {
    ...(init.headers || {}),
    Authorization: `Bearer ${config.token}`,
  } as Record<string, string>;
  logger.debug('haFetch', url, init.method || 'GET');
  return fetch(url, { ...init, headers });
}
