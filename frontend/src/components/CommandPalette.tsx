import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, ScrollText, Search, CornerDownLeft, LayoutDashboard, Grid2X2, ClipboardList, ChefHat, Utensils, Package, BarChart2, Users, Settings, Wallet, Plus } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { menuService } from '../services/menu.service';
import { useProductSearch } from '../search/useSearch';
import { SearchIndex } from '../search/engine';
import { can, ROUTE_ROLES } from '../auth/permissions';
import { formatCurrency } from '../utils/cn';
import { playSound } from '../sound';
import { Highlight } from './shared/Highlight';
import { cn } from '../utils/cn';
import { t } from '../i18n';
import type { Producto } from '../types';

type Page = { to: string; label: string; icon: typeof Search; route: keyof typeof ROUTE_ROLES; hint: string };

function pages(): Page[] {
  return [
    { to: '/dashboard',     label: t('Dashboard'),   icon: LayoutDashboard, route: 'dashboard',     hint: 'panel dashboard главная' },
    { to: '/mesas',         label: t('Mesas'),       icon: Grid2X2,         route: 'mesas',         hint: 'столы mesas' },
    { to: '/pedidos',       label: t('Pedidos'),     icon: ClipboardList,   route: 'pedidos',       hint: 'заказы история orders' },
    { to: '/pedidos/nuevo', label: t('Nuevo Pedido'), icon: Plus,           route: 'pedidosNuevo',  hint: 'новый заказ создать' },
    { to: '/caja',          label: t('Caja'),        icon: Wallet,          route: 'caja',          hint: 'касса оплата' },
    { to: '/cocina',        label: t('Cocina'),      icon: ChefHat,         route: 'cocina',        hint: 'кухня' },
    { to: '/menu',          label: t('Menú'),        icon: Utensils,        route: 'menu',          hint: 'меню блюда' },
    { to: '/inventario',    label: t('Inventario'),  icon: Package,         route: 'inventario',    hint: 'склад закупки поставщики ревизия' },
    { to: '/reportes',      label: t('Reportes'),    icon: BarChart2,       route: 'reportes',      hint: 'отчёты продажи' },
    { to: '/monitor',        label: t('Monitor'),    icon: Activity,        route: 'monitor',       hint: 'монитор мониторинг контроль live' },
    { to: '/auditoria',     label: t('Registro de actividad'), icon: ScrollText, route: 'auditoria', hint: 'журнал действий аудит владелец' },
    { to: '/usuarios',      label: t('Usuarios'),    icon: Users,           route: 'usuarios',      hint: 'пользователи сотрудники' },
    { to: '/configuracion', label: t('Configuración'), icon: Settings,      route: 'configuracion', hint: 'настройки принтеры' },
  ];
}

const onlyAvailable = (p: Producto) => p.disponible;

type Row =
  | { kind: 'page'; key: string; page: Page }
  | { kind: 'dish'; key: string; prod: Producto; ranges?: Array<[number, number]> };

/** Глобальный быстрый поиск: Ctrl+K (или «/» вне полей ввода). Блюда и разделы. */
export function CommandPalette() {
  const navigate = useNavigate();
  const rol = useAuthStore((s) => s.user?.rol);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: productos = [] } = useQuery<Producto[]>({
    queryKey: ['productos'],
    queryFn: menuService.getProductos,
    enabled: !!rol && open,
    staleTime: 60_000,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const onOpen = () => setOpen(true);
    window.addEventListener('innova:search', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('innova:search', onOpen); };
  }, []);

  useEffect(() => { if (open) { setQuery(''); setCursor(0); playSound('open'); } }, [open]);

  const pageList = useMemo(() => pages().filter((p) => can(rol, p.route)), [rol, open]);
  const pageIndex = useMemo(() => new SearchIndex<Page>(pageList, [
    { get: (p) => p.label, weight: 3 }, { get: (p) => p.hint, weight: 1 },
  ]), [pageList]);

  const dishes = useProductSearch(productos, query, onlyAvailable, { immediate: true });

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    const q = query.trim();
    const pg = q ? pageIndex.search(q, { limit: 4 }).map((h) => h.item) : pageList.slice(0, 0);
    pg.forEach((page) => out.push({ kind: 'page', key: 'p' + page.to, page }));
    if (q) dishes.items.slice(0, 30).forEach((prod) => out.push({ kind: 'dish', key: 'd' + prod.id, prod, ranges: dishes.ranges.get(prod.id) }));
    return out;
  }, [query, pageIndex, pageList, dishes]);

  useEffect(() => { setCursor(0); }, [query]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-row="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const choose = (row: Row | undefined) => {
    if (!row) return;
    setOpen(false);
    if (row.kind === 'page') { navigate(row.page.to); return; }
    if (can(rol, 'pedidosNuevo')) navigate(`/pedidos/nuevo?add=${row.prod.id}`);
    else if (can(rol, 'menu')) navigate(`/menu?q=${encodeURIComponent(row.prod.nombre)}`);
  };

  if (!open || !rol) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4" role="dialog" aria-modal="true" aria-label={t('Búsqueda rápida')}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search size={18} className="text-muted-foreground flex-shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, rows.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
              else if (e.key === 'Enter') { e.preventDefault(); choose(rows[cursor]); }
            }}
            placeholder={t('Buscar plato o sección...')}
            autoComplete="off"
            spellCheck={false}
            className="flex-1 bg-transparent py-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="text-[11px] text-muted-foreground border border-border rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1">
          {!query.trim() && <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t('Empieza a escribir el nombre de un plato o sección')}</p>}
          {query.trim() && rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t('No se encontró nada')}</p>}
          {rows.map((row, i) => (
            <button
              key={row.key}
              data-row={i}
              data-sound="none"
              onMouseMove={() => setCursor(i)}
              onClick={() => choose(row)}
              className={cn('w-full flex items-center gap-3 px-4 py-2.5 text-left', i === cursor ? 'bg-primary/10' : 'hover:bg-muted/50')}
            >
              {row.kind === 'page' ? (
                <>
                  <row.page.icon size={16} className="text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 text-sm text-foreground">{row.page.label}</span>
                  <span className="text-[11px] text-muted-foreground">{t('Sección')}</span>
                </>
              ) : (
                <>
                  {row.prod.imagen
                    ? <img src={row.prod.imagen} alt="" className="w-9 h-9 rounded-md object-cover flex-shrink-0" />
                    : <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center flex-shrink-0"><Utensils size={14} className="text-muted-foreground" /></div>}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate"><Highlight text={row.prod.nombre} ranges={row.ranges} /></p>
                    <p className="text-xs text-muted-foreground truncate">{row.prod.categoria?.nombre}</p>
                  </div>
                  <span className="text-sm font-bold text-primary flex-shrink-0">{formatCurrency(Number(row.prod.precio))}</span>
                </>
              )}
              {i === cursor && <CornerDownLeft size={13} className="text-muted-foreground flex-shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

