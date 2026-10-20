import { lang, setLang, t, type Lang } from '../../i18n';
import { cn } from '../../utils/cn';

const OPTIONS: { code: Lang; label: string }[] = [
  { code: 'ru', label: 'RU' },
  { code: 'kk', label: 'ҚАЗ' },
  { code: 'en', label: 'EN' },
];

export function LanguageSwitcher({ className }: { className?: string }) {
  return (
    <div
      className={cn('inline-flex rounded-lg border border-border overflow-hidden', className)}
      role="group"
      aria-label={t('Idioma')}
    >
      {OPTIONS.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          onClick={() => { if (code !== lang) setLang(code); }}
          aria-pressed={code === lang}
          data-sound="switch"
          className={cn(
            'px-2.5 py-1.5 text-xs font-bold transition-colors',
            code === lang ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
