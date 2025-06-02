import {
  createConnection,
  createLongLivedTokenAuth,
  callService,
  getServices,
  getStates,
  getConfig,
  getUser,
  getPanels,
  getLovelaceConfig,
  getCardConfig,
  getEntityRegistry,
  getDeviceRegistry,
  getAreaRegistry,
  // Imports for client-side subscription helpers
  subscribeEntities,
  subscribeConfig,
  subscribeServices,
  subscribePanels,
  subscribeLovelace,
} from "home-assistant-js-websocket";

// Drizzle ORM and D1 imports
import { drizzle } from 'drizzle-orm/d1';
import { sqliteTable, text, integer, sql } from 'drizzle-orm/sqlite-core';
import { count, desc, eq } from 'drizzle-orm';


// --- Drizzle Schema Definition ---
export const entityInteractionsSchema = sqliteTable('entity_interactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  entityId: text('entity_id').notNull(),
  domain: text('domain').notNull(),
  service: text('service').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export const homeAssistantEventsSchema = sqliteTable('home_assistant_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventType: text('event_type').notNull(),
  eventData: text('event_data').notNull(), // Store as JSON string
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

const schema = {
    entityInteractionsSchema,
    homeAssistantEventsSchema,
};

// --- Globals for D1 and KV ---
let d1;
let kv;

/**
 * Initializes Drizzle ORM for D1 and sets up KV if not already initialized.
 * @param {Object} env - Cloudflare Worker environment variables.
 */
const ensureD1KVInitialized = (env) => {
  if (!d1 && env.DB) {
    d1 = drizzle(env.DB, { schema });
    console.log("Drizzle ORM for D1 initialized.");
  } else if (!env.DB && !d1) {
    console.warn("D1 Database (env.DB) binding not found. D1 features will be unavailable.");
  }

  if (!kv && env.KV) {
    kv = env.KV;
    console.log("KV namespace initialized.");
  } else if (!env.KV && !kv) {
    console.warn("KV Namespace (env.KV) binding not found. KV features will be unavailable.");
  }
};


// --- Home Assistant Client Functions ---
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
    // console.error("Failed to connect to Home Assistant:", error); // Already logged by caller in some cases
    throw new Error(`Connection to Home Assistant failed: ${error.message}`);
  }
};

export const getAllOrganizedEntities = async (connection, env, ctx) => {
  if (!connection) throw new Error("Connection object is required.");
  
  const CACHE_KEY = `all-entities-cache:${env.HOMEASSISTANT_URI || 'default_ha_uri'}`;
  const CACHE_TTL_SECONDS = 60;

  if (kv) {
    try {
      const cached = await kv.get(CACHE_KEY, { type: "json" });
      if (cached) {
        return cached;
      }
    } catch (e) {
      console.error("KV get error for all entities:", e);
    }
  }

  const states = await getStates(connection);
  const organizedEntities = {};
  states
    .filter((entity) => entity && entity.entity_id && !entity.entity_id.startsWith("device_tracker."))
    .forEach((entity) => {
      const [domain] = entity.entity_id.split(".");
      if (!organizedEntities[domain]) organizedEntities[domain] = {};
      organizedEntities[domain][entity.entity_id] = entity;
    });

  if (kv && ctx && typeof ctx.waitUntil === 'function') {
    try {
      ctx.waitUntil(kv.put(CACHE_KEY, JSON.stringify(organizedEntities), { expirationTtl: CACHE_TTL_SECONDS }));
    } catch (e) {
      console.error("KV put error for all entities:", e);
    }
  }
  return organizedEntities;
};

export const getEntityState = async (connection, entityId) => {
    if (!connection) throw new Error("Connection object is required.");
    if (!entityId) throw new Error("Entity ID is required.");
    const states = await getStates(connection);
    return states.find(s => s.entity_id === entityId) || null;
};

export const callExampleService = async (connection, domain = "light", service = "turn_on", serviceData = { entity_id: "light.living_room" }) => {
  if (!connection) throw new Error("Connection object is required.");
  await callService(connection, domain, service, serviceData);
  console.log(`Service ${domain}.${service} called with data:`, serviceData);
};

export const subscribeToStateChanges = (connection, callback) => {
  if (!connection) throw new Error("Connection object is required.");
  if (typeof callback !== 'function') throw new Error("Callback must be a function.");
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

export const getConfiguration = async (connection) => {
  if (!connection) throw new Error("Connection object is required.");
  return getConfig(connection);
};

export const getUserInfo = async (connection) => {
  if (!connection) throw new Error("Connection object is required.");
  return getUser(connection);
};

export const getAvailableServices = async (connection) => {
  if (!connection) throw new Error("Connection object is required.");
  return getServices(connection);
};

export const getAvailablePanels = async (connection) => {
  if (!connection) throw new Error("Connection object is required.");
  return getPanels(connection);
};

export const getLovelaceConfiguration = async (connection) => {
  if (!connection) throw new Error("Connection object is required.");
  return getLovelaceConfig(connection);
};

export const getCardConfiguration = async (connection, cardId) => {
  if (!connection) throw new Error("Connection object is required.");
  if (!cardId || typeof cardId !== 'string') throw new Error("Card ID must be a non-empty string.");
  return getCardConfig(connection, cardId);
};

export const subscribeToConfigChanges = (connection, callback) => {
  if (!connection) throw new Error("Connection object is required.");
  if (typeof callback !== 'function') throw new Error("Callback must be a function.");
  return subscribeConfig(connection, callback);
};

export const subscribeToServiceChanges = (connection, callback) => {
  if (!connection) throw new Error("Connection object is required.");
  if (typeof callback !== 'function') throw new Error("Callback must be a function.");
  return subscribeServices(connection, callback);
};

export const subscribeToPanelChanges = (connection, callback) => {
  if (!connection) throw new Error("Connection object is required.");
  if (typeof callback !== 'function') throw new Error("Callback must be a function.");
  return subscribePanels(connection, callback);
};

export const subscribeToLovelaceChanges = (connection, callback) => {
  if (!connection) throw new Error("Connection object is required.");
  if (typeof callback !== 'function') throw new Error("Callback must be a function.");
  return subscribeLovelace(connection, callback);
};

export const getEntityRegistryEntries = async (connection) => {
  if (!connection) throw new Error("Connection object is required.");
  return getEntityRegistry(connection);
};

export const getDeviceRegistryEntries = async (connection) => {
  if (!connection) throw new Error("Connection object is required.");
  return getDeviceRegistry(connection);
};

export const getAreaRegistryEntries = async (connection) => {
  if (!connection) throw new Error("Connection object is required.");
  return getAreaRegistry(connection);
};


// Cloudflare Worker fetch handler
export default {
  async fetch(request, env, ctx) {
    const jsonResponse = (data, status = 200) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    };
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD', // Added HEAD for health checks
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });
    }

    // Initialize D1/KV early for all requests, including health checks
    try {
        ensureD1KVInitialized(env);
    } catch (initError) {
        // If basic D1/KV init fails, it might affect health check too, but health check will report specific D1/KV status.
        console.error("Critical: D1/KV initialization failed early in fetch:", initError);
    }

    // API Routing
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(p => p);

    if (pathParts.length > 0 && pathParts[0] === 'api' && pathParts[1] === 'health') {
        // --- Health Check Endpoint ---
        if (request.method === 'GET' || request.method === 'HEAD') {
            const HASS_URI_HEALTH = env.HOMEASSISTANT_URI;
            const HASS_TOKEN_HEALTH = env.HOMEASSISTANT_TOKEN;
            let overallStatus = "ok";
            let httpStatus = 200;

            const checks = {
                worker: "ok",
                home_assistant_uri_configured: HASS_URI_HEALTH ? "ok" : "error: HOMEASSISTANT_URI not configured",
                home_assistant_token_configured: HASS_TOKEN_HEALTH ? "ok" : "error: HOMEASSISTANT_TOKEN not configured",
                home_assistant_connection: "pending",
                d1_database: "pending",
                kv_store: "pending",
            };

            if (!HASS_URI_HEALTH || !HASS_TOKEN_HEALTH) {
                overallStatus = "error";
                httpStatus = 503;
            }
            
            // Check Home Assistant Connection
            let healthHaConnection;
            if (HASS_URI_HEALTH && HASS_TOKEN_HEALTH) {
                try {
                    healthHaConnection = await initConnection(HASS_URI_HEALTH, HASS_TOKEN_HEALTH);
                    await getConfig(healthHaConnection); // Simple read operation
                    checks.home_assistant_connection = "ok";
                } catch (e) {
                    checks.home_assistant_connection = `error: ${e.message}`;
                    overallStatus = "error";
                    httpStatus = 503;
                } finally {
                    if (healthHaConnection && healthHaConnection.connected) {
                        healthHaConnection.close();
                    }
                }
            } else {
                 checks.home_assistant_connection = "skipped: URI or Token not configured";
                 overallStatus = "error"; // Critical if not configured
                 httpStatus = 503;
            }


            // Check D1 Database
            if (env.DB) {
                if (d1) {
                    try {
                        await d1.select({ value: sql`1` }).execute();
                        checks.d1_database = "ok";
                    } catch (e) {
                        checks.d1_database = `error: ${e.message}`;
                        overallStatus = "error";
                        httpStatus = 503;
                    }
                } else {
                    checks.d1_database = "error: D1 binding found but instance not initialized";
                    overallStatus = "error";
                    httpStatus = 503;
                }
            } else {
                checks.d1_database = "skipped: D1 binding (DB) not configured";
                // Not necessarily critical if other parts of the app don't strictly need D1 for health
            }

            // Check KV Store
            if (env.KV) {
                if (kv) {
                    try {
                        await kv.get("health-check-dummy-key"); // Operation itself is the test
                        checks.kv_store = "ok";
                    } catch (e) {
                        checks.kv_store = `error: ${e.message}`;
                        overallStatus = "error";
                        httpStatus = 503;
                    }
                } else {
                    checks.kv_store = "error: KV binding found but instance not initialized";
                    overallStatus = "error";
                    httpStatus = 503;
                }
            } else {
                checks.kv_store = "skipped: KV binding not configured";
                 // Not necessarily critical
            }
            
            if (request.method === 'HEAD') {
                return new Response(null, { status: httpStatus });
            }

            return jsonResponse({
                status: overallStatus,
                timestamp: new Date().toISOString(),
                checks,
            }, httpStatus);
        } else {
            return jsonResponse({ error: `Method ${request.method} not allowed for /api/health` }, 405);
        }
    }


    // --- Regular API Authorization and Routing ---
    const requestApiKey = request.headers.get('Authorization');
    if (!env.WORKER_API_KEY) {
        console.error("WORKER_API_KEY is not set in environment variables.");
        return jsonResponse({ error: "Worker API key not configured." }, 500);
    }
    if (!requestApiKey || requestApiKey !== `Bearer ${env.WORKER_API_KEY}`) {
      return jsonResponse({ error: 'Unauthorized to use worker API.' }, 401);
    }

    const HASS_URI = env.HOMEASSISTANT_URI;
    const HASS_TOKEN = env.HOMEASSISTANT_TOKEN;

    if (!HASS_URI || !HASS_TOKEN) {
      console.error("Home Assistant URI or Token not configured in worker secrets.");
      return jsonResponse({ error: "Home Assistant credentials not configured." }, 500);
    }

    let haConnection; // Main HA connection for API calls
    try {
      haConnection = await initConnection(HASS_URI, HASS_TOKEN);

      if (pathParts.length < 2 || pathParts[0] !== 'api') {
        return jsonResponse({ error: 'Invalid API path. Expected /api/<action>' }, 400);
      }

      const action = pathParts[1]; // pathParts[1] is now safe due to health check being pathParts[1] === 'health'
      let requestBody = {};
      if (request.method === 'POST' || request.method === 'PUT') {
        try {
          requestBody = await request.json();
        } catch (e) {
          return jsonResponse({ error: 'Invalid JSON body' }, 400);
        }
      }

      switch (action) {
        case 'entities':
          if (request.method === 'GET') {
            const entities = await getAllOrganizedEntities(haConnection, env, ctx);
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
          return jsonResponse({ error: `Method ${request.method} not allowed` }, 405);

        case 'services':
          if (request.method === 'GET') {
            const services = await getAvailableServices(haConnection);
            return jsonResponse(services);
          }
          return jsonResponse({ error: `Method ${request.method} not allowed` }, 405);

        case 'call-service':
          if (request.method === 'POST') {
            const { domain, service, serviceData } = requestBody;
            if (!domain || !service) {
              return jsonResponse({ error: 'Missing domain or service in request body' }, 400);
            }
            await callService(haConnection, domain, service, serviceData || {});
            
            if (d1 && serviceData && serviceData.entity_id && ctx && typeof ctx.waitUntil === 'function') {
              try {
                const entityIdValue = Array.isArray(serviceData.entity_id) ? serviceData.entity_id.join(',') : serviceData.entity_id;
                ctx.waitUntil(
                    d1.insert(entityInteractionsSchema).values({
                        entityId: entityIdValue,
                        domain,
                        service,
                    }).execute()
                );
              } catch (logError) {
                console.error("D1 logging error (call-service):", logError);
              }
            }
            return jsonResponse({ success: true, message: `Service ${domain}.${service} called.` });
          }
          return jsonResponse({ error: `Method ${request.method} not allowed` }, 405);
        
        case 'capture-ha-activity':
            if (request.method === 'GET') {
                if (!haConnection || !haConnection.connected) {
                    return jsonResponse({ error: "Home Assistant connection not established." }, 500);
                }
                if (!d1) {
                    return jsonResponse({ error: "D1 Database not available for logging events." }, 500);
                }

                let eventUnsubscribe = null;
                let capturedEventCount = 0;
                const maxCaptureDuration = 15000; 

                try {
                    console.log("Attempting to subscribe to Home Assistant events...");

                    const eventHandler = async (event) => {
                        capturedEventCount++;
                        if (d1 && event.event_type && event.data && ctx && typeof ctx.waitUntil === 'function') {
                            try {
                                ctx.waitUntil(
                                    d1.insert(homeAssistantEventsSchema).values({
                                        eventType: event.event_type,
                                        eventData: JSON.stringify(event.data), 
                                    }).execute()
                                    .catch(dbWriteError => console.error('D1 event insert error:', dbWriteError))
                                );
                            } catch (dbError) {
                                console.error('D1 event logging submission error:', dbError);
                            }
                        }
                    };
                    
                    eventUnsubscribe = await haConnection.subscribeEvents(eventHandler);
                    console.log("Successfully subscribed to Home Assistant events. Capturing activity...");

                    await new Promise(resolve => setTimeout(resolve, maxCaptureDuration));

                    return jsonResponse({ 
                        success: true, 
                        message: `Captured HA activity for ${maxCaptureDuration / 1000} seconds. ${capturedEventCount} events processed (check D1 logs).`,
                        eventsCaptured: capturedEventCount 
                    });

                } catch (subError) {
                    console.error("Error during HA event subscription or capture:", subError);
                    return jsonResponse({ error: `Failed to capture HA activity: ${subError.message}` }, 500);
                } finally {
                    if (eventUnsubscribe) {
                        try {
                            await eventUnsubscribe();
                            console.log("Unsubscribed from Home Assistant events.");
                        } catch (unsubError) {
                            console.error("Error unsubscribing from HA events:", unsubError);
                        }
                    }
                }
            }
            return jsonResponse({ error: `Method ${request.method} not allowed` }, 405);

        case 'panels':
          if (request.method === 'GET') {
            const panels = await getAvailablePanels(haConnection);
            return jsonResponse(panels);
          }
          return jsonResponse({ error: `Method ${request.method} not allowed` }, 405);

        case 'lovelace-config':
           if (request.method === 'GET') {
            const lovelaceConfig = await getLovelaceConfiguration(haConnection);
            return jsonResponse(lovelaceConfig);
          }
          return jsonResponse({ error: `Method ${request.method} not allowed` }, 405);
        
        case 'card-config':
          if (request.method === 'GET') {
            const cardId = url.searchParams.get('cardId');
            if (!cardId) return jsonResponse({ error: 'Missing cardId query parameter' }, 400);
            const cardConfig = await getCardConfiguration(haConnection, cardId);
            return jsonResponse(cardConfig);
          }
          return jsonResponse({ error: `Method ${request.method} not allowed` }, 405);

        case 'entity-registry':
          if (request.method === 'GET') {
            const entities = await getEntityRegistryEntries(haConnection);
            return jsonResponse(entities);
          }
          return jsonResponse({ error: `Method ${request.method} not allowed` }, 405);

        case 'device-registry':
          if (request.method === 'GET') {
            const devices = await getDeviceRegistryEntries(haConnection);
            return jsonResponse(devices);
          }
          return jsonResponse({ error: `Method ${request.method} not allowed` }, 405);

        case 'area-registry':
          if (request.method === 'GET') {
            const areas = await getAreaRegistryEntries(haConnection);
            return jsonResponse(areas);
          }
          return jsonResponse({ error: `Method ${request.method} not allowed` }, 405);
        
        case 'suggested-entities':
            if (request.method === 'GET') {
                if (!d1) return jsonResponse({ error: "D1 Database not available for suggestions." }, 500);
                try {
                    const results = await d1.select({
                        entityId: entityInteractionsSchema.entityId,
                        interactionCount: count(entityInteractionsSchema.entityId)
                    })
                    .from(entityInteractionsSchema)
                    .groupBy(entityInteractionsSchema.entityId)
                    .orderBy(desc(count(entityInteractionsSchema.entityId)))
                    .limit(10)
                    .execute();
                    
                    return jsonResponse(results);
                } catch (suggestError) {
                    console.error("Error fetching suggestions from D1:", suggestError);
                    return jsonResponse({ error: `Failed to get suggestions: ${suggestError.message}` }, 500);
                }
            }
            return jsonResponse({ error: `Method ${request.method} not allowed` }, 405);

        case 'ai-entity-insight':
            if (request.method === 'GET') {
                const entityIdParam = url.searchParams.get('entity_id');
                if (!entityIdParam) return jsonResponse({ error: 'Missing entity_id query parameter' }, 400);

                try {
                    const entityState = await getEntityState(haConnection, entityIdParam);
                    if (!entityState) return jsonResponse({ error: `Entity ${entityIdParam} not found.` }, 404);

                    let recentInteractionsD1 = [];
                    if (d1) {
                        recentInteractionsD1 = await d1.select()
                            .from(entityInteractionsSchema)
                            .where(eq(entityInteractionsSchema.entityId, entityIdParam))
                            .orderBy(desc(entityInteractionsSchema.timestamp))
                            .limit(5)
                            .execute();
                    }
                    
                    const prompt = `Given the Home Assistant entity "${entityIdParam}" with current state: ${JSON.stringify(entityState)}. Recent interactions (from D1) with this entity include: ${JSON.stringify(recentInteractionsD1)}. What are some useful insights or common next actions for this entity? Be concise.`;
                    
                    let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
                    const payload = { contents: chatHistory };
                    const geminiApiKey = ""; 
                    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
                    
                    const geminiResponse = await fetch(geminiApiUrl, {
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
                    
                    if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
                        const insightText = result.candidates[0].content.parts[0].text;
                        return jsonResponse({ entityId: entityIdParam, state: entityState, insight: insightText, recentInteractions: recentInteractionsD1 });
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
          // This check is now after the health check, so pathParts[1] will exist if we reach here.
          return jsonResponse({ error: `Unknown API action: ${action}` }, 404);
      }

    } catch (error) {
      console.error("Worker main error handler:", error);
      const errorMessage = (error instanceof Error) ? error.message : String(error);
      // If haConnection failed to initialize, it might be null here.
      // The error from initConnection will be caught and re-thrown, then caught here.
      return jsonResponse({ error: `Worker failed: ${errorMessage}` }, 500);
    } finally {
      if (haConnection && haConnection.connected && typeof haConnection.close === 'function') {
        try {
            haConnection.close();
        } catch (closeError) {
            console.error("Error closing Home Assistant connection in main finally block:", closeError);
        }
      }
    }
  },
};
