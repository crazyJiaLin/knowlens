import { create } from 'zustand';

interface UIState {
  isLoginModalOpen: boolean;
  isLoading: boolean;

  // Actions
  openLoginModal: () => void;
  closeLoginModal: () => void;
  setLoading: (loading: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isLoginModalOpen: false,
  isLoading: false,

  openLoginModal: () => set({ isLoginModalOpen: true }),
  closeLoginModal: () => set({ isLoginModalOpen: false }),
  setLoading: (loading: boolean) => set({ isLoading: loading }),
}));
