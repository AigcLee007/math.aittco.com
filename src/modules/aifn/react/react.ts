/*
 * porting of implementation from here: https://til.simonwillison.net/llms/python-react-pattern
 */

import { aixChatGenerateText_Simple } from '~/modules/aix/client/aix.client';
import { bareBonesPromptMixer } from '~/modules/persona/pmix/pmix';
import { callApiSearchGoogle } from '~/modules/google/search.client';


import type { DLLMId } from '~/common/stores/llms/llms.types';
import { frontendSideFetch } from '~/common/util/clientFetchers';


// prompt to implement the ReAct paradigm: https://arxiv.org/abs/2210.03629
const reActPrompt = (enableBrowse: boolean): string =>
  `你是一个具备强大推理能力的问答 AI 助手。
对于用户提出的问题，你必须遵循以下“循环”步骤：【思考 (Thought)】、【行动 (Action)】、停止生成并等待【观察结果 (Observation)】、最后给出【回答 (Answer)】。

**执行规则：**
1. **思考：** 每一轮开始，你必须先描述你对当前问题的想法，以及为什么需要执行下一步行动。
2. **行动：** 如果你需要外部信息（如实时搜索、维基百科、打开网页），你必须调用一项可用的工具。格式为：\`行动：工具名：参数\`。
   - **紧接着行动之后，你必须输出 \`PAUSE\` 并立即停止生成。** 严禁自行伪造观察结果。
3. **观察结果：** 系统会执行你的行动，并将结果以“观察结果：”的格式回传给你。
4. **回答：** 当你根据思考或观察结果得出了问题的准确答案时，你必须输出 \`回答：\` 后接最终答案。
   - 在输出最终答案时，只需给出结论，无需重复之前的推理步骤。

**特别注意：**
- 处理日期相关问题时，请假定今天是 {{Today}}。
- 严禁提及你的知识截止日期。

**可用的“行动（Actions）”：**

google:
例如：google: 2026年人工智能趋势
说明：返回 Google 搜索结果。当问题涉及实时事件、新闻、天气或需要事实核查时，请务必使用。

` + `wikipedia:
例如：wikipedia: 深度学习
说明：从维基百科搜索并返回摘要。

**示例会话：**

问题：法国的首都是哪里？
思考：我需要查找法国的相关信息。
行动：wikipedia: France PAUSE

观察结果：法国是一个欧洲国家。首都是巴黎。

思考：我已经得到了答案。
回答：法国的首都是巴黎。
`;


const actionRe = /^(?:Action|行动)\s*[:：]\s*(\w+)\s*[:：]\s*(.*)$/;


/**
 * State - Abstraction used for serialization, save/restore, inspection, debugging, rendering, etc.
 *
 * Keep this as minimal and flat as possible
 *   - initialize(): will create the state with initial values
 *   - loop() is a function that will update the state (in place)
 */
interface State {
  instruction: string;
  llm: string;
  messages: { role: 'user' | 'model', text: string }[];
  nextPrompt: string;
  lastObservation: string;
  result: string | undefined;
}

export class Agent {

  constructor(readonly contextRef: string, readonly abortSignal: AbortSignal) {
    // this is here only to memo `contextRef` for later use
  }

  // NOTE: this is here for demo, but the whole loop could be moved to the caller's event loop
  async reAct(question: string, llmId: DLLMId, maxTurns = 5, enableBrowse = false,
              appendLog: (...data: any[]) => void = console.log,
              showState: (state: object) => void): Promise<string> {
    let i = 0;
    // TODO: to initialize with previous chat messages to provide context.
    const S: State = this.initialize(`Question: ${question}`, llmId, enableBrowse, appendLog);
    showState(S);
    while (i < maxTurns && S.result === undefined) {
      i++;
      appendLog(`\n## 轮次 ${i}`);
      await this.step(S, llmId, appendLog);
      showState(S);
    }
    // return only the 'Answer: ' part of the result
    if (S.result) {
      const markers = ['Answer: ', '回答：', '回答: '];
      for (const marker of markers) {
        const idx = S.result.indexOf(marker);
        if (idx !== -1)
          return S.result.slice(idx + marker.length);
      }
    }
    return S.result || 'No result';
  }

  initialize(question: string, assistantLLMId: DLLMId, enableBrowse: boolean, log: (...data: any[]) => void = console.log): State {
    const systemPrompt = bareBonesPromptMixer(reActPrompt(enableBrowse), assistantLLMId);
    log('## 准备消息缓存');
    log('→ 指令 [' + 1 + ']: "' + systemPrompt.slice(0, 86).replaceAll('\n', ' ') + ' ..."');
    return {
      instruction: systemPrompt,
      messages: [],
      nextPrompt: question,
      lastObservation: '',
      result: undefined,
      llm: assistantLLMId,
    };
  }

  truncateStringAfterPause(input: string): string {
    const pauseKeyword = 'PAUSE';
    const pauseIndex = input.indexOf(pauseKeyword);

    if (pauseIndex === -1) {
      return input;
    }

    const endIndex = pauseIndex + pauseKeyword.length;
    return input.slice(0, endIndex);
  }

  async llmChat(S: State, prompt: string, llmId: DLLMId): Promise<string> {
    S.messages.push({ role: 'user', text: prompt });
    let response = await aixChatGenerateText_Simple(llmId, S.instruction, S.messages, 'chat-react-turn', this.contextRef, { abortSignal: this.abortSignal });
    // process response, strip out potential hallucinated response after PAUSE is detected
    response = this.truncateStringAfterPause(response);
    S.messages.push({ role: 'model', text: response });
    return response;
  }

  async step(S: State, llmId: DLLMId, log: (...data: any[]) => void = console.log) {
    log('→ ' + (S.lastObservation ? '行动' : '用户') + ' [' + (S.messages.length + 1) + ']: "' + S.nextPrompt + '"');
    const result = await this.llmChat(S, S.nextPrompt, llmId);
    log('← 推理结果 [' + (S.messages.length) + ']: "' + result + '"');
    const actions = result
      .split('\n')
      .map((a: string) => actionRe.exec(a))
      .filter((a: RegExpExecArray | null) => a !== null) as RegExpExecArray[];
    if (actions.length > 0) {
      const action = actions[0][1];
      let actionInput = actions[0][2].trim();
      if (actionInput.endsWith('PAUSE'))
        actionInput = actionInput.slice(0, -5).trim();
      if (!(action in knownActions)) {
        throw new Error(`未知行动: ${action}: ${actionInput}`);
      }
      log(`⚡ __${action}__("${actionInput}") → 正在观测结果`);
      S.lastObservation = await knownActions[action](actionInput, llmId);
      S.nextPrompt = `观察结果: ${S.lastObservation}`;
      // will be displayed in the next step
      // log('=>' + S.nextPrompt);
    } else {
      log('↙ 完成');
      // already displayed (← react)
      // log(`Result: ${result}`);
      S.result = result;
    }
  }
}


type ActionFunction = (input: string, llmId: DLLMId) => Promise<string>;

async function search(query: string, llmId: DLLMId): Promise<string> {
  // Use store import dynamically to avoid potential circular dependencies if any
  const { useGoogleSearchStore } = await import('~/modules/google/store-module-google');
  const { googleCloudApiKey, googleCSEId } = useGoogleSearchStore.getState();
  const hasKeys = (googleCloudApiKey?.trim()?.length || 0) >= 39 && (googleCSEId?.trim()?.length || 0) >= 17;

  if (hasKeys) {
    try {
      const data = await callApiSearchGoogle(query, 10);
      return JSON.stringify(data);
    } catch (error: any) {
      console.error('ReAct Google API Error:', error);
    }
  }

  // Fallback to Gemini-native search if it's a Gemini model
  try {
    const { findLLMOrThrow } = await import('~/common/stores/llms/store-llms');
    const llm = findLLMOrThrow(llmId);
    if (llm?.vId === ('googleai' as any)) {
      return await aixChatGenerateText_Simple(
        llmId,
        '你是一个联网搜索助手。请针对用户的查询进行联网搜索，并提取最相关的核心信息。',
        `请搜索并总结以下内容的信息：${query}`,
        'chat-react-turn',
        'react-step-search',
        {
          llmOptionsOverride: {
            llmVndGeminiGoogleSearch: 'unfiltered',
          } as any,
        },
      );
    }
  } catch (nativeError: any) {
    console.error('ReAct Native Search Error:', nativeError);
  }

  return '搜索不可用。请确保已在“设置 > 搜索”中配置 Google API Key，或使用支持原生搜索的模型（如 Gemini 系列）。';
}

async function wikipedia(q: string, _llmId: DLLMId): Promise<string> {
  const response = await frontendSideFetch(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&origin=*`,
  );
  const data = await response.json();
  return data.query.search[0].snippet;
}



// Disable, as it allows for arbitrary code execution
// async function calculate(what: string): Promise<string> {
//   return String(eval(what));
// }

const knownActions: { [key: string]: ActionFunction } = {
  wikipedia: wikipedia,
  google: search,
  // calculate: calculate, // DISABLED: security
};