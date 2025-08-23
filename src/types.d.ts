// Extend Cloudflare Workers types when needed
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
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

declare interface R2Bucket {
  put(key: string, value: string | Uint8Array | ReadableStream): Promise<R2Object>;
}

declare interface R2Object {
  key: string;
  size: number;
}

declare interface Ai {
  run(model: string, input: any): Promise<{ response: string }>;
}
