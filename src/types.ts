import type { HomeAssistantWebSocket } from './durable-objects/homeAssistant';

export interface Env {
  D1_DB: D1Database;
  CONFIG_KV: KVNamespace;
  SESSIONS_KV: KVNamespace;
  CACHE_KV: KVNamespace;
  LOGS_BUCKET: R2Bucket;
  AI: Ai;
  WEBSOCKET_SERVER: DurableObjectNamespace<HomeAssistantWebSocket>;
  HASSIO_ENDPOINT_URI: string;
  HASSIO_TOKEN: string;
}

