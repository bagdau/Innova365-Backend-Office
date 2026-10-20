import { create } from 'zustand';

interface UiState {
  sidebarOpen: boolean;
  notifCount: number;
  setSidebarOpen: (v: boolean) => void;
  toggleSidebar: () => void;
  setNotifCount: (n: number) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  notifCount: 0,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setNotifCount: (n) => set({ notifCount: n }),
}));
