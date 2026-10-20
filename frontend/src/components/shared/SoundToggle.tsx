import { Volume2, VolumeX } from 'lucide-react';
import { useSoundStore } from '../../sound';
import { t } from '../../i18n';
import { cn } from '../../utils/cn';

export function SoundToggle({ className }: { className?: string }) {
  const { enabled, toggle } = useSoundStore();
  const label = enabled ? t('Sonido activado') : t('Sonido desactivado');
  return (
    <button
      type="button"
      onClick={toggle}
      data-sound="none"
      title={label}
      aria-label={t('Sonido')}
      aria-pressed={enabled}
      className={cn(
        'w-9 h-9 flex items-center justify-center rounded-lg border border-border',
        'text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
        className,
      )}
    >
      {enabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
    </button>
  );
}
