import { create } from 'zustand';
import { persist } from 'zustand/middleware';


interface PurposeStore {

  // state
  hiddenPurposeIDs: string[];

  // actions
  toggleHiddenPurposeId: (purposeId: string) => void;

}


export const usePurposeStore = create<PurposeStore>()(
  persist(
    (set) => ({

      // default state: no hidden purposes
      hiddenPurposeIDs: [],

      toggleHiddenPurposeId: (purposeId: string) => {
        set(state => {
          const hiddenPurposeIDs = state.hiddenPurposeIDs.includes(purposeId)
            ? state.hiddenPurposeIDs.filter((id) => id !== purposeId)
            : [...state.hiddenPurposeIDs, purposeId];
          return {
            hiddenPurposeIDs,
          };
        });
      },

    }),
    {
      name: 'app-purpose',
      // keep the version to avoid invalidating local storage, but strip out the old migration logic
      version: 2,
    }),
);