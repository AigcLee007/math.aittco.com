import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: {
    id: string;
    shortId?: number | null;
    email: string;
    nickname: string;
    avatar?: string | null;
    role: string;
  } | null;

  // Actions
  setAccessToken: (access: string | null) => void;
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: AuthState['user']) => void;
  logout: () => void;
  isLoggedIn: () => boolean;
}

/**
 * Global Auth Store
 * Persists JWT tokens and basic user info in localStorage
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,

      setAccessToken: (access) => set({ accessToken: access }),
      setTokens: (access, refresh) => set({ accessToken: access, refreshToken: refresh }),
      setUser: (user) => set({ user }),
      
      logout: () => {
        set({ accessToken: null, refreshToken: null, user: null });
        // Optional: clear localstorage keys related to sessions
      },

      isLoggedIn: () => !!get().accessToken,
    }),
    {
      name: 'auth-storage', // localStorage key
    }
  )
);
