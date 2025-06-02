# Hass.io Proxy Worker

This Cloudflare Worker acts as a secure CORS-friendly proxy to the Home Assistant API, enabling frontend and third-party access to Hass.io services.

## Features

- Proxies all `/api/...` routes to your Home Assistant instance
- Adds appropriate CORS (headers) for public or restricted access
- Filters out `device_tracker` entities from entity data
- Includes a WebSocket API Client for live updates and control

## Deploy to Cloudflare Workers

Click the button below to quickly deploy this Worker to your Cloudflare account:

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/jmbish04/hassio-proxy-worker)

## Setup

Set your `HOMEASSISTANT_TOKEN` in `wrangler.toml` or Cloudflare dashboard

Update the `targetUrl` base in `src/index.js` to match your Nabu Casa URL or local instance
