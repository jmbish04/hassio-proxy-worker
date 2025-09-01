/**
 * @file src/index.ts
 * @description This is the main entry point for the Cloudflare Worker.
 * It sets up a Hono web server to handle incoming HTTP requests,
 * proxies WebSocket connections to a Durable Object, serves static assets,
 * and provides health check and OpenAPI specification endpoints.
 * @module src/index
 */

import { Hono } from 'hono';
import { v1 } from './routes/v1';
import type { Env } from './types';
import { logger } from './lib/logger';


// Export the Durable Object class with the name expected by wrangler.toml
export { HomeAssistantWebSocket } from './durable-objects/homeAssistant';



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
 * @description Serves the OpenAPI 3.1 specification from the static assets service.
 * @returns {Promise<Response>} The JSON file containing the OpenAPI specification.
 */
app.get('/openapi.json', async (c) => {
	logger.debug('Serving OpenAPI spec from ASSETS');
	try {
		// Forward the request to the ASSETS service to fetch the openapi.json file.
		return await c.env.ASSETS.fetch(new Request(new URL('/openapi.json', c.req.url)));
	} catch (error) {
		// Log the error and return a 500 response if the asset cannot be fetched.
		logger.error('Failed to fetch openapi.json from ASSETS', error);
		return c.json({ ok: false, error: 'Failed to load OpenAPI specification.' }, 500);
	}
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
