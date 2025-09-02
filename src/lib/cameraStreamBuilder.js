/**
 * Camera Stream URL Builder (JavaScript version)
 *
 * Processes Home Assistant /api/states data to build MJPEG stream URLs
 * for cameras with available access tokens.
 */

const HASSIO_ENDPOINT_BASE = "https://rpcsurqki2awrf1lukibtypjv2ochwqb.ui.nabu.casa";

/**
 * Builds MJPEG stream URLs for all available cameras from Home Assistant states data
 *
 * @param {Array} statesData - JSON array of entity objects from Home Assistant /api/states
 * @returns {Object} Dictionary mapping entity_id to full stream URL
 */
function buildCameraStreamUrls(statesData) {
  const streamUrls = {};

  // Filter and process camera entities
  const cameraEntities = statesData.filter(entity =>
    entity.entity_id.startsWith("camera.") &&
    entity.attributes &&
    entity.attributes.access_token
  );

  // Build stream URLs for each valid camera
  for (const camera of cameraEntities) {
    const { entity_id, attributes } = camera;
    const { access_token } = attributes;

    // Build the full MJPEG stream URL
    const streamUrl = `${HASSIO_ENDPOINT_BASE}/api/camera_proxy_stream/${entity_id}?token=${access_token}`;

    streamUrls[entity_id] = streamUrl;
  }

  return streamUrls;
}

/**
 * Alternative function that returns more detailed camera information
 */
function buildCameraInfoMap(statesData) {
  const cameraInfoMap = {};

  // Filter and process camera entities
  const cameraEntities = statesData.filter(entity =>
    entity.entity_id.startsWith("camera.") &&
    entity.attributes &&
    entity.attributes.access_token
  );

  // Build detailed camera info for each valid camera
  for (const camera of cameraEntities) {
    const { entity_id, state, attributes } = camera;
    const { access_token, friendly_name, entity_picture } = attributes;

    // Build the full MJPEG stream URL
    const streamUrl = `${HASSIO_ENDPOINT_BASE}/api/camera_proxy_stream/${entity_id}?token=${access_token}`;

    cameraInfoMap[entity_id] = {
      entity_id,
      stream_url: streamUrl,
      friendly_name,
      entity_picture,
      state
    };
  }

  return cameraInfoMap;
}

/**
 * Utility function to validate if an entity is a valid camera with stream access
 */
function isValidStreamableCamera(entity) {
  return entity.entity_id.startsWith("camera.") &&
         entity.attributes &&
         entity.attributes.access_token;
}

/**
 * Get count of available streaming cameras
 */
function getStreamableCameraCount(statesData) {
  return statesData.filter(isValidStreamableCamera).length;
}

// Example usage:
/*
// Mock data similar to what Home Assistant /api/states returns
const mockStatesData = [
  {
    entity_id: "camera.front_door",
    state: "streaming",
    attributes: {
      access_token: "abc123def456",
      friendly_name: "Front Door Camera"
    }
  },
  {
    entity_id: "camera.backyard",
    state: "idle",
    attributes: {
      access_token: "xyz789uvw012",
      friendly_name: "Backyard Camera"
    }
  },
  {
    entity_id: "camera.garage",
    state: "unavailable",
    attributes: {
      friendly_name: "Garage Camera"
      // No access_token - will be filtered out
    }
  }
];

const streamUrls = buildCameraStreamUrls(mockStatesData);
console.log(streamUrls);

// Output:
// {
//   "camera.front_door": "https://rpcsurqki2awrf1lukibtypjv2ochwqb.ui.nabu.casa/api/camera_proxy_stream/camera.front_door?token=abc123def456",
//   "camera.backyard": "https://rpcsurqki2awrf1lukibtypjv2ochwqb.ui.nabu.casa/api/camera_proxy_stream/camera.backyard?token=xyz789uvw012"
// }
*/

// Export for Node.js/module environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildCameraStreamUrls,
    buildCameraInfoMap,
    isValidStreamableCamera,
    getStreamableCameraCount
  };
}
