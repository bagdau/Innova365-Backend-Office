/**
 * Vista móvil optimizada para meseros.
 * Acceso: /mesero — funciona en cualquier teléfono.
 * Flujo: seleccionar mesa → elegir productos → confirmar pedido
 */
import { liveInterval } from '../../lib/live';
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useRealtime } from '../../hooks/useRealtime';
import { ArrowLeft, ShoppingCart, Plus, Minus, CheckCircle, Utensils, Grid2X2 } from 'lucide-react';
import { mesasService } from '../../services/mesas.service';
import { menuService } from '../../services/menu.service';
import { pedidosService } from '../../services/pedidos.service';
import type { Mesa, Producto, Categoria } from '../../types';
import { cn, formatCurrency } from '../../utils/cn';
import toast from 'react-hot-toast';
import { t } from '../../i18n';
import { Logo } from '../../components/shared/Logo';
import { QuickSettings } from '../../components/shared/QuickSettings';
import { SearchInput } from '../../components/shared/SearchInput';
import { Highlight } from '../../components/shared/Highlight';
import { useProductSearch } from '../../search/useSearch';

type Step = 'mesas' | 'menu' | 'confirmar';

export default function MeseroPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  useRealtime(); // recibir notificación cuando cocina marca pedido como listo
  const [step, setStep]         = useState<Step>('mesas');
  const [mesaSel, setMesaSel]   = useState<Mesa | null>(null);
  const [catFiltro, setCatFiltro] = useState('todas');
  const [search, setSearch] = useState('');
  const [carrito, setCarrito]   = useState<Record<string, number>>({});
  const [success, setSuccess]   = useState(false);

  const { data: mesas = [] } = useQuery<Mesa[]>({
    queryKey: ['mesas'],
    queryFn: mesasService.getAll,
    refetchInterval: liveInterval,
  });
  const { data: productos = [] } = useQuery<Producto[]>({
    queryKey: ['productos'],
    queryFn: menuService.getProductos,
    enabled: step !== 'mesas',
  });
  const { data: categorias = [] } = useQuery<Categoria[]>({
    queryKey: ['categorias'],
    queryFn: menuService.getCategorias,
    enabled: step !== 'mesas',
  });

  const crearPedido = useMutation({
    mutationFn: () => pedidosService.create({
      tipo: 'EN_MESA',
      mesaId: mesaSel!.id,
      items: Object.entries(carrito).map(([productoId, cantidad]) => ({ productoId, cantidad })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mesas'] });
      qc.invalidateQueries({ queryKey: ['pedidosActivos'] });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setStep('mesas');
        setMesaSel(null);
        setCarrito({});
      }, 2000);
    },
    onError: () => toast.error(t('Error al crear pedido')),
  });

  const agregarItems = useMutation({
    mutationFn: () => pedidosService.addItems(
      mesaSel!.pedidoActivo!.id,
      Object.entries(carrito).map(([productoId, cantidad]) => ({ productoId, cantidad }))
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mesas'] });
      qc.invalidateQueries({ queryKey: ['pedidosActivos'] });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setStep('mesas');
        setMesaSel(null);
        setCarrito({});
      }, 2000);
    },
    onError: () => toast.error(t('Error al añadir productos')),
  });

  const cambiarCantidad = (id: string, delta: number) => {
    setCarrito((prev) => {
      const actual = prev[id] ?? 0;
      const nuevo = Math.max(0, actual + delta);
      if (nuevo === 0) { const { [id]: _, ...rest } = prev; return rest; }
      return { ...prev, [id]: nuevo };
    });
  };

  const totalItems = Object.values(carrito).reduce((a, b) => a + b, 0);
  const totalPrecio = Object.entries(carrito).reduce((sum, [id, qty]) => {
    const p = productos.find((x) => x.id === id);
    return sum + (p ? Number(p.precio) * qty : 0);
  }, 0);

  const filtroProd = useCallback((p: Producto) => p.disponible && (catFiltro === 'todas' || p.categoriaId === catFiltro), [catFiltro]);
  const found = useProductSearch(productos, search, filtroProd);
  const prodVisibles = found.items;

  const mesasLibres   = mesas.filter((m) => m.estado === 'LIBRE');
  const mesasOcupadas = mesas.filter((m) => m.estado !== 'LIBRE');

  // ── Pantalla de éxito ────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center gap-4 p-6">
        <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center">
          <CheckCircle size={48} className="text-success" />
        </div>
        <p className="text-xl font-bold text-foreground text-center">{t('¡Pedido enviado a cocina!')}</p>
        <p className="text-muted-foreground text-center">{t('Mesa')} {mesaSel?.numero}</p>
      </div>
    );
  }

  // ── PASO 1: Selección de mesa ────────────────────────────────────────
  if (step === 'mesas') {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col">
        <header className="sticky top-0 bg-sidebar-bg border-b border-border px-4 py-3 flex items-center gap-3 z-10">
          <Logo size={26} className="flex-1 min-w-0" />
          <span className="hidden sm:inline text-muted-foreground text-sm">{t('Mesero')}</span>
          <QuickSettings />
          <button
            onClick={() => navigate('/mesas')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            <Grid2X2 size={15} />
            <span>{t('Mesas')}</span>
          </button>
        </header>

        <main className="flex-1 p-4 space-y-5">
          {/* Mesas libres */}
          {mesasLibres.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {t('Mesas libres ({n})', { n: mesasLibres.length })}
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {mesasLibres.map((mesa) => (
                  <button
                    key={mesa.id}
                    onClick={() => { setMesaSel(mesa); setCarrito({}); setStep('menu'); }}
                    className="bg-card border-2 border-success/40 rounded-2xl p-4 flex flex-col items-center gap-1 active:scale-95 transition-transform"
                  >
                    <span className="text-2xl font-black text-foreground">{mesa.numero}</span>
                    <span className="text-xs text-muted-foreground">{mesa.capacidad} 👤</span>
                    <span className="text-xs text-success font-semibold mt-1">{t('LIBRE')}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Mesas ocupadas (para añadir) */}
          {mesasOcupadas.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {t('Mesas ocupadas — añadir productos')}
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {mesasOcupadas.map((mesa) => (
                  <button
                    key={mesa.id}
                    onClick={() => { setMesaSel(mesa); setCarrito({}); setStep('menu'); }}
                    className="bg-card border-2 border-error/40 rounded-2xl p-4 flex flex-col items-center gap-1 active:scale-95 transition-transform"
                  >
                    <span className="text-2xl font-black text-foreground">{mesa.numero}</span>
                    <span className="text-xs text-muted-foreground">{mesa.capacidad} 👤</span>
                    <span className={cn('text-xs font-semibold mt-1',
                      mesa.estado === 'OCUPADA' ? 'text-error' : 'text-warning')}>
                      {mesa.estado === 'OCUPADA' ? 'OCUPADA' : 'EN ESPERA'}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    );
  }

  // ── PASO 2: Selección de productos ──────────────────────────────────
  if (step === 'menu') {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col">
        <header className="sticky top-0 bg-sidebar-bg border-b border-border px-4 py-3 flex items-center gap-3 z-10">
          <button onClick={() => setStep('mesas')} className="p-1 -ml-1 rounded-lg text-muted-foreground hover:text-foreground">
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1">
            <p className="font-bold text-foreground">{t('Mesa')} {mesaSel?.numero}</p>
            <p className="text-xs text-muted-foreground">
              {mesaSel?.estado === 'LIBRE' ? t('Pedido nuevo') : t('Añadir productos')}
            </p>
          </div>
          {totalItems > 0 && (
            <button
              onClick={() => setStep('confirmar')}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-semibold text-sm active:scale-95 transition-transform"
            >
              <ShoppingCart size={16} />
              {totalItems}
              <span className="hidden xs:inline">— {formatCurrency(totalPrecio)}</span>
            </button>
          )}
        </header>

        {/* Búsqueda */}
        <div className="sticky top-[57px] bg-background px-4 pt-2 z-10">
          <SearchInput value={search} onChange={setSearch} />
        </div>

        {/* Filtros de categoría */}
        <div className="sticky top-[105px] bg-background border-b border-border px-4 py-2 flex gap-2 overflow-x-auto z-10 scrollbar-hide">
          <button onClick={() => setCatFiltro('todas')}
            className={cn('px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors',
              catFiltro === 'todas' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground')}>
            {t('Todos')}
          </button>
          {categorias.map((c) => (
            <button key={c.id} onClick={() => setCatFiltro(c.id)}
              className={cn('px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors',
                catFiltro === c.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground')}>
              {c.nombre}
            </button>
          ))}
        </div>

        {/* Grid de productos */}
        <main className="flex-1 p-4 pb-24">
          <div className="grid grid-cols-2 gap-3">
            {prodVisibles.map((prod) => {
              const qty = carrito[prod.id] ?? 0;
              return (
                <div key={prod.id}
                  className={cn('bg-card border-2 rounded-2xl overflow-hidden flex flex-col transition-all',
                    qty > 0 ? 'border-primary shadow-md shadow-primary/20' : 'border-border')}>
                  {/* Imagen */}
                  <div className="relative h-28 bg-muted">
                    {prod.imagen ? (
                      <img src={prod.imagen} alt={prod.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Utensils size={24} className="text-muted-foreground/30" />
                      </div>
                    )}
                    {qty > 0 && (
                      <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-primary text-white font-black text-sm flex items-center justify-center shadow-lg">
                        {qty}
                      </div>
                    )}
                  </div>

                  <div className="p-3 flex flex-col gap-2 flex-1">
                    <p className="text-sm font-semibold text-foreground leading-tight line-clamp-2"><Highlight text={prod.nombre} ranges={found.ranges.get(prod.id)} /></p>
                    <p className="text-primary font-bold text-base">{formatCurrency(Number(prod.precio))}</p>

                    {/* Controles */}
                    {qty === 0 ? (
                      <button
                        onClick={() => cambiarCantidad(prod.id, 1)}
                        className="w-full py-2.5 rounded-xl bg-primary/10 text-primary font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
                      >
                        <Plus size={16} /> {t('Agregar')}
                      </button>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <button onClick={() => cambiarCantidad(prod.id, -1)}
                          className="w-10 h-10 rounded-xl bg-muted text-foreground font-bold flex items-center justify-center text-lg active:scale-90 transition-transform">
                          <Minus size={16} />
                        </button>
                        <span className="text-xl font-black text-foreground">{qty}</span>
                        <button onClick={() => cambiarCantidad(prod.id, 1)}
                          className="w-10 h-10 rounded-xl bg-primary text-white font-bold flex items-center justify-center text-lg active:scale-90 transition-transform">
                          <Plus size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        {/* Botón flotante confirmar */}
        {totalItems > 0 && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
            <button
              onClick={() => setStep('confirmar')}
              className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-base flex items-center justify-between px-5 active:scale-95 transition-transform"
            >
              <span className="bg-white/20 rounded-lg px-2 py-0.5 text-sm">{totalItems}</span>
              <span>{t('Ver pedido')}</span>
              <span>{formatCurrency(totalPrecio)}</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── PASO 3: Confirmar pedido ─────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="sticky top-0 bg-sidebar-bg border-b border-border px-4 py-3 flex items-center gap-3 z-10">
        <button onClick={() => setStep('menu')} className="p-1 -ml-1 rounded-lg text-muted-foreground hover:text-foreground">
          <ArrowLeft size={22} />
        </button>
        <div>
          <p className="font-bold text-foreground">{t('Confirmar pedido')}</p>
          <p className="text-xs text-muted-foreground">{t('Mesa')} {mesaSel?.numero}</p>
        </div>
      </header>

      <main className="flex-1 p-4 pb-32 space-y-3">
        {Object.entries(carrito).map(([id, qty]) => {
          const prod = productos.find((p) => p.id === id);
          if (!prod) return null;
          return (
            <div key={id} className="flex items-center gap-4 bg-card border border-border rounded-2xl p-3">
              {prod.imagen ? (
                <img src={prod.imagen} alt={prod.nombre} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-muted flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">{prod.nombre}</p>
                <p className="text-sm text-muted-foreground">{formatCurrency(Number(prod.precio))} × {qty}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-foreground">{formatCurrency(Number(prod.precio) * qty)}</p>
                <div className="flex items-center gap-2 mt-1">
                  <button onClick={() => cambiarCantidad(id, -1)}
                    className="w-6 h-6 rounded-full bg-muted text-foreground flex items-center justify-center text-sm">−</button>
                  <span className="text-sm font-bold">{qty}</span>
                  <button onClick={() => cambiarCantidad(id, 1)}
                    className="w-6 h-6 rounded-full bg-muted text-foreground flex items-center justify-center text-sm">+</button>
                </div>
              </div>
            </div>
          );
        })}
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground px-1">
          <span>{t('Productos: {n}', { n: totalItems })}</span>
          <span className="font-bold text-foreground text-base">{t('Total:')} {formatCurrency(totalPrecio)}</span>
        </div>
        <button
          disabled={crearPedido.isPending || agregarItems.isPending}
          onClick={() => {
            if (mesaSel?.estado === 'LIBRE') crearPedido.mutate();
            else agregarItems.mutate();
          }}
          className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-base active:scale-95 transition-transform disabled:opacity-50"
        >
          {crearPedido.isPending || agregarItems.isPending
            ? t('Enviando...')
            : mesaSel?.estado === 'LIBRE'
              ? t('🍳 Enviar a cocina')
              : t('➕ Añadir al pedido')}
        </button>
      </div>
    </div>
  );
}
