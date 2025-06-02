addEventListener("fetch", event = {
  event.respondWith(handleRequest(event.request))
})

const ALLOWED_ORIGINS = ["*"] // Customize as needed

async function handleRequest(request) {
  const url = new URL(request.url)
  const haPath = url.pathname.replace(/^\/?api\/?/, "")

  const targetUrl = `https://rpcsurqki2awrf1lukibtypjv2ochwqb.ui.nabu.casa/api/${haPath}${url.search}`

  const haHeaders = {
    'Authorization': `Bearer ${HOMEASSISTANT_TOKEN}`,
    'Content-Type': 'application/json'
  }

  const init = {
    method: request.method,
    headers: haHeaders,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.text() : undefined,
  }

  // Preflight CORS
  if (request.method === "OPTIONS") {
    const resHeaders = new Headers()
    resHeaders.set("Access-Control-Allow-Origin", ALLOWED_ORIGINS.includes("*") ? "*" : request.headers.get("Origin"))
    resHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    resHeaders.set("Access