import { useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeSwitcher } from './ThemeSwitcher';
import { SoundToggle } from './SoundToggle';
import { KeyboardToggle } from './KeyboardToggle';
import { Floating } from '../ui/Floating';
import { t } from '../../i18n';

/** Язык, тема и звук: на планшете/десктопе — в строку, на телефоне — одной кнопкой с нижней панелью (чтобы шапка не ломалась). */
export function QuickSettings() {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="hidden md:flex items-center gap-3"><LanguageSwitcher /><ThemeSwitcher /><SoundToggle /><KeyboardToggle /></div>
      <button ref={ref} type="button" onClick={() => setOpen((v) => !v)} aria-label={t('Idioma')} data-sound="none"
        className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground flex-shrink-0">
        <SlidersHorizontal size={16} />
      </button>
      <Floating open={open} onClose={() => setOpen(false)} anchorRef={ref} width={300} estHeight={180} title={t('Idioma')}>
        <div className="flex flex-wrap items-center justify-center gap-4 p-4"><LanguageSwitcher /><ThemeSwitcher /><SoundToggle /><KeyboardToggle /></div>
      </Floating>
    </>
  );
}
