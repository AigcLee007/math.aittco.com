import assert from 'node:assert/strict';
import test from 'node:test';

import { OPENAI_API_PATHS, openAIAccess } from '../src/modules/llms/server/openai/openai.access';
import { geminiAccess } from '../src/modules/llms/server/gemini/gemini.access';
import { anthropicAccess } from '../src/modules/llms/server/anthropic/anthropic.access';

test('canonical OpenAI and xAI text models use the fixed Responses relay', () => {
  const openai = openAIAccess({ dialect: 'openai', oaiKey: 'k', oaiOrg: '', oaiHost: 'https://old.example', heliKey: '' }, 'gpt-5.5', OPENAI_API_PATHS.responses);
  assert.equal(openai.url, 'https://api.aittco.com/v1/responses');
  const xai = openAIAccess({ dialect: 'xai', oaiKey: 'k', oaiOrg: '', oaiHost: '', heliKey: '' }, 'grok-4.6', OPENAI_API_PATHS.responses);
  assert.equal(xai.url, 'https://api.aittco.com/v1/responses');
});

test('canonical Gemini text models use the fixed relay even with a custom host', () => {
  const access = geminiAccess({ dialect: 'gemini', geminiKey: 'k', geminiHost: 'https://old.example', minSafetyLevel: 'BLOCK_NONE' } as any, 'gemini-3.5-flash-preview', '/v1beta/{model=models/*}:generateContent', false);
  assert.equal(access.url, 'https://api.aittco.com/v1beta/models/gemini-3.5-flash-preview:generateContent');
  assert.equal((access.headers as Record<string, string>).Authorization, 'Bearer k');
});

test('canonical Anthropic text models can use the fixed relay without an official host', () => {
  const access = anthropicAccess({ dialect: 'anthropic', anthropicKey: 'k', anthropicHost: null, heliconeKey: null } as any, '/v1/messages', { modelIdForRouting: 'claude-opus-5' });
  assert.equal(access.url, 'https://api.aittco.com/v1/messages');
});
