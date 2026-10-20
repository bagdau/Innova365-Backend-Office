import { Bell, Menu, Search } from 'lucide-react';
import { QuickSettings } from '../shared/QuickSettings';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { reportesService } from '../../services/reportes.service';
import { useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';
import { t } from '../../i18n';

interface Props {
  title: string;
}

export function Header({ title }: Props) {
  const { user } = useAuthStore();
  const { notifCount, toggleSidebar } = useUiStore();
  const navigate = useNavigate();
  // Название берём из живого запроса: меняется сразу после сохранения (и на других устройствах по SSE), без F5.
  const { data: rest } = useQuery<{ nombre: string }>({ queryKey: ['restaurante'], queryFn: reportesService.getRestaurante, staleTime: 300_000 });

  return (
    <header className="h-16 bg-header-bg border-b border-border flex items-center justify-between gap-2 px-2.5 sm:px-4 lg:px-6 flex-shrink-0">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Hamburger — visible en móvil y desktop */}
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label={t('Abrir/cerrar menú')}
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-semibold text-foreground leading-tight line-clamp-2 sm:truncate">{title}</h1>
          <p className="hidden sm:block text-xs text-muted-foreground truncate">{rest?.nombre ?? user?.restaurante?.nombre ?? 'Innova365'}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event('innova:search'))}
          title="Ctrl+K"
          className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-sm"
        >
          <Search size={15} />
          <span>{t('Buscar')}</span>
          <kbd className="text-[10px] border border-border rounded px-1 py-0.5">Ctrl K</kbd>
        </button>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event('innova:search'))}
          aria-label={t('Buscar')}
          className="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground"
        >
          <Search size={16} />
        </button>
        <QuickSettings />
        <button
          onClick={() => navigate('/notificaciones')}
          aria-label={t('Notificaciones')} title={t('Notificaciones')}
          className="relative w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Bell size={18} />
          {notifCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary rounded-full text-[10px] text-white flex items-center justify-center font-bold">
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
