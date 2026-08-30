import type { RelayRouteId, RelayTransport } from './model-route.service';

export interface ModelRouteDefinition {
  routeId: RelayRouteId;
  hostEnv: 'AITTCO_API_HOST' | 'BLTCY_API_HOST';
  keyEnv: 'AITTCO_API_KEY' | 'BLTCY_API_KEY';
  protocol: RelayTransport;
  upstreamModel: string;
  endpointPath?: string;
  resolutionModelPolicy?: 'same' | 'suffix';
  // Optional per-model relay overrides (supports different keys on same channel host).
  baseUrl?: string;
  apiKey?: string;
}

/**
 * Model routing table
 *
 * Maintenance rule:
 * 1. Add the real relay host/key values in `.env`
 * 2. Add one entry here for every model that needs custom routing
 * 3. Keep the key as the frontend-facing model id
 * 4. Keep `upstreamModel` as the exact model id expected by the relay
 *
 * Example:
 * 'your-model-id': {
 *   routeId: 'bltcy',
 *   hostEnv: 'BLTCY_API_HOST',
 *   keyEnv: 'BLTCY_API_KEY',
 *   protocol: 'openai-images',
 *   upstreamModel: 'your-upstream-model-id',
 * },
 */
export const MODEL_ROUTE_TABLE: Record<string, ModelRouteDefinition> = {
  // AITTCO relay: Gemini image generation models
  'gemini-3-pro-image-preview': {
    routeId: 'aittco',
    hostEnv: 'AITTCO_API_HOST',
    keyEnv: 'AITTCO_API_KEY',
    protocol: 'gemini-generate-content',
    upstreamModel: 'gemini-3-pro-image-preview',
  },
  'gemini-3.1-flash-image-preview': {
    routeId: 'aittco',
    hostEnv: 'AITTCO_API_HOST',
    keyEnv: 'AITTCO_API_KEY',
    protocol: 'gemini-generate-content',
    upstreamModel: 'gemini-3.1-flash-image-preview',
  },

  // BLTCY relay: Nano Banana image models
  'nano-banana-2': {
    routeId: 'bltcy',
    hostEnv: 'BLTCY_API_HOST',
    keyEnv: 'BLTCY_API_KEY',
    protocol: 'openai-images',
    upstreamModel: 'nano-banana-2',
  },
  'nano-banana-pro': {
    routeId: 'bltcy',
    hostEnv: 'BLTCY_API_HOST',
    keyEnv: 'BLTCY_API_KEY',
    protocol: 'openai-images',
    upstreamModel: 'nano-banana-2',
  },
  'nano-banana-pro-preview': {
    routeId: 'bltcy',
    hostEnv: 'BLTCY_API_HOST',
    keyEnv: 'BLTCY_API_KEY',
    protocol: 'openai-images',
    upstreamModel: 'nano-banana-2',
  },

  // Shared text/image helper model for prompt optimization and image description
  'gemini-3-pro-preview': {
    routeId: 'aittco',
    hostEnv: 'AITTCO_API_HOST',
    keyEnv: 'AITTCO_API_KEY',
    protocol: 'gemini-generate-content',
    upstreamModel: 'gemini-3-pro-preview',
  },

};
