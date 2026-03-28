import { create } from 'zustand';
import { api } from '@/lib/api';

interface AuthState {
  user: any | null;
  organization: any | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { organizationName: string; name: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
  loadProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  organization: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const result = await api.login(email, password);
    api.setToken(result.token);
    set({ user: result.user, organization: result.organization, isAuthenticated: true });
  },

  register: async (data) => {
    const result = await api.register(data);
    api.setToken(result.token);
    set({ user: result.user, organization: result.organization, isAuthenticated: true });
  },

  logout: () => {
    api.setToken(null);
    set({ user: null, organization: null, isAuthenticated: false });
  },

  loadProfile: async () => {
    try {
      const token = api.getToken();
      if (!token) {
        set({ isLoading: false });
        return;
      }
      const profile = await api.getProfile();
      set({ user: profile, organization: profile.organization, isAuthenticated: true, isLoading: false });
    } catch {
      api.setToken(null);
      set({ isLoading: false });
    }
  },
}));
