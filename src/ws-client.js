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
  getEntityRegistry,
  getDeviceRegistry,
  getAreaRegistry,
} from "home-assistant-js-websocket";

const HASS_URL = "http://localhost:8123";
const ACCESS_TOKEN = "YOUR_LONG_LIVED_ACCESS_TOKEN";

export const initConnection = async () = {
  const auth = createLongLivedTokenAuth(HASS_URL, ACCESS_TOKEN);
  const connection = await createConnection({ auth });
  return connection;
};

export const getAllOrganizedEntities = async (connection) = {
  const states = await getStates(connection);
  const organizedEntities = {};

  states
    .filter((entity) = !entity.entity_id.startsWith("device_tracker."))
    .forEach((entity) = {
      const [domain] = entity.entity_id.split(".");
      if (!organizedEntities[domain]) {
