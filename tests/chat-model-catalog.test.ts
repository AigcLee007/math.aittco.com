import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHAT_MODEL_FIXED_API_HOST,
  CHAT_MODEL_CATALOG,
  getChatModelCatalogPlan,
  isFixedTextModelId,
  type ModelPricingSnapshot,
} from '../src/common/models/chat-model-catalog';

const expectedCatalog = [
  ['gemini-3.5-flash-preview', 'Gemini-3.5-Flash', 1],
  ['gemini-3.7-flash', 'Gemini-3.7-Flash', 2],
  ['gemini-3.1-pro-preview', 'Gemini-3.1-Pro', 3],
  ['gpt-5.5', 'GPT-5.5', 4],
  ['gpt-5.6-terra', 'GPT-5.6-Terra', 3],
  ['gpt-5.6-sol', 'GPT-5.6-Sol', 6],
  ['claude-opus-4-8', 'Claude-Opus-4-8', 6],
  ['claude-sonnet-5', 'Claude-Sonnet-5', 5],
  ['claude-opus-5', 'Claude-Opus-5', 7],
  ['grok-4.6', 'Grok-4.6', 3],
] as const;

test('catalog contains exactly the ten canonical text models', () => {
  assert.equal(CHAT_MODEL_FIXED_API_HOST, 'https://api.aittco.com');
  assert.deepEqual(
    CHAT_MODEL_CATALOG.map(({ modelId, modelName, coinCost }) => [modelId, modelName, coinCost]),
    expectedCatalog,
  );
  assert.ok(CHAT_MODEL_CATALOG.every((model) => model.category === 'CHAT' && model.isActive));
});

test('canonical model IDs accept whitespace, case, models/, and vendor/ prefixes', () => {
  for (const [modelId] of expectedCatalog) {
    assert.equal(isFixedTextModelId(modelId), true);
    assert.equal(isFixedTextModelId(` models/${modelId.toUpperCase()} `), true);
  }
  assert.equal(isFixedTextModelId('openai/gpt-5.5'), true);
  assert.equal(isFixedTextModelId('anthropic/claude-opus-4-8'), true);
  assert.equal(isFixedTextModelId('googleai/gemini-3.7-flash'), true);
  assert.equal(isFixedTextModelId('xai/grok-4.6'), true);
  assert.equal(isFixedTextModelId('gpt-image-2'), false);
  assert.equal(isFixedTextModelId('dall-e-3'), false);
  assert.equal(isFixedTextModelId('whisper-1'), false);
  assert.equal(isFixedTextModelId('tts-1'), false);
});

test('catalog plan upserts canonical rows, deactivates stale managed chat rows, and preserves media', () => {
  const current: ModelPricingSnapshot[] = [
    { modelId: 'gemini-3.5-flash-preview', modelName: 'Old name', category: 'CHAT', coinCost: 99, isActive: false },
    { modelId: 'gemini-3-flash-preview', modelName: 'Gemini-3-Flash', category: 'CHAT', coinCost: 1, isActive: true },
    { modelId: 'googleai/gemini-3-flash-preview', modelName: 'Gemini-3-Flash', category: 'CHAT', coinCost: 1, isActive: true },
    { modelId: 'gpt-5.4', modelName: 'GPT-5.4', category: 'CHAT', coinCost: 4, isActive: true },
    { modelId: 'gpt-4o', modelName: 'GPT-4o', category: 'CHAT', coinCost: 2, isActive: true },
    { modelId: 'openai/gpt-5.5', modelName: 'GPT-5.5 alias', category: 'CHAT', coinCost: 4, isActive: true },
    { modelId: 'claude-sonnet-4-6', modelName: 'Claude Sonnet 4.6', category: 'CHAT', coinCost: 4, isActive: true },
    { modelId: 'claude-opus-4-6', modelName: 'Claude Opus 4.6', category: 'CHAT', coinCost: 6, isActive: true },
    { modelId: 'anthropic/claude-opus-4-8', modelName: 'Claude alias', category: 'CHAT', coinCost: 6, isActive: true },
    { modelId: 'grok-4.1', modelName: 'Grok-4.1', category: 'CHAT', coinCost: 3, isActive: true },
    { modelId: 'xai/grok-4.6', modelName: 'Grok alias', category: 'CHAT', coinCost: 3, isActive: true },
    { modelId: 'gemini-3-pro-preview', modelName: 'Gemini-3-Pro', category: 'CHAT', coinCost: 3, isActive: true },
    { modelId: 'googleai/gemini-3-pro-preview', modelName: 'Gemini-3-Pro', category: 'CHAT', coinCost: 3, isActive: true },
    { modelId: 'gpt-image-2', modelName: 'GPT-image-2', category: 'IMAGE', coinCost: 1, isActive: true },
    { modelId: 'claude-video', modelName: 'Claude Video', category: 'VIDEO', coinCost: 9, isActive: true },
  ];

  const plan = getChatModelCatalogPlan(current);

  assert.deepEqual(plan.deactivateModelIds, [
    'anthropic/claude-opus-4-8',
    'claude-opus-4-6',
    'claude-sonnet-4-6',
    'gemini-3-flash-preview',
    'gemini-3-pro-preview',
    'googleai/gemini-3-flash-preview',
    'googleai/gemini-3-pro-preview',
    'gpt-4o',
    'gpt-5.4',
    'grok-4.1',
    'openai/gpt-5.5',
    'xai/grok-4.6',
  ]);
  assert.deepEqual(plan.upserts.map((row) => row.modelId), expectedCatalog.map(([modelId]) => modelId));
  assert.equal(plan.upserts.find((row) => row.modelId === 'gpt-5.5')?.coinCost, 4);
  assert.ok(!plan.deactivateModelIds.includes('gpt-image-2'));
  assert.ok(!plan.deactivateModelIds.includes('claude-video'));
});

test('synchronized catalog produces no additional changes and every model has a description', () => {
  const synchronized: ModelPricingSnapshot[] = CHAT_MODEL_CATALOG.map((entry) => ({ ...entry }));
  assert.deepEqual(getChatModelCatalogPlan(synchronized), { upserts: [], deactivateModelIds: [] });
  for (const model of CHAT_MODEL_CATALOG) {
    assert.ok(model.description.length >= 20, `${model.modelId} description is too short`);
  }
});
