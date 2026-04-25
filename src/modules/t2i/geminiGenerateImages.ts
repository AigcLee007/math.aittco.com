import { apiAsync } from '~/common/util/trpc.client';

import type { T2iCreateImageOutput, T2iGenerateOptions } from './t2i.server';
import type { TextToImageProvider } from '~/common/components/useCapabilities';
import type { GeminiAccessSchema } from '~/modules/llms/server/gemini/gemini.access';
import { findServiceAccessOrThrow } from '~/modules/llms/vendors/vendor.helpers';
import { useGeminiT2IStore } from './gemini/store-module-gemini';


export async function geminiGenerateImagesOrThrow(
  provider: TextToImageProvider,
  prompt: string,
  count: number,
  { abortSignal }: T2iGenerateOptions = {},
): Promise<T2iCreateImageOutput[]> {

  const { modelServiceId } = provider;

  // 1. Get access
  if (!modelServiceId) throw new Error('No Gemini model service ID');
  const access = findServiceAccessOrThrow<{}, GeminiAccessSchema>(modelServiceId).transportAccess;

// 2. Call the router
  // We hardcode the model ID for now as it's the only one supported/requested
  const modelId = 'models/gemini-2.5-flash-image'; 
  const { aspectRatio } = useGeminiT2IStore.getState();

  try {
    const images = await apiAsync.llmGemini.createImages.mutate({
      access,
      model: { id: modelId },
      prompt,
      count,
      generationConfig: { aspectRatio },
    }, {
      signal: abortSignal,
    });

    return images as T2iCreateImageOutput[];
  } catch (error: any) {
    console.error('Gemini image generation error:', error);
    throw error;
  }
}
