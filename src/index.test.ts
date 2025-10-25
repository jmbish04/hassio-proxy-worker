import { describe, expect, it, vi } from "vitest";
import type { ExecutionContext } from '@cloudflare/workers-types';

vi.mock("ai", () => ({
	generateText: async () => ({ text: "mocked summary" }),
}));

vi.mock('./lib/homeAssistantWs', () => ({
  getHaClient: () => ({
    getStates: async () => []
  })
}));

import worker from './index';
import type { Env } from './types';

// Typed mocks for bindings
const configKVStore: Record<string, string> = {};

const createKVMock = (store: Record<string, string> = {}) => ({
  async get(key: string) {
    return store[key] || null;
  },
  async put(key: string, value: string) {
    store[key] = value;
  },
  async delete(key: string) {
    delete store[key];
  }
});

const ctx = { waitUntil() {}, passThroughOnException() {}, props: {} } as unknown as ExecutionContext;

const bindings: Env = {
	D1_DB: {
		prepare() {
			return {
				bind() {
					return { async run() {} };
				},
			};
		},
	} as any,
	CONFIG_KV: createKVMock(configKVStore) as any,
	SESSIONS_KV: createKVMock() as any,
	CACHE_KV: createKVMock() as any,
	LOGS_BUCKET: { async put() {} } as any,
	AI: {
		async run(model: string) {
      if (model.includes('whisper')) return { text: 'hello' } as any;
      if (model.includes('gpt-4o-mini-tts')) return { audio_base64: 'fakeaudio' } as any;
      return { text: 'mocked summary' } as any;
    }
		} as any,
	WEBSOCKET_SERVER: {
		idFromName() {
			return {} as any;
		},
		get() {
			return {
				fetch: () => new Response("not implemented", { status: 501 }),
			} as any;
		},
	} as any,
	ASSETS: {
		async fetch() {
			return new Response("asset");
		},
	} as any,
	HASSIO_ENDPOINT_URI: "https://ha",
	HASSIO_TOKEN: "token",
	DEFAULT_TEXT_MODEL: "@cf/openai/gpt-oss-120b",
	DEFAULT_OBJECT_MODEL: "@cf/facebook/detr-resnet-50",
	DEFAULT_FACE_MODEL: "@cf/microsoft/resnet-50",
	DEFAULT_VISION_MODEL: "@cf/llava-hf/llava-1.5-7b-hf",
} as any;

describe("Alexa REST API scaffold", () => {
  it('responds to health check', async () => {
    const res = await worker.fetch(new Request('http://localhost/health'), bindings as any, ctx as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("generates AI summary", async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
			// Mock Home Assistant API calls that the new implementation makes
			if (url.includes('/api/states')) {
				return new Response(JSON.stringify([
					{
						entity_id: 'sensor.test1',
						state: 'unavailable',
						last_changed: '2025-08-25T10:00:00Z'
					},
					{
						entity_id: 'light.test2',
						state: 'on'
					}
				]), { status: 200 });
			}
			return new Response('Not found', { status: 404 });
		});

    const res = await worker.fetch(
      new Request("http://localhost/v1/ai/summary", { method: "POST" }),
      bindings as any,
      ctx as any,
    );
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.data).toEqual({
			text: "mocked summary",
			logAnalysis: expect.objectContaining({
				source: expect.any(String),
				summary: expect.any(String),
				errorCount: expect.any(Number),
				warningCount: expect.any(Number),
				uniqueErrorTypes: expect.any(Number),
				timeRange: expect.any(Object)
			})
		});

		globalThis.fetch = originalFetch;
	});

  it("proxies Home Assistant state", async () => {
    await (bindings.CONFIG_KV as any).put("instance:abc", JSON.stringify({
      baseUrl: "https://ha",
      token: "t",
    }));
		const originalFetch = globalThis.fetch;
		globalThis.fetch = async (url: any, init?: any) => {
			expect(url).toBe("https://ha/api/states/light.kitchen");
			expect(init.headers.Authorization).toBe("Bearer t");
			return new Response(JSON.stringify({ state: "on" }), { status: 200 });
		};

    const res = await worker.fetch(
      new Request("http://localhost/v1/ha/abc/states/light.kitchen"),
      bindings as any,
      ctx as any,
    );
		const data = await res.json();
		expect(data.data.state).toBe("on");
		globalThis.fetch = originalFetch;
	});

	it("validates WebSocket command is a JSON object", async () => {
		// Test with invalid input - string instead of object
    let res = await worker.fetch(
      new Request("http://localhost/v1/ha/ws", {
        method: "POST",
        body: JSON.stringify("invalid string")
      }),
      bindings as any,
      ctx as any,
    );
		expect(res.status).toBe(400);
		let data = await res.json();
		expect(data.ok).toBe(false);
		expect(data.error).toBe("Request body must be a JSON object");

		// Test with invalid input - array instead of object
    res = await worker.fetch(
      new Request("http://localhost/v1/ha/ws", {
        method: "POST",
        body: JSON.stringify(["invalid", "array"])
      }),
      bindings as any,
      ctx as any,
    );
		expect(res.status).toBe(400);
		data = await res.json();
		expect(data.ok).toBe(false);

		// Test with invalid input - null
    res = await worker.fetch(
      new Request("http://localhost/v1/ha/ws", {
        method: "POST",
        body: JSON.stringify(null)
      }),
      bindings as any,
      ctx as any,
    );
		expect(res.status).toBe(400);
		data = await res.json();
		expect(data.ok).toBe(false);
		expect(data.error).toBe("Request body must be a JSON object");
	});
});
