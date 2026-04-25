import * as React from 'react';

import type { ColorPaletteProp } from '@mui/joy/styles/types';

import type { ChatExecuteMode } from './execute-mode.types';


interface ModeDescription {
  // menu data
  label: string;
  description: string | React.JSX.Element;
  canAttach?: true | 'requires-tti-edit';
  highlight?: boolean;
  shortcut?: string;
  hideOnDesktop?: boolean;
  requiresTTI?: boolean;
  // button data
  sendColor: ColorPaletteProp;
  sendText: string;
}


export const ExecuteModeItems: { [key in ChatExecuteMode]: ModeDescription } = {
  'generate-content': {
    label: '对话',
    description: '与 AI 角色对话',
    canAttach: true,
    sendColor: 'primary',
    sendText: '发送',
  },
  'generate-image': {
    label: '生图',
    description: '将文本作为绘图提示词',
    canAttach: 'requires-tti-edit',
    requiresTTI: true,
    sendColor: 'success',
    sendText: '生图',
  },
  'beam-content': {
    label: '多模型融合', // Best of, Auto-Prime, Top Pick, Select Best
    description: '组合多个模型', // Smarter: combine...
    shortcut: 'Ctrl + Enter',
    canAttach: true,
    hideOnDesktop: true,
    sendColor: 'primary',
    sendText: '多模型融合',
  },
  'append-user': {
    label: '添加',
    description: '插入内容',
    shortcut: 'Alt + Enter',
    canAttach: true,
    sendColor: 'primary',
    sendText: '添加',
  },
  'react-content': {
    label: '深度思考 (ReAct)', //  · α
    description: '分步骤回答问题',
    sendColor: 'success',
    sendText: '深度思考',
  },
};
