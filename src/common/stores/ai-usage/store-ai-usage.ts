import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AIUsageRecord {
  id: string;
  timestamp: string;         // ISO String
  toolName: string;          // e.g. "AIGC-Club"
  modelId: string;           // e.g. "gpt-4"
  modelVersion: string;      // e.g. "0613"
  purpose: string;           // Inferred or Manual
  phase: number;             // 1-5
  prompt: string;            // Truncated if too long
  response: string;          // Summary (first 200 chars)
  adopted: 'full' | 'partial' | 'rejected' | 'pending';
  modifications?: string;
}

interface AIUsageStore {
  records: AIUsageRecord[];
  isTracking: boolean;
  projectName: string;
  teamInfo: string;

  addRecord: (record: Omit<AIUsageRecord, 'id' | 'timestamp'>) => void;
  updateAdoption: (id: string, adopted: AIUsageRecord['adopted'], modifications?: string) => void;
  toggleTracking: () => void;
  setProjectInfo: (projectName: string, teamInfo: string) => void;
  clearRecords: () => void;
}

export const useAIUsageStore = create<AIUsageStore>()(
  persist(
    (set, get) => ({
      records: [],
      isTracking: true,
      projectName: '数学建模竞赛',
      teamInfo: '队伍名称',

      addRecord: (record) => set((state) => ({
        records: [
          ...state.records,
          {
            ...record,
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
          },
        ],
      })),

      updateAdoption: (id, adopted, modifications) => set((state) => ({
        records: state.records.map((r) =>
          r.id === id ? { ...r, adopted, modifications } : r
        ),
      })),

      toggleTracking: () => set((state) => ({ isTracking: !state.isTracking })),
      
      setProjectInfo: (projectName, teamInfo) => set({ projectName, teamInfo }),

      clearRecords: () => set({ records: [] }),
    }),
    {
      name: 'app-ai-usage',
    }
  )
);
