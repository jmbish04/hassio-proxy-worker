import {
  callService,
  createConnection,
  createLongLivedTokenAuth,
  getConfig,
  getServices,
  getStates,
  getUser,
  subscribeConfig,
  subscribeEntities,
  subscribeServices,
} from "home-assistant-js-websocket";



// Drizzle ORM and D1 imports
import { count, desc, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';

// Hono for routing
import { Hono } from 'hono';
import { cors } from 'hono/cors';

// --- Drizzle Schema Definition ---
// At the top of src/index.js, replace the schema definition with:
import { entityInteractionsSchema, homeAssistantEventsSchema } from './db/schema.js';

// Remove the schema definitions and just keep:
const drizzleSchemaObject = {
    entityInteractionsSchema,
    homeAssistantEventsSchema,
};



// --- Globals for D1, KV, and Hono App ---
let d1;
let kv;
const app = new Hono(); // Hono app instance

/**
 * Initializes Drizzle ORM for D1 and sets up KV if not already initialized.
 * @param {Object} env - Cloudflare Worker environment variables.
 */
const ensureD1KVInitialized = (env) => {
  if (!d1 && env.DB) {
    d1 = drizzle(env.DB, { schema: drizzleSchemaObject }); // Use the renamed schema object
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

// --- OpenAPI 3.1.0 Specification ---
// For a larger project, move this to a separate file (e.g., openapi-spec.js)
const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Home Assistant Proxy Worker API",
    version: "1.0.0",
    description: "A Cloudflare Worker to proxy requests to Home Assistant, log interactions, and provide insights.",
  },
  servers: [
    {
      url: "{workerUrl}", // Variable for worker URL, will be dynamically set or user-provided
      variables: {
        workerUrl: {
          default: "https://your-worker-name.your-account.workers.dev", // Replace with actual or placeholder
          description: "The base URL of this Cloudflare Worker.",
        },
      },
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "API_KEY",
        description: "Worker API Key for authorization."
      }
    }
  },
  security: [ // Global security, applied to all paths unless overridden
    {
      BearerAuth: []
    }
  ],
  paths: {
    "/api/health": {
      get: {
        summary: "Service Health Check",
        description: "Verifies the health of the worker and its downstream dependencies (Home Assistant, D1, KV). This endpoint does not require authorization.",
        security: [], // Override global security
        responses: {
          "200": { description: "Service is healthy.", content: { "application/json": { schema: { type: "object" } } } },
          "503": { description: "Service is unhealthy.", content: { "application/json": { schema: { type: "object" } } } }
        }
      }
    },
    "/api/entities": {
      get: {
        summary: "Get All Organized Entities",
        description: "Fetches all entities from Home Assistant, organized by domain, excluding device_trackers. Uses KV caching.",
        responses: { "200": { description: "A map of entities.", content: { "application/json": { schema: { type: "object" } } } } }
      }
    },
    "/api/config": {
      get: {
        summary: "Get Home Assistant Configuration",
        responses: { "200": { description: "Home Assistant configuration object.", content: { "application/json": { schema: { type: "object" } } } } }
      }
    },
    "/api/user": {
      get: {
        summary: "Get Home Assistant User Info",
        responses: { "200": { description: "Home Assistant user object.", content: { "application/json": { schema: { type: "object" } } } } }
      }
    },
     "/api/services": {
      get: {
        summary: "Get Available Home Assistant Services",
        responses: { "200": { description: "Object describing available services.", content: { "application/json": { schema: { type: "object" } } } } }
      }
    },
    "/api/call-service": {
      post: {
        summary: "Call a Home Assistant Service",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  domain: { type: "string", example: "light" },
                  service: { type: "string", example: "turn_on" },
                  serviceData: { type: "object", additionalProperties: true, example: { entity_id: "light.living_room" } }
                },
                required: ["domain", "service"]
              }
            }
          }
        },
        responses: { "200": { description: "Service called successfully.", content: { "application/json": { schema: { type: "object", properties: { success: {type: "boolean"}, message: {type: "string"} } } } } } }
      }
    },
    "/api/capture-ha-activity": {
      get: {
        summary: "Capture Home Assistant Activity",
        description: "Subscribes to Home Assistant events for a short duration and logs them to D1.",
        responses: { "200": { description: "Activity capture initiated/completed.", content: { "application/json": { schema: { type: "object" } } } } }
      }
    },
    "/api/panels": {
      get: {
        summary: "Get Home Assistant Panels",
        responses: { "200": { description: "Object describing available panels.", content: { "application/json": { schema: { type: "object" } } } } }
      }
    },
    "/api/lovelace-config": {
      get: {
        summary: "Get Home Assistant Lovelace Configuration",
        responses: { "200": { description: "Lovelace configuration object.", content: { "application/json": { schema: { type: "object" } } } } }
      }
    },
    "/api/card-config": {
      get: {
        summary: "Get Home Assistant Card Configuration",
        parameters: [
          { name: "cardId", in: "query", required: true, schema: { type: "string" }, description: "The ID of the card." }
        ],
        responses: { "200": { description: "Card configuration object.", content: { "application/json": { schema: { type: "object" } } } } }
      }
    },
    "/api/entity-registry": {
      get: {
        summary: "Get Home Assistant Entity Registry",
        responses: { "200": { description: "Array of entity registry entries.", content: { "application/json": { schema: { type: "array", items: { type: "object"} } } } } }
      }
    },
    "/api/device-registry": {
      get: {
        summary: "Get Home Assistant Device Registry",
        responses: { "200": { description: "Array of device registry entries.", content: { "application/json": { schema: { type: "array", items: { type: "object"} } } } } }
      }
    },
    "/api/area-registry": {
      get: {
        summary: "Get Home Assistant Area Registry",
        responses: { "200": { description: "Array of area registry entries.", content: { "application/json": { schema: { type: "array", items: { type: "object"} } } } } }
      }
    },
    "/api/suggested-entities": {
      get: {
        summary: "Get Suggested Entities",
        description: "Returns a list of entities likely to be interacted with based on past usage.",
        responses: { "200": { description: "Array of suggested entities with interaction counts.", content: { "application/json": { schema: { type: "array", items: { type: "object"} } } } } }
      }
    },
    "/api/ai-entity-insight": {
      get: {
        summary: "Get AI Insight for an Entity",
        parameters: [
          { name: "entity_id", in: "query", required: true, schema: { type: "string" }, description: "The entity_id to get insights for." }
        ],
        responses: { "200": { description: "AI-generated insight for the entity.", content: { "application/json": { schema: { type: "object" } } } } }
      }
    }
  }
};

// --- RapiDoc HTML ---
// For a larger project, this could be a separate HTML file served as a static asset
const rapidocHTML = (workerUrl) => `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script type="module" src="https://unpkg.com/rapidoc/dist/rapidoc-min.js"></script>
  <title>HA Proxy Worker API Docs</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
    rapi-doc { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <rapi-doc
    spec-url="${workerUrl}/openapi.json"
    theme="dark"
    render-style="view"
    show-header="false"
    allow-server-selection="false"
    allow-authentication="true"
    regular-font="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
    mono-font="'Courier New', Courier, monospace"
  > </rapi-doc>
</body>
</html>
`;

// --- Home Assistant Client Functions (as defined before) ---
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
    throw new Error(`Connection to Home Assistant failed: ${error.message}`);
  }
};
export const getAllOrganizedEntities = async (connection, env, ctx) => {
  if (!connection) throw new Error("Connection object is required.");
  const CACHE_KEY = `all-entities-cache:${env.HOMEASSISTANT_URI || 'default_ha_uri'}`;
  const CACHE_TTL_SECONDS = 60;
  if (kv) {
    try { const cached = await kv.get(CACHE_KEY, { type: "json" }); if (cached) {
      // Filter out device_tracker from cache too
      const filtered = {};
      Object.entries(cached).forEach(([domain, ents]) => {
        if (domain !== 'device_tracker') filtered[domain] = ents;
      });
      return filtered;
    } }
    catch (e) { console.error("KV get error for all entities:", e); }
  }
  const states = await getStates(connection);
  const organizedEntities = {};
  states.filter(e => e && e.entity_id && !e.entity_id.startsWith("device_tracker.") )
    .forEach(e => { const [d] = e.entity_id.split("."); if (!organizedEntities[d]) organizedEntities[d] = {}; organizedEntities[d][e.entity_id] = e; });
  if (kv && ctx && typeof ctx.waitUntil === 'function') {
    try { ctx.waitUntil(kv.put(CACHE_KEY, JSON.stringify(organizedEntities), { expirationTtl: CACHE_TTL_SECONDS })); }
    catch (e) { console.error("KV put error for all entities:", e); }
  }
  return organizedEntities;
};
export const getEntityState = async (connection, entityId) => {
    if (!connection || !entityId) throw new Error("Connection or Entity ID missing.");
    const states = await getStates(connection); return states.find(s => s.entity_id === entityId) || null;
};
export const callExampleService = async (c, d = "light", s = "turn_on", sd = { entity_id: "light.living_room" }) => { if (!c) throw new Error("Conn required."); await callService(c, d, s, sd); console.log(`Svc ${d}.${s} called`, sd);};
export const subscribeToStateChanges = (c, cb) => { if(!c || typeof cb !== 'function') throw new Error("Conn/CB err."); return subscribeEntities(c, ents => { const f={}; Object.entries(ents).forEach(([id,es]) => { if(id && !id.startsWith("device_tracker.")) f[id]=es;}); cb(f);});};
export const getConfiguration = async c => { if(!c) throw new Error("Conn required."); return getConfig(c);};
export const getUserInfo = async c => { if(!c) throw new Error("Conn required."); return getUser(c);};
export const getAvailableServices = async c => { if(!c) throw new Error("Conn required."); return getServices(c);};
export const getAvailablePanels = async c => { if(!c) throw new Error("Conn required."); return c.sendMessagePromise({ type: "get_panels" }); };
export const getLovelaceConfiguration = async c => { if(!c) throw new Error("Conn required."); return c.sendMessagePromise({ type: "lovelace/config" }); };
export const getCardConfiguration = async (c, id) => { if(!c || !id) throw new Error("Conn/ID err."); return c.sendMessagePromise({ type: "lovelace/card/get_config", card_id: id }); };
export const subscribeToConfigChanges = (c, cb) => { if(!c || typeof cb !== 'function') throw new Error("Conn/CB err."); return subscribeConfig(c, cb);};
export const subscribeToServiceChanges = (c, cb) => { if(!c || typeof cb !== 'function') throw new Error("Conn/CB err."); return subscribeServices(c, cb);};
export const getEntityRegistryEntries = async c => { if(!c) throw new Error("Conn required."); return c.sendMessagePromise({ type: "config/entity_registry/list" }); };
export const getDeviceRegistryEntries = async c => { if(!c) throw new Error("Conn required."); return c.sendMessagePromise({ type: "config/device_registry/list" }); };
export const getAreaRegistryEntries = async c => { if(!c) throw new Error("Conn required."); return c.sendMessagePromise({ type: "config/area_registry/list" }); };


// --- Hono Middleware ---
// CORS Middleware
app.use('*', cors({ origin: '*' })); // Allow all origins

// Initialization Middleware (runs for all requests)
app.use('*', async (c, next) => {
  try {
    ensureD1KVInitialized(c.env);
  } catch (initError) {
    console.error("Critical: D1/KV initialization failed in middleware:", initError);
    // Allow request to proceed, health check will report specific D1/KV status
  }
  await next();
});

// Authorization Middleware (for /api/* routes, excluding public ones)
app.use('/api/*', async (c, next) => {
  const path = new URL(c.req.url).pathname;
  const publicApiPaths = ['/api/health', '/api/openapi.json', '/api/docs']; // Adjusted to match Hono routing

  if (publicApiPaths.includes(path) || path === '/openapi.json' || path === '/docs') { // Direct check for root paths
    await next();
    return;
  }

  const requestApiKey = c.req.header('Authorization');
  if (!c.env.WORKER_API_KEY) {
    console.error("WORKER_API_KEY is not set in environment variables.");
    return c.json({ error: "Worker API key not configured." }, 500);
  }
  if (!requestApiKey || requestApiKey !== `Bearer ${c.env.WORKER_API_KEY}`) {
    return c.json({ error: 'Unauthorized to use worker API.' }, 401);
  }
  await next();
});


// --- Hono Public Routes ---
app.get('/openapi.json', (c) => {
  const workerUrl = new URL(c.req.url).origin;
  const dynamicSpec = JSON.parse(JSON.stringify(openApiSpec)); // Deep clone
  dynamicSpec.servers[0].variables.workerUrl.default = workerUrl; // Set dynamic worker URL
  return c.json(dynamicSpec);
});

app.get('/docs', (c) => {
  const workerUrl = new URL(c.req.url).origin;
  return c.html(rapidocHTML(workerUrl));
});

// --- Hono API Routes ---
// Health Check (already public via middleware logic, but explicit route is fine)
app.get('/api/health', async (c) => {
    const HASS_URI_HEALTH = c.env.HOMEASSISTANT_URI;
    const HASS_TOKEN_HEALTH = c.env.HOMEASSISTANT_TOKEN;
    let overallStatus = "ok";
    let httpStatus = 200;
    const checks = { /* ... health check logic ... */ }; // Keep existing health logic

    checks.worker = "ok";
    checks.home_assistant_uri_configured = HASS_URI_HEALTH ? "ok" : "error: HOMEASSISTANT_URI not configured";
    checks.home_assistant_token_configured = HASS_TOKEN_HEALTH ? "ok" : "error: HOMEASSISTANT_TOKEN not configured";
    checks.home_assistant_connection = "pending";
    checks.d1_database = "pending";
    checks.kv_store = "pending";

    if (!HASS_URI_HEALTH || !HASS_TOKEN_HEALTH) { overallStatus = "error"; httpStatus = 503; }

    let healthHaConnection;
    if (HASS_URI_HEALTH && HASS_TOKEN_HEALTH) {
        try { healthHaConnection = await initConnection(HASS_URI_HEALTH, HASS_TOKEN_HEALTH); await getConfig(healthHaConnection); checks.home_assistant_connection = "ok"; }
        catch (e) { checks.home_assistant_connection = `error: ${e.message}`; overallStatus = "error"; httpStatus = 503; }
        finally { if (healthHaConnection && healthHaConnection.connected) healthHaConnection.close(); }
    } else { checks.home_assistant_connection = "skipped: URI or Token not configured"; overallStatus = "error"; httpStatus = 503; }

    if (c.env.DB) {
        if (d1) { try { await d1.select({ value: sql`1` }).execute(); checks.d1_database = "ok"; } catch (e) { checks.d1_database = `error: ${e.message}`; overallStatus = "error"; httpStatus = 503; } }
        else { checks.d1_database = "error: D1 binding found but instance not initialized"; overallStatus = "error"; httpStatus = 503; }
    } else { checks.d1_database = "skipped: D1 binding (DB) not configured"; }

    if (c.env.KV) {
        if (kv) { try { await kv.get("health-check-dummy-key"); checks.kv_store = "ok"; } catch (e) { checks.kv_store = `error: ${e.message}`; overallStatus = "error"; httpStatus = 503; } }
        else { checks.kv_store = "error: KV binding found but instance not initialized"; overallStatus = "error"; httpStatus = 503; }
    } else { checks.kv_store = "skipped: KV binding not configured"; }

    return c.json({ status: overallStatus, timestamp: new Date().toISOString(), checks }, httpStatus);
});

// Home Assistant Connection Middleware (for routes needing HA)
const haAuthMiddleware = async (c, next) => {
  const HASS_URI = c.env.HOMEASSISTANT_URI;
  const HASS_TOKEN = c.env.HOMEASSISTANT_TOKEN;
  if (!HASS_URI || !HASS_TOKEN) {
    return c.json({ error: "Home Assistant credentials not configured." }, 500);
  }
  let haConnection;
  try {
    haConnection = await initConnection(HASS_URI, HASS_TOKEN);
    c.set('haConnection', haConnection); // Make connection available to subsequent handlers
    await next();
  } catch (error) {
    return c.json({ error: `Worker failed to connect to Home Assistant: ${error.message}` }, 500);
  } finally {
    if (haConnection && haConnection.connected && typeof haConnection.close === 'function') {
      try { haConnection.close(); }
      catch (closeError) { console.error("Error closing HA connection in middleware:", closeError); }
    }
  }
};

// Apply HA Auth Middleware to relevant routes
app.use('/api/*', haAuthMiddleware); // Apply to all /api/* that are not public

// --- API Endpoints using Hono ---
app.get('/api/entities', async (c) => {
  const haConnection = c.get('haConnection');
  const entities = await getAllOrganizedEntities(haConnection, c.env, c.executionCtx);
  // Filter out device_tracker entities at the API response level as well
  const filtered = {};
  Object.entries(entities).forEach(([domain, ents]) => {
    if (domain !== 'device_tracker') {
      filtered[domain] = ents;
    }
  });
  return c.json(filtered);
});

app.get('/api/config', async (c) => {
  const haConnection = c.get('haConnection');
  const config = await getConfiguration(haConnection);
  return c.json(config);
});

app.get('/api/user', async (c) => {
  const haConnection = c.get('haConnection');
  const user = await getUserInfo(haConnection);
  return c.json(user);
});

app.get('/api/services', async (c) => {
  const haConnection = c.get('haConnection');
  const services = await getAvailableServices(haConnection);
  return c.json(services);
});

app.post('/api/call-service', async (c) => {
  const haConnection = c.get('haConnection');
  const { domain, service, serviceData } = await c.req.json();
  if (!domain || !service) {
    return c.json({ error: 'Missing domain or service in request body' }, 400);
  }
  await callService(haConnection, domain, service, serviceData || {});
  if (d1 && serviceData && serviceData.entity_id && c.executionCtx && typeof c.executionCtx.waitUntil === 'function') {
    try {
      const entityIdValue = Array.isArray(serviceData.entity_id) ? serviceData.entity_id.join(',') : serviceData.entity_id;
      c.executionCtx.waitUntil(
          d1.insert(entityInteractionsSchema).values({ entityId: entityIdValue, domain, service }).execute()
      );
    } catch (logError) { console.error("D1 logging error (call-service):", logError); }
  }
  return c.json({ success: true, message: `Service ${domain}.${service} called.` });
});

app.get('/api/capture-ha-activity', async (c) => {
  const haConnection = c.get('haConnection');
  if (!haConnection || !haConnection.connected) return c.json({ error: "HA connection not established." }, 500);
  if (!d1) return c.json({ error: "D1 Database not available for logging events." }, 500);

  let eventUnsubscribe = null; let capturedEventCount = 0; const maxCaptureDuration = 15000;
  try {
    const eventHandler = async (event) => {
      capturedEventCount++;
      if (d1 && event.event_type && event.data && c.executionCtx && typeof c.executionCtx.waitUntil === 'function') {
        c.executionCtx.waitUntil(
            d1.insert(homeAssistantEventsSchema).values({ eventType: event.event_type, eventData: JSON.stringify(event.data) }).execute()
            .catch(dbWriteError => console.error('D1 event insert error:', dbWriteError))
        );
      }
    };
    eventUnsubscribe = await haConnection.subscribeEvents(eventHandler);
    await new Promise(resolve => setTimeout(resolve, maxCaptureDuration));
    return c.json({ success: true, message: `Captured HA activity for ${maxCaptureDuration/1000}s. ${capturedEventCount} events.`, eventsCaptured: capturedEventCount });
  } catch (subError) { return c.json({ error: `Failed to capture HA activity: ${subError.message}` }, 500); }
  finally { if (eventUnsubscribe) { try { await eventUnsubscribe(); } catch (unsubError) { console.error("Error unsubscribing from HA events:", unsubError);}}}
});

app.get('/api/panels', async (c) => c.json(await getAvailablePanels(c.get('haConnection'))));
app.get('/api/lovelace-config', async (c) => c.json(await getLovelaceConfiguration(c.get('haConnection'))));
app.get('/api/card-config', async (c) => {
  const cardId = c.req.query('cardId');
  if (!cardId) return c.json({ error: 'Missing cardId query parameter' }, 400);
  return c.json(await getCardConfiguration(c.get('haConnection'), cardId));
});
app.get('/api/entity-registry', async (c) => c.json(await getEntityRegistryEntries(c.get('haConnection'))));
app.get('/api/device-registry', async (c) => c.json(await getDeviceRegistryEntries(c.get('haConnection'))));
app.get('/api/area-registry', async (c) => c.json(await getAreaRegistryEntries(c.get('haConnection'))));

app.get('/api/suggested-entities', async (c) => {
  if (!d1) return c.json({ error: "D1 Database not available for suggestions." }, 500);
  try {
    const results = await d1.select({ entityId: entityInteractionsSchema.entityId, interactionCount: count(entityInteractionsSchema.entityId) })
      .from(entityInteractionsSchema).groupBy(entityInteractionsSchema.entityId).orderBy(desc(count(entityInteractionsSchema.entityId))).limit(10).execute();
    return c.json(results);
  } catch (e) { console.error("Err D1 suggestions:", e); return c.json({ error: `Failed suggestions: ${e.message}`}, 500);}
});

app.get('/api/ai-entity-insight', async (c) => {
  const entityIdParam = c.req.query('entity_id');
  if (!entityIdParam) return c.json({ error: 'Missing entity_id query parameter' }, 400);
  const haConnection = c.get('haConnection');
  try {
    const entityState = await getEntityState(haConnection, entityIdParam);
    if (!entityState) return c.json({ error: `Entity ${entityIdParam} not found.` }, 404);
    let recentInteractionsD1 = [];
    if (d1) {
      recentInteractionsD1 = await d1.select().from(entityInteractionsSchema).where(eq(entityInteractionsSchema.entityId, entityIdParam)).orderBy(desc(entityInteractionsSchema.timestamp)).limit(5).execute();
    }
    const prompt = `Given HA entity "${entityIdParam}" state: ${JSON.stringify(entityState)}. Recent interactions: ${JSON.stringify(recentInteractionsD1)}. Useful insights/next actions? Concise.`;

    // Use Cloudflare AI binding
    if (!c.env.AI) {
        return c.json({ error: "AI binding not configured in worker environment." }, 500);
    }
    const aiModel = c.env.AI_MODEL || "@cf/meta/llama-3-8b-instruct"; // Default to a Llama model if not set

    const messages = [
        { role: "system", content: "You are a helpful assistant providing insights about Home Assistant entities." },
        { role: "user", content: prompt }
    ];

    let aiResult;
    try {
        aiResult = await c.env.AI.run(aiModel, { messages });
    } catch (aiRunError) {
        console.error(`Error running AI model ${aiModel}:`, aiRunError);
        return c.json({ error: `Failed to run AI model: ${aiRunError.message}`, modelUsed: aiModel }, 500);
    }

    // The response structure from c.env.AI.run for chat models is typically { response: "..." }
    if (aiResult && typeof aiResult.response === 'string') {
      return c.json({ entityId: entityIdParam, state: entityState, insight: aiResult.response, recentInteractions: recentInteractionsD1 });
    } else {
      console.error("Unexpected API response structure from model:", aiModel, aiResult);
      return c.json({ error: "Failed to get insight from AI, unexpected response format.", modelUsed: aiModel, details: aiResult }, 500);
    }
  } catch (aiError) {
    console.error("AI insight err:", aiError);
    return c.json({ error: `Failed to get AI insight: ${aiError.message}` }, 500);
  }
});


// Fallback for 404
app.notFound((c) => {
  return c.json({ error: 'Not Found', message: `The path ${c.req.url} was not found.` }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled Hono Error:', err);
  return c.json({ error: 'Internal Server Error', message: err.message }, 500);
});

// Export the Hono app's fetch handler
export default {
  fetch: app.fetch,
};
