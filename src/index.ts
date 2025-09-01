/**
 * @file src/index.ts
 * @description This is the main entry point for the Cloudflare Worker.
 * It sets up a Hono web server to handle incoming HTTP requests,
 * proxies WebSocket connections to a Durable Object, serves static assets,
 * and provides health check and OpenAPI specification endpoints.
 * @module src/index
 */

import { Hono } from "hono";
import { brainSweep } from "./lib/brain";
import { HaWebSocketClient } from "./lib/homeAssistantWs";
import { logger } from "./lib/logger";
import { v1 } from "./routes/v1";

// Export the Durable Object class with the name expected by wrangler.toml
export { HomeAssistantWebSocket } from "./durable-objects/homeAssistant";

/**
 * @interface WorkerEnv
 * @description Extends the generated Env interface with additional environment variables
 * specific to this worker.
 * @property {string} HASSIO_ENDPOINT_URI - The endpoint URI for the Home Assistant instance.
 * @property {string} HASSIO_TOKEN - The long-lived access token for Home Assistant.
 * @property {string} DEFAULT_TEXT_MODEL - The default AI model for text generation.
 * @property {string} DEFAULT_OBJECT_MODEL - The default AI model for object detection.
 * @property {string} DEFAULT_FACE_MODEL - The default AI model for face detection.
 * @property {string} DEFAULT_VISION_MODEL - The default AI model for vision analysis.
 */
export interface WorkerEnv
	extends Omit<
		Env,
		| "DEFAULT_TEXT_MODEL"
		| "DEFAULT_OBJECT_MODEL"
		| "DEFAULT_FACE_MODEL"
		| "DEFAULT_VISION_MODEL"
	> {
	HASSIO_ENDPOINT_URI: string;
	HASSIO_TOKEN: string;
	DEFAULT_TEXT_MODEL: string;
	DEFAULT_OBJECT_MODEL: string;
	DEFAULT_FACE_MODEL: string;
	DEFAULT_VISION_MODEL: string;
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
const app = new Hono<{ Bindings: WorkerEnv }>();

/**
 * @middleware
 * @description A simple logging middleware that logs the method and path of every incoming request.
 */
app.use("*", async (c, next) => {
	logger.debug("Request:", c.req.method, c.req.path);
	await next();
});

/**
 * @route {GET} /health
 * @description Provides a health check endpoint for monitoring the worker's status.
 * It returns the worker's uptime, status, and Home Assistant connectivity status.
 * @returns {Response} JSON response with `ok`, `uptime`, `env.ready`, and `homeAssistant` status.
 */
app.get("/health", async (c) => {
	logger.debug("Handling /health");
	const uptime = (Date.now() - startTime) / 1000;

	// Check if Home Assistant credentials are configured
	const hasCredentials = !!(c.env.HASSIO_ENDPOINT_URI && c.env.HASSIO_TOKEN);

	// Check Home Assistant REST API connectivity
	let restApiStatus = false;
	if (hasCredentials) {
		try {
			const restResponse = await fetch(`${c.env.HASSIO_ENDPOINT_URI}/api/`, {
				headers: {
					Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
					"Content-Type": "application/json",
				},
				signal: AbortSignal.timeout(5000), // 5 second timeout
			});
			restApiStatus = restResponse.ok;
		} catch (error) {
			logger.debug("Home Assistant REST API check failed:", error);
			restApiStatus = false;
		}
	}

	// Check Home Assistant WebSocket API connectivity
	let websocketApiStatus = false;
	if (hasCredentials) {
		try {
			// Create a fresh WebSocket client instance for health checks to avoid connection pooling issues
			const healthCheckClient = new HaWebSocketClient(
				c.env.HASSIO_ENDPOINT_URI,
				c.env.HASSIO_TOKEN,
			);
			const configResponse = await Promise.race([
				healthCheckClient.getConfig(),
				new Promise((_, reject) =>
					setTimeout(() => reject(new Error("WebSocket timeout")), 3000),
				),
			]);
			websocketApiStatus = !!configResponse;
		} catch (error) {
			logger.debug("Home Assistant WebSocket API check failed:", error);
			websocketApiStatus = false;
		}
	}

	return c.json({
		ok: true,
		uptime,
		env: { ready: true },
		homeAssistant: {
			restApi: restApiStatus,
			websocketApi: websocketApiStatus,
			configured: hasCredentials,
		},
	});
});

/**
 * @route {GET} /
 * @description Serves the main `index.html` page from the static assets service.
 * Provides a fallback text response if the asset fetch fails.
 * @returns {Promise<Response>} The HTML page or a plain text fallback.
 */
app.get("/", async (c) => {
	logger.debug("Handling root path");
	try {
		return await c.env.ASSETS.fetch(
			new Request(new URL("/index.html", c.req.url)),
		);
	} catch (error) {
		logger.warn(`Failed to fetch index.html, returning default text`, error);
		return c.text(
			`hassio-proxy-worker up. See /openapi.json and /v1/* for API documentation. Error details: ${error}`,
		);
	}
});

/**
 * @route {GET} /openapi.json
 * @description Serves the OpenAPI 3.1 specification from the static assets service.
 * @returns {Promise<Response>} The JSON file containing the OpenAPI specification.
 */
app.get("/openapi.json", async (c) => {
	logger.debug("Serving OpenAPI spec from ASSETS");
	try {
		// Forward the request to the ASSETS service to fetch the openapi.json file.
		return await c.env.ASSETS.fetch(
			new Request(new URL("/openapi.json", c.req.url)),
		);
	} catch (error) {
		// Log the error and return a 500 response if the asset cannot be fetched.
		logger.error("Failed to fetch openapi.json from ASSETS", error);
		return c.json(
			{ ok: false, error: "Failed to load OpenAPI specification." },
			500,
		);
	}
});

/**
 * @route {GET} /api/camera_proxy/:entity_id
 * @description Proxies camera image requests to Home Assistant
 * This allows the dashboard to display camera feeds by forwarding requests to HA
 * @param {string} entity_id - The camera entity ID (e.g., "camera.front_door")
 * @returns {Promise<Response>} The camera image from Home Assistant
 */
app.get("/api/camera_proxy/:entity_id", async (c) => {
	const { entity_id } = c.req.param();
	logger.debug("Proxying camera image for", entity_id);

	// Check if Home Assistant is configured
	if (!c.env.HASSIO_ENDPOINT_URI || !c.env.HASSIO_TOKEN) {
		return c.json({ ok: false, error: "Home Assistant not configured" }, 400);
	}

	try {
		// Forward the request to Home Assistant's camera proxy endpoint
		const response = await fetch(
			`${c.env.HASSIO_ENDPOINT_URI}/api/camera_proxy/${entity_id}`,
			{
				headers: {
					Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
				},
			},
		);

		if (!response.ok) {
			logger.debug(`Camera proxy failed for ${entity_id}: ${response.status}`);
			return new Response("Camera unavailable", { status: 404 });
		}

		// Return the image with appropriate headers
		return new Response(response.body, {
			headers: {
				"Content-Type": response.headers.get("Content-Type") || "image/jpeg",
				"Cache-Control": "no-cache",
			},
		});
	} catch (error) {
		logger.error("Camera proxy error:", error);
		return new Response("Camera error", { status: 500 });
	}
});

/**
 * @description Mounts the v1 router group under the `/v1` path.
 * All routes defined in `src/routes/v1.ts` will be prefixed with `/v1`.
 */
app.route("/v1", v1);

/**
 * @route {GET} /ws/:instanceId
 * @description Handles WebSocket upgrade requests and proxies them to the appropriate
 * HomeAssistantWebSocket Durable Object instance based on the `instanceId`.
 * @param {string} instanceId - The unique identifier for the WebSocket instance.
 * @returns {Promise<Response>} A response that establishes the WebSocket connection via the Durable Object.
 */
app.get("/ws/:instanceId", (c) => {
	const { instanceId } = c.req.param();
	logger.debug("Proxying WebSocket for instance", instanceId);
	const id = c.env.WEBSOCKET_SERVER.idFromName(instanceId);
	const stub = c.env.WEBSOCKET_SERVER.get(id);
	return stub.fetch(c.req.raw);
});

/**
 * @default
 * @description The default export of the module, which is an ExportedHandler object
 * that includes both fetch and scheduled handlers.
 * The Cloudflare Workers runtime uses this to handle incoming events.
 */
export default {
	async fetch(
		request: Request,
		env: WorkerEnv,
		ctx: ExecutionContext,
	): Promise<Response> {
		return app.fetch(request, env, ctx);
	},

	async scheduled(
		controller: ScheduledController,
		env: WorkerEnv,
		ctx: ExecutionContext,
	): Promise<void> {
		logger.info("🧠 Scheduled brain sweep triggered", {
			cron: controller.cron,
			scheduledTime: controller.scheduledTime,
		});

		// Run brain sweep in background
		ctx.waitUntil(
			brainSweep(env.D1_DB)
				.then((result) => {
					logger.info("🧠 Scheduled brain sweep completed", result);
				})
				.catch((error) => {
					logger.error("🧠 Scheduled brain sweep failed", error);
				}),
		);
	},
};
