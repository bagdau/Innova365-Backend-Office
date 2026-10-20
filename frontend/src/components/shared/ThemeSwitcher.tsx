import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { t } from '../../i18n';
import { cn } from '../../utils/cn';

export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';
  const label = isDark ? t('Tema claro') : t('Tema oscuro');

  return (
    <button
      type="button"
      onClick={toggleTheme}
      data-sound="toggle"
      title={label}
      aria-label={t('Cambiar tema')}
      className={cn(
        'w-9 h-9 flex items-center justify-center rounded-lg border border-border',
        'text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
        className,
      )}
    >
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
