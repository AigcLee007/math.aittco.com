import { create } from 'zustand';

export interface ArtifactData {
  title: string;
  type: string; // 'code', 'mermaid', 'svg', 'html', etc., useful for hinting or custom rendering
  content: string;
}

interface ArtifactsState {
  activeArtifact: ArtifactData | null;
  openArtifact: (artifact: ArtifactData) => void;
  closeArtifact: () => void;
}

export const useArtifactsStore = create<ArtifactsState>()((set) => ({
  activeArtifact: null,
  openArtifact: (artifact) => set({ activeArtifact: artifact }),
  closeArtifact: () => set({ activeArtifact: null }),
}));
