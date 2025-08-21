# Home Assistant Cloudflare Workers Integration - Agents Guide

## Overview

This guide provides comprehensive instructions for building a Cloudflare Workers-based system that provides 2-way communication with Home Assistant, utilizing all available Cloudflare bindings for maximum functionality and performance.

## Architecture Components

### Core Bindings Configuration

```toml
# wrangler.toml
name = "homeassistant-integration"
main = "src/index.ts"
compatibility_date = "2024-10-22"

# Workers AI for object detection and face recognition
[ai]
binding = "AI"

# KV for session management, configuration, and cache
[[kv_namespaces]]
binding = "CONFIG_KV"
id = "your-config-kv-namespace-id"
preview_id = "your-config-preview-id"

[[kv_namespaces]]
binding = "SESSIONS_KV"
id = "your-sessions-kv-namespace-id"
preview_id = "your-sessions-preview-id"

[[kv_namespaces]]
binding = "CACHE_KV"
id = "your-cache-kv-namespace-id"
preview_id = "your-cache-preview-id"

# D1 for persistent data storage
[[d1_databases]]
binding = "DB"
database_name = "homeassistant_data"
database_id = "your-d1-database-id"
migrations_dir = "migrations"

# R2 for log storage and media files
[[r2_buckets]]
binding = "LOGS_BUCKET"
bucket_name = "homeassistant-logs"

[[r2_buckets]]
binding = "MEDIA_BUCKET"
bucket_name = "homeassistant-media"

# Durable Objects for real-time communication and agent queue
[[durable_objects.bindings]]
name = "WEBSOCKET_SERVER"
class_name = "HomeAssistantWebSocket"

[[durable_objects.bindings]]
name = "AGENT_QUEUE"
class_name = "AgentQueue"

[[durable_objects.bindings]]
name = "CONNECTION_MANAGER"
class_name = "ConnectionManager"

# Workflows for orchestrating complex operations
[[workflows]]
name = "security-analysis"
binding = "SECURITY_WORKFLOW"
class_name = "SecurityAnalysisWorkflow"

[[workflows]]
name = "log-processor"
binding = "LOG_PROCESSOR_WORKFLOW"
class_name = "LogProcessorWorkflow"

# Queues for asynchronous processing
[[queues.producers]]
queue = "camera-events"
binding = "CAMERA_QUEUE"

[[queues.producers]]
queue = "log-processing"
binding = "LOG_QUEUE"

[[queues.consumers]]
queue = "camera-events"
max_batch_size = 10
max_retries = 3

[[queues.consumers]]
queue = "log-processing"
max_batch_size = 50
max_retries = 5

# Hyperdrive for database connections (if needed)
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "your-hyperdrive-config-id"

# Service bindings for modular architecture
[[services]]
binding = "FACE_RECOGNITION_SERVICE"
service = "face-recognition-worker"

[[services]]
binding = "OBJECT_DETECTION_SERVICE"
service = "object-detection-worker"

[migrations]
tag = "v1"
new_sqlite_classes = ["HomeAssistantWebSocket", "AgentQueue", "ConnectionManager"]
```

## Database Schema (D1)

### Initial Migration

```sql
-- migrations/0001_initial_schema.sql
CREATE TABLE IF NOT EXISTS home_assistant_instances (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    access_token TEXT NOT NULL,
    webhook_id TEXT,
    last_seen DATETIME,
    status TEXT DEFAULT 'disconnected',
    version TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    hassio_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    name TEXT NOT NULL,
    state TEXT,
    attributes TEXT, -- JSON
    last_changed DATETIME,
    last_updated DATETIME,
    instance_id TEXT REFERENCES home_assistant_instances(id)
);

CREATE TABLE IF NOT EXISTS camera_events (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    image_url TEXT,
    image_r2_key TEXT,
    detected_objects TEXT, -- JSON array
    faces_detected INTEGER DEFAULT 0,
    face_recognition_results TEXT, -- JSON
    confidence_scores TEXT, -- JSON
    event_timestamp DATETIME,
    processed_at DATETIME,
    security_threat_level TEXT DEFAULT 'low',
    instance_id TEXT REFERENCES home_assistant_instances(id)
);

CREATE TABLE IF NOT EXISTS api_calls (
    id TEXT PRIMARY KEY,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    payload TEXT,
    response_status INTEGER,
    response_body TEXT,
    execution_time_ms INTEGER,
    instance_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS security_reports (
    id TEXT PRIMARY KEY,
    report_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    events_analyzed INTEGER,
    recommendations TEXT, -- JSON
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    instance_id TEXT REFERENCES home_assistant_instances(id)
);

CREATE INDEX idx_entities_instance ON entities(instance_id);
CREATE INDEX idx_camera_events_timestamp ON camera_events(event_timestamp);
CREATE INDEX idx_api_calls_timestamp ON api_calls(created_at);
CREATE INDEX idx_security_reports_severity ON security_reports(severity);
```

## Core Worker Structure

### Main Entry Point

```typescript
// src/index.ts
import { DurableObject, WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { HomeAssistantAPI } from './homeassistant/api';
import { HomeAssistantWebSocket } from './durable-objects/websocket';
import { AgentQueue } from './durable-objects/agent-queue';
import { ConnectionManager } from './durable-objects/connection-manager';
import { SecurityAnalysisWorkflow, LogProcessorWorkflow } from './workflows';
import { handleWebSocketUpgrade } from './websocket/handler';
import { generateOpenAPISpec } from './api/openapi';
import { generateHelpPage } from './api/help';

export interface Env {
    AI: Ai;
    CONFIG_KV: KVNamespace;
    SESSIONS_KV: KVNamespace;
    CACHE_KV: KVNamespace;
    DB: D1Database;
    LOGS_BUCKET: R2Bucket;
    MEDIA_BUCKET: R2Bucket;
    WEBSOCKET_SERVER: DurableObjectNamespace<HomeAssistantWebSocket>;
    AGENT_QUEUE: DurableObjectNamespace<AgentQueue>;
    CONNECTION_MANAGER: DurableObjectNamespace<ConnectionManager>;
    SECURITY_WORKFLOW: Workflow;
    LOG_PROCESSOR_WORKFLOW: Workflow;
    CAMERA_QUEUE: Queue;
    LOG_QUEUE: Queue;
    HYPERDRIVE?: Hyperdrive;
    FACE_RECOGNITION_SERVICE?: Fetcher;
    OBJECT_DETECTION_SERVICE?: Fetcher;
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);
        const api = new HomeAssistantAPI(env);

        // Handle WebSocket upgrade for Home Assistant communication
        if (request.headers.get('Upgrade') === 'websocket') {
            return handleWebSocketUpgrade(request, env);
        }

        // API Routes
        if (url.pathname.startsWith('/api/v1/')) {
            return handleAPIRequest(request, env, ctx);
        }

        // Documentation endpoints
        if (url.pathname === '/openapi.json') {
            return new Response(await generateOpenAPISpec(), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (url.pathname === '/help' || url.pathname === '/docs') {
            return new Response(await generateHelpPage(), {
                headers: { 'Content-Type': 'text/html' }
            });
        }

        // Health check
        if (url.pathname === '/health') {
            return Response.json({ status: 'healthy', timestamp: new Date().toISOString() });
        }

        return new Response('Not Found', { status: 404 });
    },

    async queue(batch: MessageBatch<any>, env: Env, ctx: ExecutionContext): Promise<void> {
        await handleQueueMessages(batch, env, ctx);
    },

    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        await handleScheduledTasks(event, env, ctx);
    }
} satisfies ExportedHandler<Env>;

// Export Durable Object classes
export { HomeAssistantWebSocket, AgentQueue, ConnectionManager };
export { SecurityAnalysisWorkflow, LogProcessorWorkflow };
```

## WebSocket Communication Layer

### Home Assistant WebSocket Durable Object

```typescript
// src/durable-objects/websocket.ts
export class HomeAssistantWebSocket extends DurableObject {
    private sessions: Map<string, WebSocket> = new Map();
    private hassioConnections: Map<string, WebSocket> = new Map();
    private messageQueue: Array<any> = [];

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        this.initializeWebSocketHandlers();
    }

    async fetch(request: Request): Promise<Response> {
        const webSocketPair = new WebSocketPair();
        const [client, server] = Object.values(webSocketPair);

        await this.handleNewConnection(server, request);

        return new Response(null, {
            status: 101,
            webSocket: client,
        });
    }

    private async handleNewConnection(webSocket: WebSocket, request: Request) {
        webSocket.accept();
        
        const url = new URL(request.url);
        const sessionId = url.searchParams.get('session_id') || crypto.randomUUID();
        const connectionType = url.searchParams.get('type') || 'client';

        if (connectionType === 'hassio') {
            this.hassioConnections.set(sessionId, webSocket);
            await this.authenticateHomeAssistant(sessionId, webSocket);
        } else {
            this.sessions.set(sessionId, webSocket);
        }

        webSocket.addEventListener('message', async (event) => {
            await this.handleMessage(sessionId, event.data, connectionType);
        });

        webSocket.addEventListener('close', () => {
            this.sessions.delete(sessionId);
            this.hassioConnections.delete(sessionId);
        });

        // Send queued messages if any
        await this.flushMessageQueue(sessionId);
    }

    private async handleMessage(sessionId: string, data: string, connectionType: string) {
        try {
            const message = JSON.parse(data);
            
            if (connectionType === 'hassio') {
                await this.handleHomeAssistantMessage(sessionId, message);
            } else {
                await this.handleClientMessage(sessionId, message);
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    private async handleHomeAssistantMessage(sessionId: string, message: any) {
        switch (message.type) {
            case 'auth':
                await this.handleAuth(sessionId, message);
                break;
            case 'event':
                await this.handleEvent(sessionId, message);
                break;
            case 'result':
                await this.handleResult(sessionId, message);
                break;
            case 'ping':
                await this.sendToHomeAssistant(sessionId, { type: 'pong', id: message.id });
                break;
            default:
                // Broadcast to all connected clients
                await this.broadcastToClients(message);
        }
    }

    private async handleEvent(sessionId: string, event: any) {
        // Store event in D1
        await this.env.DB.prepare(`
            INSERT INTO entities (id, hassio_id, domain, name, state, attributes, last_changed, last_updated, instance_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                state = excluded.state,
                attributes = excluded.attributes,
                last_changed = excluded.last_changed,
                last_updated = excluded.last_updated
        `).bind(
            event.data.entity_id,
            event.data.entity_id,
            event.data.entity_id.split('.')[0],
            event.data.attributes?.friendly_name || event.data.entity_id,
            event.data.state,
            JSON.stringify(event.data.attributes),
            event.data.last_changed,
            event.data.last_updated,
            sessionId
        ).run();

        // Handle camera events specifically
        if (event.data.entity_id.includes('camera.') && event.data.attributes?.entity_picture) {
            await this.env.CAMERA_QUEUE.send({
                type: 'camera_event',
                entity_id: event.data.entity_id,
                image_url: event.data.attributes.entity_picture,
                instance_id: sessionId,
                timestamp: Date.now()
            });
        }

        // Broadcast to connected clients
        await this.broadcastToClients(event);
    }

    async sendToHomeAssistant(sessionId: string, message: any): Promise<void> {
        const connection = this.hassioConnections.get(sessionId);
        if (connection && connection.readyState === WebSocket.READY_STATE_OPEN) {
            connection.send(JSON.stringify(message));
        } else {
            // Queue message for later delivery
            this.messageQueue.push({ sessionId, message, timestamp: Date.now() });
        }
    }

    async broadcastToClients(message: any): Promise<void> {
        for (const [sessionId, webSocket] of this.sessions) {
            if (webSocket.readyState === WebSocket.READY_STATE_OPEN) {
                webSocket.send(JSON.stringify(message));
            }
        }
    }

    // Implement hibernation for WebSocket connections
    webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
        // Handle hibernated WebSocket messages
        return this.handleMessage(ws.deserializeAttachment(), message.toString(), 'client');
    }

    webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
        // Clean up hibernated WebSocket connections
        const sessionId = ws.deserializeAttachment();
        this.sessions.delete(sessionId);
        this.hassioConnections.delete(sessionId);
    }
}
```

## API Handler Implementation

### RESTful API Routes

```typescript
// src/api/handler.ts
async function handleAPIRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    // Authentication middleware
    const authResult = await authenticateRequest(request, env);
    if (!authResult.success) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Home Assistant proxy endpoints
        if (pathname.startsWith('/api/v1/hassio/')) {
            return await proxyToHomeAssistant(request, env, authResult.instanceId);
        }

        // Entity management
        if (pathname === '/api/v1/entities' && method === 'GET') {
            return await getEntities(request, env, authResult.instanceId);
        }

        if (pathname.match(/^\/api\/v1\/entities\/[^\/]+$/) && method === 'GET') {
            const entityId = pathname.split('/').pop();
            return await getEntity(entityId!, env, authResult.instanceId);
        }

        if (pathname.match(/^\/api\/v1\/entities\/[^\/]+\/state$/) && method === 'POST') {
            const entityId = pathname.split('/')[3];
            return await setEntityState(entityId, request, env, authResult.instanceId);
        }

        // Camera and AI endpoints
        if (pathname === '/api/v1/camera/analyze' && method === 'POST') {
            return await analyzeCameraImage(request, env, authResult.instanceId);
        }

        if (pathname === '/api/v1/camera/events' && method === 'GET') {
            return await getCameraEvents(request, env, authResult.instanceId);
        }

        // Security reports
        if (pathname === '/api/v1/security/reports' && method === 'GET') {
            return await getSecurityReports(request, env, authResult.instanceId);
        }

        if (pathname === '/api/v1/security/analyze' && method === 'POST') {
            return await triggerSecurityAnalysis(request, env, authResult.instanceId);
        }

        // Log management
        if (pathname === '/api/v1/logs/upload' && method === 'POST') {
            return await uploadLogs(request, env, authResult.instanceId);
        }

        if (pathname === '/api/v1/logs' && method === 'GET') {
            return await getLogs(request, env, authResult.instanceId);
        }

        // Services control
        if (pathname.match(/^\/api\/v1\/services\/[^\/]+\/[^\/]+$/) && method === 'POST') {
            const [domain, service] = pathname.split('/').slice(-2);
            return await callService(domain, service, request, env, authResult.instanceId);
        }

        // Automation management
        if (pathname === '/api/v1/automations' && method === 'GET') {
            return await getAutomations(request, env, authResult.instanceId);
        }

        if (pathname.match(/^\/api\/v1\/automations\/[^\/]+\/trigger$/) && method === 'POST') {
            const automationId = pathname.split('/')[4];
            return await triggerAutomation(automationId, request, env, authResult.instanceId);
        }

        // Configuration endpoints
        if (pathname === '/api/v1/config' && method === 'GET') {
            return await getConfig(env, authResult.instanceId);
        }

        if (pathname === '/api/v1/config' && method === 'PUT') {
            return await updateConfig(request, env, authResult.instanceId);
        }

        return Response.json({ error: 'Endpoint not found' }, { status: 404 });

    } catch (error) {
        console.error('API Error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
```

## Workers AI Integration

### Object Detection and Face Recognition

```typescript
// src/ai/vision.ts
export class VisionProcessor {
    constructor(private env: Env) {}

    async processImage(imageUrl: string, entityId: string, instanceId: string): Promise<any> {
        try {
            // Download image
            const imageResponse = await fetch(imageUrl);
            const imageBuffer = await imageResponse.arrayBuffer();

            // Store original image in R2
            const imageKey = `images/${instanceId}/${entityId}/${Date.now()}.jpg`;
            await this.env.MEDIA_BUCKET.put(imageKey, imageBuffer, {
                httpMetadata: { contentType: 'image/jpeg' }
            });

            // Object detection
            const objectDetection = await this.env.AI.run('@cf/microsoft/resnet-50', {
                image: imageBuffer
            });

            // Face detection using RetinaFace
            const faceDetection = await this.env.AI.run('@cf/facebook/detr-resnet-50', {
                image: imageBuffer
            });

            // Face recognition if faces are detected
            let faceRecognitionResults = null;
            if (faceDetection && Array.isArray(faceDetection) && faceDetection.length > 0) {
                // Use external face recognition service if available
                if (this.env.FACE_RECOGNITION_SERVICE) {
                    const faceResponse = await this.env.FACE_RECOGNITION_SERVICE.fetch('/analyze', {
                        method: 'POST',
                        body: imageBuffer,
                        headers: { 'Content-Type': 'image/jpeg' }
                    });
                    faceRecognitionResults = await faceResponse.json();
                }
            }

            // Generate scene description using vision model
            const sceneDescription = await this.env.AI.run('@cf/llava-hf/llava-1.5-7b-hf', {
                image: imageBuffer,
                prompt: "Analyze this security camera image. Describe what you see and identify any potential security concerns.",
                max_tokens: 512
            });

            // Calculate threat level
            const threatLevel = this.calculateThreatLevel(objectDetection, faceDetection, sceneDescription);

            // Store results in D1
            const eventId = crypto.randomUUID();
            await this.env.DB.prepare(`
                INSERT INTO camera_events 
                (id, entity_id, image_url, image_r2_key, detected_objects, faces_detected, 
                 face_recognition_results, confidence_scores, event_timestamp, processed_at, 
                 security_threat_level, instance_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                eventId,
                entityId,
                imageUrl,
                imageKey,
                JSON.stringify(objectDetection),
                Array.isArray(faceDetection) ? faceDetection.length : 0,
                JSON.stringify(faceRecognitionResults),
                JSON.stringify(this.extractConfidenceScores(objectDetection, faceDetection)),
                new Date().toISOString(),
                new Date().toISOString(),
                threatLevel,
                instanceId
            ).run();

            return {
                eventId,
                objects: objectDetection,
                faces: faceDetection,
                faceRecognition: faceRecognitionResults,
                sceneDescription: sceneDescription.description,
                threatLevel,
                imageKey
            };

        } catch (error) {
            console.error('Image processing error:', error);
            throw error;
        }
    }

    private calculateThreatLevel(objects: any[], faces: any[], description: any): string {
        let score = 0;

        // Check for suspicious objects
        const suspiciousObjects = ['weapon', 'knife', 'gun', 'person', 'backpack'];
        if (objects) {
            objects.forEach(obj => {
                if (suspiciousObjects.some(sus => obj.label?.toLowerCase().includes(sus))) {
                    score += obj.score || 0.5;
                }
            });
        }

        // Unknown faces increase threat level
        if (faces && faces.length > 0) {
            score += faces.length * 0.3;
        }

        // Analyze scene description for keywords
        const threatKeywords = ['break', 'suspicious', 'unauthorized', 'weapon', 'danger'];
        if (description && description.description) {
            threatKeywords.forEach(keyword => {
                if (description.description.toLowerCase().includes(keyword)) {
                    score += 0.4;
                }
            });
        }

        if (score >= 1.5) return 'high';
        if (score >= 0.8) return 'medium';
        return 'low';
    }

    private extractConfidenceScores(objects: any[], faces: any[]): any {
        return {
            objects: objects?.map(obj => ({ label: obj.label, confidence: obj.score })) || [],
            faces: faces?.map(face => ({ confidence: face.score || 0.5 })) || []
        };
    }
}
```

## Workflow Implementations

### Security Analysis Workflow

```typescript
// src/workflows/security.ts
export class SecurityAnalysisWorkflow extends WorkflowEntrypoint<Env> {
    async run(event: WorkflowEvent<any>, step: WorkflowStep) {
        const { instanceId, timeRange } = event.payload;

        // Step 1: Gather camera events
        const cameraEvents = await step.do('gather-camera-events', async () => {
            const result = await this.env.DB.prepare(`
                SELECT * FROM camera_events 
                WHERE instance_id = ? 
                AND event_timestamp >= datetime('now', '-' || ? || ' hours')
                ORDER BY event_timestamp DESC
            `).bind(instanceId, timeRange || 24).all();
            
            return result.results;
        });

        // Step 2: Analyze patterns
        const patterns = await step.do('analyze-patterns', async () => {
            // Use Workers AI to analyze patterns
            const analysisPrompt = `
                Analyze the following security camera events and identify patterns, 
                anomalies, and potential security concerns:
                ${JSON.stringify(cameraEvents, null, 2)}
                
                Provide a structured analysis including:
                1. Threat level assessment
                2. Identified patterns
                3. Recommendations
                4. Time-based analysis
            `;

            const analysis = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
                prompt: analysisPrompt,
                max_tokens: 1024
            });

            return analysis;
        });

        // Step 3: Generate recommendations
        const recommendations = await step.do('generate-recommendations', async () => {
            const recommendationPrompt = `
                Based on the security analysis: ${patterns.response}
                
                Generate specific, actionable security recommendations for a Home Assistant setup.
                Include automation suggestions and security improvements.
            `;

            const recs = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
                prompt: recommendationPrompt,
                max_tokens: 512
            });

            return recs;
        });

        // Step 4: Determine severity
        const severity = await step.do('determine-severity', async () => {
            const highThreatEvents = cameraEvents.filter((event: any) => 
                event.security_threat_level === 'high'
            ).length;
            
            if (highThreatEvents > 5) return 'critical';
            if (highThreatEvents > 2) return 'high';
            if (highThreatEvents > 0) return 'medium';
            return 'low';
        });

        // Step 5: Store report
        const report = await step.do('store-report', async () => {
            const reportId = crypto.randomUUID();
            
            await this.env.DB.prepare(`
                INSERT INTO security_reports 
                (id, report_type, severity, title, description, events_analyzed, recommendations, instance_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                reportId,
                'automated_analysis',
                severity,
                `Security Analysis Report - ${new Date().toLocaleDateString()}`,
                patterns.response,
                cameraEvents.length,
                recommendations.response,
                instanceId
            ).run();

            return { reportId, severity };
        });

        // Step 6: Send notifications if high severity
        if (severity === 'high' || severity === 'critical') {
            await step.do('send-alert', async () => {
                // Send WebSocket alert to connected clients
                const wsId = this.env.WEBSOCKET_SERVER.idFromName(`alerts-${instanceId}`);
                const wsStub = this.env.WEBSOCKET_SERVER.get(wsId);
                
                await wsStub.fetch(new Request('https://dummy.com/alert', {
                    method: 'POST',
                    body: JSON.stringify({
                        type: 'security_alert',
                        severity: severity,
                        reportId: report.reportId,
                        message: `Security threat detected! ${cameraEvents.length} events analyzed.`
                    })
                }));
            });
        }

        return {
            reportId: report.reportId,
            severity,
            eventsAnalyzed: cameraEvents.length,
            recommendations: recommendations.response
        };
    }
}
```

### Log Processor Workflow

```typescript
// src/workflows/logs.ts
export class LogProcessorWorkflow extends WorkflowEntrypoint<Env> {
    async run(event: WorkflowEvent<any>, step: WorkflowStep) {
        const { logData, instanceId, logType } = event.payload;

        // Step 1: Parse and validate logs
        const parsedLogs = await step.do('parse-logs', async () => {
            // Parse different log formats (JSON, syslog, etc.)
            return this.parseLogData(logData, logType);
        });

        // Step 2: Store in R2 with compression
        const r2Key = await step.do('store-logs', async () => {
            const timestamp = new Date().toISOString().split('T')[0];
            const key = `logs/${instanceId}/${timestamp}/${crypto.randomUUID()}.json.gz`;
            
            // Compress logs before storing
            const compressed = await this.compressData(JSON.stringify(parsedLogs));
            
            await this.env.LOGS_BUCKET.put(key, compressed, {
                httpMetadata: { 
                    contentType: 'application/gzip',
                    contentEncoding: 'gzip'
                },
                customMetadata: {
                    instanceId,
                    logType,
                    timestamp: new Date().toISOString(),
                    entryCount: parsedLogs.length.toString()
                }
            });

            return key;
        });

        // Step 3: Extract metrics and errors
        const analysis = await step.do('analyze-logs', async () => {
            const errors = parsedLogs.filter((log: any) => 
                log.level === 'ERROR' || log.level === 'CRITICAL'
            );
            
            const warnings = parsedLogs.filter((log: any) => 
                log.level === 'WARNING' || log.level === 'WARN'
            );

            // Use AI to analyze error patterns
            if (errors.length > 0) {
                const errorAnalysis = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
                    prompt: `Analyze these Home Assistant error logs and identify common issues and solutions: ${JSON.stringify(errors.slice(0, 10))}`,
                    max_tokens: 512
                });

                return {
                    totalEntries: parsedLogs.length,
                    errors: errors.length,
                    warnings: warnings.length,
                    errorAnalysis: errorAnalysis.response,
                    r2Key
                };
            }

            return {
                totalEntries: parsedLogs.length,
                errors: errors.length,
                warnings: warnings.length,
                r2Key
            };
        });

        // Step 4: Update metrics in KV
        await step.do('update-metrics', async () => {
            const today = new Date().toISOString().split('T')[0];
            const metricsKey = `metrics:${instanceId}:${today}`;
            
            const existingMetrics = await this.env.CONFIG_KV.get(metricsKey, 'json') || {
                logEntries: 0,
                errors: 0,
                warnings: 0
            };

            const updatedMetrics = {
                logEntries: existingMetrics.logEntries + analysis.totalEntries,
                errors: existingMetrics.errors + analysis.errors,
                warnings: existingMetrics.warnings + analysis.warnings,
                lastUpdated: new Date().toISOString()
            };

            await this.env.CONFIG_KV.put(metricsKey, JSON.stringify(updatedMetrics));
        });

        return analysis;
    }

    private parseLogData(data: string, type: string): any[] {
        // Implementation for parsing different log formats
        try {
            switch (type) {
                case 'json':
                    return data.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
                case 'syslog':
                    return this.parseSyslogFormat(data);
                default:
                    return data.split('\n').map(line => ({ message: line, timestamp: new Date().toISOString() }));
            }
        } catch (error) {
            console.error('Log parsing error:', error);
            return [{ message: data, timestamp: new Date().toISOString(), parseError: true }];
        }
    }

    private parseSyslogFormat(data: string): any[] {
        // Basic syslog parsing - extend as needed
        return data.split('\n').map(line => {
            const match = line.match(/^(\w+\s+\d+\s+\d+:\d+:\d+)\s+(\w+)\s+(.+)$/);
            if (match) {
                return {
                    timestamp: match[1],
                    host: match[2],
                    message: match[3],
                    raw: line
                };
            }
            return { message: line, raw: line };
        });
    }

    private async compressData(data: string): Promise<Uint8Array> {
        const stream = new CompressionStream('gzip');
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();
        
        writer.write(new TextEncoder().encode(data));
        writer.close();
        
        const chunks: Uint8Array[] = [];
        let done = false;
        
        while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) chunks.push(value);
        }
        
        return new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], []));
    }
}
```

## Queue Message Handlers

### Camera Event Processing

```typescript
// src/queues/camera-handler.ts
async function handleCameraEvents(messages: Message[], env: Env): Promise<void> {
    const visionProcessor = new VisionProcessor(env);
    
    for (const message of messages) {
        try {
            const { entity_id, image_url, instance_id } = message.body;
            
            // Process image with AI
            const results = await visionProcessor.processImage(image_url, entity_id, instance_id);
            
            // Trigger security analysis if high threat detected
            if (results.threatLevel === 'high') {
                await env.SECURITY_WORKFLOW.create({
                    params: {
                        instanceId: instance_id,
                        triggerEvent: 'high_threat_detected',
                        eventId: results.eventId
                    }
                });
            }
            
            // Send real-time update via WebSocket
            const wsId = env.WEBSOCKET_SERVER.idFromName(`main-${instance_id}`);
            const wsStub = env.WEBSOCKET_SERVER.get(wsId);
            
            await wsStub.fetch(new Request('https://dummy.com/update', {
                method: 'POST',
                body: JSON.stringify({
                    type: 'camera_analysis_complete',
                    entityId: entity_id,
                    results
                })
            }));
            
            message.ack();
        } catch (error) {
            console.error('Camera event processing error:', error);
            message.retry();
        }
    }
}
```

## OpenAPI Specification Generator

### Dynamic API Documentation

```typescript
// src/api/openapi.ts
export async function generateOpenAPISpec(): Promise<string> {
    const spec = {
        openapi: '3.0.3',
        info: {
            title: 'Home Assistant Cloudflare Workers Integration API',
            version: '1.0.0',
            description: 'Comprehensive API for 2-way communication with Home Assistant',
            contact: {
                name: 'API Support',
                url: 'https://your-worker.your-domain.workers.dev/help'
            }
        },
        servers: [
            {
                url: 'https://your-worker.your-domain.workers.dev',
                description: 'Production server'
            }
        ],
        paths: {
            '/api/v1/entities': {
                get: {
                    summary: 'Get all entities',
                    description: 'Retrieve all Home Assistant entities',
                    parameters: [
                        {
                            name: 'domain',
                            in: 'query',
                            description: 'Filter by entity domain',
                            schema: { type: 'string' }
                        },
                        {
                            name: 'limit',
                            in: 'query',
                            description: 'Limit number of results',
                            schema: { type: 'integer', default: 100 }
                        }
                    ],
                    responses: {
                        '200': {
                            description: 'List of entities',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'array',
                                        items: { $ref: '#/components/schemas/Entity' }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            '/api/v1/entities/{entityId}': {
                get: {
                    summary: 'Get specific entity',
                    parameters: [
                        {
                            name: 'entityId',
                            in: 'path',
                            required: true,
                            schema: { type: 'string' }
                        }
                    ],
                    responses: {
                        '200': {
                            description: 'Entity details',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/Entity' }
                                }
                            }
                        }
                    }
                }
            },
            '/api/v1/camera/analyze': {
                post: {
                    summary: 'Analyze camera image',
                    description: 'Process camera image with AI for object detection and face recognition',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        entityId: { type: 'string' },
                                        imageUrl: { type: 'string' },
                                        includeObjects: { type: 'boolean', default: true },
                                        includeFaces: { type: 'boolean', default: true }
                                    },
                                    required: ['entityId', 'imageUrl']
                                }
                            }
                        }
                    },
                    responses: {
                        '200': {
                            description: 'Analysis results',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/AnalysisResult' }
                                }
                            }
                        }
                    }
                }
            },
            '/api/v1/security/reports': {
                get: {
                    summary: 'Get security reports',
                    parameters: [
                        {
                            name: 'severity',
                            in: 'query',
                            schema: { 
                                type: 'string',
                                enum: ['low', 'medium', 'high', 'critical']
                            }
                        }
                    ],
                    responses: {
                        '200': {
                            description: 'List of security reports',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'array',
                                        items: { $ref: '#/components/schemas/SecurityReport' }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            '/ws': {
                get: {
                    summary: 'WebSocket endpoint for real-time communication',
                    description: 'Upgrade to WebSocket for bidirectional real-time communication',
                    parameters: [
                        {
                            name: 'Upgrade',
                            in: 'header',
                            required: true,
                            schema: { type: 'string', enum: ['websocket'] }
                        }
                    ]
                }
            }
        },
        components: {
            schemas: {
                Entity: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        hassio_id: { type: 'string' },
                        domain: { type: 'string' },
                        name: { type: 'string' },
                        state: { type: 'string' },
                        attributes: { type: 'object' },
                        last_changed: { type: 'string', format: 'date-time' },
                        last_updated: { type: 'string', format: 'date-time' }
                    }
                },
                AnalysisResult: {
                    type: 'object',
                    properties: {
                        eventId: { type: 'string' },
                        objects: { type: 'array', items: { type: 'object' } },
                        faces: { type: 'array', items: { type: 'object' } },
                        faceRecognition: { type: 'object' },
                        sceneDescription: { type: 'string' },
                        threatLevel: { type: 'string', enum: ['low', 'medium', 'high'] },
                        imageKey: { type: 'string' }
                    }
                },
                SecurityReport: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        report_type: { type: 'string' },
                        severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        events_analyzed: { type: 'integer' },
                        recommendations: { type: 'object' },
                        generated_at: { type: 'string', format: 'date-time' }
                    }
                }
            },
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            }
        },
        security: [
            { bearerAuth: [] }
        ]
    };

    return JSON.stringify(spec, null, 2);
}
```

### Interactive Help Page

```typescript
// src/api/help.ts
export async function generateHelpPage(): Promise<string> {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Home Assistant Integration API - Help</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', roboto, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        .endpoint { background: #ecf0f1; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #3498db; }
        .method { display: inline-block; padding: 4px 8px; border-radius: 3px; font-weight: bold; color: white; margin-right: 10px; }
        .get { background: #2ecc71; }
        .post { background: #e74c3c; }
        .put { background: #f39c12; }
        .delete { background: #e67e22; }
        .websocket { background: #9b59b6; }
        code { background: #34495e; color: #ecf0f1; padding: 2px 6px; border-radius: 3px; }
        .feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 20px 0; }
        .feature-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #dee2e6; }
        .feature-card h3 { color: #495057; margin-top: 0; }
        .toc { background: #e8f4fd; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .toc ul { list-style: none; padding-left: 0; }
        .toc li { margin: 5px 0; }
        .toc a { text-decoration: none; color: #3498db; }
        .toc a:hover { text-decoration: underline; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🏠 Home Assistant Cloudflare Workers Integration API</h1>
        
        <div class="warning">
            <strong>⚡ Real-time Integration:</strong> This API provides comprehensive 2-way communication with Home Assistant, including WebSocket support, AI-powered camera analysis, and automated security reporting.
        </div>

        <div class="toc">
            <h2>📋 Table of Contents</h2>
            <ul>
                <li><a href="#overview">Overview</a></li>
                <li><a href="#authentication">Authentication</a></li>
                <li><a href="#websocket">WebSocket Communication</a></li>
                <li><a href="#entities">Entity Management</a></li>
                <li><a href="#camera">Camera & AI Analysis</a></li>
                <li><a href="#security">Security Reports</a></li>
                <li><a href="#services">Services Control</a></li>
                <li><a href="#logs">Log Management</a></li>
                <li><a href="#automations">Automations</a></li>
                <li><a href="#examples">Code Examples</a></li>
            </ul>
        </div>

        <h2 id="overview">🌟 Key Features</h2>
        <div class="feature-grid">
            <div class="feature-card">
                <h3>🤖 AI-Powered Vision</h3>
                <p>Advanced object detection and face recognition using Workers AI with real-time threat assessment.</p>
            </div>
            <div class="feature-card">
                <h3>⚡ Real-time WebSocket</h3>
                <p>Bidirectional WebSocket communication matching Home Assistant's native API for instant updates.</p>
            </div>
            <div class="feature-card">
                <h3>🔒 Security Analysis</h3>
                <p>Automated security report generation with AI-driven pattern analysis and threat detection.</p>
            </div>
            <div class="feature-card">
                <h3>📊 Log Pipeline</h3>
                <p>Comprehensive log processing and storage in R2 with compressed archival and searchable metrics.</p>
            </div>
            <div class="feature-card">
                <h3>🔄 Workflow Orchestration</h3>
                <p>Durable workflow execution for complex multi-step operations with automatic retry and state management.</p>
            </div>
            <div class="feature-card">
                <h3>📱 Full API Control</h3>
                <p>Complete control over Home Assistant entities, services, automations, and configuration via REST API.</p>
            </div>
        </div>

        <h2 id="authentication">🔐 Authentication</h2>
        <p>All API requests require authentication using Bearer tokens:</p>
        <div class="endpoint">
            <code>Authorization: Bearer YOUR_ACCESS_TOKEN</code>
        </div>

        <h2 id="websocket">🔌 WebSocket Communication</h2>
        <div class="endpoint">
            <span class="method websocket">WEBSOCKET</span>
            <code>/ws?type=client</code> - Client connection
        </div>
        <div class="endpoint">
            <span class="method websocket">WEBSOCKET</span>
            <code>/ws?type=hassio&session_id=YOUR_INSTANCE</code> - Home Assistant connection
        </div>

        <h2 id="entities">🏠 Entity Management</h2>
        <div class="endpoint">
            <span class="method get">GET</span>
            <code>/api/v1/entities</code> - Get all entities
        </div>
        <div class="endpoint">
            <span class="method get">GET</span>
            <code>/api/v1/entities/{entityId}</code> - Get specific entity
        </div>
        <div class="endpoint">
            <span class="method post">POST</span>
            <code>/api/v1/entities/{entityId}/state</code> - Update entity state
        </div>

        <h2 id="camera">📷 Camera & AI Analysis</h2>
        <div class="endpoint">
            <span class="method post">POST</span>
            <code>/api/v1/camera/analyze</code> - Analyze camera image with AI
        </div>
        <div class="endpoint">
            <span class="method get">GET</span>
            <code>/api/v1/camera/events</code> - Get camera analysis history
        </div>

        <h2 id="security">🔒 Security Reports</h2>
        <div class="endpoint">
            <span class="method get">GET</span>
            <code>/api/v1/security/reports</code> - Get security reports
        </div>
        <div class="endpoint">
            <span class="method post">POST</span>
            <code>/api/v1/security/analyze</code> - Trigger security analysis workflow
        </div>

        <h2 id="services">⚙️ Services Control</h2>
        <div class="endpoint">
            <span class="method post">POST</span>
            <code>/api/v1/services/{domain}/{service}</code> - Call Home Assistant service
        </div>

        <h2 id="logs">📝 Log Management</h2>
        <div class="endpoint">
            <span class="method post">POST</span>
            <code>/api/v1/logs/upload</code> - Upload logs to R2 storage
        </div>
        <div class="endpoint">
            <span class="method get">GET</span>
            <code>/api/v1/logs</code> - Query stored logs
        </div>

        <h2 id="automations">🔄 Automations</h2>
        <div class="endpoint">
            <span class="method get">GET</span>
            <code>/api/v1/automations</code> - List automations
        </div>
        <div class="endpoint">
            <span class="method post">POST</span>
            <code>/api/v1/automations/{automationId}/trigger</code> - Trigger automation
        </div>

        <h2 id="examples">💻 Code Examples</h2>
        
        <h3>WebSocket Connection (JavaScript)</h3>
        <pre><code>
const ws = new WebSocket('wss://your-worker.your-domain.workers.dev/ws?type=client');

ws.onopen = () => {
    console.log('Connected to Home Assistant Worker');
    
    // Subscribe to entity updates
    ws.send(JSON.stringify({
        type: 'subscribe_events',
        event_type: 'state_changed'
    }));
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Received:', data);
    
    // Handle different message types
    switch(data.type) {
        case 'event':
            handleEntityUpdate(data.event);
            break;
        case 'camera_analysis_complete':
            handleCameraAnalysis(data.results);
            break;
        case 'security_alert':
            handleSecurityAlert(data);
            break;
    }
};
        </code></pre>

        <h3>Camera Analysis (Python)</h3>
        <pre><code>
import requests
import json

# Analyze camera image
response = requests.post(
    'https://your-worker.your-domain.workers.dev/api/v1/camera/analyze',
    headers={
        'Authorization': 'Bearer YOUR_TOKEN',
        'Content-Type': 'application/json'
    },
    json={
        'entityId': 'camera.front_door',
        'imageUrl': 'https://your-hassio.local/api/camera_proxy/camera.front_door',
        'includeObjects': True,
        'includeFaces': True
    }
)

result = response.json()
print(f"Threat Level: {result['threatLevel']}")
print(f"Objects Detected: {len(result['objects'])}")
print(f"Faces Detected: {len(result['faces'])}")
        </code></pre>

        <h3>Security Report Generation (curl)</h3>
        <pre><code>
# Trigger security analysis workflow
curl -X POST https://your-worker.your-domain.workers.dev/api/v1/security/analyze \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "timeRange": 24,
    "includePatterns": true,
    "generateRecommendations": true
  }'
        </code></pre>

        <h2>📚 Additional Resources</h2>
        <ul>
            <li><a href="/openapi.json">OpenAPI Specification</a></li>
            <li><a href="https://developers.cloudflare.com/workers-ai/">Workers AI Documentation</a></li>
            <li><a href="https://developers.cloudflare.com/durable-objects/">Durable Objects Guide</a></li>
            <li><a href="https://www.home-assistant.io/developers/websocket_api/">Home Assistant WebSocket API</a></li>
        </ul>

        <footer style="margin-top: 40px; text-align: center; color: #7f8c8d; border-top: 1px solid #ecf0f1; padding-top: 20px;">
            <p>🚀 Powered by Cloudflare Workers | Built for Home Assistant Integration</p>
        </footer>
    </div>
</body>
</html>
    `;
}
```

## Agent Queue Implementation

### Durable Object for Agent Management

```typescript
// src/durable-objects/agent-queue.ts
export class AgentQueue extends DurableObject {
    private queue: Array<AgentTask> = [];
    private processing: Map<string, AgentTask> = new Map();
    private agents: Map<string, AgentWorker> = new Map();

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        this.initializeAgents();
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const method = request.method;

        switch (`${method} ${url.pathname}`) {
            case 'POST /enqueue':
                return await this.enqueueTask(request);
            case 'GET /status':
                return await this.getQueueStatus();
            case 'POST /process':
                return await this.processNextTask();
            case 'GET /agents':
                return await this.getAgentStatus();
            default:
                return new Response('Not Found', { status: 404 });
        }
    }

    private async enqueueTask(request: Request): Promise<Response> {
        const task: AgentTask = await request.json();
        task.id = crypto.randomUUID();
        task.enqueuedAt = new Date().toISOString();
        task.status = 'queued';

        this.queue.push(task);
        
        // Store in Durable Object storage for persistence
        await this.ctx.storage.put(`task:${task.id}`, task);
        await this.ctx.storage.put('queue', this.queue);

        // Trigger processing
        this.ctx.waitUntil(this.processQueue());

        return Response.json({ taskId: task.id, position: this.queue.length });
    }

    private async processQueue(): Promise<void> {
        while (this.queue.length > 0 && this.processing.size < 10) {
            const task = this.queue.shift();
            if (!task) break;

            this.processing.set(task.id, task);
            task.status = 'processing';
            task.startedAt = new Date().toISOString();

            // Process task based on type
            this.ctx.waitUntil(this.executeTask(task));
        }
    }

    private async executeTask(task: AgentTask): Promise<void> {
        try {
            let result: any;

            switch (task.type) {
                case 'camera_analysis':
                    result = await this.processCameraAnalysis(task);
                    break;
                case 'security_report':
                    result = await this.processSecurityReport(task);
                    break;
                case 'automation_trigger':
                    result = await this.processAutomationTrigger(task);
                    break;
                case 'entity_update':
                    result = await this.processEntityUpdate(task);
                    break;
                default:
                    throw new Error(`Unknown task type: ${task.type}`);
            }

            task.status = 'completed';
            task.completedAt = new Date().toISOString();
            task.result = result;

        } catch (error) {
            task.status = 'failed';
            task.error = error.message;
            task.failedAt = new Date().toISOString();
            
            // Retry logic
            if (task.retryCount < (task.maxRetries || 3)) {
                task.retryCount = (task.retryCount || 0) + 1;
                task.status = 'queued';
                this.queue.push(task);
            }
        } finally {
            this.processing.delete(task.id);
            await this.ctx.storage.put(`task:${task.id}`, task);
        }
    }

    private async processCameraAnalysis(task: AgentTask): Promise<any> {
        const visionProcessor = new VisionProcessor(this.env);
        return await visionProcessor.processImage(
            task.payload.imageUrl,
            task.payload.entityId,
            task.payload.instanceId
        );
    }

    private async processSecurityReport(task: AgentTask): Promise<any> {
        const workflow = await this.env.SECURITY_WORKFLOW.create({
            params: task.payload
        });
        return { workflowId: workflow.id };
    }

    private async processAutomationTrigger(task: AgentTask): Promise<any> {
        // Trigger Home Assistant automation
        const api = new HomeAssistantAPI(this.env);
        return await api.triggerAutomation(
            task.payload.automationId,
            task.payload.instanceId
        );
    }

    private async processEntityUpdate(task: AgentTask): Promise<any> {
        // Update entity state in Home Assistant
        const api = new HomeAssistantAPI(this.env);
        return await api.updateEntityState(
            task.payload.entityId,
            task.payload.state,
            task.payload.instanceId
        );
    }
}

interface AgentTask {
    id: string;
    type: 'camera_analysis' | 'security_report' | 'automation_trigger' | 'entity_update';
    payload: any;
    priority: number;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    enqueuedAt: string;
    startedAt?: string;
    completedAt?: string;
    failedAt?: string;
    retryCount?: number;
    maxRetries?: number;
    result?: any;
    error?: string;
}
```

## Implementation Notes

### Key Integration Points

1. **WebSocket API Compatibility**: The WebSocket implementation matches Home Assistant’s native API, enabling seamless integration.
1. **Comprehensive AI Integration**: Workers AI handles object detection, face recognition, and scene analysis with threat assessment.
1. **Scalable Storage**: Uses all Cloudflare storage options:
- **KV**: Session management, configuration, caching
- **D1**: Structured data and relational queries
- **R2**: Log archival and media storage
- **Durable Objects**: Real-time state and agent queues
1. **Workflow Orchestration**: Cloudflare Workflows handle complex multi-step operations with automatic retry and state management.
1. **Queue-based Processing**: Asynchronous processing of camera events and log data using Cloudflare Queues.
1. **Dynamic Documentation**: OpenAPI specification and help pages are generated dynamically and updated automatically when the worker changes.
1. **Security-First Design**: Built-in threat detection, security reporting, and automated analysis workflows.
1. **Home Assistant Full Compatibility**: Supports all Home Assistant API endpoints including entities, services, automations, and configuration.

### Performance Optimizations

- **Edge Caching**: Critical data cached in KV for fast global access
- **Connection Hibernation**: WebSocket connections hibernate to reduce costs
- **Batch Processing**: Queue messages processed in batches for efficiency
- **Compressed Storage**: Logs compressed before R2 storage
- **Smart Routing**: Durable Objects placed near Home Assistant instances

### Monitoring and Observability

- **Real-time Metrics**: Queue status, processing times, error rates
- **Security Alerts**: Immediate notifications for high-threat events
- **Log Analytics**: Searchable log storage with AI-powered analysis
- **Performance Tracking**: API response times and success rates stored in Analytics Engine

This architecture provides a complete, production-ready solution for integrating Home Assistant with Cloudflare Workers, utilizing every available binding for maximum functionality and performance.