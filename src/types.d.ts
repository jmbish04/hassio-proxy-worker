declare interface D1Database {}
declare interface KVNamespace {
  get(key: string): Promise<any>;
  put(key: string, value: string): Promise<any>;
  delete(key: string): Promise<any>;
}
declare interface R2Bucket {}

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
