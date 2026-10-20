import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ColorMode = 'normal' | 'daltonico' | 'alto-contraste';
export type FontSize  = 'normal' | 'grande' | 'muy-grande';

interface A11yState {
  colorMode: ColorMode;
  fontSize:  FontSize;
  setColorMode: (m: ColorMode) => void;
  setFontSize:  (s: FontSize)  => void;
}

export const useA11yStore = create<A11yState>()(
  persist(
    (set) => ({
      colorMode: 'normal',
      fontSize:  'normal',
      setColorMode: (colorMode) => set({ colorMode }),
      setFontSize:  (fontSize)  => set({ fontSize }),
    }),
    { name: 'innova365-a11y' }
  )
);
