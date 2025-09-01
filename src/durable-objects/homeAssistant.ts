import type { Env } from '../types';
import { getInstanceConfig } from '../lib/homeAssistant';
import { logger } from '../lib/logger';

export class HomeAssistantWebSocket implements DurableObject {
  private readonly state: DurableObjectState;
  private env: Env;
  private haSocket?: WebSocket;
  private clients = new Set<WebSocket>();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      logger.warn('Non-websocket request to HomeAssistantWebSocket');
      return new Response('Expected websocket', { status: 400 });
    }

    const url = new URL(request.url);
    const instanceId = url.pathname.split('/').pop() || 'default';
    logger.debug('HomeAssistantWebSocket fetch for', instanceId);
    await this.ensureHaSocket(instanceId);

    const pair = new WebSocketPair();
    const { 0: client, 1: server } = pair;

    server.accept?.();

    this.clients.add(server);
    server.addEventListener('message', (ev: any) => {
      try {
        this.haSocket?.send(ev.data);
      } catch {}
    });
    const remove = () => {
      this.clients.delete(server);
    };
    server.addEventListener('close', remove);
    server.addEventListener('error', remove);

    return new Response(null, { status: 101, webSocket: client });
  }

  private async ensureHaSocket(instanceId: string) {
    if (this.haSocket && this.haSocket.readyState <= 1) return;

    const config = this.env.HASSIO_ENDPOINT_URI && this.env.HASSIO_TOKEN
      ? { baseUrl: this.env.HASSIO_ENDPOINT_URI, token: this.env.HASSIO_TOKEN }
      : await getInstanceConfig(this.env, instanceId);
    if (!config) {
      logger.warn('No HA config found for instance', instanceId);
      return;
    }

    const wsUrl = config.baseUrl.replace(/^http/, 'ws') + '/api/websocket';
    this.haSocket = new WebSocket(wsUrl);
    logger.debug('Opening HA socket', wsUrl);
    this.haSocket.addEventListener('open', () => {
      this.haSocket!.send(
        JSON.stringify({ type: 'auth', access_token: config.token })
      );
    });
    this.haSocket.addEventListener('message', (ev) => {
      for (const client of this.clients) {
        try {
          client.send(ev.data);
        } catch {}
      }
    });
    this.haSocket.addEventListener('close', () => {
      logger.warn('HA socket closed');
      this.haSocket = undefined;
    });
    this.haSocket.addEventListener('error', () => {
      logger.error('HA socket error');
      this.haSocket = undefined;
    });
  }
}