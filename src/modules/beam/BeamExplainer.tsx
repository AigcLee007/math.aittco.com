import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import { ExplainerCarousel, ExplainerPage } from '~/common/components/ExplainerCarousel';
import { animationEnterScaleUp } from '~/common/util/animUtils';


const beamSteps: ExplainerPage[] = [
  {
    stepDigits: '',
    stepName: '欢迎',
    // titlePrefix: 'Welcome to Beam.', //  Better answers, faster.
    titlePrefix: '欢迎使用 ', titleSpark: '多模型融合',
    // titleSpark: 'B E A M',
    // titleSuffix: ' azing',
    // titleSquircle: true,
    mdContent: `
**多模型融合 (Multi-Model Fusion)** 是 Aittco 中的一种高级模式，它可以[同时](https://big-agi.com/blog/beam-multi-model-ai-reasoning)调用多个 AI 模型来回答同一个问题。

这就像与多位顶尖专家专家进行头脑风暴，每个人都提供独特的见解。
该模式让您能对比多个答案的可优劣，并最终合并出一个最佳结果。

![Aittco BEAM Rays](https://big-agi.com/app/journeys/beam/explainer-beam-scatter-1200px-alpha.png)

`, // Let&apos;s get you to better chat answers, faster.
  },
  {
    stepDigits: '01',
    stepName: '多模型',
    titlePrefix: '使用 ', titleSpark: '多模型融合', titleSuffix: ' 探索。',
    // titleSpark: 'Beaming', titleSuffix: ': Exploration',
    mdContent: `
**分发方案是第一阶段**，您选择的多个 AI 模型将同时生成不同的回复。

您可以自由组合、加载或保存您喜欢的模型配置。
完成后，您可以直接采纳某一个满意的回复，或者选择多个喜欢的回复进行合并优化。

**重要提示：** _最好在对话早期/较短时使用_。💰 请注意多模型发散和合并的 Token 使用量；
由于是并行且漫长的操作，它们将比普通聊天消耗更多 Token。

混合使用不同的 AI 模型，以获得多样化的创意和视角。
`, // and delete the ones that aren't helpful
  },
  {
    stepDigits: '02',
    stepName: '合并',
    titlePrefix: '使用 ', titleSpark: '合并', titleSuffix: ' 整合。',
    // titleSpark: 'Merging', titleSuffix: ': Synthesis', // Synthesis, Convergence
    mdContent: `
合并是**将各模型回复中的最佳部分整合**成一个出色、连贯的答案。

您可以从多种合并选项中进行选择，包括 **Fusion (融合)**、**Checklist (清单)**、**Compare (对比)** 和 **Custom (自定义)**。
尝试不同的选项，找到最适合您聊天的那个。

![AIGC-Club BEAM Rays](https://big-agi.com/app/journeys/beam/explainer-beam-gather-1600px-alpha.png)
    `, // > Merge until you have a single, high-quality response. Or choose the final response manually, skipping merge.
  },
//   {
//     stepDigits: '',
//     stepName: 'Tips',
//     titleSuffix: 'Effectiveness Tips', //  · N × GPT-4 -> GPT-5
//     mdContent: `
// #### Human as a Judge
// You, the user, provide creative direction and final judgement. The AI models are powerful tools that generate drafts for you to quickly evaluate and refine.
// There are profound reasons why this approach works, which we explore [in our blog](https://big-agi.com/blog/introducing-beam).
//
// #### Best Use
// This tool is designed for the **early stages** of a process, where it delivers unparalleled insights and perspectives precisely **when your
// project needs clarity and direction**.
//
// The diversity of perspectives acts **like the wisdom of a seasoned team**, offering a wide array of solutions and viewpoints.
//
// #### Considerations
// The tool **will consume more Tokens** than a regular chat, which is another reason to use it early on when
// a chat history is short, and the return on investment is greater.
// `,
//   },
] as const;


const beamExplainerSx: SxProps = {
  // allows the content to be scrolled (all browsers)
  overflowY: 'auto',
  // actually make sure this scrolls & fills
  height: '100%',

  // style
  padding: 3, // { xs: 3, md: 3 },
  animation: `${animationEnterScaleUp} 0.2s cubic-bezier(.17,.84,.44,1)`,

  // layout
  display: 'grid',
};


export function BeamExplainer(props: {
  onWizardComplete: () => any,
}) {

  return (
    <Box
      // variant={grayUI ? 'solid' : 'soft'}
      // invertedColors={grayUI ? true : undefined}
      sx={beamExplainerSx}
    >

      <ExplainerCarousel
        explainerId='beam-onboard'
        steps={beamSteps}
        // footer={
        //   <Typography level='body-xs' sx={{ textAlign: 'center', maxWidth: '400px', mx: 'auto' }}>
        //     {/*Unlock beaming, combine AI wisdom, achieve clarity.*/}
        //     {/*Discover, Design and Dream.*/}
        //     {/*The journey from exploration to refinement is iterative.*/}
        //     {/*Each cycle sharpens your ideas, bringing you closer to innovation.*/}
        //   </Typography>
        // }
        onFinished={props.onWizardComplete}
      />

    </Box>

  );
}