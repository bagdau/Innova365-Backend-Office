import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Minus, Trash2, CheckCircle, Utensils, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { menuService } from '../../services/menu.service';
import { mesasService } from '../../services/mesas.service';
import { pedidosService } from '../../services/pedidos.service';
import { formatCurrency } from '../../utils/cn';
import type { Producto, Categoria, Mesa } from '../../types';
import toast from 'react-hot-toast';
import { cn } from '../../utils/cn';
import { Select } from '../../components/ui/Select';
import { t, apiError } from '../../i18n';
import { SearchInput } from '../../components/shared/SearchInput';
import { Highlight } from '../../components/shared/Highlight';
import { useProductSearch } from '../../search/useSearch';
import { useAuthStore } from '../../store/authStore';
import { can } from '../../auth/permissions';
import { serviceCharge } from '../../lib/serviceCharge';

interface CartItem { producto: Producto; cantidad: number; }

export default function NuevoPedidoPage() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const rol = currentUser?.rol;
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMesaId = searchParams.get('mesaId') ?? '';

  const [tipo, setTipo] = useState<'EN_MESA' | 'PARA_LLEVAR'>('EN_MESA');
  const [mesaId, setMesaId] = useState(initialMesaId);
  const [waiterId, setWaiterId] = useState('');
  const [catActiva, setCatActiva] = useState<string>('todas');
  const [search, setSearch] = useState('');
  const mesaRef = useRef<HTMLButtonElement>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [mesaError, setMesaError] = useState(false);
  const sinMesa = tipo === 'EN_MESA' && !mesaId;

  // Intento de enviar sin mesa: avisa y lleva la atención al selector (antes el botón estaba bloqueado sin explicar nada)
  const pedirMesa = () => {
    setMesaError(true);
    mesaRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    mesaRef.current?.focus();
    toast.error(t('Elige una mesa o «Para llevar»'));
  };
  const [cart, setCart] = useState<CartItem[]>([]);

  const { data: productos = [] } = useQuery<Producto[]>({ queryKey: ['productos'], queryFn: menuService.getProductos });
  const { data: categorias = [] } = useQuery<Categoria[]>({ queryKey: ['categorias'], queryFn: menuService.getCategorias });
  const { data: mesas = [] } = useQuery<Mesa[]>({ queryKey: ['mesas'], queryFn: mesasService.getAll });
  const { data: waiters = [] } = useQuery({ queryKey: ['activeWaiters'], queryFn: pedidosService.getWaiters, enabled: rol === 'ADMIN' || rol === 'SUPERADMIN' || rol === 'CAJERO' });

  const filtroProd = useCallback((p: Producto) => p.disponible && (catActiva === 'todas' || p.categoriaId === catActiva), [catActiva]);
  const found = useProductSearch(productos, search, filtroProd);
  const prodFiltrados = found.items;

  const addItem = (prod: Producto) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.producto.id === prod.id);
      if (existing) return prev.map((i) => i.producto.id === prod.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      return [...prev, { producto: prod, cantidad: 1 }];
    });
  };

  // /pedidos/nuevo?add=<id> — llega desde la búsqueda global (Ctrl+K)
  const addParam = searchParams.get('add');
  useEffect(() => {
    if (!addParam || productos.length === 0) return;
    const prod = productos.find((x) => x.id === addParam);
    if (prod) addItem(prod);
    const next = new URLSearchParams(searchParams);
    next.delete('add');
    setSearchParams(next, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addParam, productos.length]);

  const removeItem = (id: string) => setCart((prev) => prev.filter((i) => i.producto.id !== id));
  const updateQty = (id: string, delta: number) => {
    setCart((prev) => prev.map((i) => i.producto.id === id ? { ...i, cantidad: Math.max(1, i.cantidad + delta) } : i));
  };

  const total = cart.reduce((s, i) => s + Number(i.producto.precio) * i.cantidad, 0);
  const percent = rol === 'MESERO' ? Number(currentUser?.waiterPercent ?? 0) : Number(waiters.find((w) => w.id === waiterId)?.waiterPercent ?? 0);
  const charge = serviceCharge(total, percent);
  const totalWithService = total + charge;
  const requiereCocina = cart.some((i) => i.producto.requiereCocina);

  const crearPedido = useMutation({
    mutationFn: () => pedidosService.create({
      tipo,
      mesaId: tipo === 'EN_MESA' ? mesaId : undefined,
      meseroId: waiterId || undefined,
      items: cart.map((i) => ({ productoId: i.producto.id, cantidad: i.cantidad })),
    }),
    onSuccess: (pedido) => {
      qc.invalidateQueries({ queryKey: ['mesas'] });
      qc.invalidateQueries({ queryKey: ['pedidosActivos'] });
      setMesaError(false);
      toast.success(pedido.estado === 'LISTO' ? t('Pedido listo para entregar') : t('Pedido enviado a cocina'));
      navigate(tipo === 'PARA_LLEVAR' ? (can(rol, 'caja') ? '/caja' : '/pedidos') : '/mesas');
    },
    onError: (e: any) => toast.error(apiError(e, 'Error al crear pedido')),
  });

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 h-full">
      {/* Left: Catalog */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Selectors */}
        <div className="flex items-center gap-4 flex-wrap">
          {rol !== 'MESERO' && waiters.length > 0 && <Select className="w-52" value={waiterId} onChange={setWaiterId}
            options={[{ value: '', label: t('Без официанта') }, ...waiters.map((w) => ({ value: w.id, label: w.nombre }))]} />}
          {tipo === 'EN_MESA' && (
            <Select
              triggerRef={mesaRef}
              className="w-48"
              invalid={mesaError}
              value={mesaId}
              onChange={(v) => { setMesaId(v); setMesaError(false); }}
              options={[{ value: '', label: t('Seleccionar mesa') }, ...mesas.filter((m) => m.estado === 'LIBRE').map((m) => ({ value: m.id, label: `${t('Mesa')} ${m.numero}` }))]}
            />
          )}
          <div className="flex rounded-m border border-border overflow-hidden">
            <button
              onClick={() => setTipo('EN_MESA')}
              className={cn('px-4 py-2 text-sm font-medium transition-colors', tipo === 'EN_MESA' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground')}
            >{t('En mesa')}</button>
            <button
              onClick={() => setTipo('PARA_LLEVAR')}
              className={cn('px-4 py-2 text-sm font-medium transition-colors', tipo === 'PARA_LLEVAR' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground')}
            >{t('Para llevar')}</button>
          </div>
        </div>

        {/* Búsqueda */}
        <SearchInput value={search} onChange={setSearch} hotkey="/"
          onEnter={() => { if (found.items.length === 1) { addItem(found.items[0]); setSearch(''); } }}
          className="max-w-md" />

        {/* Category Tabs */}
        <div className="flex gap-1.5 sm:gap-2 flex-nowrap sm:flex-wrap overflow-x-auto sm:overflow-visible -mx-1 px-1 pb-1 sm:pb-0">
          <button
            onClick={() => setCatActiva('todas')}
            className={cn('px-3 sm:px-4 py-1.5 rounded-pill text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0', catActiva === 'todas' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground')}
          >{t('Todas')}</button>
          {categorias.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCatActiva(cat.id)}
              className={cn('px-3 sm:px-4 py-1.5 rounded-pill text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0', catActiva === cat.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground')}
            >{cat.nombre}</button>
          ))}
        </div>

        {prodFiltrados.length === 0 && search.trim() && (
          <p className="text-sm text-muted-foreground py-6">{t('Nada encontrado para «{q}»', { q: search.trim() })}</p>
        )}

        {/* Products Grid */}
        <div className="grid grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 auto-rows-max content-start gap-2 sm:gap-3 overflow-y-auto min-h-0 pb-24 lg:pb-0">
          {prodFiltrados.map((prod) => {
            const inCart = cart.find((i) => i.producto.id === prod.id);
            return (
              <div key={prod.id}
                className={cn('bg-card border-2 rounded-xl overflow-hidden flex flex-col transition-all',
                  inCart ? 'border-primary shadow-md shadow-primary/20' : 'border-border')}>
                <div className="relative h-16 min-[480px]:h-24 sm:h-28 bg-muted overflow-hidden">
                  {prod.imagen ? (
                    <img src={prod.imagen} alt={prod.nombre} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Utensils size={20} className="text-muted-foreground/30" />
                    </div>
                  )}
                  {inCart && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary text-white font-black text-xs flex items-center justify-center">
                      {inCart.cantidad}
                    </div>
                  )}
                </div>
                <div className="p-1.5 sm:p-3 flex flex-col gap-1 sm:gap-1.5 flex-1">
                  <p className="text-[11px] sm:text-sm font-semibold text-foreground line-clamp-2 leading-tight"><Highlight text={prod.nombre} ranges={found.ranges.get(prod.id)} /></p>
                  <p className="text-primary font-bold text-xs sm:text-sm">{formatCurrency(Number(prod.precio))}</p>
                  <Button size="sm" className="w-full mt-auto !px-1 sm:!px-3" aria-label={t('Agregar')} onClick={() => addItem(prod)}>
                    <Plus size={14} /> <span className="hidden sm:inline">{t('Agregar')}</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Телефон/планшет: закреплённая полоска «Заказ» открывает корзину нижней панелью */}
      {cart.length > 0 && !cartOpen && (
        <button onClick={() => setCartOpen(true)} data-sound="none"
          className="lg:hidden fixed bottom-0 inset-x-0 z-30 flex items-center justify-between gap-3 px-4 py-3.5 bg-primary text-white shadow-2xl"
          style={{ paddingBottom: 'max(0.875rem, env(safe-area-inset-bottom))' }}>
          <span className="font-semibold">{t('Orden Actual')} · {cart.reduce((n, i) => n + i.cantidad, 0)}</span>
          <span className="font-bold">{formatCurrency(totalWithService)}</span>
        </button>
      )}
      {cartOpen && <div className="lg:hidden fixed inset-0 z-30 bg-black/55 fade-in" onClick={() => setCartOpen(false)} />}

      {/* Right: Order Panel */}
      <div className={cn('flex-col bg-card border border-border',
        'lg:flex lg:static lg:w-80 lg:flex-shrink-0 lg:rounded-l lg:max-h-none',
        cartOpen ? 'flex fixed inset-x-0 bottom-0 z-40 max-h-[88dvh] rounded-t-2xl sheet-up' : 'hidden')}>
        <div className="px-4 py-4 border-b border-border flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">{t('Orden Actual')}</h3>
          <button onClick={() => setCartOpen(false)} className="lg:hidden ml-auto p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted" aria-label={t('Cerrar')}><X size={18} /></button>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-xs text-error hover:underline">{t('Limpiar')}</button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border/50">
          {cart.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">{t('Sin items agregados')}</p>
          ) : cart.map((item) => (
            <div key={item.producto.id} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground font-medium truncate">{item.producto.nombre}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(Number(item.producto.precio))}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(item.producto.id, -1)} className="w-6 h-6 rounded bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
                  <Minus size={10} />
                </button>
                <span className="w-6 text-center text-sm text-foreground font-medium">{item.cantidad}</span>
                <button onClick={() => updateQty(item.producto.id, 1)} className="w-6 h-6 rounded bg-primary flex items-center justify-center text-white">
                  <Plus size={10} />
                </button>
              </div>
              <span className="text-sm text-foreground w-16 text-right">
                {formatCurrency(Number(item.producto.precio) * item.cantidad)}
              </span>
              <button onClick={() => removeItem(item.producto.id)} aria-label={t('Eliminar')} title={t('Eliminar')} className="text-muted-foreground hover:text-error">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-border p-4 space-y-3">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t('Subtotal')}</span><span>{formatCurrency(total)}</span>
          </div>
          {percent > 0 && <div className="flex justify-between text-xs text-muted-foreground"><span>{t('Обслуживание {n}%', { n: percent })}</span><span>{formatCurrency(charge)}</span></div>}
          <div className="flex justify-between text-base font-bold text-foreground">
            <span>{t('TOTAL')}</span><span className="text-primary">{formatCurrency(totalWithService)}</span>
          </div>
          <Button
            className="w-full"
            loading={crearPedido.isPending}
            disabled={cart.length === 0}
            onClick={() => (sinMesa ? pedirMesa() : crearPedido.mutate())}
          >
            <CheckCircle size={15} /> {requiereCocina ? t('Confirmar y enviar a cocina') : t('Confirmar pedido')}
          </Button>
          {sinMesa && cart.length > 0 && (
            <p className="text-xs text-warning text-center">{t('Elige una mesa o «Para llevar»')}</p>
          )}
          <button onClick={() => navigate(-1)} className="w-full text-xs text-muted-foreground hover:text-foreground text-center">
            {t('Cancelar pedido')}
          </button>
        </div>
      </div>
    </div>
  );
}
