import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Grid2X2, ClipboardList, ChefHat, Utensils,
  Package, BarChart2, Users, Settings, LogOut, X, Wallet, Activity, ScrollText, Bike } from 'lucide-react';
import { cn, getInitials, rolLabel } from '../../utils/cn';
import { useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';
import { authService } from '../../services/auth.service';
import toast from 'react-hot-toast';
import { Logo } from '../shared/Logo';
import { can, type RouteKey } from '../../auth/permissions';
import { playSound } from '../../sound';
import { t } from '../../i18n';

const navItems: Array<{ to: string; icon: typeof LayoutDashboard; label: string; route: RouteKey }> = [
  { to: '/dashboard',     icon: LayoutDashboard, label: t('Dashboard'),      route: 'dashboard' },
  { to: '/monitor',       icon: Activity,        label: t('Monitor'),        route: 'monitor' },
  { to: '/mesas',         icon: Grid2X2,         label: t('Mesas'),          route: 'mesas' },
  { to: '/pedidos',       icon: ClipboardList,   label: t('Pedidos'),        route: 'pedidos' },
  { to: '/caja',          icon: Wallet,          label: t('Caja'),           route: 'caja' },
  { to: '/cocina',        icon: ChefHat,         label: t('Cocina'),         route: 'cocina' },
  { to: '/entregas',      icon: Bike,            label: t('Entregas'),       route: 'entregas' },
  { to: '/menu',          icon: Utensils,        label: t('Menú'),           route: 'menu' },
  { to: '/techcards',     icon: ChefHat,         label: 'Техкарты',          route: 'techcards' },
  { to: '/inventario',    icon: Package,         label: t('Inventario'),     route: 'inventario' },
  { to: '/reportes',      icon: BarChart2,       label: t('Reportes'),       route: 'reportes' },
  { to: '/usuarios',      icon: Users,           label: t('Usuarios'),       route: 'usuarios' },
  { to: '/auditoria',     icon: ScrollText,      label: t('Registro de actividad'), route: 'auditoria' },
  { to: '/configuracion', icon: Settings,        label: t('Configuración'),  route: 'configuracion' },
];

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const { sidebarOpen, setSidebarOpen } = useUiStore();
  const navigate = useNavigate();

  const visibleNav = navItems.filter((item) => user && can(user.rol, item.route));

  const handleLogout = async () => {
    try { await authService.logout(); } catch { /* ignore */ }
    logout();
    navigate('/login');
    playSound('back');
    toast.success(t('Sesión cerrada'));
  };

  const close = () => setSidebarOpen(false);

  return (
    <>
      {/* Overlay oscuro en móvil cuando sidebar está abierto */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30',
          'flex flex-col bg-sidebar-bg border-r border-border',
          'transition-transform duration-300 ease-in-out',
          'w-64',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo + botón cerrar (móvil) */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-border">
          <Logo size={32} />
          <button
            onClick={close}
            className="lg:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label={t('Cerrar menú')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto" aria-label={t('Navegación principal')}>
          {visibleNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => { if (window.innerWidth < 1024) close(); }}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-3 rounded-lg text-[15px] font-medium transition-all',
                  isActive
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )
              }
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer / perfil */}
        <div className="border-t border-border p-3">
          <div
            className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-muted transition-colors cursor-pointer group"
            onClick={() => { navigate('/perfil'); if (window.innerWidth < 1024) close(); }}
            role="button"
            aria-label={t('Ver perfil')}
          >
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
              {user ? getInitials(user.nombre) : '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{user?.nombre}</p>
              <p className="text-xs text-muted-foreground">{user ? rolLabel(user.rol) : ''}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleLogout(); }}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-error transition-all p-1.5 rounded"
              title={t('Cerrar sesión')}
              aria-label={t('Cerrar sesión')}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
