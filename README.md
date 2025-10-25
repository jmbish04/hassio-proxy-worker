# hassio-proxy-worker (draft scaffold)

This draft sets the foundation for an **Alexa-skill REST API**:

- `/v1/*` endpoints return Alexa-friendly JSON `{ ok, speech, card?, data }`.
- `/openapi.json` publishes a placeholder spec for skill-side integration.
- `wrangler.toml` now points to **dist/index.js** and includes placeholder bindings for **D1**, **KV**, **R2**.
- TypeScript build pipeline via `tsconfig.json` and `pnpm build`.
- `/v1/ai/summary` demonstrates Workers AI usage via the Vercel AI SDK.
- **Configurable AI Models**: Environment variables for easy AI model switching without code changes.

## Features

- **✅ Generated Runtime Types**: Migrated from `@cloudflare/workers-types` to Wrangler v4 generated types
- **✅ Configurable AI Models**: AI models are now configurable via environment variables (see `AI_MODELS.md`)
- **✅ WebSocket Support**: Durable Object-based WebSocket server for real-time Home Assistant communication
- **✅ Test Coverage**: Comprehensive test suite with 11 passing tests

## Dev
```bash
pnpm i
pnpm dev
```

## Deploy
```bash
pnpm deploy
```

## Next
- Implement LAN scan (via Tunnel) and D1 upsert in `/v1/devices/scan`.
- Implement UniFi Protect client and snapshot-to-R2 in `/v1/protect/*`.
- Add tracing tables (`events`, `actions`) and KV rate limiting middleware.
