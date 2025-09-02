/**
 * @file src/lib/aiModels.ts
 * @description Utility functions for working with AI models and environment variables.
 * Provides helper functions to get AI model names from environment variables
 * with fallbacks to defaults, and an exhaustive list of available models.
 */

import type { WorkerEnv } from '../index';

/**
 * Get the text generation model name from environment variables.
 * @param env - The worker environment
 * @returns The model name for text generation
 */
export function getTextModel(env: WorkerEnv): string {
    return env.DEFAULT_TEXT_MODEL || "@cf/openai/gpt-oss-120b";
}

/**
 * Get the object detection model name from environment variables.
 * @param env - The worker environment
 * @returns The model name for object detection
 */
export function getObjectModel(env: WorkerEnv): string {
    return env.DEFAULT_OBJECT_MODEL || "@cf/facebook/detr-resnet-50";
}

/**
 * Get the face detection model name from environment variables.
 * @param env - The worker environment
 * @returns The model name for face detection
 */
export function getFaceModel(env: WorkerEnv): string {
    return env.DEFAULT_FACE_MODEL || "@cf/microsoft/resnet-50";
}

/**
 * Get the vision model name from environment variables.
 * @param env - The worker environment
 * @returns The model name for vision analysis
 */
export function getVisionModel(env: WorkerEnv): string {
    return env.DEFAULT_VISION_MODEL || "@cf/llava-hf/llava-1.5-7b-hf";
}

/**
 * Type-safe AI model names for better TypeScript support.
 */
export type TextModel = string;
export type ObjectModel = string;
export type FaceModel = string;
export type VisionModel = string;

/**
 * All available AI models in the system, categorized by task.
 * This list is generated from the Cloudflare model catalog.
 */
export const AI_MODELS = {
    text: {
        default: "@cf/openai/gpt-oss-120b",
        alternatives: [
            "@cf/deepseek-ai/deepseek-math-7b-instruct",     // CW: 4k, Beta
            "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",  // CW: 80k, Price I/O: $0.50/$4.88
            "@cf/defog/sqlcoder-7b-2",                       // CW: 10k, Beta
            "@cf/fblgit/una-cybertron-7b-v2-bf16",           // CW: 15k, Beta
            "@cf/google/gemma-2b-it-lora",                   // CW: 8k, LoRA: Yes, Beta
            "@cf/google/gemma-3-12b-it",                     // CW: 80k, Price I/O: $0.35/$0.56, LoRA: Yes
            "@cf/google/gemma-7b-it-lora",                   // CW: 3.5k, LoRA: Yes, Beta
            "@cf/meta-llama/llama-2-7b-chat-hf-lora",        // CW: 8k, LoRA: Yes, Beta
            "@cf/meta/llama-2-7b-chat-fp16",                 // CW: 4k, Price I/O: $0.56/$6.67
            "@cf/meta/llama-2-7b-chat-int8",                 // CW: 8k
            "@cf/meta/llama-3-8b-instruct",                  // CW: 8k, Price I/O: $0.28/$0.83
            "@cf/meta/llama-3-8b-instruct-awq",              // CW: 8k, Price I/O: $0.12/$0.27
            "@cf/meta/llama-3.1-8b-instruct-awq",            // CW: 8k, Price I/O: $0.12/$0.27
            "@cf/meta/llama-3.1-8b-instruct-fp8",            // CW: 32k, Price I/O: $0.15/$0.29
            "@cf/meta/llama-3.2-11b-vision-instruct",        // CW: 128k, Price I/O: $0.049/$0.68, LoRA: Yes, Vision
            "@cf/meta/llama-3.2-1b-instruct",                // CW: 60k, Price I/O: $0.027/$0.20
            "@cf/meta/llama-3.2-3b-instruct",                // CW: 128k, Price I/O: $0.051/$0.34
            "@cf/meta/llama-3.3-70b-instruct-fp8-fast",      // TOP 5: Large, fast model for heavy-duty reasoning. CW: 24k, Price I/O: $0.29/$2.25, Function Calling, Async
            "@cf/meta/llama-4-scout-17b-16e-instruct",       // TOP 5: Newest generation, multimodal, great for complex agentic tasks. CW: 131k, Price I/O: $0.27/$0.85, Function Calling, Async
            "@cf/meta/llama-guard-3-8b",                     // CW: N/A, Price I/O: $0.48/$0.03, LoRA: Yes
            "@cf/microsoft/phi-2",                           // CW: 2k, Beta
            "@cf/mistral/mistral-7b-instruct-v0.1",          // CW: 2.8k, Price I/O: $0.11/$0.19, LoRA: Yes
            "@cf/mistral/mistral-7b-instruct-v0.2-lora",     // CW: 15k, LoRA: Yes, Beta
            "@cf/mistralai/mistral-small-3.1-24b-instruct",  // TOP 5: Strong vision/text balance with large context. CW: 128k, Price I/O: $0.35/$0.56, Function Calling
            "@cf/openchat/openchat-3.5-0106",                // CW: 8k, Beta
            "@cf/openai/gpt-oss-120b",                       // TOP 5: Excellent for high-reasoning, production use cases. CW: 128k, Price I/O: $0.35/$0.75, Async
            "@cf/openai/gpt-oss-20b",                        // CW: 128k, Price I/O: $0.20/$0.30
            "@cf/qwen/qwen1.5-0.5b-chat",                    // CW: 32k, Beta
            "@cf/qwen/qwen1.5-1.8b-chat",                    // CW: 32k, Beta
            "@cf/qwen/qwen1.5-14b-chat-awq",                 // CW: 7.5k, Beta
            "@cf/qwen/qwen1.5-7b-chat-awq",                  // CW: 20k, Beta
            "@cf/qwen/qwen2.5-coder-32b-instruct",           // CW: 32k, Price I/O: $0.66/$1.00, LoRA: Yes
            "@cf/qwen/qwq-32b",                              // CW: 24k, Price I/O: $0.66/$1.00, LoRA: Yes
            "@cf/thebloke/discolm-german-7b-v1-awq",         // CW: 4k, Beta
            "@cf/tiiuae/falcon-7b-instruct",                 // CW: 4k, Beta
            "@cf/tinyllama/tinyllama-1.1b-chat-v1.0",        // CW: 2k, Beta
            "@hf/google/gemma-7b-it",                        // TOP 5: Versatile, open model from Google, good for general purpose tasks. CW: 8k, LoRA: Yes, Beta
            "@hf/meta-llama/meta-llama-3-8b-instruct",       // CW: 8k
            "@hf/mistral/mistral-7b-instruct-v0.2",          // CW: 3k, LoRA: Yes, Beta
            "@hf/nexusflow/starling-lm-7b-beta",              // CW: 4k, Beta
            "@hf/nousresearch/hermes-2-pro-mistral-7b",      // CW: 24k, Function Calling, Beta
            "@hf/thebloke/deepseek-coder-6.7b-base-awq",     // CW: 4k, Beta
            "@hf/thebloke/deepseek-coder-6.7b-instruct-awq", // CW: 4k, Beta
            "@hf/thebloke/llama-2-13b-chat-awq",             // CW: 4k, Beta
            "@hf/thebloke/llamaguard-7b-awq",                // CW: 4k, Beta
            "@hf/thebloke/mistral-7b-instruct-v0.1-awq",     // CW: 4k, Beta
            "@hf/thebloke/neural-chat-7b-v3-1-awq",          // CW: 4k, Beta
            "@hf/thebloke/openhermes-2.5-mistral-7b-awq",    // CW: 4k, Beta
            "@hf/thebloke/zephyr-7b-beta-awq",               // CW: 4k, Beta
        ],
    },
    object: {
        default: "@cf/facebook/detr-resnet-50",
        alternatives: [
            "@cf/microsoft/resnet-50", // Price: $0.0000025/req. Primarily Image Classification, but a viable alternative.
        ],
    },
    face: {
        default: "@cf/microsoft/resnet-50",
        alternatives: [
            // No other direct alternatives for face detection/image classification in the provided list.
            // Keeping the original alternative for consistency.
            "@cf/facebook/detr-resnet-50", // Price: N/A
        ],
    },
    vision: {
        default: "@cf/llava-hf/llava-1.5-7b-hf", // Beta
        alternatives: [
            "@cf/meta/llama-3.2-11b-vision-instruct", // CW: 128k, Price I/O: $0.049/$0.68, LoRA: Yes
            "@cf/unum/uform-gen2-qwen-500m",          // Beta
        ],
    },
} as const;
