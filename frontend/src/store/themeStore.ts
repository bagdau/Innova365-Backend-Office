import { create } from 'zustand';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'innova365-theme';

function initial(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* storage no disponible */ }
  return 'dark';
}

function apply(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
}

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const theme = initial();
  document.documentElement.setAttribute('data-theme', theme);
  return {
    theme,
    setTheme: (t) => { apply(t); set({ theme: t }); },
    toggleTheme: () => { const t: Theme = get().theme === 'dark' ? 'light' : 'dark'; apply(t); set({ theme: t }); },
  };
});
