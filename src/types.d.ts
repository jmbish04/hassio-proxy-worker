declare interface D1Database {
  prepare(query: string): {
    bind(...values: any[]): { run(): Promise<any> };
  };
}


interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  run(): Promise<D1Result>;
}

interface D1Result {
  success: boolean;
  meta: any;
  results: any[];
}


declare interface KVNamespace {
  get(key: string): Promise<any>;
  put(key: string, value: string): Promise<any>;
  delete(key: string): Promise<any>;
}


declare interface R2Bucket {
  put(key: string, value: string | Uint8Array | ArrayBuffer | ReadableStream): Promise<R2Object>;
  get(key: string): Promise<R2Object | null>;
  delete(key: string): Promise<void>;
}

interface R2Object {
  key: string;
  version: string;
  size: number;
  etag: string;
  httpEtag: string;
  checksums: R2Checksums;
  uploaded: Date;
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
}

interface R2Checksums {
  md5?: ArrayBuffer;
  sha1?: ArrayBuffer;
  sha256?: ArrayBuffer;
  sha384?: ArrayBuffer;
  sha512?: ArrayBuffer;
}


interface DurableObjectState {}

interface DurableObject {}

interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;

}

declare interface Ai {
  run(model: string, input: any): Promise<{ response: string }>;
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
