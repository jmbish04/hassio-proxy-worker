# AI Model Configuration

This document explains how to configure AI models used by the Hassio Proxy Worker through environment variables.

## Environment Variables

The worker supports the following AI model environment variables in `wrangler.toml`:

```toml
[vars]
DEFAULT_TEXT_MODEL = "@cf/openai/gpt-oss-120b"
DEFAULT_OBJECT_MODEL = "@cf/facebook/detr-resnet-50"
DEFAULT_FACE_MODEL = "@cf/microsoft/resnet-50"
DEFAULT_VISION_MODEL = "@cf/llava-hf/llava-1.5-7b-hf"
```

## Supported Models

### Text Generation Models
- `@cf/openai/gpt-oss-120b` (default) - **Production-ready, high reasoning**
  - Context: 128k tokens
  - Price: $0.35/$0.75 per M input/output tokens
  - Features: Async queue support, excellent for complex reasoning tasks
- `@cf/meta/llama-3.3-70b-instruct-fp8-fast` - **Large model for heavy-duty reasoning**
  - Context: 24k tokens
  - Price: $0.29/$2.25 per M input/output tokens
  - Features: Function calling, async queue
- `@cf/meta/llama-4-scout-17b-16e-instruct` - **Newest generation, multimodal**
  - Context: 131k tokens
  - Price: $0.27/$0.85 per M input/output tokens
  - Features: Function calling, async queue, multimodal capabilities
- `@cf/mistralai/mistral-small-3.1-24b-instruct` - **Strong vision/text balance**
  - Context: 128k tokens
  - Price: $0.35/$0.56 per M input/output tokens
  - Features: Function calling, vision capabilities
- `@cf/meta/llama-3.2-3b-instruct` - **Cost-effective option**
  - Context: 128k tokens
  - Price: $0.051/$0.34 per M input/output tokens

### Object Detection Models
- `@cf/facebook/detr-resnet-50` (default)
- `@cf/microsoft/resnet-50`

### Face Detection Models
- `@cf/microsoft/resnet-50` (default)
- `@cf/facebook/detr-resnet-50`

### Vision Analysis Models
- `@cf/llava-hf/llava-1.5-7b-hf` (default)
- `@cf/meta/llama-3.2-11b-vision-instruct`

## Usage in Code

The worker provides helper functions to get model names with fallbacks:

```typescript
import { getTextModel, getObjectModel, getFaceModel, getVisionModel } from './lib/aiModels';

// Get text model for AI summary
const textModel = getTextModel(env);
const analysis = await env.AI.run(textModel, {
  prompt: "Analyze this log entry...",
  max_tokens: 256,
});

// Get object detection model
const objectModel = getObjectModel(env);
const objects = await env.AI.run(objectModel, {
  image: imageBuffer
});
```

## Configuration Examples

### Development
```toml
[vars]
DEFAULT_TEXT_MODEL = "@cf/meta/llama-3.2-3b-instruct"
DEFAULT_OBJECT_MODEL = "@cf/facebook/detr-resnet-50"
DEFAULT_FACE_MODEL = "@cf/microsoft/resnet-50"
DEFAULT_VISION_MODEL = "@cf/llava-hf/llava-1.5-7b-hf"
```

### Production (High Performance)
```toml
[vars]
DEFAULT_TEXT_MODEL = "@cf/openai/gpt-oss-120b"
DEFAULT_OBJECT_MODEL = "@cf/facebook/detr-resnet-50"
DEFAULT_FACE_MODEL = "@cf/microsoft/resnet-50"
DEFAULT_VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct"
```

### Production (Heavy Reasoning)
```toml
[vars]
DEFAULT_TEXT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
DEFAULT_OBJECT_MODEL = "@cf/facebook/detr-resnet-50"
DEFAULT_FACE_MODEL = "@cf/microsoft/resnet-50"
DEFAULT_VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct"
```

### Cost Optimized
```toml
[vars]
DEFAULT_TEXT_MODEL = "@cf/meta/llama-3.2-1b-instruct"
DEFAULT_OBJECT_MODEL = "@cf/microsoft/resnet-50"
DEFAULT_FACE_MODEL = "@cf/microsoft/resnet-50"
DEFAULT_VISION_MODEL = "@cf/llava-hf/llava-1.5-7b-hf"
```

## Benefits

1. **Flexibility**: Easily switch AI models without code changes
2. **Environment-specific**: Use different models for dev/staging/production
3. **Cost Control**: Choose cheaper models for development and testing
4. **Performance Tuning**: Use more powerful models in production
5. **Fallbacks**: Built-in defaults ensure the worker always functions

## Type Safety

The `aiModels.ts` utility provides TypeScript types for better development experience:

```typescript
import type { TextModel, ObjectModel, FaceModel, VisionModel } from './lib/aiModels';

// Type-safe model references
const model: TextModel = "@cf/meta/llama-3.1-8b-instruct";
```

## Migration from Hardcoded Models

The old approach with hardcoded models:
```typescript
// Old way (hardcoded)
const analysis = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
  prompt: "Analyze this...",
});
```

New configurable approach:
```typescript
// New way (configurable)
import { getTextModel } from './lib/aiModels';

const model = getTextModel(env);
const analysis = await env.AI.run(model, {
  prompt: "Analyze this...",
});
```

This ensures your AI model choices are centralized and configurable without requiring code deployments.
