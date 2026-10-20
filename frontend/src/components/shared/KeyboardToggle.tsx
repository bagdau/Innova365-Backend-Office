import { Keyboard } from 'lucide-react';
import { useKeyboardStore } from '../../store/keyboardStore';
import { t } from '../../i18n';
import { cn } from '../../utils/cn';

/** Включает/выключает экранную клавиатуру (запоминается на этом устройстве). */
export function KeyboardToggle({ className }: { className?: string }) {
  const { enabled, toggle } = useKeyboardStore();
  const label = enabled ? t('Teclado en pantalla activado') : t('Teclado en pantalla desactivado');
  return (
    <button
      type="button" onClick={toggle} data-sound="none" data-vkb="off"
      title={label} aria-label={t('Teclado en pantalla')} aria-pressed={enabled}
      className={cn(
        'w-9 h-9 flex items-center justify-center rounded-lg border transition-colors',
        enabled ? 'border-primary/60 bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted',
        className,
      )}
    >
      <Keyboard size={17} />
    </button>
  );
}
