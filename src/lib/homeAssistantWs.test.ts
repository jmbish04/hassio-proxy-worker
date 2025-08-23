import { describe, it, expect, beforeEach } from 'vitest';
import { HaWebSocketClient } from './homeAssistantWs';

class MockSocket extends EventTarget {
  static instances: MockSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  private sentPromiseResolve?: () => void;
  private sentPromise?: Promise<void>;
  
  constructor(public url: string) {
    super();
    MockSocket.instances.push(this);
  }
  
  send(data: string) {
    this.sent.push(data);
    // Resolve any waiting promise when a message is sent
    if (this.sentPromiseResolve) {
      this.sentPromiseResolve();
      this.sentPromiseResolve = undefined;
      this.sentPromise = undefined;
    }
  }
  
  close() {
    this.readyState = 3;
  }
  
  // Helper method to wait for a message to be sent
  waitForSent(): Promise<void> {
    if (!this.sentPromise) {
      this.sentPromise = new Promise((resolve) => {
        this.sentPromiseResolve = resolve;
      });
    }
    return this.sentPromise;
  }
}

beforeEach(() => {
  MockSocket.instances = [];
  // @ts-ignore
  globalThis.WebSocket = MockSocket;
});

describe('HaWebSocketClient', () => {
  it('authenticates and returns responses', async () => {
    const client = new HaWebSocketClient('http://ha', 'abc');
    const resultPromise = client.getStates();
    const ws = MockSocket.instances[0];
    ws.readyState = 1;
    ws.dispatchEvent(new Event('open'));
    expect(JSON.parse(ws.sent[0])).toEqual({ type: 'auth', access_token: 'abc' });
    ws.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'auth_ok' }) }));
    await ws.waitForSent();
    const sent = JSON.parse(ws.sent[1]);
    expect(sent.type).toBe('get_states');
    const id = sent.id;
    ws.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({ id, type: 'result', result: [{ entity_id: 'light.kitchen' }] })
      })
    );
    const res = await resultPromise;
    expect(((res as HaResponseMessage).result as any[])[0].entity_id).toBe('light.kitchen');
  });

  it('sends call_service command', async () => {
    const client = new HaWebSocketClient('http://ha', 'abc');
    const resultPromise = client.callService('light', 'turn_on', { entity_id: 'light.kitchen' });
    const ws = MockSocket.instances[0];
    ws.readyState = 1;
    ws.dispatchEvent(new Event('open'));
    ws.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'auth_ok' }) }));
    await ws.waitForSent();
    const sent = JSON.parse(ws.sent[1]);
    expect(sent.type).toBe('call_service');
    expect(sent.domain).toBe('light');
    const id = sent.id;
    ws.dispatchEvent(
      new MessageEvent('message', { data: JSON.stringify({ id, type: 'result', success: true }) })
    );
    const res = await resultPromise;
    expect((res as HaResponseMessage).success).toBe(true);
  });
});

