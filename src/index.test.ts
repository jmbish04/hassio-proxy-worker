import { describe, expect, it, vi } from "vitest";

vi.mock("ai", () => ({
	generateText: async () => ({ text: "mocked summary" }),
}));

vi.mock('./lib/homeAssistantWs', () => ({
  getHaClient: () => ({
    getStates: async () => []
  })
}));

import app from './index';
import type { Env } from './types';

// Simple mocks for bindings with minimal type fixes
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
	CONFIG_KV: {
		store: {} as Record<string, string>,
		async get(key: string) {
			return (this as any).store[key];
		},
		async put(key: string, value: string) {
			(this as any).store[key] = value;
		},
		async delete(key: string) {
			delete (this as any).store[key];
		},
	} as any,
	SESSIONS_KV: { async get() {}, async put() {}, async delete() {} } as any,
	CACHE_KV: { async get() {}, async put() {}, async delete() {} } as any,
	LOGS_BUCKET: { async put() {} } as any,
	AI: {
		async run(model: string) {
      if (model.includes('whisper')) return { text: 'hello' } as any;
      if (model.includes('gpt-4o-mini-tts')) return { audio_base64: 'fakeaudio' } as any;
      return { response: 'diag' } as any;
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
};
const ctx = { waitUntil() {} } as any;

describe("Alexa REST API scaffold", () => {
	it("responds to health check", async () => {
		const res = await app.request("http://localhost/health", bindings, ctx);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.ok).toBe(true);
	});

	it("returns device scan results", async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
			if (url.includes('/api/states')) {
				return new Response(JSON.stringify([
					{
						entity_id: 'sensor.test1',
						state: 'on',
						attributes: { device_id: 'device1' }
					},
					{
						entity_id: 'light.test2',
						state: 'off',
						attributes: { device_id: 'device2' }
					},
					{
						entity_id: 'switch.test3',
						state: 'on',
						attributes: { unique_id: 'device1' } // Should not create duplicate
					}
				]), { status: 200 });
			}
			return new Response('Not found', { status: 404 });
		});

		const res = await app.request(
			new Request("http://localhost/v1/devices/scan", { method: "POST" }),
			bindings,
			ctx,
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.ok).toBe(true);
		expect(data.data).toEqual({
			added: 0,
			updated: 2, // 2 unique devices from mock
			total: 2,
			entities: 3, // 3 entities from mock
			domains: { sensor: 1, light: 1, switch: 1 },
			summary: "Found 3 entities across 3 domains",
			reportUrl: null,
		});

		globalThis.fetch = originalFetch;
	});

	it("accepts log webhook", async () => {
		const res = await app.request(
			new Request("http://localhost/v1/webhooks/logs", {
				method: "POST",
				body: JSON.stringify({ level: "ERROR", message: "fail" }),
			}),
			bindings,
			ctx,
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.ok).toBe(true);
		expect(data.data?.key).toBeDefined();
	});

	it("stores and retrieves worker state", async () => {
		const putRes = await app.request(
			new Request("http://localhost/v1/worker/state/test", { method: "PUT", body: "value" }),
			bindings,
			ctx,
		);
		expect(putRes.status).toBe(200);

		const res = await app.request(new Request("http://localhost/v1/worker/state/test"), bindings, ctx);
		const data = await res.json();
		expect(data.data).toEqual({ key: "test", value: "value" });
	});

  it('handles voice interaction', async () => {
    const res = await app.request(
      '/v1/ai/voice',
      { method: 'POST', body: JSON.stringify({ audio: 'abc' }) },
      bindings,
      ctx
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.transcript).toBe('hello');
    expect(data.data.audio).toBe('fakeaudio');
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

		const res = await app.request(
			new Request("http://localhost/v1/ai/summary", { method: "POST" }),
			bindings,
			ctx,
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
		(bindings.CONFIG_KV as any).store["instance:abc"] = JSON.stringify({
			baseUrl: "https://ha",
			token: "t",
		});
		const originalFetch = globalThis.fetch;
		globalThis.fetch = async (url: any, init?: any) => {
			expect(url).toBe("https://ha/api/states/light.kitchen");
			expect(init.headers.Authorization).toBe("Bearer t");
			return new Response(JSON.stringify({ state: "on" }), { status: 200 });
		};

		const res = await app.request(
			new Request("http://localhost/v1/ha/abc/states/light.kitchen"),
			bindings,
			ctx,
		);
		const data = await res.json();
		expect(data.data.state).toBe("on");
		globalThis.fetch = originalFetch;
	});

	it("validates WebSocket command is a JSON object", async () => {
		// Test with invalid input - string instead of object
		let res = await app.request(
			new Request("http://localhost/v1/ha/ws", {
				method: "POST",
				body: JSON.stringify("invalid string")
			}),
			bindings,
			ctx,
		);
		expect(res.status).toBe(400);
		let data = await res.json();
		expect(data.ok).toBe(false);
		expect(data.error).toBe("Request body must be a JSON object");

		// Test with invalid input - array instead of object
		res = await app.request(
			new Request("http://localhost/v1/ha/ws", {
				method: "POST",
				body: JSON.stringify(["invalid", "array"])
			}),
			bindings,
			ctx,
		);
		expect(res.status).toBe(400);
		data = await res.json();
		expect(data.ok).toBe(false);

		// Test with invalid input - null
		res = await app.request(
			new Request("http://localhost/v1/ha/ws", {
				method: "POST",
				body: JSON.stringify(null)
			}),
			bindings,
			ctx,
		);
		expect(res.status).toBe(400);
		data = await res.json();
		expect(data.ok).toBe(false);
		expect(data.error).toBe("Request body must be a JSON object");
	});
});
