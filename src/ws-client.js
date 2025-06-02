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

// Firebase imports
import { initializeApp } from "firebase/app";
import { 
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy, // Note: orderBy might require composite indexes in Firestore
  limit,
  serverTimestamp
} from "firebase/firestore";
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken 
} from "firebase/auth";

// --- Home Assistant Client Functions (as before) ---

/**
 * Initializes the connection to Home Assistant.
 * @param {string} hassUrl - The URL of the Home Assistant instance (e.g., from env.HOMEASSISTANT_URI).
 * @param {string} accessToken - The Long-Lived Access Token (e.g., from env.HOMEASSISTANT_TOKEN).
 * @returns {Promise<import("home-assistant-js-websocket").Connection>} The Home Assistant connection object.
 */
export const initConnection = async (hassUrl, accessToken) => {
  if (!hassUrl || typeof hassUrl !== 'string') {
    throw new Error("Home Assistant URL (hassUrl) must be a non-empty string.");
  }
  if (!accessToken || typeof accessToken !== 'string') {
    throw new Error("Home Assistant Access Token (accessToken) must be a non-empty string.");
  }
  try {
    const auth = createLongLivedTokenAuth(hassUrl, accessToken);
    const connection = await createConnection({ auth });
    return connection;
  } catch (error) {
    console.error("Failed to connect to Home Assistant:", error);
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
  if (!connection) throw new Error("Connection object is required.");
  const states = await getStates(connection);
  const organizedEntities = {};
  states
    .filter((entity) => entity && entity.entity_id && !entity.entity_id.startsWith("device_tracker."))
    .forEach((entity) => {
      const [domain] = entity.entity_id.split(".");
      if (!organizedEntities[domain]) organizedEntities[domain] = {};
      organizedEntities[domain][entity.entity_id] = entity;
    });
  return organizedEntities;
};

/**
 * Gets the state of a single entity.
 * @param {import("home-assistant-js-websocket").Connection} connection - The active Home Assistant connection.
 * @param {string} entityId - The ID of the entity.
 * @returns {Promise<Object|null>} The entity state object or null if not found.
 */
export const getEntityState = async (connection, entityId) => {
    if (!connection) throw new Error("Connection object is required.");
    if (!entityId) throw new Error("Entity ID is required.");
    const states = await getStates(connection);
    return states.find(s => s.entity_id === entityId) || null;
};


// (Other HA client functions: getConfiguration, getUserInfo, etc. remain the same)
// ... (getConfiguration, getUserInfo, getAvailableServices, getAvailablePanels, getLovelaceConfiguration, getCardConfiguration)
// ... (getEntityRegistryEntries, getDeviceRegistryEntries, getAreaRegistryEntries)
// ... (Subscription functions also remain largely the same for client-side use if needed)

/**
 * Gets the Home Assistant configuration.
 * @param {import("home-assistant-js-websocket").Connection} connection - The active Home Assistant connection.
 * @returns {Promise<Object>} The Home Assistant configuration object.
 */
export const getConfiguration = async (connection) => {
  if (!connection) throw new Error("Connection object is required.");
  return getConfig(connection);
};

/**
 * Gets the current user information from Home Assistant.
 * @param {import("home-assistant-js-websocket").Connection} connection - The active Home Assistant connection.
 * @returns {Promise<Object>} The user object.
 */
export const getUserInfo = async (connection) => {
  if (!connection) throw new Error("Connection object is required.");
  return getUser(connection);
};

/**
 * Gets the available services from Home Assistant.
 * @param {import("home-assistant-js-websocket").Connection} connection - The active Home Assistant connection.
 * @returns {Promise<Object>} An object describing the available services.
 */
export const getAvailableServices = async (connection) => {
  if (!connection) throw new Error("Connection object is required.");
  return getServices(connection);
};

/**
 * Gets the available panels (sidebar items) from Home Assistant.
 * @param {import("home-assistant-js-websocket").Connection} connection - The active Home Assistant connection.
 * @returns {Promise<Object>} An object describing the available panels.
 */
export const getAvailablePanels = async (connection) => {
  if (!connection) throw new Error("Connection object is required.");
  return getPanels(connection);
};

/**
 * Gets the Lovelace configuration from Home Assistant.
 * @param {import("home-assistant-js-websocket").Connection} connection - The active Home Assistant connection.
 * @returns {Promise<Object>} The Lovelace configuration object.
 */
export const getLovelaceConfiguration = async (connection) => {
  if (!connection) throw new Error("Connection object is required.");
  return getLovelaceConfig(connection);
};

/**
 * Gets the configuration for a specific Lovelace card.
 * @param {import("home-assistant-js-websocket").Connection} connection - The active Home Assistant connection.
 * @param {string} cardId - The ID of the card to retrieve.
 * @returns {Promise<Object>} The card configuration object.
 */
export const getCardConfiguration = async (connection, cardId) => {
  if (!connection) throw new Error("Connection object is required.");
  if (!cardId || typeof cardId !== 'string') throw new Error("Card ID must be a non-empty string.");
  return getCardConfig(connection, cardId);
};

/**
 * Gets the entity registry from Home Assistant.
 * @param {import("home-assistant-js-websocket").Connection} connection - The active Home Assistant connection.
 * @returns {Promise<Array<Object>>} An array of entity registry entries.
 */
export const getEntityRegistryEntries = async (connection) => {
  if (!connection) throw new Error("Connection object is required.");
  return getEntityRegistry(connection);
};

/**
 * Gets the device registry from Home Assistant.
 * @param {import("home-assistant-js-websocket").Connection} connection - The active Home Assistant connection.
 * @returns {Promise<Array<Object>>} An array of device registry entries.
 */
export const getDeviceRegistryEntries = async (connection) => {
  if (!connection) throw new Error("Connection object is required.");
  return getDeviceRegistry(connection);
};

/**
 * Gets the area registry from Home Assistant.
 * @param {import("home-assistant-js-websocket").Connection} connection - The active Home Assistant connection.
 * @returns {Promise<Array<Object>>} An array of area registry entries.
 */
export const getAreaRegistryEntries = async (connection) => {
  if (!connection) throw new Error("Connection object is required.");
  return getAreaRegistry(connection);
};


// --- Firebase Globals ---
let firebaseApp;
let firestoreDB;
let firebaseAuth;
let currentUserId; // For Firestore user-specific data

/**
 * Initializes Firebase app and services if not already initialized.
 * Must be called before using Firestore or Auth.
 * @param {Object} env - Cloudflare Worker environment variables.
 */
const ensureFirebaseInitialized = async (env) => {
  if (!firebaseApp) {
    if (!env.FIREBASE_CONFIG) {
      console.error("FIREBASE_CONFIG is not set in environment variables.");
      throw new Error("Firebase configuration not found.");
    }
    try {
      const firebaseConfig = JSON.parse(env.FIREBASE_CONFIG);
      firebaseApp = initializeApp(firebaseConfig);
      firestoreDB = getFirestore(firebaseApp);
      firebaseAuth = getAuth(firebaseApp);
      
      // Authenticate (e.g., anonymously for worker-level operations)
      // __initial_auth_token is specific to Canvas environment, adapt if needed for direct CF worker.
      // For a backend worker, anonymous auth is usually sufficient unless you have specific user contexts.
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
         await signInWithCustomToken(firebaseAuth, __initial_auth_token);
      } else {
         await signInAnonymously(firebaseAuth);
      }
      currentUserId = firebaseAuth.currentUser ? firebaseAuth.currentUser.uid : crypto.randomUUID();
      console.log("Firebase initialized and user authenticated. User ID:", currentUserId);

    } catch (e) {
      console.error("Firebase initialization error:", e);
      throw new Error(`Firebase initialization failed: ${e.message}`);
    }
  }
};


// Cloudflare Worker fetch handler
export default {
  async fetch(request, env, ctx) {
    // Helper function to return JSON responses
    const jsonResponse = (data, status = 200) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, // Added CORS for broader testing
      });
    };
     // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });
    }

    // --- 0. Initialize Firebase (must be done before auth checks if auth depends on it) ---
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; // For Firestore paths
    try {
        await ensureFirebaseInitialized(env);
    } catch (error) {
        console.error("Critical: Firebase initialization failed in fetch:", error);
        return jsonResponse({ error: `Firebase setup failed: ${error.message}` }, 500);
    }


    // --- 1. Authorization for Worker API ---
    const requestApiKey = request.headers.get('Authorization');
    if (!env.WORKER_API_KEY) {
        console.error("WORKER_API_KEY is not set in environment variables.");
        return jsonResponse({ error: "Worker API key not configured." }, 500);
    }
    if (!requestApiKey || requestApiKey !== `Bearer ${env.WORKER_API_KEY}`) {
      return jsonResponse({ error: 'Unauthorized to use worker API.' }, 401);
    }

    // --- 2. Retrieve Home Assistant Credentials ---
    const HASS_URI = env.HOMEASSISTANT_URI;
    const HASS_TOKEN = env.HOMEASSISTANT_TOKEN;

    if (!HASS_URI || !HASS_TOKEN) {
      console.error("Home Assistant URI or Token not configured in worker secrets.");
      return jsonResponse({ error: "Home Assistant credentials not configured." }, 500);
    }

    let haConnection;
    try {
      // --- 3. Initialize Home Assistant Connection ---
      haConnection = await initConnection(HASS_URI, HASS_TOKEN);
      // console.log("Successfully connected to Home Assistant via worker proxy!");

      // --- 4. API Routing ---
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/').filter(p => p); 

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
            const entities = await getAllOrganizedEntities(haConnection);
            return jsonResponse(entities);
          }
          return jsonResponse({ error: `Method ${request.method} not allowed` }, 405);

        case 'config':
          if (request.method === 'GET') {
            const config = await getConfiguration(haConnection);
            return jsonResponse(config);
          }
          return jsonResponse({ error: `Method ${request.method} not allowed` }, 405);
        
        case 'user':
          if (request.method === 'GET') {
            const user = await getUserInfo(haConnection);
            return jsonResponse(user);
          }
          return jsonResponse({ error: `Method ${request.method} not allowed for /api/user` }, 405);

        case 'services':
          if (request.method === 'GET') {
            const services = await getAvailableServices(haConnection);
            return jsonResponse(services);
          }
          return jsonResponse({ error: `Method ${request.method} not allowed for /api/services` }, 405);

        case 'call-service':
          if (request.method === 'POST') {
            const { domain, service, serviceData } = requestBody;
            if (!domain || !service) {
              return jsonResponse({ error: 'Missing domain or service in request body' }, 400);
            }
            await callService(haConnection, domain, service, serviceData || {});
            
            // Log interaction to Firestore
            if (firestoreDB && serviceData && serviceData.entity_id) {
              try {
                const entityId = serviceData.entity_id;
                const interactionsCollectionPath = `/artifacts/${appId}/users/${currentUserId}/entityInteractions`;
                await addDoc(collection(firestoreDB, interactionsCollectionPath), {
                  entityId: Array.isArray(entityId) ? entityId.join(',') : entityId, // Handle single or multiple entity_ids
                  domain,
                  service,
                  timestamp: serverTimestamp(),
                });
                // console.log(`Interaction logged for ${entityId}`);
              } catch (logError) {
                console.error("Firestore logging error:", logError);
                // Do not fail the main request if logging fails
              }
            }
            return jsonResponse({ success: true, message: `Service ${domain}.${service} called.` });
          }
          return jsonResponse({ error: `Method ${request.method} not allowed` }, 405);

        case 'panels':
          if (request.method === 'GET') {
            const panels = await getAvailablePanels(haConnection);
            return jsonResponse(panels);
          }
          return jsonResponse({ error: `Method ${request.method} not allowed for /api/panels` }, 405);

        case 'lovelace-config':
           if (request.method === 'GET') {
            const lovelaceConfig = await getLovelaceConfiguration(haConnection);
            return jsonResponse(lovelaceConfig);
          }
          return jsonResponse({ error: `Method ${request.method} not allowed for /api/lovelace-config` }, 405);
        
        case 'card-config':
          if (request.method === 'GET') {
            const cardId = url.searchParams.get('cardId');
            if (!cardId) return jsonResponse({ error: 'Missing cardId query parameter' }, 400);
            const cardConfig = await getCardConfiguration(haConnection, cardId);
            return jsonResponse(cardConfig);
          }
          return jsonResponse({ error: `Method ${request.method} not allowed for /api/card-config` }, 405);

        case 'entity-registry':
          if (request.method === 'GET') {
            const entities = await getEntityRegistryEntries(haConnection);
            return jsonResponse(entities);
          }
          return jsonResponse({ error: `Method ${request.method} not allowed for /api/entity-registry` }, 405);

        case 'device-registry':
          if (request.method === 'GET') {
            const devices = await getDeviceRegistryEntries(haConnection);
            return jsonResponse(devices);
          }
          return jsonResponse({ error: `Method ${request.method} not allowed for /api/device-registry` }, 405);

        case 'area-registry':
          if (request.method === 'GET') {
            const areas = await getAreaRegistryEntries(haConnection);
            return jsonResponse(areas);
          }
          return jsonResponse({ error: `Method ${request.method} not allowed for /api/area-registry` }, 405);
        
        case 'suggested-entities':
            if (request.method === 'GET') {
                if (!firestoreDB) return jsonResponse({ error: "Firestore not available for suggestions." }, 500);
                try {
                    const interactionsCollectionPath = `/artifacts/${appId}/users/${currentUserId}/entityInteractions`;
                    const q = query(
                        collection(firestoreDB, interactionsCollectionPath),
                        orderBy("timestamp", "desc"), // Get recent interactions
                        limit(100) // Look at last 100 interactions for suggestions
                    );
                    const querySnapshot = await getDocs(q);
                    const interactionCounts = {};
                    querySnapshot.forEach((docSnap) => {
                        const data = docSnap.data();
                        // Handle cases where entityId might be an array string
                        const entityIds = data.entityId.includes(',') ? data.entityId.split(',') : [data.entityId];
                        entityIds.forEach(id => {
                           interactionCounts[id] = (interactionCounts[id] || 0) + 1;
                        });
                    });

                    // Sort by count
                    const sortedSuggestions = Object.entries(interactionCounts)
                        .sort(([, countA], [, countB]) => countB - countA)
                        .map(([entityId, count]) => ({ entityId, count }));
                    
                    return jsonResponse(sortedSuggestions.slice(0, 10)); // Return top 10
                } catch (suggestError) {
                    console.error("Error fetching suggestions:", suggestError);
                    return jsonResponse({ error: `Failed to get suggestions: ${suggestError.message}` }, 500);
                }
            }
            return jsonResponse({ error: `Method ${request.method} not allowed` }, 405);

        case 'ai-entity-insight':
            if (request.method === 'GET') {
                const entityId = url.searchParams.get('entity_id');
                if (!entityId) return jsonResponse({ error: 'Missing entity_id query parameter' }, 400);

                try {
                    // 1. Get current entity state from Home Assistant
                    const entityState = await getEntityState(haConnection, entityId);
                    if (!entityState) return jsonResponse({ error: `Entity ${entityId} not found.` }, 404);

                    // 2. Get recent interactions for this entity from Firestore
                    let recentInteractions = [];
                    if (firestoreDB) {
                        const interactionsCollectionPath = `/artifacts/${appId}/users/${currentUserId}/entityInteractions`;
                        const q = query(
                            collection(firestoreDB, interactionsCollectionPath),
                            where("entityId", "==", entityId), // Or "array-contains" if entityId was stored in an array
                            orderBy("timestamp", "desc"),
                            limit(5)
                        );
                        const querySnapshot = await getDocs(q);
                        querySnapshot.forEach(docSnap => recentInteractions.push(docSnap.data()));
                    }
                    
                    // 3. Call Gemini API
                    const prompt = `Given the Home Assistant entity "${entityId}" with current state: ${JSON.stringify(entityState)}. Recent interactions with this entity include: ${JSON.stringify(recentInteractions)}. What are some useful insights or common next actions for this entity? Be concise.`;
                    
                    let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
                    const payload = { contents: chatHistory };
                    const apiKey = ""; // Gemini Flash does not require an explicit key here for Canvas
                    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
                    
                    const geminiResponse = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (!geminiResponse.ok) {
                        const errorText = await geminiResponse.text();
                        console.error("Gemini API error:", errorText);
                        return jsonResponse({ error: `Gemini API request failed: ${geminiResponse.statusText}`, details: errorText }, 500);
                    }
                    
                    const result = await geminiResponse.json();
                    
                    if (result.candidates && result.candidates.length > 0 &&
                        result.candidates[0].content && result.candidates[0].content.parts &&
                        result.candidates[0].content.parts.length > 0) {
                        const insightText = result.candidates[0].content.parts[0].text;
                        return jsonResponse({ entityId, state: entityState, insight: insightText, recentInteractions });
                    } else {
                        console.error("Unexpected Gemini API response structure:", result);
                        return jsonResponse({ error: "Failed to get insight from AI, unexpected response.", details: result }, 500);
                    }

                } catch (aiError) {
                    console.error("Error fetching AI insight:", aiError);
                    return jsonResponse({ error: `Failed to get AI insight: ${aiError.message}` }, 500);
                }
            }
            return jsonResponse({ error: `Method ${request.method} not allowed` }, 405);

        default:
          return jsonResponse({ error: `Unknown action: ${action}` }, 404);
      }

    } catch (error) {
      console.error("Worker proxy error:", error);
      const errorMessage = (error instanceof Error) ? error.message : String(error);
      return jsonResponse({ error: `Worker proxy failed: ${errorMessage}` }, 500);
    } finally {
      if (haConnection && haConnection.connected && typeof haConnection.close === 'function') {
        try {
            haConnection.close();
        } catch (closeError) {
            console.error("Error closing Home Assistant connection:", closeError);
        }
      }
    }
  },
};
