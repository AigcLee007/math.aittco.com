import { apiAsync } from '~/common/util/trpc.client';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.access';

export interface DXAIServiceSettings {
  xaiKey: string;
  oaiHost?: string; // Added to support custom host
  csf?: boolean;
}

export const ModelVendorXAI: IModelVendor<DXAIServiceSettings, OpenAIAccessSchema> = {
  id: 'xai',
  name: 'xAI',
  displayRank: 15,
  displayGroup: 'popular',
  location: 'cloud',
  instanceLimit: 1,
  hasServerConfigKey: 'hasLlmXAI',

  /// client-side-fetch ///
  csfAvailable: _csfXAIAvailable,

  // functions
  initializeSetup: () => ({ xaiKey: '' }),
  validateSetup: setup => setup.xaiKey?.length >= 20, // Relaxed further to support various key formats
  getTransportAccess: (partialSetup) => ({
    dialect: 'openai',
    clientSideFetch: _csfXAIAvailable(partialSetup) && !!partialSetup?.csf,
    oaiKey: partialSetup?.xaiKey || '',
    oaiOrg: '',
    oaiHost: 'https://api.aittco.com', // Force custom host and hide from user
    heliKey: '',
  }),

  // OpenAI transport ('xai' dialect in 'access')
  rpcUpdateModelsOrThrow: async (access) => {
    const { models } = await apiAsync.llmOpenAI.listModels.query({ access });
    return {
      models: models.filter(m => m.id.toLowerCase().includes('grok')),
    };
  },

};

function _csfXAIAvailable(s?: Partial<DXAIServiceSettings>) {
  return !!s?.xaiKey;
}
