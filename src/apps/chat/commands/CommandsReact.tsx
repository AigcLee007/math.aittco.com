import PsychologyIcon from '@mui/icons-material/Psychology';

import type { ICommandsProvider } from './ICommandsProvider';

export const CommandsReact: ICommandsProvider = {
  id: 'cmd-mode-react',
  rank: 15,

  getCommands: () => [{
    primary: '/react',
    arguments: ['prompt'],
    description: '使用基于 ReAct 策略的深度思考模型来回答您的问题',
    Icon: PsychologyIcon,
  }],

};
