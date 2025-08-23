declare interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

declare interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  run(): Promise<D1Result>;
}

declare interface D1Result {
  success: boolean;
  meta: any;
}

declare interface KVNamespace {
  get(key: string): Promise<any>;
  put(key: string, value: string): Promise<any>;
  delete(key: string): Promise<any>;
}

declare interface R2Bucket {
  put(key: string, value: string | ArrayBuffer | Uint8Array): Promise<void>;
}

declare interface Ai {
  run(model: string, input: any): Promise<{ response: string }>;
}

interface DurableObjectId {}

interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

declare interface DurableObjectNamespace<T = any> {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

// Cloudflare Workers types
declare interface DurableObjectState {
  id: DurableObjectId;
  storage: DurableObjectStorage;
}

declare interface DurableObjectStorage {
  get(key: string): Promise<any>;
  put(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
}

declare interface DurableObject {
  fetch(request: Request): Promise<Response>;
}

declare class WebSocketPair {
  0: WebSocket;
  1: WebSocket;
  constructor();
}

// Extend ResponseInit to support webSocket for Workers
declare interface ResponseInit {
  webSocket?: WebSocket;
}

// Cloudflare Workers WebSocket extension
declare interface WebSocket {
  accept?(): void;
}
