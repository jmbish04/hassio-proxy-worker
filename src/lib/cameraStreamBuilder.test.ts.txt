/**
 * Test and example usage for Camera Stream URL Builder
 */

import {
    buildCameraInfoMap,
    buildCameraStreamUrls,
    type HAEntityState,
} from "./cameraStreamBuilder";
import type { WorkerEnv } from '../index';

// Mock environment for testing
const mockEnv: WorkerEnv = {
    HASSIO_ENDPOINT_URI: "https://rpcsurqki2awrf1lukibtypjv2ochwqb.ui.nabu.casa"
} as WorkerEnv;

// Example Home Assistant /api/states data
const mockStatesData: HAEntityState[] = [
	{
		entity_id: "camera.front_door",
		state: "streaming",
		attributes: {
			access_token: "abc123def456",
			friendly_name: "Front Door Camera",
			entity_picture: "/api/camera_proxy/camera.front_door",
		},
		last_changed: "2025-08-27T10:00:00Z",
		last_updated: "2025-08-27T10:00:00Z",
	},
	{
		entity_id: "camera.backyard",
		state: "idle",
		attributes: {
			access_token: "xyz789uvw012",
			friendly_name: "Backyard Camera",
			entity_picture: "/api/camera_proxy/camera.backyard",
		},
		last_changed: "2025-08-27T09:30:00Z",
		last_updated: "2025-08-27T09:30:00Z",
	},
	{
		entity_id: "camera.garage",
		state: "unavailable",
		attributes: {
			// No access_token - should be filtered out
			friendly_name: "Garage Camera",
			entity_picture: "/api/camera_proxy/camera.garage",
		},
		last_changed: "2025-08-27T08:00:00Z",
		last_updated: "2025-08-27T08:00:00Z",
	},
	{
		entity_id: "switch.living_room_light",
		state: "on",
		attributes: {
			friendly_name: "Living Room Light",
		},
		last_changed: "2025-08-27T09:45:00Z",
		last_updated: "2025-08-27T09:45:00Z",
	},
];

// Test the basic stream URL builder
console.log("=== Basic Stream URLs ===");
const streamUrls = buildCameraStreamUrls(mockStatesData, mockEnv);
console.log(JSON.stringify(streamUrls, null, 2));

/* Expected output:
{
  "camera.front_door": "https://rpcsurqki2awrf1lukibtypjv2ochwqb.ui.nabu.casa/api/camera_proxy_stream/camera.front_door?token=abc123def456",
  "camera.backyard": "https://rpcsurqki2awrf1lukibtypjv2ochwqb.ui.nabu.casa/api/camera_proxy_stream/camera.backyard?token=xyz789uvw012"
}
*/

// Test the detailed camera info builder
console.log("\n=== Detailed Camera Info ===");
const cameraInfo = buildCameraInfoMap(mockStatesData, mockEnv);
console.log(JSON.stringify(cameraInfo, null, 2));

/* Expected output:
{
  "camera.front_door": {
    "entity_id": "camera.front_door",
    "stream_url": "https://rpcsurqki2awrf1lukibtypjv2ochwqb.ui.nabu.casa/api/camera_proxy_stream/camera.front_door?token=abc123def456",
    "friendly_name": "Front Door Camera",
    "entity_picture": "/api/camera_proxy/camera.front_door",
    "state": "streaming"
  },
  "camera.backyard": {
    "entity_id": "camera.backyard",
    "stream_url": "https://rpcsurqki2awrf1lukibtypjv2ochwqb.ui.nabu.casa/api/camera_proxy_stream/camera.backyard?token=xyz789uvw012",
    "friendly_name": "Backyard Camera",
    "entity_picture": "/api/camera_proxy/camera.backyard",
    "state": "idle"
  }
}
*/

// Usage in a real application
export function exampleUsage(env: WorkerEnv) {
	// In your application, you would fetch from Home Assistant
	// const response = await fetch(`${env.HASSIO_ENDPOINT_URI}/api/states`, {
	//   headers: { 'Authorization': `Bearer ${env.HASSIO_TOKEN}` }
	// });
	// const statesData = await response.json();

	// Then build the stream URLs
	const streamUrls = buildCameraStreamUrls(mockStatesData, env);

	// Use the URLs for displaying camera feeds
	Object.entries(streamUrls).forEach(([entityId, streamUrl]) => {
		console.log(`Camera ${entityId} can be streamed at: ${streamUrl}`);
	});

	return streamUrls;
}
