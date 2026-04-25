import * as React from 'react';
import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import { InfiniteCanvas } from './components/InfiniteCanvas';
import { DrawHeader } from './components/DrawHeader';
import { DesignerPrompt, PromptComposer } from './create/PromptComposer';
import { DrawCreateQueue } from './queue-draw-create';
import { useProcessingQueue } from '~/common/logic/ProcessingQueue';
import { TextToImageProvider } from '~/common/components/useCapabilities';


const imagineWorkspaceSx: SxProps = {
  flexGrow: 1,
  overflowY: 'auto',

  // style
  backgroundColor: 'background.level3',
  boxShadow: 'inset 0 0 4px 0px rgba(0, 0, 0, 0.2)',

  // layout
  display: 'flex',
  flexDirection: 'column',
};

const imagineScrollContainerSx: SxProps = {
  flex: 1,
  overflowY: 'auto',
  position: 'relative',
  minHeight: 128,
};


/*async function queryActiveGenerateImageVector(singlePrompt: string, vectorSize: number = 1) {
  const imageContentFragments = await t2iGenerateImageContentFragments(null, singlePrompt, vectorSize, 'global', 'app-draw');

  for (const imageContentFragment of imageContentFragments) {
    console.log('TODO: notImplemented: imagePartDataRef: CRUD and View of blobs as ImageBlocks', imageContentFragment.part);
  }
  // TODO continue...

  return [];
}*/

/*
function TempPromptImageGen(props: { prompt: DesignerPrompt, sx?: SxProps }) {

  // NOTE: we shall consider a multidimensional shape-based design

  // derived state
  const { prompt: dp } = props;

  // external state
  const { data: imageBlocks, error, isPending } = useQuery<ImageBlock[], Error>({
    enabled: !!dp.prompt,
    queryKey: ['draw-dpid', dp.uuid],
    queryFn: () => queryActiveGenerateImageVector(dp.prompt, dp._repeatCount),
    refetchOnReconnect: false,
    refetchOnMount: false,
    staleTime: Infinity,
  });

  return <>

    {error && <InlineError error={error} />}

    {Array.from({ length: dp._repeatCount }).map((_, index) => {
      const imgUid = `gen-img-${index}`;
      const imageBlock = imageBlocks?.[index] || null;
      return imageBlock
        // ? <RenderImage key={imgUid} imageBlock={imageBlock} noTooltip />
        ? <Box sx={{


          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative',
          mx: 'auto', my: 'auto', // mt: (index > 0 || !props.isFirst) ? 1.5 : 0,
          boxShadow: 'lg',
          backgroundColor: 'neutral.solidBg',

          '& picture': { display: 'flex' },
          '& img': { maxWidth: '100%', maxHeight: '100%' },

        }}>
          <picture><img src={imageBlock.url} alt={imageBlock.alt} /></picture>
        </Box>
        : <Card key={imgUid} sx={{ mb: 'auto' }}>
          <Skeleton animation='wave' variant='rectangular' sx={{ minWidth: 128, width: '100%', aspectRatio: 1 }} />
        </Card>;
    })}

  </>;
}
*/

export function DrawCreate(props: {
  queue: DrawCreateQueue,
  isMobile: boolean,
  showHeader: boolean,
  onHideHeader: () => void,
  mayWork: boolean,
  providers: TextToImageProvider[],
  activeProviderId: string | null,
  setActiveProviderId: (providerId: (string | null)) => void,
}) {

  // state
  const [prompts, setPrompts] = React.useState<DesignerPrompt[]>([]);

  // external state
  const { queueState } = useProcessingQueue(props.queue);

  // handlers
  const handleStopDrawing = React.useCallback(() => {
    setPrompts([]);
  }, []);

  const { queue } = props;

  const handlePromptEnqueue = React.useCallback((designerPrompts: DesignerPrompt[]) => {
    for (const designerPrompt of designerPrompts) {
      void queue.enqueueItem(designerPrompt); // fire/forget
    }
  }, [queue]);


  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Top Header with Tabs */}
      <DrawHeader />

      {/* Infinite Canvas with Grid and Pan */}
      <InfiniteCanvas sx={{ flexGrow: 1 }}>
        {/* Render actual generated images here - Placeholder for now */}
        {/* <ZeroGenerations /> */}
        {/* {!props.mayWork && <ZeroDrawConfig />} */}
      </InfiniteCanvas>


      {/* Floating Prompt Composer */}
      <PromptComposer
        isMobile={props.isMobile}
        queueLength={prompts.length}
        onDrawingStop={handleStopDrawing}
        onPromptEnqueue={handlePromptEnqueue}
      />

    </Box>
  );
}
