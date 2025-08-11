# MCP Cloudflare Worker

This project exposes a minimal [Model Context Protocol](https://github.com/modelcontextprotocol) (MCP) style tool as a Cloudflare Worker using [Hono](https://hono.dev/).
It provides a simple REST interface that can be called from voice assistants or other clients.

## Features
- **Health check** at `/health`
- **Echo tool** at `/v1/echo` for MCP style interactions
- **Time endpoint** at `/v1/time` demonstrating fast edge responses
- Uses **KV** to persist the last echoed message with `waitUntil` for non-blocking writes

## Development

Install dependencies:
```bash
npm install
```

Run the worker locally:
```bash
npm run dev
```

Run tests:
```bash
npm test
```

## Deployment

Ensure `wrangler.toml` is configured with your account details and KV namespace.
Then deploy using:
```bash
npm run deploy
```

## Edge optimisation
- Responses are served from Cloudflare's edge network for low latency.
- The time endpoint uses caching headers so repeat requests are served efficiently.
- Background writes to KV use `waitUntil` to avoid blocking the response.
