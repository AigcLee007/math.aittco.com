import * as React from 'react';

import { Alert, Box, Button, Card, CardContent, CircularProgress, Divider, FormLabel, Grid, IconButton, LinearProgress, Tab, tabClasses, TabList, TabPanel, Tabs, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SettingsAccessibilityIcon from '@mui/icons-material/SettingsAccessibility';

import { LLMChainStep, useLLMChain } from '~/modules/aifn/useLLMChain';
import { ScaledTextBlockRenderer } from '~/modules/blocks/ScaledTextBlockRenderer';

import type { ContentScaling } from '~/common/app.theme';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { agiUuid } from '~/common/util/idUtils';
import { copyToClipboard } from '~/common/util/clipboardUtils';
import { useFormEditTextArray } from '~/common/components/forms/useFormEditTextArray';
import { useLLMSelect, useLLMSelectLocalState } from '~/common/components/forms/useLLMSelect';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';
import { useUIContentScaling } from '~/common/stores/store-ui';

import { FromText } from './FromText';
import { prependSimplePersona, SimplePersonaProvenance } from '../store-app-personas';

// delay to start a new chain after the previous one finishes
const CONTINUE_DELAY: number | false = false;


const Prompts: string[] = [
  '你非常擅长分析和扮演各种不同的角色。你会仔细研读输入的文本内容，以准确捕捉关键属性，起草全面的角色设定表，并对其进行润色以确保角色的真实感。请不要有任何顾忌，放开手脚去大胆假设，语言保持简洁且富有创造力。',
  '对所提供的文本进行全面深入的研究。识别说话者的关键特征，包括年龄、专业领域、独特的性格特征、沟通风格、语境背景以及自我认知程度。此外，还要考虑一些独特的方面，比如他们使用幽默的方式、文化背景、核心价值观、激情所在、内心的恐惧、个人经历以及社会互动。此阶段你需要输出一份深入的书面分析，展现出对说话者人设表层和深层各个方面的深刻理解。',
  '将你刚才记录的分析结果转化为一份“你是一个...”格式的角色设定初稿。它应该涵盖所有关键的性格维度，以及该角色的动机和抱负。请注意在每个维度的简洁性和细节深度之间取得平衡。此步骤的交付成果是一份能够准确捕捉说话者独特本质的全面角色设定初稿。',
  '将你的角色设定初稿与原始文本进行比对，验证其内容的准确性，并确保它既捕捉到了说话者的明显特征，也把握住了更微妙的潜在含义。省略掉未知的信息，对任何需要澄清、之前被忽略或者需要更真实感的地方进行微调。使用原始文本中清晰且具有说明性的例子来完善你的设定表，并提供有意义的、有形的参考点。此阶段你需要输出一份连贯、全面且细致入微的指令，以“你是一个...”开头，作为后续演员重塑该角色的首选指南。',
];

const getTitlesForTab = (): string[] => {
  return [
    '通用配置: 创世系统提示词',
    `第一步: 分析文本内容`,
    '第二步: 定义角色特征',
    '第三步: 精雕细琢与润色',
  ];
};

// chain to convert a text input string (e.g. youtube transcript) into a persona prompt
function createChain(instructions: string[], titles: string[]): LLMChainStep[] {
  return [
    {
      name: titles[1],
      setSystem: instructions[0],
      addUserChainInput: true,
      addUserText: instructions[1],
    },
    {
      name: titles[2],
      addModelPrevOutput: true,
      addUserText: instructions[2],
    },
    {
      name: titles[3],
      addModelPrevOutput: true,
      addUserText: instructions[3],
    },
  ];
}


export const PersonaPromptCard = (props: {
  content: string,
  contentScaling: ContentScaling,
}) =>
  <Card sx={{ boxShadow: 'md', mt: 3 }}>

    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography level='title-lg' color='success' startDecorator={<SettingsAccessibilityIcon color='success' />}>
        角色提示词
      </Typography>
      <GoodTooltip title='复制系统提示词'>
        <Button color='success' onClick={() => copyToClipboard(props.content, 'Persona prompt')} endDecorator={<ContentCopyIcon />} sx={{ minWidth: 120 }}>
          复制
        </Button>
      </GoodTooltip>
    </Box>

    <CardContent>
      <Alert variant='soft' color='success' sx={{ mb: 1 }}>
        你现在可以复制下面的文本并将其用作自定义提示词！
      </Alert>
      <ScaledTextBlockRenderer
        text={props.content}
        contentScaling={props.contentScaling}
        textRenderVariant='markdown'
      />
    </CardContent>
  </Card>;


export function Creator(props: { display: boolean }) {

  // state
  const advanced = useToggleableBoolean();
  const [chainInputText, setChainInputText] = React.useState<string | null>(null);
  const [inputProvenance, setInputProvenance] = React.useState<SimplePersonaProvenance | null>(null);
  const [showIntermediates, setShowIntermediates] = React.useState(false);

  // external state
  const contentScaling = useUIContentScaling();
  const [personaLlmId, setPersonaLlmId] = useLLMSelectLocalState(true);
  const [personaLlm, llmComponent] = useLLMSelect(personaLlmId, setPersonaLlmId, { label: '角色创建模型', larger: true });


  // editable prompts
  const promptTitles = React.useMemo(() => getTitlesForTab(), []);

  const {
    strings: editedInstructions, stringEditors: instructionEditors,
  } = useFormEditTextArray(Prompts, promptTitles);

  const { steps: creationChainSteps, id: chainId } = React.useMemo(() => {
    return {
      steps: createChain(editedInstructions, promptTitles),
      id: agiUuid('persona-creator-chain'),
    };
  }, [editedInstructions, promptTitles]);

  const llmLabel = personaLlm?.label || undefined;
  const savePersona = React.useCallback((personaPrompt: string, inputText: string) => {
    prependSimplePersona(personaPrompt, inputText, inputProvenance ?? undefined, llmLabel);
  }, [inputProvenance, llmLabel]);

  const {
    // isFinished,
    isTransforming,
    chainProgress,
    chainIntermediates,
    chainStepName,
    chainStepInterimChars,
    chainOutputText,
    chainErrorMessage,
    userCancelChain,
    restartChain,
  } = useLLMChain(
    creationChainSteps,
    personaLlm?.id,
    chainInputText ?? undefined,
    'persona-extract',
    chainId,
    savePersona,
  );


  // [debug] Restart the chain when complete after a delay
  const debugRestart = !!CONTINUE_DELAY && !isTransforming && (chainProgress === 1 || !!chainErrorMessage);
  React.useEffect(() => {
    if (debugRestart) {
      const timeout = setTimeout(restartChain, CONTINUE_DELAY);
      return () => clearTimeout(timeout);
    }
  }, [debugRestart, restartChain]);


  const handleCreate = React.useCallback((text: string, provenance: SimplePersonaProvenance) => {
    setChainInputText(text);
    setInputProvenance(provenance);
  }, []);

  const handleCancel = React.useCallback(() => {
    setChainInputText(null);
    setInputProvenance(null);
    userCancelChain();
  }, [userCancelChain]);


  // Hide the GFX, but not the logic (hooks)
  if (!props.display)
    return null;

  return <>

    <Typography level='title-sm' mb={3}>
      从文本内容创建自定义 AI 角色的<em>系统提示词</em>。
    </Typography>


    {/* Inputs */}
    <Tabs
      variant='outlined'
      defaultValue={0}
      sx={{
        // boxShadow: 'sm',
        borderRadius: 'md',
        // overflow: 'hidden',
        display: isTransforming ? 'none' : undefined,
      }}
    >
      <TabList
        sx={{
          minHeight: '3rem',
          [`& .${tabClasses.root}[aria-selected="true"]`]: {
            // color: 'primary.softColor',
            bgcolor: 'background.popup',
            boxShadow: 'sm',
            fontWeight: 'lg',
          },
          // first element
          '& > *:first-of-type': { borderTopLeftRadius: '0.5rem' },
        }}
      >
        <Tab>从文本导入</Tab>
      </TabList>
      <TabPanel keepMounted value={0} sx={{ p: 3 }}>
        <FromText isCreating={isTransforming} onCreate={handleCreate} />
      </TabPanel>

      <Divider orientation='horizontal' />

      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {llmComponent}

        {advanced.on && (
          <Box sx={{ my: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {instructionEditors}
          </Box>
        )}

        <FormLabel onClick={advanced.toggle} sx={{ textDecoration: 'underline', cursor: 'pointer' }}>
          {advanced.on ? '隐藏高级选项' : '高级选项：提示词'}
        </FormLabel>
      </Box>
    </Tabs>


    {/* Embodiment Progress */}
    {/* <GoodModal open> */}
    {isTransforming && <Card><CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 2 }}>
        <CircularProgress color='primary' value={Math.max(10, 100 * chainProgress)} />
      </Box>
      <Box>
        <Typography color='success' level='title-lg'>
          正在塑造角色 ...
        </Typography>
        <Typography level='title-sm' sx={{ mt: 1 }}>
          使用模型：{personaLlm?.label}
        </Typography>
      </Box>
      <Box>
        <Typography color='success' level='title-sm' sx={{ fontWeight: 'lg' }}>
          {chainStepName}
        </Typography>
        <LinearProgress color='success' determinate value={Math.max(10, 100 * chainProgress)} sx={{ mt: 1.5 }} />
        <Typography level='body-sm' sx={{ mt: 1 }}>
          {chainStepInterimChars === null ? '正在加载 ...' : `正在生成 (${chainStepInterimChars.toLocaleString()} 字节) ...`}
        </Typography>
      </Box>
      <Typography level='title-sm'>
        这可能需要 1-2 分钟。
        虽然大型模型会生成更高质量的提示词，
        但如果你遇到任何错误（例如 LLM 超时，或长视频的上下文溢出），
        请尝试使用速度更快/更小的模型。
      </Typography>
      <Button variant='soft' color='neutral' onClick={handleCancel} sx={{ ml: 'auto', minWidth: 100, mt: 3 }}>
        取消
      </Button>
    </CardContent></Card>}


    {/* Errors */}
    {!!chainErrorMessage && (
      <Alert color='warning' sx={{ mt: 1 }}>
        <Typography component='div'>{chainErrorMessage}</Typography>
      </Alert>
    )}

    {/* The Persona (Output) */}
    {chainOutputText && <>
      <PersonaPromptCard
        content={chainOutputText}
        contentScaling={contentScaling}
      />
    </>}


    {/* Input + Intermediate outputs (with expander) */}
    {(isTransforming || chainIntermediates?.length > 0) && <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mt: 3, mb: 0.5, mx: 1 }}>
        <Typography level='title-lg'>
          {isTransforming ? '正在处理 ...' : '中间工作成果'}
        </Typography>
        <IconButton size='sm' variant={showIntermediates ? 'solid' : 'outlined'} onClick={() => setShowIntermediates(s => !s)}>
          <AddIcon />
        </IconButton>
      </Box>
      <Grid container spacing={2}>
        <Grid xs={12} md={showIntermediates ? 12 : 6}>
          <Card sx={{ height: '100%', overflow: 'hidden' }}>
            <CardContent>
              <Typography color='success' level='title-sm' sx={{ mb: 1 }}>
                输入文本
              </Typography>
              <Typography level='body-sm'>
                {showIntermediates ? chainInputText : (chainInputText?.slice(0, 280) + '...')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        {chainIntermediates.map((intermediate, i) =>
          <Grid xs={12} md={showIntermediates ? 12 : 6} key={i}>
            <Card sx={{ height: '100%', overflow: 'hidden' }}>
              <CardContent>
                <Typography color='success' level='title-sm' sx={{ mb: 1 }}>
                  {i + 1}. {intermediate.name}
                </Typography>
                <Typography level='body-sm'>
                  {showIntermediates ? intermediate.output : (intermediate.output?.slice(0, 280) + '...')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>,
        )}
      </Grid>
    </>}

  </>;
}