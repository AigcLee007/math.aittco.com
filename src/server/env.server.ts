/**
 * Server-side environment variables centralized access and validation.
 * Replaced with env.client-mock.ts on client builds via webpack.
 */
// [client-side] throw immediately if imported
if (typeof window !== 'undefined')
  throw new Error('[DEV] env.server: server module should never be imported on the client.');

// noinspection ES6PreferShortImport - because this is included by `next.config.ts` and build would not find this file with ~/...
import { createEnv } from '../modules/3rdparty/t3-env';
import * as z from 'zod/v4';


// Helper to make some variables required only in production
const isProd = process.env.NODE_ENV === 'production' // True on Vercel and local builds, false on local dev
  && process.env.NEXT_PUBLIC_VERCEL_TARGET_ENV !== 'preview'; // False on Vercel dev-branch builds ('production' and 'staging' environments are treated as prod)
const requireOnProd = isProd ? z.string() : z.string().optional();


export const env = createEnv({

  /*
   * Serverside Environment variables, not available on the client.
   * Will throw if you access these variables on the client.
   */
  server: {

    // Backend Postgres, for optional storage via Prisma
    POSTGRES_PRISMA_URL: z.string().optional(),
    POSTGRES_URL_NON_POOLING: z.string().optional(),
    // Backend MongoDB, for a more complete developer data platform.
    MDB_URI: z.string().optional(),


    // LLM: OpenAI
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_API_HOST: z.url().optional(),
    OPENAI_API_ORG_ID: z.string().optional(),

    // Relay: AITTCO
    AITTCO_API_HOST: z.url().optional(),
    AITTCO_API_KEY: z.string().optional(),

    // Relay: BLTCY
    BLTCY_API_HOST: z.url().optional(),
    BLTCY_API_KEY: z.string().optional(),
    NANO_BANANA_LINE1_API_KEY: z.string().optional(),
    NANO_BANANA_LINE1_BASE_URL: z.url().optional(),
    NANO_BANANA_LINE2_API_KEY: z.string().optional(),
    NANO_BANANA_LINE2_BASE_URL: z.url().optional(),
    NANO_BANANA_VIP_API_KEY: z.string().optional(),
    NANO_BANANA_VIP_BASE_URL: z.url().optional(),

    // LLM: Alibaba (OpenAI)
    ALIBABA_API_HOST: z.url().optional(),
    ALIBABA_API_KEY: z.string().optional(),

    // LLM: Azure OpenAI
    AZURE_OPENAI_API_ENDPOINT: z.url().optional(),
    AZURE_OPENAI_API_KEY: z.string().optional(),
    // The following do not need to be set
    AZURE_OPENAI_DISABLE_V1: z.string().optional(), // next-gen API is active by default, default: false
    AZURE_OPENAI_API_VERSION: z.string().optional(), // traditional API still used for non-response models, default: '2025-04-01-preview'
    AZURE_DEPLOYMENTS_API_VERSION: z.string().optional(), // default: '2023-03-15-preview'

    // LLM: Anthropic
    ANTHROPIC_API_KEY: z.string().optional(),
    ANTHROPIC_API_HOST: z.url().optional(),

    // LLM: Deepseek AI
    DEEPSEEK_API_KEY: z.string().optional(),

    // LLM: Google AI's Gemini
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_API_HOST: z.url().optional(),

    // LLM: Groq
    GROQ_API_KEY: z.string().optional(),

    // LLM: LocalAI
    LOCALAI_API_HOST: z.url().optional(),
    LOCALAI_API_KEY: z.string().optional(),

    // LLM: Mistral
    MISTRAL_API_KEY: z.string().optional(),

    // LLM: Moonshot AI
    MOONSHOT_API_KEY: z.string().optional(),

    // LLM: Ollama
    OLLAMA_API_HOST: z.url().optional(),

    // LLM: OpenPipe
    OPENPIPE_API_KEY: z.string().optional(),

    // LLM: OpenRouter
    OPENROUTER_API_KEY: z.string().optional(),

    // LLM: Perplexity
    PERPLEXITY_API_KEY: z.string().optional(),

    // LLM: Together AI
    TOGETHERAI_API_KEY: z.string().optional(),

    // LLM: xAI
    XAI_API_KEY: z.string().optional(),


    // Helicone - works on both OpenAI and Anthropic vendors
    HELICONE_API_KEY: z.string().optional(),


    // Browsing Service
    PUPPETEER_WSS_ENDPOINT: z.url().optional(),

    // Google Custom Search
    GOOGLE_CLOUD_API_KEY: z.string().optional(),
    GOOGLE_CSE_ID: z.string().optional(),


    // Text-To-Speech: ElevenLabs - speech.ts
    ELEVENLABS_API_KEY: z.string().optional(),
    ELEVENLABS_API_HOST: z.url().optional(),
    ELEVENLABS_VOICE_ID: z.string().optional(),


    // Backend: HTTP Basic Authentication
    HTTP_BASIC_AUTH_USERNAME: z.string().optional(),
    HTTP_BASIC_AUTH_PASSWORD: z.string().optional(),
 
    // Image Provider API Host (for relay/proxy)
    IMAGE_PROVIDER_API_HOST: z.url().optional(),

    // Backend API Key (Shared between Next.js and FastAPI or Upstream)
    BACKEND_API_KEY: z.string().optional(),

    // Payments: generic notify signature/token
    PAYMENT_NOTIFY_TOKEN: z.string().optional(),
    PAYMENT_RETURN_URL: z.url().optional(),
    ZPAY_SUBMIT_URL: z.url().optional(),
    ZPAY_PID: z.string().optional(),
    ZPAY_PKEY: z.string().optional(),
    XUNHU_GATEWAY: z.url().optional(),
    XUNHU_QUERY_URL: z.url().optional(),
    XUNHU_APP_ID: z.string().optional(),
    XUNHU_APP_SECRET: z.string().optional(),

    // Payments: Alipay
    ALIPAY_GATEWAY: z.url().optional(),
    ALIPAY_APP_ID: z.string().optional(),
    ALIPAY_NOTIFY_URL: z.url().optional(),

    // Payments: WeChat Pay
    WECHAT_PAY_GATEWAY: z.url().optional(),
    WECHAT_PAY_MCH_ID: z.string().optional(),
    WECHAT_PAY_NOTIFY_URL: z.url().optional(),

    // Backend: JWT Authentication
    JWT_SECRET: z.string().optional(),
    JWT_REFRESH_SECRET: z.string().optional(),

    // AIX: Strict parsing mode - if omitted: strict in dev (throws on unknown API values), tolerant in prod (warns)
    // Set to 'true' to force strict mode in production (useful for debugging API drift)
    AIX_STRICT_PARSING: z.enum(['true']).optional(),

    // Build-time configuration (ignore)
    BIG_AGI_BUILD: z.enum(['standalone', 'static']).optional(),

  },

  /*
   * Environment variables available on the client (and server).
   * You'll get type errors if these are not prefixed with NEXT_PUBLIC_.
   *
   * This is here basically for validation, but seems to not be used anywhere in the client code.
   *
   * NOTE: they must be set at build time, not runtime(!)
   */
  client: {

    // Frontend: Google Analytics GA4 Measurement ID
    NEXT_PUBLIC_GA4_MEASUREMENT_ID: z.string().optional(),

    // Google Drive Picker: download files from Google Drive
    NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID: z.string().optional(),

    // Frontend: server to use for PlantUML rendering
    NEXT_PUBLIC_PLANTUML_SERVER_URL: z.url().optional(),

  },

  // matches user expectations - see https://github.com/enricoros/big-AGI/issues/279
  emptyStringAsUndefined: true,

  // with Noext.JS >= 13.4.4 we'd only need to destructure client variables
  experimental__runtimeEnv: {
    NEXT_PUBLIC_GA4_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
    NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID,
    NEXT_PUBLIC_PLANTUML_SERVER_URL: process.env.NEXT_PUBLIC_PLANTUML_SERVER_URL,
  },
});
