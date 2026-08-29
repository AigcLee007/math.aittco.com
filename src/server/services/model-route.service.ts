import { env } from '~/server/env.server';
import { prismaDb } from '../prisma/prismaDb';
import { MODEL_ROUTE_TABLE, type ModelRouteDefinition } from './model-route.config';

export type RelayRouteId = string;
export type RelayTransport = 'gemini-generate-content' | 'openai-images' | 'anthropic' | 'visionary-images';

export interface RelayRouteConfig {
  routeId: RelayRouteId;
  label: string;
  baseUrl: string;
  apiKey: string;
}

export interface ModelRelayRoute extends RelayRouteConfig {
  transport: RelayTransport;
  upstreamModel: string;
  endpointPath?: string;
}

interface RouteEnvBinding {
  hostEnv: 'AITTCO_API_HOST' | 'BLTCY_API_HOST';
  keyEnv: 'AITTCO_API_KEY' | 'BLTCY_API_KEY';
  fallbackHost: string;
  fallbackKey: string;
}

interface RelayRuntimeConfig {
  channels: Record<string, RelayRouteConfig>;
  modelRouteOverrides: Record<string, ModelRouteDefinition>;
}

export const MODEL_ROUTE_OVERRIDES_CONFIG_KEY = 'MODEL_ROUTE_OVERRIDES_JSON';
export const RELAY_CHANNELS_CONFIG_KEY = 'RELAY_CHANNELS_JSON';

export const RELAY_SYSTEM_CONFIG_KEYS: Record<RelayRouteId, { hostKey: RouteEnvBinding['hostEnv']; apiKey: RouteEnvBinding['keyEnv'] }> = {
  aittco: {
    hostKey: 'AITTCO_API_HOST',
    apiKey: 'AITTCO_API_KEY',
  },
  bltcy: {
    hostKey: 'BLTCY_API_HOST',
    apiKey: 'BLTCY_API_KEY',
  },
};

const TASK_PREFIX = 'relaytask';
const RUNTIME_CACHE_TTL_MS = 10_000;
let relayRuntimeConfigCache: { loadedAt: number; config: RelayRuntimeConfig } | null = null;

function normalizeRelayHost(host: string): string {
  return host
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/v1beta?$/, '');
}

function normalizeModelId(model: string): string {
  return model.trim().replace(/^models\//, '').toLowerCase();
}

function isRelayTransport(transport: string): transport is RelayTransport {
  return transport === 'gemini-generate-content'
    || transport === 'openai-images'
    || transport === 'anthropic'
    || transport === 'visionary-images';
}

function normalizeEndpointPath(endpointPath?: string): string | undefined {
  if (!endpointPath)
    return undefined;
  const trimmed = endpointPath.trim();
  if (!trimmed)
    return undefined;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

const RELAY_ENV_BINDINGS: Record<RelayRouteId, RouteEnvBinding> = {
  aittco: {
    hostEnv: 'AITTCO_API_HOST',
    keyEnv: 'AITTCO_API_KEY',
    fallbackHost: normalizeRelayHost(
      env.IMAGE_PROVIDER_API_HOST
      || env.GEMINI_API_HOST
      || env.OPENAI_API_HOST
      || 'https://api.aittco.com',
    ),
    fallbackKey: (env.BACKEND_API_KEY || env.GEMINI_API_KEY || env.OPENAI_API_KEY || '').trim(),
  },
  bltcy: {
    hostEnv: 'BLTCY_API_HOST',
    keyEnv: 'BLTCY_API_KEY',
    fallbackHost: 'https://api.bltcy.ai',
    fallbackKey: '',
  },
};

function getEnvValue(key: RouteEnvBinding['hostEnv'] | RouteEnvBinding['keyEnv']): string {
  return (env[key] || '').trim();
}

function emptyRuntimeConfig(): RelayRuntimeConfig {
  return {
    channels: {},
    modelRouteOverrides: {},
  };
}

function parseRelayChannels(rawValue?: string): Record<string, RelayRouteConfig> {
  if (!rawValue?.trim())
    return {};

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return {};

    const channels: Record<string, RelayRouteConfig> = {};
    for (const [rawId, rawDef] of Object.entries(parsed as Record<string, any>)) {
      const id = String(rawId || '').trim().toLowerCase();
      if (!id || !rawDef || typeof rawDef !== 'object' || Array.isArray(rawDef))
        continue;
      const baseUrl = normalizeRelayHost(String(rawDef.baseUrl || ''));
      const apiKey = String(rawDef.apiKey || '').trim();
      if (!baseUrl && !apiKey)
        continue;
      channels[id] = {
        routeId: id,
        label: String(rawDef.label || id.toUpperCase()).trim() || id.toUpperCase(),
        baseUrl,
        apiKey,
      };
    }

    return channels;
  } catch {
    return {};
  }
}

function parseModelRouteOverrides(rawValue?: string): Record<string, ModelRouteDefinition> {
  if (!rawValue?.trim())
    return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return {};
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    return {};

  const normalizedOverrides: Record<string, ModelRouteDefinition> = {};

  for (const [rawModelId, rawDefinition] of Object.entries(parsed as Record<string, any>)) {
    if (!rawDefinition || typeof rawDefinition !== 'object' || Array.isArray(rawDefinition))
      continue;

    const routeId = String(rawDefinition.routeId || '').trim().toLowerCase();
    const protocol = String(rawDefinition.protocol || rawDefinition.transport || '').trim();
    const upstreamModel = String(rawDefinition.upstreamModel || '').trim();
    const baseUrl = normalizeRelayHost(String(rawDefinition.baseUrl || ''));
    const apiKey = String(rawDefinition.apiKey || '').trim();
    const resolutionModelPolicy = String(rawDefinition.resolutionModelPolicy || '').trim().toLowerCase() === 'suffix'
      ? 'suffix'
      : 'same';
    const modelId = normalizeModelId(rawModelId);

    if (!routeId || !isRelayTransport(protocol) || !upstreamModel || !modelId)
      continue;

    const keys = (routeId === 'aittco' || routeId === 'bltcy')
      ? RELAY_SYSTEM_CONFIG_KEYS[routeId]
      : null;
    normalizedOverrides[modelId] = {
      routeId,
      hostEnv: keys?.hostKey || 'AITTCO_API_HOST',
      keyEnv: keys?.apiKey || 'AITTCO_API_KEY',
      protocol,
      upstreamModel,
      endpointPath: normalizeEndpointPath(rawDefinition.endpointPath),
      resolutionModelPolicy,
      ...(baseUrl ? { baseUrl } : {}),
      ...(apiKey ? { apiKey } : {}),
    };
  }

  return normalizedOverrides;
}

async function loadRelayRuntimeConfig(): Promise<RelayRuntimeConfig> {
  const now = Date.now();
  if (relayRuntimeConfigCache && now - relayRuntimeConfigCache.loadedAt < RUNTIME_CACHE_TTL_MS)
    return relayRuntimeConfigCache.config;

  const config = emptyRuntimeConfig();
  const configKeys = [
    RELAY_SYSTEM_CONFIG_KEYS.aittco.hostKey,
    RELAY_SYSTEM_CONFIG_KEYS.aittco.apiKey,
    RELAY_SYSTEM_CONFIG_KEYS.bltcy.hostKey,
    RELAY_SYSTEM_CONFIG_KEYS.bltcy.apiKey,
    RELAY_CHANNELS_CONFIG_KEY,
    MODEL_ROUTE_OVERRIDES_CONFIG_KEY,
  ];

  try {
    const rows = await prismaDb.systemConfig.findMany({
      where: { key: { in: configKeys } },
      select: { key: true, value: true },
    });
    const byKey = new Map(rows.map((row) => [row.key, row.value]));
    config.channels = parseRelayChannels(byKey.get(RELAY_CHANNELS_CONFIG_KEY));

    for (const routeId of Object.keys(RELAY_SYSTEM_CONFIG_KEYS) as Array<'aittco' | 'bltcy'>) {
      const { hostKey, apiKey } = RELAY_SYSTEM_CONFIG_KEYS[routeId];
      const hostOverride = normalizeRelayHost(byKey.get(hostKey) || '');
      const keyOverride = (byKey.get(apiKey) || '').trim();
      if (!hostOverride && !keyOverride)
        continue;
      const existing = config.channels[routeId];
      config.channels[routeId] = {
        routeId,
        label: existing?.label || routeId.toUpperCase(),
        baseUrl: hostOverride || existing?.baseUrl || '',
        apiKey: keyOverride || existing?.apiKey || '',
      };
    }

    config.modelRouteOverrides = parseModelRouteOverrides(byKey.get(MODEL_ROUTE_OVERRIDES_CONFIG_KEY));
  } catch {
    // Keep env/static fallback when DB is unavailable.
  }

  relayRuntimeConfigCache = {
    loadedAt: now,
    config,
  };
  return config;
}

function buildRelayRouteConfig(routeId: RelayRouteId, runtimeConfig: RelayRuntimeConfig): RelayRouteConfig {
  const normalizedRouteId = routeId.trim().toLowerCase();
  const dynamicChannel = runtimeConfig.channels[normalizedRouteId];
  if (dynamicChannel) {
    return {
      routeId: normalizedRouteId,
      label: dynamicChannel.label || normalizedRouteId.toUpperCase(),
      baseUrl: normalizeRelayHost(dynamicChannel.baseUrl || ''),
      apiKey: (dynamicChannel.apiKey || '').trim(),
    };
  }

  if (normalizedRouteId === 'aittco' || normalizedRouteId === 'bltcy') {
    const binding = RELAY_ENV_BINDINGS[normalizedRouteId];
    const baseUrl = normalizeRelayHost(
      getEnvValue(binding.hostEnv)
      || binding.fallbackHost,
    );
    const apiKey = (
      getEnvValue(binding.keyEnv)
      || binding.fallbackKey
    ).trim();

    if (normalizedRouteId === 'bltcy' && !baseUrl)
      return buildRelayRouteConfig('aittco', runtimeConfig);

    if (normalizedRouteId === 'bltcy' && !apiKey) {
      const aittco = buildRelayRouteConfig('aittco', runtimeConfig);
      return {
        ...aittco,
        routeId: normalizedRouteId,
        label: 'BLTCY (fallback AITTCO)',
      };
    }

    return {
      routeId: normalizedRouteId,
      label: normalizedRouteId.toUpperCase(),
      baseUrl,
      apiKey,
    };
  }

  return {
    routeId: normalizedRouteId,
    label: normalizedRouteId.toUpperCase(),
    baseUrl: '',
    apiKey: '',
  };
}

function applyModelRelayOverrides(
  route: RelayRouteConfig,
  definition: ModelRouteDefinition,
): RelayRouteConfig {
  const baseUrlOverride = normalizeRelayHost(definition.baseUrl || '');
  const apiKeyOverride = (definition.apiKey || '').trim();

  if (!baseUrlOverride && !apiKeyOverride)
    return route;

  return {
    ...route,
    ...(baseUrlOverride ? { baseUrl: baseUrlOverride } : {}),
    ...(apiKeyOverride ? { apiKey: apiKeyOverride } : {}),
    label: `${route.label} (model override)`,
  };
}

function getDefaultModelRoute(model: string): ModelRouteDefinition {
  const normalized = normalizeModelId(model);

  if (normalized.includes('claude')) {
    return {
      routeId: 'aittco',
      hostEnv: 'AITTCO_API_HOST',
      keyEnv: 'AITTCO_API_KEY',
      protocol: 'anthropic',
      upstreamModel: normalized,
    };
  }

  if (normalized.includes('gpt-image') || normalized.includes('dall-e') || normalized.startsWith('gpt-')) {
    return {
      routeId: 'aittco',
      hostEnv: 'AITTCO_API_HOST',
      keyEnv: 'AITTCO_API_KEY',
      protocol: 'openai-images',
      upstreamModel: normalized,
      endpointPath: '/v1/images/generations',
    };
  }

  return {
    routeId: 'aittco',
    hostEnv: 'AITTCO_API_HOST',
    keyEnv: 'AITTCO_API_KEY',
    protocol: 'gemini-generate-content',
    upstreamModel: normalized,
  };
}

export function invalidateRelayRuntimeConfigCache(): void {
  relayRuntimeConfigCache = null;
}

export async function getRelayRouteById(routeId: RelayRouteId): Promise<RelayRouteConfig> {
  const runtimeConfig = await loadRelayRuntimeConfig();
  return buildRelayRouteConfig(routeId, runtimeConfig);
}

export async function resolveImageModelRoute(model: string): Promise<ModelRelayRoute> {
  const normalized = normalizeModelId(model);
  const runtimeConfig = await loadRelayRuntimeConfig();
  const definition = runtimeConfig.modelRouteOverrides[normalized] || MODEL_ROUTE_TABLE[normalized] || getDefaultModelRoute(normalized);
  const route = applyModelRelayOverrides(
    buildRelayRouteConfig(definition.routeId, runtimeConfig),
    definition,
  );

  return {
    ...route,
    transport: definition.protocol,
    upstreamModel: definition.upstreamModel,
    endpointPath: normalizeEndpointPath(definition.endpointPath),
  };
}

export async function resolvePromptModelRoute(model = 'gemini-3.5-flash-preview'): Promise<ModelRelayRoute> {
  const normalized = normalizeModelId(model);
  const runtimeConfig = await loadRelayRuntimeConfig();
  const definition = runtimeConfig.modelRouteOverrides[normalized] || MODEL_ROUTE_TABLE[normalized] || getDefaultModelRoute(normalized);
  const route = applyModelRelayOverrides(
    buildRelayRouteConfig(definition.routeId, runtimeConfig),
    definition,
  );

  return {
    ...route,
    transport: definition.protocol,
    upstreamModel: definition.upstreamModel,
    endpointPath: normalizeEndpointPath(definition.endpointPath),
  };
}

export async function resolveVideoModelRoute(model: string): Promise<ModelRelayRoute> {
  return resolveImageModelRoute(model);
}

export function assertRelayRouteIsConfigured(route: RelayRouteConfig): void {
  if (!route.baseUrl)
    throw new Error(`Relay ${route.label} is missing a base URL`);
  if (!route.apiKey)
    throw new Error(`Relay ${route.label} is missing an API key`);
}

export function buildGeminiGenerateContentUrl(route: RelayRouteConfig, model: string): string {
  assertRelayRouteIsConfigured(route);
  return `${route.baseUrl}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(route.apiKey)}`;
}

export function buildGeminiEndpointUrl(route: RelayRouteConfig, endpointPath: string): string {
  assertRelayRouteIsConfigured(route);
  const normalizedEndpoint = normalizeEndpointPath(endpointPath) || endpointPath;
  const base = `${route.baseUrl}${normalizedEndpoint}`;
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}key=${encodeURIComponent(route.apiKey)}`;
}

export function buildOpenAIImagesUrl(route: RelayRouteConfig, asyncMode = false, endpointPath = '/v1/images/generations'): string {
  assertRelayRouteIsConfigured(route);
  const normalizedEndpoint = normalizeEndpointPath(endpointPath) || '/v1/images/generations';
  if (!asyncMode)
    return `${route.baseUrl}${normalizedEndpoint}`;

  const separator = normalizedEndpoint.includes('?') ? '&' : '?';
  return `${route.baseUrl}${normalizedEndpoint}${separator}async=true`;
}

export function buildOpenAITaskUrl(route: RelayRouteConfig, upstreamTaskId: string): string {
  assertRelayRouteIsConfigured(route);
  return `${route.baseUrl}/v1/images/tasks/${upstreamTaskId}`;
}

export function createRelayAuthHeaders(route: RelayRouteConfig): Record<string, string> {
  assertRelayRouteIsConfigured(route);
  return {
    Authorization: `Bearer ${route.apiKey}`,
  };
}

export function encodeRelayTaskId(routeId: RelayRouteId, upstreamTaskId: string): string {
  return `${TASK_PREFIX}:${routeId}:${upstreamTaskId}`;
}

export function decodeRelayTaskId(taskId: string): { routeId: RelayRouteId; upstreamTaskId: string } | null {
  const [prefix, routeId, ...rest] = taskId.split(':');
  if (prefix !== TASK_PREFIX || !routeId || !rest.length)
    return null;

  return {
    routeId: routeId.trim().toLowerCase(),
    upstreamTaskId: rest.join(':'),
  };
}

export async function getMergedModelRouteTable(): Promise<Record<string, ModelRouteDefinition>> {
  const runtimeConfig = await loadRelayRuntimeConfig();
  return {
    ...MODEL_ROUTE_TABLE,
    ...runtimeConfig.modelRouteOverrides,
  };
}

export async function getImageResolutionModelPolicy(model: string): Promise<'same' | 'suffix'> {
  const normalized = normalizeModelId(model);
  const runtimeConfig = await loadRelayRuntimeConfig();
  const definition = runtimeConfig.modelRouteOverrides[normalized] || MODEL_ROUTE_TABLE[normalized] || getDefaultModelRoute(normalized);
  return definition.resolutionModelPolicy === 'suffix' ? 'suffix' : 'same';
}

export function getModelRouteTable() {
  return MODEL_ROUTE_TABLE;
}
