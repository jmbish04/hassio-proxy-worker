import type { Env } from '../index';

export interface InstanceConfig {
  baseUrl: string;
  token: string;
}

export async function getInstanceConfig(env: Env, instanceId: string): Promise<InstanceConfig | null> {
  const raw = await env.CONFIG_KV.get(`instance:${instanceId}`);
  return raw ? JSON.parse(raw) : null;
}

export async function haFetch(env: Env, instanceId: string, path: string, init: RequestInit = {}): Promise<Response> {
  const config = await getInstanceConfig(env, instanceId);
  if (!config) {
    return new Response('instance not configured', { status: 404 });
  }
  const url = `${config.baseUrl}${path}`;
  const headers = {
    ...(init.headers || {}),
    Authorization: `Bearer ${config.token}`,
  } as Record<string, string>;
  return fetch(url, { ...init, headers });
}
