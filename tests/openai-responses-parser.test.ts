import assert from 'node:assert/strict';
import test from 'node:test';

import { createOpenAIResponsesEventParser } from '../src/modules/aix/server/dispatch/chatGenerate/parsers/openai.responses.parser';

test('ignores relay codex events, audio deltas, and missing content item IDs', () => {
  const parser = createOpenAIResponsesEventParser();
  assert.doesNotThrow(() => parser({} as any, JSON.stringify({ type: 'codex.rate_limits' })));
  assert.doesNotThrow(() => parser({} as any, JSON.stringify({
    type: 'response.content_part.added', output_index: 1, content_index: 0,
    part: { type: 'output_text', text: '' },
  })));
  assert.doesNotThrow(() => parser({} as any, JSON.stringify({
    type: 'response.audio.delta', sequence_number: 0, delta: 'AA==',
  })));
});

test('accepts relay-specific reasoning fields and unknown completed output items', () => {
  const parser = createOpenAIResponsesEventParser();
  const transmitter = { setTokenStopReason() {}, updateMetrics() {} };
  assert.doesNotThrow(() => parser(transmitter as any, JSON.stringify({
    type: 'response.completed',
    response: {
      id: 'resp_test', object: 'response', created_at: 1, status: 'completed',
      model: 'gpt-5.5', output: [{
        type: 'reasoning', id: null, content: [],
        summary: null, encrypted_content: 'opaque-relay-value', relay_field: true,
      }], usage: null,
    },
  })));
  assert.doesNotThrow(() => parser(transmitter as any, JSON.stringify({
    type: 'response.completed',
    response: {
      id: 'resp_test_2', object: 'response', created_at: 1, status: 'completed',
      model: 'gpt-5.6-sol', output: [{ type: 'relay_reasoning_v2', content: [] }], usage: null,
    },
  })));
});

test('suppresses reasoning summary UI while preserving normal text output', () => {
  const parser = createOpenAIResponsesEventParser();
  let reasoningCalls = 0;
  let text = '';
  const transmitter = {
    appendReasoningText() { reasoningCalls++; },
    appendAutoText_weak(value: string) { text += value; },
  };
  parser(transmitter as any, JSON.stringify({
    type: 'response.reasoning_summary_text.delta', output_index: 0, item_id: 'rs_test', summary_index: 0, delta: 'internal reasoning',
  }));
  parser(transmitter as any, JSON.stringify({
    type: 'response.output_text.delta', output_index: 0, content_index: 0, item_id: 'msg_test', delta: 'hello', logprobs: null,
  }));
  assert.equal(reasoningCalls, 0);
  assert.equal(text, 'hello');
});
