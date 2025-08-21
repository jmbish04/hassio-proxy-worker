import type { Env } from '../index';

export class HomeAssistantWebSocket implements DurableObject {
  private readonly state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected websocket', { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    // TODO: Bridge messages to Home Assistant websocket API
    server.addEventListener('message', (ev) => {
      // For now echo back
      server.send(ev.data);
    });

    return new Response(null, { status: 101, webSocket: client });
  }
}
