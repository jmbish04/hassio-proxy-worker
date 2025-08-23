/**
 * Home Assistant WebSocket client for Cloudflare Workers.
 *
 * This client wraps the Home Assistant WebSocket API allowing any supported
 * command to be issued and responses awaited. It authenticates using
 * `env.HASSIO_TOKEN` and connects to the instance configured by
 * `env.HASSIO_ENDPOINT_URI`.
 */

import type { Env } from '../index';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}

/**
 * `HaWebSocketClient` manages a persistent authenticated WebSocket connection
 * to a Home Assistant instance. Messages are automatically given unique IDs and
 * the corresponding responses are routed back to the caller.
 */
export class HaWebSocketClient {
  private socket?: WebSocket;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private authPromise?: Promise<void>;

  constructor(private readonly url: string, private readonly token: string) {}

  /**
   * Connects to the Home Assistant WebSocket API if not already connected.
   * The returned promise resolves once authentication succeeds.
   */
  private async connect(): Promise<void> {
    if (this.socket && this.socket.readyState <= 1) {
      return this.authPromise;
    }

    const wsUrl = this.url.replace(/^http/, 'ws') + '/api/websocket';
    this.socket = new WebSocket(wsUrl);

    this.authPromise = new Promise((resolve, reject) => {
      const sock = this.socket!;

      sock.addEventListener('open', () => {
        sock.send(JSON.stringify({ type: 'auth', access_token: this.token }));
      });

      sock.addEventListener('message', (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'auth_ok') {
            resolve();
            return;
          }
          if (typeof msg.id === 'number' && this.pending.has(msg.id)) {
            this.pending.get(msg.id)!.resolve(msg);
            this.pending.delete(msg.id);
          }
        } catch (err) {
          // ignore malformed messages
        }
      });

      const fail = (err: unknown) => {
        reject(err);
        this.socket = undefined;
        this.authPromise = undefined;

        // Reject all pending requests to prevent callers from hanging
        for (const p of this.pending.values()) {
          p.reject(err);
        }
        this.pending.clear();
      };

      sock.addEventListener('close', () => fail(new Error('socket closed')));
      sock.addEventListener('error', (ev) => fail(ev));
    });

    return this.authPromise;
  }

  /**
   * Sends an arbitrary command over the WebSocket connection.
   *
   * @param command Partial Home Assistant command object. The `id` field will
   *   be added automatically.
   * @returns The parsed response message from Home Assistant.
   */
  async send<T = unknown>(command: Record<string, unknown>): Promise<T> {
    await this.connect();
    const id = this.nextId++;
    const payload = { ...command, id };

    return new Promise<T>((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('socket not connected'));
        return;
      }
      this.pending.set(id, { resolve, reject });
      try {
        this.socket.send(JSON.stringify(payload));
      } catch (err) {
        this.pending.delete(id);
        reject(err);
      }
    });
  }

  /** Convenience wrapper for `call_service` commands. */
  callService(domain: string, service: string, serviceData?: Record<string, unknown>) {
    return this.send({
      type: 'call_service',
      domain,
      service,
      service_data: serviceData,
    });
  }

  /** Convenience wrapper for `get_states` command. */
  getStates() {
    return this.send({ type: 'get_states' });
  }

  /** Convenience wrapper for `get_services` command. */
  getServices() {
    return this.send({ type: 'get_services' });
  }

  /** Convenience wrapper for `get_config` command. */
  getConfig() {
    return this.send({ type: 'get_config' });
  }
}

let client: HaWebSocketClient | undefined;

/**
 * Returns a singleton `HaWebSocketClient` instance configured from environment
 * bindings. Subsequent calls reuse the existing connection.
 */
export function getHaClient(env: Env): HaWebSocketClient {
  if (!client) {
    client = new HaWebSocketClient(env.HASSIO_ENDPOINT_URI, env.HASSIO_TOKEN);
  }
  return client;
}

