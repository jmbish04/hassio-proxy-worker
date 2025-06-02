import {
  createConnection,
  createLongLivedTokenAuth,
  subscribeEntities,
  callService,
  getServices,
  getStates,
  getConfig,
  getUser,
  getPanels,
  getLovelaceConfig,
  getCardConfig,
  subscribeConfig,
  subscribeServices,
  subscribePanels,
  subscribeLovelace,
  // subscribeEntities as subscribeEntitiesRaw, // This was duplicated, removed one
  getEntityRegistry,
  getDeviceRegistry,
  getAreaRegistry,
} from "home-assistant-js-websocket";

// Constants for HASS_URL and ACCESS_TOKEN are removed.
// These will now be passed into initConnection.

/**
 * Initializes the connection to Home Assistant.
 * @param {string} hassUrl - The URL of the Home Assistant instance (e.g., from env.HOMEASSISTANT_URI).
 * @param {string} accessToken - The Long-Lived Access Token (e.g., from env.HOMEASSISTANT_TOKEN).
 * @returns {Promise<import("home-assistant-js-websocket").Connection>} The Home Assistant connection object.
 * @throws {Error} If connection or authentication fails.
 */
export const initConnection = async (hassUrl, accessToken) => {
  // Validate inputs
  if (!hassUrl || typeof hassUrl !== 'string') {
    throw new Error("Home Assistant URL (hassUrl) must be a non-empty string.");
  }
  if (!accessToken || typeof accessToken !== 'string') {
    throw new Error("Home Assistant Access Token (accessToken) must be a non-empty string.");
  }

  try {
    // Create authentication object using the provided URL and token
    const auth = createLongLivedTokenAuth(hassUrl, accessToken);
    // Establish the connection
    const connection = await createConnection({ auth });
    return connection;
  } catch (error) {
    // Log the error for debugging purposes on the worker side
    console.error("Failed to connect to Home Assistant:", error);
    // Re-throw the error or handle it as appropriate for the worker environment
    throw new Error(`Connection to Home Assistant failed: ${error.message}`);
  }
};

/**
 * Fetches all entities from Home Assistant, organizes them by domain,
 * and excludes device_tracker entities.
 * @param {import("home-assistant-js-websocket").Connection} connection - The active Home Assistant connection.
 * @returns {Promise<Object>} An object with domains as keys and entity objects as values.
 */
export const getAllOrganizedEntities = async (connection) => {
  if (!connection) {
    throw new Error("Connection object is required.");
  }
  const states = await getStates(connection);
  const organizedEntities = {};

  states
    .filter((entity) => entity && entity.entity_id && !entity.entity_id.startsWith("device_tracker."))
    .forEach((entity) => {
      const [domain] = entity.entity_id.split(".");
      if (!organizedEntities[domain]) {
        organizedEntities[domain] = {};
      }
      organizedEntities[domain][entity.entity_id] = entity;
    });

  return organizedEntities;
};

/**
 * Example function to call a service in Home Assistant.
 * @param {import("home-assistant-js-websocket").Connection} connection - The active Home Assistant connection.
 * @param {string} domain - The domain of the service (e.g., "light").
 * @param {string} service - The service to call (e.g., "turn_on").
 * @param {Object} [serviceData] - Optional data for the service call (e.g., { entity_id: "light.living_room" }).
 */
export const callExampleService = async (connection, domain = "light", service = "turn_on", serviceData = { entity_id: "light.living_room" }) => {
  if (!connection) {
    throw new Error("Connection object is required.");
  }
  await callService(connection, domain, service, serviceData);
  console.log(`Service ${domain}.${service} called with data:`, serviceData);
};

/**
 * Subscribes to state changes for entities, excluding device_tracker entities.
 * @param {import("home-assistant-js-websocket").Connection} connection - The active Home Assistant connection.
 * @param {function(Object): void} callback - Function to call with filtered entity states.
 * @returns {Promise<() => void>} A function to unsubscribe.
 */
export const subscribeToStateChanges = (connection, callback) => {
  if (!connection) {
    throw new Error("Connection object is required.");
  }
  if (typeof callback !== 'function') {
    throw new Error("Callback must be a function.");
  }
  // subscribeEntities returns a function to unsubscribe
  return subscribeEntities(connection, (entities) => {
    const filteredEntities = {};
    Object.entries(entities).forEach(([entityId, entityState]) => {
      if (entityId && !entityId.startsWith("device_tracker.")) {
        filteredEntities[entityId] = entityState;
      }
    });
    callback(filteredEntities);
  });
};

/**
 * Gets the Home Assistant configuration.
 * @param {import("home-assistant-js-websocket").Connection} connection - The active Home Assistant connection.
 * @returns {Promise<Object>} The Home Assistant configuration object.
 */
export const getConfiguration = async (connection) => {
  if (!connection) {
    throw new Error("Connection object is required.");
  }
  const config = await getConfig(connection);
  return config;
};

/**
 * Gets the current user information from Home Assistant.
 * @param {import("home-assistant-js-websocket").Connection} connection - The active Home Assistant connection.
 * @returns {Promise<Object>} The user object.
 */
export const getUserInfo = async (connection) => {
  if (!connection) {
    throw new Error("Connection object is required.");
  }
  const user = await getUser(connection);
  return user;
};

/**
 * Gets the available services from Home Assistant.
 * @param {import("home-assistant-js-websocket").Connection} connection - The active Home Assistant connection.
 * @returns {Promise<Object>} An object describing the available services.
 */
export const getAvailableServices = async (connection) => {
  if (!connection) {
    throw new Error("Connection object is required.");
  }
  const services = await getServices(connection);
  return services;
};

/**
 * Gets the available panels (sidebar items) from Home Assistant.
 * @param {import("home-assistant-js-websocket").Connection} connection - The active Home Assistant connection.
 * @returns {Promise<Object>} An object describing the available panels.
 */
export const getAvailablePanels = async (connection) => {
  if (!connection) {
    throw new Error("Connection object is required.");
  }
  const panels = await getPanels(connection);
  return panels;
};

/**
 * Gets the Lovelace configuration from Home Assistant.
 * @param {import("home-assistant-js-websocket").Connection} connection - The active Home Assistant connection.
 * @returns {Promise<Object>} The Lovelace configuration object.
 */
export const getLovelaceConfiguration = async (connection) => {
  if (!connection) {
    throw new Error("Connection object is required.");
  }
  const lovelaceConfig = await getLovelaceConfig(connection);
  return lovelaceConfig;
};

/**
 * Gets the configuration for a specific Lovelace card.
 * @param {import("home-assistant-js-websocket").Connection} connection - The active Home Assistant connection.
 * @param {string} cardId - The ID of the card to retrieve.
 * @returns {Promise<Object>} The card configuration object.
 */
export const getCardConfiguration = async (connection, cardId) => {
  if (!connection) {
    throw new Error("Connection object is required.");
  }
  if (!cardId || typeof cardId !== 'string') {
    throw new Error("Card ID must be a non-empty string.");
  }
  const cardConfig = await getCardConfig(connection, cardId);
  return cardConfig;
};

/**
 * Subscribes to changes in the Home Assistant configuration.
 * @param {import("home-assistant-js-websocket").Connection} connection - The active Home Assistant connection.
 * @param {function(Object): void} callback - Function to call with the updated configuration.
 * @returns {Promise<() => void>} A function to unsubscribe.
 */
export const subscribeToConfigChanges = (connection, callback) => {
  if (!connection) {
    throw new Error("Connection object is required.");
  }
   if (typeof callback !== 'function') {
    throw new Error("Callback must be a function.");
  }
  return subscribeConfig(connection, callback);
};

/**
 * Subscribes to changes in the available services.
 * @param {import("home-assistant-js-websocket").Connection} connection - The active Home Assistant connection.
 * @param {function(Object): void} callback - Function to call with the updated services.
 * @returns {Promise<() => void>} A function to unsubscribe.
 */
export const subscribeToServiceChanges = (connection, callback) => {
  if (!connection) {
    throw new Error("Connection object is required.");
  }
   if (typeof callback !== 'function') {
    throw new Error("Callback must be a function.");
  }
  return subscribeServices(connection, callback);
};

/**
 * Subscribes to changes in the available panels.
 * @param {import("home-assistant-js-websocket").Connection} connection - The active Home Assistant connection.
 * @param {function(Object): void} callback - Function to call with the updated panels.
 * @returns {Promise<() => void>} A function to unsubscribe.
 */
export const subscribeToPanelChanges = (connection, callback) => {
  if (!connection) {
    throw new Error("Connection object is required.");
  }
   if (typeof callback !== 'function') {
    throw new Error("Callback must be a function.");
  }
  return subscribePanels(connection, callback);
};

/**
 * Subscribes to changes in the Lovelace configuration.
 * @param {import("home-assistant-js-websocket").Connection} connection - The active Home Assistant connection.
 * @param {function(Object): void} callback - Function to call with the updated Lovelace configuration.
 * @returns {Promise<() => void>} A function to unsubscribe.
 */
export const subscribeToLovelaceChanges = (connection, callback) => {
  if (!connection) {
    throw new Error("Connection object is required.");
  }
  if (typeof callback !== 'function') {
    throw new Error("Callback must be a function.");
  }
  return subscribeLovelace(connection, callback);
};

/**
 * Gets the entity registry from Home Assistant.
 * @param {import("home-assistant-js-websocket").Connection} connection - The active Home Assistant connection.
 * @returns {Promise<Array<Object>>} An array of entity registry entries.
 */
export const getEntityRegistryEntries = async (connection) => {
  if (!connection) {
    throw new Error("Connection object is required.");
  }
  const entities = await getEntityRegistry(connection);
  return entities;
};

/**
 * Gets the device registry from Home Assistant.
 * @param {import("home-assistant-js-websocket").Connection} connection - The active Home Assistant connection.
 * @returns {Promise<Array<Object>>} An array of device registry entries.
 */
export const getDeviceRegistryEntries = async (connection) => {
  if (!connection) {
    throw new Error("Connection object is required.");
  }
  const devices = await getDeviceRegistry(connection);
  return devices;
};

/**
 * Gets the area registry from Home Assistant.
 * @param {import("home-assistant-js-websocket").Connection} connection - The active Home Assistant connection.
 * @returns {Promise<Array<Object>>} An array of area registry entries.
 */
export const getAreaRegistryEntries = async (connection) => {
  if (!connection) {
    throw new Error("Connection object is required.");
  }
  const areas = await getAreaRegistry(connection);
  return areas;
};

// Cloudflare Worker fetch handler
export default {
  async fetch(request, env, ctx) {
    // Helper function to return JSON responses
    const jsonResponse = (data, status = 200) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    // --- 1. Authorization ---
    const apiKey = request.headers.get('Authorization');
    if (!env.WORKER_API_KEY) {
        console.error("WORKER_API_KEY is not set in environment variables.");
        return jsonResponse({ error: "Worker API key not configured." }, 500);
    }
    if (!apiKey || apiKey !== `Bearer ${env.WORKER_API_KEY}`) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    // --- 2. Retrieve Home Assistant Credentials ---
    const HASS_URI = env.HOMEASSISTANT_URI;
    const HASS_TOKEN = env.HOMEASSISTANT_TOKEN;

    if (!HASS_URI || !HASS_TOKEN) {
      console.error("Home Assistant URI or Token not configured in worker secrets.");
      return jsonResponse({ error: "Home Assistant credentials not configured." }, 500);
    }

    let connection;
    try {
      // --- 3. Initialize Home Assistant Connection ---
      connection = await initConnection(HASS_URI, HASS_TOKEN);
      console.log("Successfully connected to Home Assistant via worker proxy!");

      // --- 4. API Routing ---
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/').filter(p => p); // e.g., /api/entities -> ['api', 'entities']

      if (pathParts.length < 2 || pathParts[0] !== 'api') {
        return jsonResponse({ error: 'Invalid API path. Expected /api/<action>' }, 400);
      }

      const action = pathParts[1];
      let requestBody = {};
      if (request.method === 'POST' || request.method === 'PUT') {
        try {
          requestBody = await request.json();
        } catch (e) {
          return jsonResponse({ error: 'Invalid JSON body' }, 400);
        }
      }

      // --- 5. Handle Actions ---
      switch (action) {
        case 'entities':
          if (request.method === 'GET') {
            const entities = await getAllOrganizedEntities(connection);
            return jsonResponse(entities);
          }
          return jsonResponse({ error: `Method ${request.method} not allowed for /api/entities` }, 405);

        case 'config':
          if (request.method === 'GET') {
            const config = await getConfiguration(connection);
            return jsonResponse(config);
          }
          return jsonResponse({ error: `Method ${request.method} not allowed for /api/config` }, 405);

        case 'user':
          if (request.method === 'GET') {
            const user = await getUserInfo(connection);
            return jsonResponse(user);
          }
          return jsonResponse({ error: `Method ${request.method} not allowed for /api/u
