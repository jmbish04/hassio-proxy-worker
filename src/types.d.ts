declare interface D1Database {
  prepare(query: string): {
    bind(...values: any[]): { run(): Promise<any> };
  };
}
declare interface KVNamespace {
  get(key: string): Promise<any>;
  put(key: string, value: string): Promise<any>;
  delete(key: string): Promise<any>;
}
declare interface R2Bucket {
  put(key: string, value: string | ArrayBuffer): Promise<void>;
}

declare interface Ai {
  run(model: string, input: any): Promise<{ response: string }>;
}

interface DurableObjectId {}

interface DurableObjectState {}

interface DurableObject {}

interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

declare interface DurableObjectNamespace<T = any> {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

declare class WebSocketPair {
  0: WebSocket;
  1: WebSocket;
}

// Extend Response to support webSocket property
interface ResponseInit {
  webSocket?: WebSocket;
}

// Extend WebSocket to support accept method for Workers
interface WebSocket {
  accept?(): void;
}
