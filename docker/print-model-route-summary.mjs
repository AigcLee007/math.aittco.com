const MODEL_ROUTE_TABLE = {
  'gemini-3-pro-image-preview': {
    routeId: 'aittco',
    protocol: 'gemini-generate-content',
    upstreamModel: 'gemini-3-pro-image-preview',
  },
  'gemini-3.1-flash-image-preview': {
    routeId: 'aittco',
    protocol: 'gemini-generate-content',
    upstreamModel: 'gemini-3.1-flash-image-preview',
  },
  'nano-banana-2': {
    routeId: 'bltcy',
    protocol: 'openai-images',
    upstreamModel: 'nano-banana-2',
  },
  'nano-banana-pro': {
    routeId: 'bltcy',
    protocol: 'openai-images',
    upstreamModel: 'nano-banana-2',
  },
  'nano-banana-pro-preview': {
    routeId: 'bltcy',
    protocol: 'openai-images',
    upstreamModel: 'nano-banana-2',
  },
  'gemini-3-pro-preview': {
    routeId: 'aittco',
    protocol: 'gemini-generate-content',
    upstreamModel: 'gemini-3-pro-preview',
  },
};

function maskKey(apiKey) {
  return apiKey ? 'configured' : 'missing';
}

function resolveRoute(routeId) {
  const aittcoHost = (process.env.AITTCO_API_HOST || process.env.IMAGE_PROVIDER_API_HOST || process.env.GEMINI_API_HOST || process.env.OPENAI_API_HOST || 'https://api.aittco.com')
    .replace(/\/+$/, '')
    .replace(/\/v1beta?$/, '');
  const aittcoKey = process.env.AITTCO_API_KEY || process.env.BACKEND_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || '';

  if (routeId === 'aittco') {
    return {
      label: 'AITTCO',
      baseUrl: aittcoHost,
      apiKey: aittcoKey,
    };
  }

  const bltcyHost = (process.env.BLTCY_API_HOST || 'https://api.bltcy.ai')
    .replace(/\/+$/, '')
    .replace(/\/v1beta?$/, '');
  const bltcyKey = process.env.BLTCY_API_KEY || aittcoKey;

  return {
    label: process.env.BLTCY_API_KEY ? 'BLTCY' : 'BLTCY (fallback AITTCO)',
    baseUrl: process.env.BLTCY_API_KEY ? bltcyHost : aittcoHost,
    apiKey: bltcyKey,
  };
}

console.log('Model route summary:');
for (const [modelId, definition] of Object.entries(MODEL_ROUTE_TABLE)) {
  const route = resolveRoute(definition.routeId);
  console.log(
    `- ${modelId} -> ${route.label} | protocol=${definition.protocol} | upstream=${definition.upstreamModel} | host=${route.baseUrl} | key=${maskKey(route.apiKey)}`,
  );
}
