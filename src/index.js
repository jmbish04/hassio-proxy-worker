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
  subscribeEntities as subscribeEntitiesRaw,
  getEntityRegistry,
  getDeviceRegistry,
  getAreaRegistry,
} from "home-assistant-js-websocket";

// Replace with your Home Assistant instance URL and Long-Lived Access Token
const HASS_URL = "http://localhost:8123";
const ACCESS_TOKEN = "YOUR_LONG_LIVED_ACCESS_TOKEN";

// Initialize the connection
export const initConnection = async () => {
  const auth = createLongLivedTokenAuth(HASS_URL, ACCESS_TOKEN);
  const connection = await createConnection({ auth });
  return connection;
};

// Fetch all entities, excluding device_tracker entities
export const getAllOrganizedEntities = async (connection) => {
  const states = await getStates(connection);
  const organizedEntities = {};

  states
    .filter((entity) => !entity.entity_id.startsWith("device_tracker."))
    .forEach((entity) => {
      const [domain] = entity.entity_id.split(".");
      if (!organizedEntities[domain]) {
        organizedEntities[domain] = {};
      }
      organizedEntities[domain][entity.entity_id] = entity;
    });

  return organizedEntities;
};

// Example: Call a service
export const callExampleService = async (connection) => {
  await callService(connection, "light", "turn_on", {
    entity_id: "light.living_room",
  });
};

// Example: Subscribe to state changes
export const subscribeToStateChanges = (connection, callback) => {
  subscribeEntities(connection, (entities) => {
    const filteredEntities = {};
    Object.entries(entities).forEach(([entityId, entity]) => {
      if (!entityId.startsWith("device_tracker.")) {
        filteredEntities[entityId] = entity;
      }
    });
    callback(filteredEntities);
  });
};

// Example: Get configuration
export const getConfiguration = async (connection) => {
  const config = await getConfig(connection);
  return config;
};

// Example: Get user info
export const getUserInfo = async (connection) => {
  const user = await getUser(connection);
  return user;
};

// Example: Get services
export const getAvailableServices = async (connection) => {
  const services = await getServices(connection);
  return services;
};

// Example: Get panels
export const getAvailablePanels = async (connection) => {
  const panels = await getPanels(connection);
  return panels;
};

// Example: Get Lovelace config
export const getLovelaceConfiguration = async (connection) => {
  const lovelaceConfig = await getLovelaceConfig(connection);
  return lovelaceConfig;
};

// Example: Get card config
export const getCardConfiguration = async (connection, cardId) => {
  const cardConfig = await getCardConfig(connection, cardId);
  return cardConfig;
};

// Example: Subscribe to config changes
export const subscribeToConfigChanges = (connection, callback) => {
  subscribeConfig(connection, callback);
};

// Example: Subscribe to service changes
export const subscribeToServiceChanges = (connection, callback) => {
  subscribeServices(connection, callback);
};

// Example: Subscribe to panel changes
export const subscribeToPanelChanges = (connection, callback) => {
  subscribePanels(connection, callback);
};

// Example: Subscribe to Lovelace changes
export const subscribeToLovelaceChanges = (connection, callback) => {
  subscribeLovelace(connection, callback);
};

// Example: Get entity registry
export const getEntityRegistryEntries = async (connection) => {
  const entities = await getEntityRegistry(connection);
  return entities;
};

// Example: Get device registry
export const getDeviceRegistryEntries = async (connection) => {
  const devices = await getDeviceRegistry(connection);
  return devices;
};

// Example: Get area registry
export const getAreaRegistryEntries = async (connection) => {
  const areas = await getAreaRegistry(connection);
  return areas;
};
