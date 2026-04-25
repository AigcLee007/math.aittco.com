import * as React from 'react';

import { FormControl, ListDivider, Switch } from '@mui/joy';
import CodeIcon from '@mui/icons-material/Code';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import EngineeringIcon from '@mui/icons-material/Engineering';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import type { DModelDomainId } from '~/common/stores/llms/model.domains.types';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormSelectControl, FormSelectOption } from '~/common/components/forms/FormSelectControl';
import { useLLMSelect } from '~/common/components/forms/useLLMSelect';
import { useLabsDevMode } from '~/common/stores/store-ux-labs';
import { useModelDomain } from '~/common/stores/llms/hooks/useModelDomain';

import type { TokenCountingMethod } from '../chat/store-app-chat';
import { useChatAutoAI } from '../chat/store-app-chat';


const _keepThinkingBlocksOptions: FormSelectOption<'all' | 'last-only'>[] = [
  {
    value: 'last-only',
    label: '最近',
    description: '默认',
  },
  {
    value: 'all',
    label: '保留所有',
    description: '保留所有痕迹',
  },
] as const;

const _tokenCountingMethodOptions: FormSelectOption<TokenCountingMethod>[] = [
  {
    value: 'approximate',
    label: '快速',
    description: '轻量级：约 90% 准确率',
  },
  {
    value: 'accurate',
    label: '精确',
    description: '精确分词，消耗更多资源',
  },
] as const;


function FormControlDomainModel(props: {
  domainId: DModelDomainId,
  title: React.ReactNode,
  description?: React.ReactNode,
  tooltip?: React.ReactNode,
}) {

  // external state
  const { domainModelId: fastModelId, assignDomainModelId: setFastModelId } = useModelDomain(props.domainId);
  const [_llm, llmComponent] = useLLMSelect(fastModelId, setFastModelId, { label: '', autoRefreshDomain: props.domainId });

  return (
    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart
        title={props.title}
        description={props.description}
        tooltip={props.tooltip}
      />
      {llmComponent}
    </FormControl>
  );
}


export function AppChatSettingsAI() {

  const {
    autoSuggestAttachmentPrompts, setAutoSuggestAttachmentPrompts,
    autoSuggestDiagrams, setAutoSuggestDiagrams,
    autoSuggestHTMLUI, setAutoSuggestHTMLUI,
    // autoSuggestQuestions, setAutoSuggestQuestions,
    autoTitleChat, setAutoTitleChat,
    chatKeepLastThinkingOnly, setChatKeepLastThinkingOnly,
    tokenCountingMethod, setTokenCountingMethod,
  } = useChatAutoAI();

  const labsDevMode = useLabsDevMode();

  const showModelIcons = false; // useUIComplexityMode() === 'extra';

  // callbacks

  const handleAutoSetChatTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => setAutoTitleChat(event.target.checked);

  const handleAutoSuggestAttachmentPromptsChange = (event: React.ChangeEvent<HTMLInputElement>) => setAutoSuggestAttachmentPrompts(event.target.checked);

  const handleAutoSuggestDiagramsChange = (event: React.ChangeEvent<HTMLInputElement>) => setAutoSuggestDiagrams(event.target.checked);

  const handleAutoSuggestHTMLUIChange = (event: React.ChangeEvent<HTMLInputElement>) => setAutoSuggestHTMLUI(event.target.checked);

  // const handleAutoSuggestQuestionsChange = (event: React.ChangeEvent<HTMLInputElement>) => setAutoSuggestQuestions(event.target.checked);

  return <>

    <FormControlDomainModel
      domainId='codeApply'
      title={!showModelIcons ? '代码模型' : <><CodeIcon color='primary' sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} />代码模型</>}
      description='代码任务'
      tooltip={<>
        智能<b>代码编辑</b>模型（必须支持工具调用），具有出色的编码能力且速度较快。用于：
        <ul>
          <li>生成图表</li>
          <li>生成 HTML UI</li>
          <li>前向兼容性</li>
        </ul>
        建议选择 Sonnet 3.5 级别的模型。
      </>}
    />

    <FormControlDomainModel
      domainId='fastUtil'
      title={!showModelIcons ? '工具模型' : <><EditRoundedIcon color='primary' sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} />工具模型</>}
      description='标题、杂项任务'
      tooltip={<>
        轻量级模型（必须支持工具调用），用于“快速”、低成本的操作，例如：
        <ul>
          <li>生成对话标题</li>
          <li>附件提示词</li>
          <li>及更多</li>
        </ul>
        对于对话消息和类似的高质量内容，将使用聊天模型。
      </>}
    />

    <FormControlDomainModel
      domainId='imageCaption'
      title='视觉模型'
      description='图像描述'
      tooltip='当选择字幕（文本）附件选项时，用于生成图像文本描述的视觉模型。'
    />

    {labsDevMode && (
      <FormControlDomainModel
        domainId='primaryChat'
        title={<><EngineeringIcon color='warning' sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} />上次使用的模型</>}
        description='对话回退模型'
        tooltip='上次使用的聊天模型，用作新对话的默认模型。这是一个开发设置，用于测试自动检测最合适的初始聊天模型。'
      />
    )}

    <FormSelectControl
      title='Token 计数'
      tooltip='控制如何计算上下文限制和价格估算的 Token。'
      options={_tokenCountingMethodOptions}
      value={tokenCountingMethod}
      onChange={setTokenCountingMethod}
    />

    <FormSelectControl
      title='推理过程'
      tooltip='控制如何在聊天记录中保留 AI 思考/推理块。仅保留在最后一条消息中（默认）可减少混乱。'
      options={_keepThinkingBlocksOptions}
      value={chatKeepLastThinkingOnly ? 'last-only' : 'all'}
      onChange={(value) => setChatKeepLastThinkingOnly(value === 'last-only')}
    />

    <ListDivider inset='gutter'>自动 AI 功能</ListDivider>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='自动标题'
                      description={autoTitleChat ? '自动' : '仅手动'}
                      tooltip='[工具模型] 自动为新对话生成相关标题。'
                      tooltipWarning={!autoTitleChat} />
      <Switch checked={autoTitleChat} onChange={handleAutoSetChatTitleChange}
              endDecorator={autoTitleChat ? '开' : '关'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='附件提示词'
                      description={autoSuggestAttachmentPrompts ? '猜测动作' : '关闭'}
                      tooltip={!autoSuggestAttachmentPrompts ? undefined : '[工具模型] 当附件添加到对话中时建议动作/提示词。'} />
      <Switch checked={autoSuggestAttachmentPrompts} onChange={handleAutoSuggestAttachmentPromptsChange}
              endDecorator={autoSuggestAttachmentPrompts ? '开' : '关'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>


    <ListDivider inset='gutter'>自动增强消息</ListDivider>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='生成图表'
                      description={autoSuggestDiagrams ? '添加图表' : '关闭'}
                      tooltip={!autoSuggestDiagrams ? undefined : '[代码模型] 当 AI 检测到回复通过可视化表示会更清晰时，自动创建图表和流程图。'} />
      <Switch checked={autoSuggestDiagrams} onChange={handleAutoSuggestDiagramsChange}
              endDecorator={autoSuggestDiagrams ? '开' : '关'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart
        title='生成 UI'
        description={autoSuggestHTMLUI ? '添加 HTML' : '关闭'}
        tooltipWarning={autoSuggestHTMLUI}
        tooltip={<>
          [代码模型] 在适当时在对话响应中创建交互式 UI 组件。
          <hr />
          安全警告：这将在对话消息中开启 JS/HTML 代码执行
          <hr />
          Alpha 测试版：仅用于测试。风险自担。
        </>}
      />
      <Switch checked={autoSuggestHTMLUI} onChange={handleAutoSuggestHTMLUIChange}
              endDecorator={autoSuggestHTMLUI ? <div>开{' '}<WarningRoundedIcon sx={{ cursor: 'pointer', color: 'red' }} /></div> : '关'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>

    {/*<FormControl disabled orientation='horizontal' sx={{ justifyContent: 'space-between' }}>*/}
    {/*  <FormLabelStart title='Auto Questions'*/}
    {/*                  description={autoSuggestQuestions ? 'LLM Questions' : 'No'}*/}
    {/*                  tooltip={<>Vote <Link href='https://github.com/enricoros/big-agi/issues/228' target='_blank'>#228</Link></>} />*/}
    {/*  <Switch checked={autoSuggestQuestions} onChange={handleAutoSuggestQuestionsChange}*/}
    {/*          endDecorator={autoSuggestQuestions ? 'On' : 'Off'}*/}
    {/*          slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />*/}
    {/*</FormControl>*/}

  </>;
}
