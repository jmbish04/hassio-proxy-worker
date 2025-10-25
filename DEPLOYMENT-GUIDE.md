# 🚀 Brain System Deployment Guide

## Overview
This guide shows how to deploy the AI Agent Brain system to Cloudflare Workers and configure it to connect to your Home Assistant instance.

## Architecture
```
┌─────────────────┐    HTTPS    ┌──────────────────┐    WebSocket/REST    ┌─────────────────┐
│   User/Client   │ ────────────▶│ Cloudflare Worker│ ─────────────────────▶│ Home Assistant  │
│                 │              │  (Brain System)  │                      │                 │
└─────────────────┘              └──────────────────┘                      └─────────────────┘
                                          │                                          │
                                          ▼                                          │
                                   ┌─────────────┐                                  │
                                   │ Cloudflare  │                                  │
                                   │ D1 Database │                                  │
                                   │ (Brain Data)│                                  │
                                   └─────────────┘                                  │
                                                                                    │
                   Home Assistant Instance: https://rpcsurqki2awrf1lukibtypjv2ochwqb.ui.nabu.casa
```

## Prerequisites

1. **Cloudflare Account** with Workers plan
2. **Home Assistant** accessible at: `https://rpcsurqki2awrf1lukibtypjv2ochwqb.ui.nabu.casa`
3. **Long-lived Access Token** from Home Assistant
4. **wrangler CLI** installed and authenticated

## Step 1: Clone and Setup

```bash
cd /Volumes/Projects/workers/hassio-proxy-worker
npm install
```

## Step 2: Configure Secrets

Set your Home Assistant connection details as Cloudflare Workers secrets:

```bash
# Set Home Assistant endpoint
wrangler secret put HASSIO_ENDPOINT_URI
# Enter: https://rpcsurqki2awrf1lukibtypjv2ochwqb.ui.nabu.casa

# Set Home Assistant long-lived access token
wrangler secret put HASSIO_TOKEN
# Enter: your_long_lived_access_token_here
```

## Step 3: Deploy to Production

```bash
# Deploy the worker with brain system
wrangler deploy
```

This will:
- Deploy the worker to Cloudflare's global network
- Set up the weekly CRON schedule (Mondays 09:00 UTC)
- Create D1 database with brain tables
- Return your worker URL (e.g., `https://hassio-proxy.your-subdomain.workers.dev`)

## Step 4: Test Brain System

Replace `YOUR-WORKER-URL` with your actual deployed worker URL:

```bash
# Test Home Assistant connectivity
curl https://YOUR-WORKER-URL/health

# Expected response:
{
  "ok": true,
  "uptime": 123.45,
  "env": { "ready": true },
  "homeAssistant": {
    "restApi": true,
    "websocketApi": true,
    "configured": true
  }
}

# Test brain status
curl https://YOUR-WORKER-URL/v1/brain/status

# Expected response:
{
  "ok": true,
  "data": {
    "entities": {
      "total": 1650,
      "normalized": 1565,
      "unbrained": 85
    },
    "intents": {
      "total": 8250,
      "averagePerEntity": 5.0
    }
  }
}

# Trigger manual brain sweep
curl https://YOUR-WORKER-URL/v1/brain/run

# Expected response:
{
  "ok": true,
  "data": {
    "ran_at_utc": "2025-08-25T10:00:00.000Z",
    "scanned": 85,
    "normalized": 85,
    "intentsCreated": 425
  }
}
```

## Step 5: Verify CRON Schedule

The brain system will automatically run every Monday at 09:00 UTC. You can verify this in:

1. **Cloudflare Dashboard** → Workers & Pages → Your Worker → Triggers
2. **Worker Logs** → Look for "🧠 Scheduled brain sweep triggered"

## Expected Behavior

### First Run
- Scans all entities from Home Assistant
- Normalizes entity types (e.g., switch.bathroom_light → light)
- Generates 5-15 intents per entity
- Stores everything in D1 database

### Subsequent Runs
- Only processes entities with <5 intents or no normalization
- Idempotent operations (safe to run multiple times)
- Updates existing data without duplication

### Example Entity Processing

For `switch.bathroom_light`:

1. **Normalization**:
   ```json
   {
     "entity_id": "switch.bathroom_light",
     "canonical_type": "light",
     "canonical_domain": "switch",
     "confidence": 0.95,
     "reasoning": "Name heuristic indicates a light; HA domain must remain 'switch' for service calls."
   }
   ```

2. **Generated Intents**:
   ```json
   [
     {
       "label": "turn on bathroom light",
       "intent_kind": "control",
       "action_domain": "switch",
       "action_service": "turn_on",
       "action_data": {"entity_id": "switch.bathroom_light"}
     },
     {
       "label": "turn off bathroom light in 15 minutes",
       "intent_kind": "schedule",
       "action_domain": "switch",
       "action_service": "turn_off",
       "action_data": {"entity_id": "switch.bathroom_light", "delay": "PT15M"}
     }
   ]
   ```

## Dashboard Access

Visit `https://YOUR-WORKER-URL` to see the enhanced dashboard with:
- ✅ Worker status
- ✅ Home Assistant REST API status
- ✅ Home Assistant WebSocket API status
- 🧠 Brain system controls

## Monitoring

### Logs
```bash
# View worker logs
wrangler tail

# Look for brain-specific logs:
# "🧠 Scheduled brain sweep triggered"
# "🧠 Brain sweep complete: {"scanned":85,"normalized":85,"intentsCreated":425}"
```

### Metrics
Monitor brain system health via the `/v1/brain/status` endpoint:
- Track entity normalization coverage
- Monitor intent generation progress
- Identify entities needing attention

## Troubleshooting

### Connection Issues
```bash
# Test Home Assistant connectivity directly
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://rpcsurqki2awrf1lukibtypjv2ochwqb.ui.nabu.casa/api/

# Should return Home Assistant API info
```

### Brain System Issues
```bash
# Check if tables exist
curl https://YOUR-WORKER-URL/v1/brain/status

# If "database not found" - run migration:
wrangler d1 migrations apply hassio_proxy_db
```

### CRON Not Running
1. Check Cloudflare Dashboard → Workers → Triggers
2. Verify CRON expression: `0 9 * * 1` (Mondays 9AM UTC)
3. Check worker logs for scheduled events

## Security Notes

- **Secrets**: Never commit HASSIO_TOKEN to version control
- **HTTPS**: All communication uses HTTPS/WSS encryption
- **Tokens**: Use Home Assistant long-lived access tokens with minimal required permissions
- **Network**: Worker runs on Cloudflare's secure global network

## Next Steps

With the brain system deployed:

1. **Build Conversational AI**: Use normalized entities and intents for voice/chat assistants
2. **Create Automations**: Leverage intent candidates for smart automation builders
3. **Develop Dashboards**: Use entity normalization for better UI organization
4. **Integrate Services**: Connect voice assistants, chatbots, or mobile apps

The brain system now provides a comprehensive knowledge base about your Home Assistant entities, enabling natural language interactions and intelligent automation.
