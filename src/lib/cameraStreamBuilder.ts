/**
 * Camera Stream URL Builder
 *
 * Processes Home Assistant /api/states data to build MJPEG stream URLs
 * for cameras with available access tokens.
 */
import type { WorkerEnv } from '../index';

/**
 * Get the Home Assistant endpoint
 * @param env - The worker environment
 * @returns The Home Assistant endpoint URL
 */
export function getHaEndpoint(env: WorkerEnv): string {
    return env.HASSIO_ENDPOINT_URI || "https://rpcsurqki2awrf1lukibtypjv2ochwqb.ui.nabu.casa";
}

export interface HAEntityState {
  entity_id: string;
  state: string;
  attributes: {
    access_token?: string;
    entity_picture?: string;
    friendly_name?: string;
    [key: string]: unknown;
  };
  last_changed: string;
  last_updated: string;
}

export interface CameraStreamMap {
  [entity_id: string]: string;
}

/**
 * Builds MJPEG stream URLs for all available cameras from Home Assistant states data
 *
 * @param statesData - JSON array of entity objects from Home Assistant /api/states
 * @param env - The worker environment containing HASSIO_ENDPOINT_URI
 * @returns Dictionary mapping entity_id to full stream URL
 */
export function buildCameraStreamUrls(statesData: HAEntityState[], env: WorkerEnv): CameraStreamMap {
  const streamUrls: CameraStreamMap = {};
  const hassioEndpoint = getHaEndpoint(env);

  // Filter and process camera entities
  const cameraEntities = statesData.filter(entity =>
    entity.entity_id.startsWith("camera.") &&
    entity.attributes.access_token
  );

  // Build stream URLs for each valid camera
  for (const camera of cameraEntities) {
    const { entity_id, attributes } = camera;
    const { access_token } = attributes;

    // Build the full MJPEG stream URL
    const streamUrl = `${hassioEndpoint}/api/camera_proxy_stream/${entity_id}?token=${access_token}`;

    streamUrls[entity_id] = streamUrl;
  }

  return streamUrls;
}

/**
 * Alternative function that returns more detailed camera information
 * including both stream URL and additional metadata
 */
export interface CameraInfo {
  entity_id: string;
  stream_url: string;
  friendly_name?: string;
  entity_picture?: string;
  state: string;
}

export function buildCameraInfoMap(statesData: HAEntityState[], env: WorkerEnv): { [entity_id: string]: CameraInfo } {
  const cameraInfoMap: { [entity_id: string]: CameraInfo } = {};
  const hassioEndpoint = getHaEndpoint(env);

  // Filter and process camera entities
  const cameraEntities = statesData.filter(entity =>
    entity.entity_id.startsWith("camera.") &&
    entity.attributes.access_token
  );

  // Build detailed camera info for each valid camera
  for (const camera of cameraEntities) {
    const { entity_id, state, attributes } = camera;
    const { access_token, friendly_name, entity_picture } = attributes;

    // Build the full MJPEG stream URL
    const streamUrl = `${hassioEndpoint}/api/camera_proxy_stream/${entity_id}?token=${access_token}`;

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
export function isValidStreamableCamera(entity: HAEntityState): boolean {
  return entity.entity_id.startsWith("camera.") &&
         !!entity.attributes.access_token;
}

/**
 * Get count of available streaming cameras
 */
export function getStreamableCameraCount(statesData: HAEntityState[]): number {
  return statesData.filter(isValidStreamableCamera).length;
}
