# hassio-proxy-worker (draft scaffold)

This draft sets the foundation for an **Alexa-skill REST API**:

- `/v1/*` endpoints return Alexa-friendly JSON `{ ok, speech, card?, data }`.
- `/openapi.json` publishes a placeholder spec for skill-side integration.
- `wrangler.toml` now points to **dist/index.js** and includes placeholder bindings for **D1**, **KV**, **R2**.
- TypeScript build pipeline via `tsconfig.json` and `pnpm build`.
- `/v1/ai/summary` demonstrates Workers AI usage via the Vercel AI SDK.

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
