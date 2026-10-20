import { create } from 'zustand';

const KEY = 'innova365-vkb';

/** По умолчанию клавиатура включена на сенсорных устройствах (кассовый моноблок, планшет), на обычном ПК — выключена. */
function defaultEnabled(): boolean {
  try {
    if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) return true;
    return window.matchMedia?.('(pointer: coarse)').matches ?? false;
  } catch { return false; }
}

function initial(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'on') return true;
    if (v === 'off') return false;
  } catch { /* storage недоступен */ }
  return defaultEnabled();
}

interface KeyboardState {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  toggle: () => void;
}

export const useKeyboardStore = create<KeyboardState>((set, get) => ({
  enabled: initial(),
  setEnabled: (v) => { try { localStorage.setItem(KEY, v ? 'on' : 'off'); } catch { /* ignore */ } set({ enabled: v }); },
  toggle: () => get().setEnabled(!get().enabled),
}));
