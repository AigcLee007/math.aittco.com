import { create } from 'zustand';
import { persist } from 'zustand/middleware';


// Gemini 2.5 Flash Image Aspect Ratios
// https://ai.google.dev/gemini-api/docs/image-generation?lang=rest
export type GeminiAspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '2:3' | '3:2' | '21:9' | '5:4' | '4:5';

interface ModuleGeminiT2IStore {
  aspectRatio: GeminiAspectRatio;
  setAspectRatio: (aspectRatio: GeminiAspectRatio) => void;
}

export const useGeminiT2IStore = create<ModuleGeminiT2IStore>()(
  persist(
    (set) => ({
      aspectRatio: '1:1',
      setAspectRatio: (aspectRatio) => set({ aspectRatio }),
    }),
    {
      name: 'app-module-t2i-gemini',
      version: 1,
    },
  ),
);
