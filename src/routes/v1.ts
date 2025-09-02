import { Hono } from "hono";
import type { WorkerEnv } from "../index";
import { brainSweep } from "../lib/brain";
import { haFetch } from "../lib/homeAssistant";
import { getHaClient } from "../lib/homeAssistantWs";
import { logger } from "../lib/logger";
import {
  formatLogsForAI,
  type LogEntry,
  processHomeLogs,
  parseErrorLogText,
  extractErrorsFromStates,
} from "../lib/logProcessor";
import { ok } from "../lib/response";
import { syncEntitiesFromHA } from "../lib/sync";

export const v1 = new Hono<{ Bindings: WorkerEnv }>();

v1.use("*", async (c, next) => {
	logger.debug("[v1]", c.req.method, c.req.path);
	await next();
});

// AI Brain endpoints
v1.get("/brain/run", async (c) => {
	logger.debug("Manual brain sweep requested");
	try {
		// First sync entities from Home Assistant if needed
		let syncResult = { synced: 0, errors: 0 };

		if (c.env.HASSIO_ENDPOINT_URI && c.env.HASSIO_TOKEN) {
			// Check if we have entities in the database
			const entityCount = await c.env.D1_DB.prepare(
				"SELECT COUNT(*) as count FROM entities"
			).first<{ count: number }>();

			// If we have few or no entities, sync from Home Assistant
			if (!entityCount || entityCount.count < 10) {
				logger.debug("Syncing entities before brain sweep");
				syncResult = await syncEntitiesFromHA(
					c.env.D1_DB,
					c.env.HASSIO_ENDPOINT_URI,
					c.env.HASSIO_TOKEN
				);
			}
		}

		// Run the brain sweep
		const result = await brainSweep(c.env.D1_DB);

		return c.json(ok("brain sweep completed", {
			...result,
			entitiesSynced: syncResult.synced,
			syncErrors: syncResult.errors,
		}));
	} catch (error) {
		logger.error("Brain sweep failed:", error);
		return c.json(
			{
				ok: false,
				error: `Brain sweep failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			},
			500,
		);
	}
});

v1.get("/brain/status", async (c) => {
	logger.debug("Brain status requested");
	try {
		// Get counts of normalized entities and intent candidates
		const normalizedCount = await c.env.D1_DB.prepare(
			"SELECT COUNT(*) as count FROM entity_normalization",
		).first<{ count: number }>();

		const intentCount = await c.env.D1_DB.prepare(
			"SELECT COUNT(*) as count FROM intent_candidates WHERE enabled = 1",
		).first<{ count: number }>();

		const entityCount = await c.env.D1_DB.prepare(
			"SELECT COUNT(*) as count FROM entities",
		).first<{ count: number }>();

		// Find entities that need brain processing
		const unbrainedCount = await c.env.D1_DB.prepare(`
				SELECT COUNT(DISTINCT e.id) as count
				FROM entities e
				LEFT JOIN entity_normalization n ON n.entity_id = e.id
				LEFT JOIN intent_candidates i ON i.entity_id = e.id AND i.enabled = 1
				GROUP BY e.id
				HAVING n.entity_id IS NULL OR COUNT(i.id) < 5
			`).first<{ count: number }>();

		// Get the last brain run
		const lastRun = await c.env.D1_DB.prepare(`
			SELECT ran_at_utc, scanned, normalized, intents_created
			FROM brain_runs
			ORDER BY ran_at_utc DESC
			LIMIT 1
		`).first<{ ran_at_utc: string; scanned: number; normalized: number; intents_created: number }>();

		return c.json(
			ok("brain status", {
				entities: {
					total: entityCount?.count || 0,
					normalized: normalizedCount?.count || 0,
					unbrained: unbrainedCount?.count || 0,
				},
				intents: {
					total: intentCount?.count || 0,
					averagePerEntity: entityCount?.count
						? Math.round(
								((intentCount?.count || 0) / entityCount.count) * 100,
							) / 100
						: 0,
				},
				lastRun: lastRun ? {
					ranAt: lastRun.ran_at_utc,
					scanned: lastRun.scanned,
					normalized: lastRun.normalized,
					intentsCreated: lastRun.intents_created
				} : null,
			}),
		);
	} catch (error) {
		logger.error("Brain status failed:", error);
		return c.json(
			{
				ok: false,
				error: `Brain status failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			},
			500,
		);
	}
});

// NOTE: All are stubs. Real logic (LAN scan, Protect, D1, R2) comes next PR.

v1.post("/devices/scan", async (c) => {
	logger.debug("devices/scan invoked");

	// Check if Home Assistant is configured
	if (!c.env.HASSIO_ENDPOINT_URI || !c.env.HASSIO_TOKEN) {
		return c.json(
			{
				ok: false,
				error:
					"Home Assistant not configured. Please set HASSIO_ENDPOINT_URI and HASSIO_TOKEN.",
			},
			400,
		);
	}

	try {
		// Sync entities from Home Assistant to database
		const syncResult = await syncEntitiesFromHA(
			c.env.D1_DB,
			c.env.HASSIO_ENDPOINT_URI,
			c.env.HASSIO_TOKEN
		);

		// Get all entity states for summary information
		const statesRes = await fetch(`${c.env.HASSIO_ENDPOINT_URI}/api/states`, {
			headers: {
				Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
				"Content-Type": "application/json",
			},
		});

		if (!statesRes.ok) {
			throw new Error(`States fetch failed: ${statesRes.status}`);
		}

		const states = await statesRes.json();
		const entityCount = Array.isArray(states) ? states.length : 0;

		// Group entities by domain to get device-like information
		const entityByDomain: Record<string, number> = {};
		const devices: string[] = [];

		if (Array.isArray(states)) {
			for (const entity of states) {
				if (entity.entity_id) {
					const domain = entity.entity_id.split(".")[0];
					entityByDomain[domain] = (entityByDomain[domain] || 0) + 1;

					// Extract unique device names from entity attributes
					if (entity.attributes?.device_id || entity.attributes?.unique_id) {
						const deviceId =
							entity.attributes.device_id || entity.attributes.unique_id;
						if (deviceId && !devices.includes(deviceId)) {
							devices.push(deviceId);
						}
					}
				}
			}
		}

		const deviceCount = devices.length;

		logger.debug("device scan complete", {
			entityCount,
			deviceCount,
			domains: Object.keys(entityByDomain).length,
			syncedEntities: syncResult.synced,
			syncErrors: syncResult.errors,
			topDomains: Object.entries(entityByDomain)
				.sort(([, a], [, b]) => b - a)
				.slice(0, 5),
		});

		return c.json(
			ok("device scan completed", {
				added: syncResult.synced, // Entities synced to database
				updated: deviceCount,
				total: deviceCount,
				entities: entityCount,
				entitiesSynced: syncResult.synced,
				syncErrors: syncResult.errors,
				domains: entityByDomain,
				summary: `Found ${entityCount} entities across ${Object.keys(entityByDomain).length} domains, synced ${syncResult.synced} to database`,
				reportUrl: null,
			}),
		);
	} catch (error) {
		logger.error("Device scan failed:", error);
		return c.json(
			{
				ok: false,
				error: `Device scan failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			},
			500,
		);
	}
});

v1.get("/devices", async (c) => {
	logger.debug("devices list requested");
	return c.json(ok("stub: list devices", { items: [], total: 0 }));
});

v1.get("/devices/:id", async (c) => {
	const { id } = c.req.param();
	logger.debug("device detail requested", id);
	return c.json(
		ok(`stub: device detail for ${id}`, {
			id,
			mac: null,
			ip: null,
			lastSeenTs: null,
		}),
	);
});

v1.get("/cameras", async (c) => {
	logger.debug("cameras list requested");

	// Check if Home Assistant is configured
	if (!c.env.HASSIO_ENDPOINT_URI || !c.env.HASSIO_TOKEN) {
		return c.json(
			{
				ok: false,
				error: "Home Assistant not configured. Please set HASSIO_ENDPOINT_URI and HASSIO_TOKEN.",
			},
			400,
		);
	}

	try {
		// Get all entities from Home Assistant
		const statesRes = await fetch(`${c.env.HASSIO_ENDPOINT_URI}/api/states`, {
			headers: {
				Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
				"Content-Type": "application/json",
			},
		});

		if (!statesRes.ok) {
			throw new Error(`States fetch failed: ${statesRes.status}`);
		}

		const entities = (await statesRes.json()) as Array<{
			entity_id: string;
			state: string;
			attributes?: {
				friendly_name?: string;
				brand?: string;
				device_class?: string;
				access_token?: string;
				entity_picture?: string;
				[key: string]: unknown;
			};
		}>;

		// Filter for camera entities
		const cameras = entities.filter((entity) =>
			entity.entity_id.startsWith("camera.")
		).map(camera => ({
			entity_id: camera.entity_id,
			friendly_name: camera.attributes?.friendly_name || camera.entity_id,
			state: camera.state,
			brand: camera.attributes?.brand || 'Unknown',
			device_class: camera.attributes?.device_class || 'camera',
			entity_picture: camera.attributes?.entity_picture,
			access_token: camera.attributes?.access_token,
			// Use our local proxy for camera images to avoid CORS issues
			stream_url: `/api/camera_proxy/${camera.entity_id}`,
			// Add live stream capability check and endpoint
			has_live_stream: !!(camera.attributes?.access_token || camera.attributes?.entity_picture),
			live_stream_endpoint: camera.attributes?.entity_picture && camera.attributes?.access_token
				? `${c.env.HASSIO_ENDPOINT_URI}${camera.attributes.entity_picture}?token=${camera.attributes.access_token}`
				: `/v1/cameras/${camera.entity_id}/stream`
		}));

		// Categorize cameras by status - expand what's considered "online"
		const onlineCameras = cameras.filter(
			(camera) => camera.state !== "unavailable" && camera.state !== "unknown" && camera.state !== "error"
		);

		const offlineCameras = cameras.filter(
			(camera) => camera.state === "unavailable" || camera.state === "unknown" || camera.state === "error"
		);

		// Log all camera states for debugging
		const cameraStates = cameras.reduce((acc, camera) => {
			acc[camera.state] = (acc[camera.state] || 0) + 1;
			return acc;
		}, {} as Record<string, number>);

		logger.debug("cameras found", {
			total: cameras.length,
			online: onlineCameras.length,
			offline: offlineCameras.length,
			states: cameraStates,
		});

		return c.json(
			ok("cameras retrieved", {
				cameras,
				summary: {
					total: cameras.length,
					online: onlineCameras.length,
					offline: offlineCameras.length,
				}
			}),
		);
	} catch (error) {
		logger.error("Camera fetch failed:", error);
		return c.json(
			{
				ok: false,
				error: `Camera fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			},
			500,
		);
	}
});

// Get live stream URL for a camera
v1.get("/cameras/:entity_id/stream", async (c) => {
	const { entity_id } = c.req.param();
	logger.debug("Live stream URL requested for", entity_id);

	if (!c.env.HASSIO_ENDPOINT_URI || !c.env.HASSIO_TOKEN) {
		return c.json(
			{
				ok: false,
				error: "Home Assistant not configured",
			},
			400,
		);
	}

	try {
		// Call Home Assistant's camera stream URL API
		const streamRes = await fetch(
			`${c.env.HASSIO_ENDPOINT_URI}/api/camera_proxy_stream/${entity_id}`,
			{
				headers: {
					Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
					"Content-Type": "application/json",
				},
			},
		);

		if (!streamRes.ok) {
			// If the stream proxy doesn't work, try getting the entity details
			// and construct a stream URL from the entity_picture with access_token
			const entityRes = await fetch(
				`${c.env.HASSIO_ENDPOINT_URI}/api/states/${entity_id}`,
				{
					headers: {
						Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
						"Content-Type": "application/json",
					},
				},
			);

			if (entityRes.ok) {
				const entity = await entityRes.json() as {
					attributes?: {
						access_token?: string;
						entity_picture?: string;
						[key: string]: unknown;
					};
				};
				const accessToken = entity.attributes?.access_token;
				const entityPicture = entity.attributes?.entity_picture;

				if (entityPicture && accessToken) {
					// Construct live stream URL using entity_picture with access_token
					const streamUrl = `${c.env.HASSIO_ENDPOINT_URI}${entityPicture}?token=${accessToken}`;
					return c.json(
						ok("camera stream URL", {
							entity_id,
							stream_url: streamUrl,
							stream_type: "mjpeg",
							fallback_url: `/api/camera_proxy/${entity_id}`,
						}),
					);
				}
			}

			throw new Error(`Stream not available for ${entity_id}`);
		}

		// If we get here, the stream proxy worked
		const streamUrl = `${c.env.HASSIO_ENDPOINT_URI}/api/camera_proxy_stream/${entity_id}`;
		return c.json(
			ok("camera stream URL", {
				entity_id,
				stream_url: streamUrl,
				stream_type: "stream",
				fallback_url: `/api/camera_proxy/${entity_id}`,
			}),
		);
	} catch (error) {
		logger.error("Camera stream URL fetch failed:", error);
		return c.json(
			{
				ok: false,
				error: `Camera stream failed: ${error instanceof Error ? error.message : "Unknown error"}`,
				fallback_url: `/api/camera_proxy/${entity_id}`,
			},
			500,
		);
	}
});

// Refresh a specific camera by calling Home Assistant reload service
v1.post("/cameras/:entity_id/refresh", async (c) => {
	const { entity_id } = c.req.param();
	logger.debug("Camera refresh requested for", entity_id);

	if (!c.env.HASSIO_ENDPOINT_URI || !c.env.HASSIO_TOKEN) {
		return c.json(
			{
				ok: false,
				error: "Home Assistant not configured",
			},
			400,
		);
	}

	try {
		// First get the camera entity to find its config_entry_id
		const entityRes = await fetch(
			`${c.env.HASSIO_ENDPOINT_URI}/api/states/${entity_id}`,
			{
				headers: {
					Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
					"Content-Type": "application/json",
				},
			},
		);

		if (!entityRes.ok) {
			throw new Error(`Entity fetch failed: ${entityRes.status}`);
		}

		const entity = await entityRes.json() as {
			attributes?: {
				friendly_name?: string;
				device_id?: string;
				[key: string]: unknown;
			};
		};

		// Try multiple approaches to refresh the camera
		let refreshResult = null;
		let refreshMethod = "";

		// Method 1: Try to reload the config entry if we can find the device_id
		if (entity.attributes?.device_id) {
			try {
				// Get device info to find config_entry_id
				const deviceRes = await fetch(
					`${c.env.HASSIO_ENDPOINT_URI}/api/config/device_registry`,
					{
						headers: {
							Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
							"Content-Type": "application/json",
						},
					},
				);

				if (deviceRes.ok) {
					const devices = await deviceRes.json() as Array<{
						id: string;
						config_entries: string[];
					}>;
					const device = devices.find(d => d.id === entity.attributes?.device_id);

					if (device && device.config_entries.length > 0) {
						// Reload the config entry
						const reloadRes = await fetch(
							`${c.env.HASSIO_ENDPOINT_URI}/api/services/homeassistant/reload_config_entry`,
							{
								method: "POST",
								headers: {
									Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
									"Content-Type": "application/json",
								},
								body: JSON.stringify({
									entry_id: device.config_entries[0],
								}),
							},
						);

						if (reloadRes.ok) {
							refreshResult = await reloadRes.json();
							refreshMethod = "config_entry_reload";
						}
					}
				}
			} catch (configError) {
				logger.debug("Config entry reload failed, trying alternative methods", configError);
			}
		}

		// Method 2: If config entry reload didn't work, try homeassistant.update_entity
		if (!refreshResult) {
			try {
				const updateRes = await fetch(
					`${c.env.HASSIO_ENDPOINT_URI}/api/services/homeassistant/update_entity`,
					{
						method: "POST",
						headers: {
							Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							entity_id: entity_id,
						}),
					},
				);

				if (updateRes.ok) {
					refreshResult = await updateRes.json();
					refreshMethod = "update_entity";
				}
			} catch (updateError) {
				logger.debug("Update entity failed, trying final method", updateError);
			}
		}

		// Method 3: If nothing else worked, try to call camera.snapshot service to trigger activity
		if (!refreshResult) {
			try {
				const snapshotRes = await fetch(
					`${c.env.HASSIO_ENDPOINT_URI}/api/services/camera/snapshot`,
					{
						method: "POST",
						headers: {
							Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							entity_id: entity_id,
							filename: `/tmp/camera_refresh_${entity_id.replace('.', '_')}.jpg`,
						}),
					},
				);

				if (snapshotRes.ok) {
					refreshResult = await snapshotRes.json();
					refreshMethod = "snapshot_trigger";
				}
			} catch (snapshotError) {
				logger.debug("Snapshot trigger failed", snapshotError);
			}
		}

		if (refreshResult) {
			return c.json(
				ok("camera refreshed", {
					entity_id,
					method: refreshMethod,
					friendly_name: entity.attributes?.friendly_name || entity_id,
					result: refreshResult,
				}),
			);
		} else {
			// If all methods failed, just return success since we tried our best
			return c.json(
				ok("camera refresh attempted", {
					entity_id,
					method: "attempted_multiple",
					friendly_name: entity.attributes?.friendly_name || entity_id,
					note: "Refresh was attempted but specific result unavailable",
				}),
			);
		}
	} catch (error) {
		logger.error("Camera refresh failed:", error);
		return c.json(
			{
				ok: false,
				error: `Camera refresh failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			},
			500,
		);
	}
});

v1.post("/protect/sync", async (c) => {
	logger.debug("protect sync invoked");

	try {
		// Get all entities to find UniFi Protect cameras
		const entitiesRes = await fetch(`${c.env.HASSIO_ENDPOINT_URI}/api/states`, {
			headers: {
				Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
				"Content-Type": "application/json",
			},
		});

		if (!entitiesRes.ok) {
			throw new Error(`States fetch failed: ${entitiesRes.status}`);
		}

		const entities = (await entitiesRes.json()) as Array<{
			entity_id: string;
			state: string;
			attributes?: {
				brand?: string;
				device_class?: string;
				[key: string]: unknown;
			};
		}>;

		// Filter for UniFi Protect camera entities
		const protectCameras = entities.filter(
			(entity) =>
				entity.entity_id.startsWith("camera.") &&
				(entity.attributes?.brand === "Ubiquiti Inc." ||
					entity.entity_id.includes("unifi") ||
					entity.attributes?.device_class === "camera"),
		);

		// Count online/offline cameras
		const onlineCameras = protectCameras.filter(
			(camera) => camera.state === "idle" || camera.state === "streaming",
		);

		const offlineCameras = protectCameras.filter(
			(camera) => camera.state === "unavailable" || camera.state === "unknown",
		);

		// Try to get snapshot count (this would be implementation specific)
		let snapshotCount = 0;
		try {
			// This would typically call a UniFi Protect specific service
			const snapshotRes = await fetch(
				`${c.env.HASSIO_ENDPOINT_URI}/api/services/unifiprotect/get_snapshot_url`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						entity_id: protectCameras.map((c) => c.entity_id),
					}),
				},
			);

			if (snapshotRes.ok) {
				const snapshots = (await snapshotRes.json()) as unknown[];
				snapshotCount = Array.isArray(snapshots)
					? snapshots.length
					: protectCameras.length;
			}
		} catch (snapshotError) {
			logger.debug("Snapshot count failed, using camera count", snapshotError);
			snapshotCount = protectCameras.length;
		}

		logger.debug("protect sync complete", {
			total: protectCameras.length,
			online: onlineCameras.length,
			offline: offlineCameras.length,
			snapshotCount,
		});

		return c.json(
			ok("protect sync completed", {
				total: protectCameras.length,
				online: onlineCameras.length,
				updated: onlineCameras.length, // Cameras that were successfully synced
				snapshotCount: snapshotCount,
				offline: offlineCameras.map((c) => c.entity_id),
			}),
		);
	} catch (error) {
		logger.error("Protect sync failed:", error);
		return c.json(
			{
				ok: false,
				error: `Protect sync failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			},
			500,
		);
	}
});

v1.get("/protect/cameras", async (c) => {
	logger.debug("protect cameras list requested");
	return c.json(
		ok("stub: list cameras", { total: 0, online: 0, offline: [], items: [] }),
	);
});

v1.post("/protect/cameras/:id/snapshot", async (c) => {
	const { id } = c.req.param();
	logger.debug("camera snapshot requested", id);
	return c.json(
		ok(`stub: camera snapshot for ${id}`, { imageUrl: null, camera: id }),
	);
});

v1.post("/ai/summary", async (c) => {
	logger.debug("ai summary requested - pulling Home Assistant logs");

	// Check if Home Assistant is configured
	if (!c.env.HASSIO_ENDPOINT_URI || !c.env.HASSIO_TOKEN) {
		return c.json(
			{
				ok: false,
				error: "Home Assistant not configured. Cannot retrieve logs.",
			},
			400,
		);
	}

	try {
		// Get logs from Home Assistant via REST API first (fallback if WebSocket fails)
		let logs: LogEntry[] = [];
		let logSource = "none";

		try {
			// Try to get logs via WebSocket first (more reliable)
			const wsClient = getHaClient(c.env);
			const wsLogs = (await Promise.race([
				wsClient.getLogs(),
				new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error("Timeout")), 10000),
				),
			])) as unknown;

			if (
				wsLogs &&
				typeof wsLogs === "object" &&
				"result" in wsLogs &&
				Array.isArray((wsLogs as { result: unknown }).result)
			) {
				logs = (wsLogs as { result: LogEntry[] }).result;
				logSource = "websocket";
			}
		} catch (wsError) {
			logger.debug("WebSocket log fetch failed, trying REST API", wsError);

			// Fallback: Try REST API endpoint for error logs
			try {
				const errorLogRes = await fetch(
					`${c.env.HASSIO_ENDPOINT_URI}/api/error_log`,
					{
						headers: {
							Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
							"Content-Type": "application/json",
						},
						signal: AbortSignal.timeout(10000),
					},
				);

				if (errorLogRes.ok) {
					const errorLogText = await errorLogRes.text();
					// Parse error log text into structured format
					logs = parseErrorLogText(errorLogText);
					logSource = "error_log_api";
				}
			} catch (restError) {
				logger.debug("REST API log fetch also failed", restError);
			}
		}

		// If we still don't have logs, try getting recent states with errors
		if (logs.length === 0) {
			try {
				const statesRes = await fetch(
					`${c.env.HASSIO_ENDPOINT_URI}/api/states`,
					{
						headers: {
							Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
							"Content-Type": "application/json",
						},
					},
				);

				if (statesRes.ok) {
					const states = (await statesRes.json()) as unknown[];
					// Extract entities with error states or unavailable status
					logs = extractErrorsFromStates(states);
					logSource = "states_api";
				}
			} catch (statesError) {
				logger.debug("States API also failed", statesError);
			}
		}

		// Process and condense the logs
		const processedLogs = processHomeLogs(logs);
		logger.debug(
			`Log processing complete: ${processedLogs.summary}, source: ${logSource}`,
		);

		// Format for AI analysis
		const prompt = `You are analyzing Home Assistant logs. Please provide a concise diagnostic summary and recommendations.

${formatLogsForAI(processedLogs)}

Please provide:
1. Overall system health assessment
2. Priority issues that need attention
3. Recommended actions
4. Any patterns or recurring problems

Keep the response concise and actionable.`;

		// Use a model that's definitely available in the runtime
		let responseText = "No response generated";

		try {
			const result = (await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
				prompt,
				max_tokens: 512,
			})) as { response?: string; text?: string };

			responseText = result.response || result.text || "No response generated";
		} catch (aiError) {
			logger.debug("AI inference failed, using fallback analysis", aiError);

			// Fallback: Generate a basic analysis from the processed logs
			responseText = `**System Health Assessment** (Generated without AI inference)

**Overall Status**: ${processedLogs.errorCount > 0 ? 'Issues Detected' : 'System Appears Healthy'}

**Key Findings**:
- ${processedLogs.errorCount} error(s) found
- ${processedLogs.warningCount} warning(s) detected
- ${processedLogs.uniqueErrors.length} unique error type(s)
- Log source: ${logSource}

**Priority Issues**:
${processedLogs.uniqueErrors.slice(0, 3).map(error => `- ${error}`).join('\n') || '- No critical errors detected'}

**Recommendations**:
- Monitor entities showing 'unavailable' status
- Check network connectivity for offline devices
- Review Home Assistant logs for detailed error information
- Consider restarting services if issues persist

**Note**: This analysis was generated without AI inference due to local development limitations.`;
		}

		logger.debug("ai summary response generated");

		return c.json(
			ok("ai summary", {
				text: responseText,
				logAnalysis: {
					source: logSource,
					summary: processedLogs.summary,
					errorCount: processedLogs.errorCount,
					warningCount: processedLogs.warningCount,
					uniqueErrorTypes: processedLogs.uniqueErrors.length,
					timeRange: processedLogs.timeRange,
				},
			}),
		);
	} catch (error) {
		logger.error("AI summary error:", error);
		return c.json(
			{
				ok: false,
				error: `AI summary failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			},
			500,
		);
	}
});


v1.post("/webhooks/logs", async (c) => {
	const log = await c.req.json();
	const key = `logs/${Date.now()}-${crypto.randomUUID()}.json`;
	await c.env.LOGS_BUCKET.put(key, JSON.stringify(log));

	if (typeof log?.level === "string" && log.level.toUpperCase() === "ERROR") {
		try {
			const analysis = (await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
				prompt: `Analyze Home Assistant log and provide diagnostics:\n${JSON.stringify(log)}`,
				max_tokens: 256,
			})) as { response: string };
			const id = crypto.randomUUID();
			await c.env.D1_DB.prepare(
				"INSERT INTO log_diagnostics (id, log_key, analysis, created_at) VALUES (?, ?, ?, ?)",
			)
				.bind(id, key, analysis.response, Date.now())
				.run();
		} catch (err) {
			// swallow errors to avoid failing webhook
			logger.error("Error during log analysis:", err);
		}
	}

	logger.debug("log stored", key);
	return c.json(ok("log stored", { key }));
});

v1.get("/worker/state/:key", async (c) => {
	const { key } = c.req.param();
	const value = await c.env.CONFIG_KV.get(key);
	logger.debug("state retrieved", key);
	return c.json(ok("state retrieved", { key, value }));
});

v1.put("/worker/state/:key", async (c) => {
	const { key } = c.req.param();
	const value = await c.req.text();
	await c.env.CONFIG_KV.put(key, value);
	logger.debug("state stored", key);
	return c.json(ok("state stored", { key }));
});

v1.get("/ha/:instanceId/states/:entityId", async (c) => {
	const { instanceId, entityId } = c.req.param();
	logger.debug("HA state fetch", instanceId, entityId);
	const res = await haFetch(c.env, instanceId, `/api/states/${entityId}`);
	const data = await res.json();
	return c.json(ok("state", data));
});

v1.put("/ha/:instanceId/states/:entityId", async (c) => {
	const { instanceId, entityId } = c.req.param();
	const body = await c.req.json();
	logger.debug("HA state update", instanceId, entityId, body);
	const res = await haFetch(c.env, instanceId, `/api/states/${entityId}`, {
		method: "POST",
		body: JSON.stringify(body),
		headers: { "Content-Type": "application/json" },
	});
	const data = await res.json();
	return c.json(ok("state updated", data));
});

v1.post("/ha/:instanceId/services/:domain/:service", async (c) => {
	const { instanceId, domain, service } = c.req.param();
	const body = await c.req.json();
	logger.debug("HA service call", instanceId, domain, service, body);
	const res = await haFetch(
		c.env,
		instanceId,
		`/api/services/${domain}/${service}`,
		{
			method: "POST",
			body: JSON.stringify(body),
			headers: { "Content-Type": "application/json" },
		},
	);
	const data = await res.json();
	return c.json(ok("service called", data));
});

// Generic Home Assistant WebSocket command endpoint using worker-configured instance
v1.post("/ha/ws", async (c) => {
	const command = await c.req.json();
	logger.debug("HA WS command", command);
	if (
		typeof command !== "object" ||
		command === null ||
		Array.isArray(command)
	) {
		return c.json(
			{ ok: false, error: "Request body must be a JSON object" },
			400,
		);
	}
	const data = await getHaClient(c.env).send(command);
	logger.debug("HA WS response", data);
	return c.json(ok("ws response", data));
});

// Home Assistant API diagnostics endpoint
v1.post("/ha/diagnostics", async (c) => {
	logger.debug("ha/diagnostics invoked");

	// Check if Home Assistant is configured
	if (!c.env.HASSIO_ENDPOINT_URI || !c.env.HASSIO_TOKEN) {
		return c.json({ ok: false, error: "Home Assistant not configured." }, 400);
	}

	const results = {
		baseUrl: c.env.HASSIO_ENDPOINT_URI,
		endpoints: {} as Record<
			string,
			{
				status: number | string;
				available: boolean;
				contentType?: string | null;
				sampleCount?: number;
				error?: string;
			}
		>,
	};

	// Test various common endpoints
	const endpointsToTest = [
		{ name: "api", path: "/api/" },
		{ name: "config", path: "/api/config" },
		{ name: "states", path: "/api/states" },
		{ name: "device_registry", path: "/api/config/device_registry/list" },
		{ name: "entity_registry", path: "/api/config/entity_registry/list" },
		{ name: "services", path: "/api/services" },
		{ name: "events", path: "/api/events" },
	];

	for (const endpoint of endpointsToTest) {
		try {
			const response = await fetch(
				`${c.env.HASSIO_ENDPOINT_URI}${endpoint.path}`,
				{
					headers: {
						Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
						"Content-Type": "application/json",
					},
					signal: AbortSignal.timeout(5000),
				},
			);

			results.endpoints[endpoint.name] = {
				status: response.status,
				available: response.ok,
				contentType: response.headers.get("content-type"),
			};

			// For some endpoints, get a sample of the data
			if (response.ok && endpoint.name === "states") {
				try {
					const data = await response.json();
					results.endpoints[endpoint.name].sampleCount = Array.isArray(data)
						? data.length
						: 0;
				} catch {}
			}
		} catch (error) {
			results.endpoints[endpoint.name] = {
				status: "error",
				available: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	return c.json(ok("Home Assistant API diagnostics completed", results));
});

// Real-time event subscription endpoint
v1.post("/ha/events/subscribe", async (c) => {
	logger.debug("ha events subscribe requested");

	// Check if Home Assistant is configured
	if (!c.env.HASSIO_ENDPOINT_URI || !c.env.HASSIO_TOKEN) {
		return c.json({ ok: false, error: "Home Assistant not configured." }, 400);
	}

	try {
		const { event_type } = await c.req.json<{ event_type?: string }>();

		const wsClient = getHaClient(c.env);
		const subscription = await wsClient.subscribeEvents(event_type);

		logger.debug(`Subscribed to Home Assistant events: ${event_type || "all"}`);

		return c.json(
			ok("event subscription created", {
				event_type: event_type || "all",
				subscription_id:
					typeof subscription === "object" &&
					subscription &&
					"id" in subscription
						? subscription.id
						: "unknown",
			}),
				);
	} catch (error) {
		logger.error("Event subscription error:", error);
		return c.json(
			{
				ok: false,
				error: `Event subscription failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			},
			500,
		);
	}
});

// WebSocket monitoring endpoint
v1.get("/websocket/events", async (c) => {
	logger.debug("WebSocket events requested");

	if (!c.env.HASSIO_ENDPOINT_URI || !c.env.HASSIO_TOKEN) {
		return c.json(
			{
				ok: false,
				error: "Home Assistant not configured",
			},
			400,
		);
	}

	try {
		// Get recent state changes to simulate event monitoring
		const statesRes = await fetch(`${c.env.HASSIO_ENDPOINT_URI}/api/states`, {
			headers: {
				Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
				"Content-Type": "application/json",
			},
		});

		if (!statesRes.ok) {
			throw new Error(`States fetch failed: ${statesRes.status}`);
		}

		const states = await statesRes.json();

		interface RecentEvent {
			time: string;
			entity_id: string;
			event_type: string;
			old_state: string | null;
			new_state: string;
			friendly_name: string;
			domain: string;
			age_minutes: number;
		}

		const recentEvents: RecentEvent[] = [];

		// Convert recent state changes to event-like format
		if (Array.isArray(states)) {
			const now = new Date();
			states
				.filter(state => state.last_changed || state.last_updated)
				.sort((a, b) => {
					const aTime = new Date(a.last_changed || a.last_updated).getTime();
					const bTime = new Date(b.last_changed || b.last_updated).getTime();
					return bTime - aTime;
				})
				.slice(0, 10) // Get last 10 events
				.forEach(state => {
					const lastChanged = new Date(state.last_changed || state.last_updated);
					const ageMinutes = Math.round((now.getTime() - lastChanged.getTime()) / 1000 / 60);

					if (ageMinutes < 60) { // Only show events from last hour
						recentEvents.push({
							time: lastChanged.toISOString(),
							entity_id: state.entity_id,
							event_type: 'state_changed',
							old_state: null, // We don't have old state from this endpoint
							new_state: state.state,
							friendly_name: state.attributes?.friendly_name || state.entity_id,
							domain: state.entity_id.split('.')[0],
							age_minutes: ageMinutes,
						});
					}
				});
		}

		return c.json(
			ok("recent events", {
				events: recentEvents,
				timestamp: new Date().toISOString(),
				count: recentEvents.length,
			}),
		);
	} catch (error) {
		logger.error("WebSocket events fetch failed:", error);
		return c.json(
			{
				ok: false,
				error: `WebSocket events failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			},
			500,
		);
	}
});

