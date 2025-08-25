/**
 * @file src/index.ts
 * @description This is the main entry point for the Cloudflare Worker.
 * It sets up a Hono web server to handle incoming HTTP requests,
 * proxies WebSocket connections to a Durable Object, serves static assets,
 * and provides health check and OpenAPI specification endpoints.
 * @module src/index
 */

import { Hono } from 'hono';
import { logger } from './lib/logger';
import { v1 } from './routes/v1';
export { HomeAssistantDurableObject as HomeAssistantWebSocket } from './durable-objects/homeAssistant';

/**
 * @interface Env
 * @description Defines the bindings and environment variables available to the Worker.
 * These are configured in the wrangler.toml file or the Cloudflare dashboard.
 * @property {D1Database} D1_DB - Binding for the D1 database.
 * @property {KVNamespace} CONFIG_KV - Key-Value namespace for configuration data.
 * @property {KVNamespace} SESSIONS_KV - Key-Value namespace for session storage.
 * @property {KVNamespace} CACHE_KV - Key-Value namespace for caching.
 * @property {R2Bucket} LOGS_BUCKET - Binding for the R2 bucket used for storing logs.
 * @property {Ai} AI - Binding for Cloudflare's AI services.
 * @property {DurableObjectNamespace} WEBSOCKET_SERVER - Namespace binding for the WebSocket Durable Object.
 * @property {Fetcher} ASSETS - Binding to the static assets service (for serving the frontend).
 * @property {string} HASSIO_ENDPOINT_URI - The endpoint URI for the Home Assistant instance.
 * @property {string} HASSIO_TOKEN - The long-lived access token for Home Assistant.
 */
export interface Env {
	D1_DB: D1Database;
	CONFIG_KV: KVNamespace;
	SESSIONS_KV: KVNamespace;
	CACHE_KV: KVNamespace;
	LOGS_BUCKET: R2Bucket;
	AI: Ai;
	WEBSOCKET_SERVER: DurableObjectNamespace;
	ASSETS: Fetcher;
	HASSIO_ENDPOINT_URI: string;
	HASSIO_TOKEN: string;
}

/**
 * @constant {number} startTime
 * @description Records the timestamp (in milliseconds) when the worker instance is initialized.
 * This is used to calculate the uptime of the worker instance.
 */
const startTime = Date.now();

/**
 * @constant {Hono} app
 * @description An instance of the Hono web framework, typed with the Worker's environment bindings.
 * This object is used to define routes and middleware for the application.
 */
const app = new Hono<{ Bindings: Env }>();

/**
 * @middleware
 * @description A simple logging middleware that logs the method and path of every incoming request.
 */
app.use('*', async (c, next) => {
	logger.debug('Request:', c.req.method, c.req.path);
	await next();
});

/**
 * @route {GET} /health
 * @description Provides a health check endpoint for monitoring the worker's status.
 * It returns the worker's uptime and a status indicating it's ready.
 * @returns {Response} JSON response with `ok`, `uptime`, and `env.ready` status.
 */
app.get('/health', (c) => {
	logger.debug('Handling /health');
	const uptime = (Date.now() - startTime) / 1000;
	return c.json({ ok: true, uptime, env: { ready: true } });
});

/**
 * @route {GET} /
 * @description Serves the main `index.html` page from the static assets service.
 * Provides a fallback text response if the asset fetch fails.
 * @returns {Promise<Response>} The HTML page or a plain text fallback.
 */
app.get('/', async (c) => {
	logger.debug('Handling root path');
	try {
		return await c.env.ASSETS.fetch(new Request(new URL('/index.html', c.req.url)));
	} catch (error) {
		logger.warn('Failed to fetch index.html, returning default text');
		return c.text('hassio-proxy-worker up. See /openapi.json and /v1/*');
	}
});

/**
 * @route {GET} /openapi.json
 * @description Serves a placeholder OpenAPI 3.1 specification for the API.
 * This provides a basic contract for the available API endpoints.
 * @returns {Response} JSON response containing the OpenAPI specification.
 */
app.get('/openapi.json', (c) => {
	logger.debug('Serving OpenAPI spec');
	const spec = {
		openapi: '3.1.0',
		info: {
			title: 'Alexa Skill REST API',
			version: '0.1.0',
			description:
				'Minimal Alexa-friendly API. All responses use { ok, speech, card?, data }. Stubbed for draft.',
		},
		servers: [{ url: 'https://example.workers.dev' }],
		paths: {
			'/v1/devices/scan': {
				post: {
					summary: 'Scan LAN and update device inventory (stub)',
					responses: { '200': { description: 'OK' } },
				},
			},
			'/v1/devices': {
				get: { summary: 'List devices (stub)', responses: { '200': { description: 'OK' } } },
			},
			'/v1/devices/{id}': {
				get: {
					summary: 'Get device detail (stub)',
					parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
					responses: { '200': { description: 'OK' } },
				},
			},
			'/v1/protect/sync': {
				post: { summary: 'Sync UniFi Protect cameras (stub)', responses: { '200': { description: 'OK' } } },
			},
			'/v1/protect/cameras': {
				get: { summary: 'List cameras (stub)', responses: { '200': { description: 'OK' } } },
			},
			'/v1/protect/cameras/{id}/snapshot': {
				post: {
					summary: 'Capture snapshot (stub)',
					parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
					responses: { '200': { description: 'OK' } },
				},
			},
		},
	};
	return c.json(spec);
});

/**
 * @description Mounts the v1 router group under the `/v1` path.
 * All routes defined in `src/routes/v1.ts` will be prefixed with `/v1`.
 */
app.route('/v1', v1);

/**
 * @route {GET} /ws/:instanceId
 * @description Handles WebSocket upgrade requests and proxies them to the appropriate
 * HomeAssistantWebSocket Durable Object instance based on the `instanceId`.
 * @param {string} instanceId - The unique identifier for the WebSocket instance.
 * @returns {Promise<Response>} A response that establishes the WebSocket connection via the Durable Object.
 */
app.get('/ws/:instanceId', (c) => {
	const { instanceId } = c.req.param();
	logger.debug('Proxying WebSocket for instance', instanceId);
	const id = c.env.WEBSOCKET_SERVER.idFromName(instanceId);
	const stub = c.env.WEBSOCKET_SERVER.get(id);
	return stub.fetch(c.req.raw);
});

/**
 * @default
 * @description The default export of the module, which is the Hono app instance.
 * The Cloudflare Workers runtime uses this to handle incoming fetch events.
 */
export default app;
