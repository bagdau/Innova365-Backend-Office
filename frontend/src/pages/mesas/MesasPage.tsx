import { liveInterval } from '../../lib/live';
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Clock, User, Pencil, CreditCard, ShoppingCart, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { mesasService } from '../../services/mesas.service';
import { pedidosService } from '../../services/pedidos.service';
import { menuService } from '../../services/menu.service';
import type { Mesa, Producto, Categoria } from '../../types';
import { cn, formatCurrency, rolLabel } from '../../utils/cn';
import toast from 'react-hot-toast';
import { METODOS_PAGO } from '../../lib/payments';
import { fmtMoney } from '../../lib/currency';
import { PayQr } from '../../components/shared/PayQr';
import { t, apiError } from '../../i18n';
import { printOrder, printAfterPayment } from '../../lib/printClient';
import { FileText } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { can, isAdminLike } from '../../auth/permissions';
import { useNow, minutesSince } from '../../hooks/useNow';
import { SearchInput } from '../../components/shared/SearchInput';
import { Highlight } from '../../components/shared/Highlight';
import { useProductSearch } from '../../search/useSearch';
import { addedServiceCharge } from '../../lib/serviceCharge';

function getTimerColor(t: number | null | undefined): React.CSSProperties {
  if (t == null) return {};
  if (t <= 10)  return { color: 'var(--color-error)' };
  if (t <= 20)  return { color: 'var(--color-warning)' };
  return { color: 'var(--color-success)' };
}

function getMesaBorder(m: Mesa) {
  if (m.estado === 'LIBRE')     return 'border-success/40';
  if (m.estado === 'OCUPADA')   return 'border-error/60';
  if (m.estado === 'EN_ESPERA') return 'border-warning/60';
  return 'border-border';
}


export default function MesasPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const rol = useAuthStore((s) => s.user?.rol);
  const isAdmin = isAdminLike(rol);
  const now = useNow();

  const [showCreate, setShowCreate]   = useState(false);
  const [numero, setNumero]           = useState('');
  const [capacidad, setCapacidad]     = useState('4');
  const [editMesa, setEditMesa]       = useState<Mesa | null>(null);
  const [editNumero, setEditNumero]   = useState('');
  const [editCapacidad, setEditCapacidad] = useState('');
  const [pagoMesa, setPagoMesa]       = useState<Mesa | null>(null);
  const [metodoPago, setMetodoPago]   = useState('Efectivo');

  // Añadir items a pedido activo
  const [addMesa, setAddMesa]         = useState<Mesa | null>(null);
  const [catFiltro, setCatFiltro]     = useState('todas');
  const [search, setSearch]           = useState('');
  const [carrito, setCarrito]         = useState<Record<string, number>>({});

  const { data: mesas = [], isLoading } = useQuery<Mesa[]>({
    queryKey: ['mesas'],
    queryFn: mesasService.getAll,
    refetchInterval: liveInterval,
  });
  const { data: productos = [] } = useQuery<Producto[]>({
    queryKey: ['productos'],
    queryFn: menuService.getProductos,
    enabled: !!addMesa,
  });
  const { data: categorias = [] } = useQuery<Categoria[]>({
    queryKey: ['categorias'],
    queryFn: menuService.getCategorias,
    enabled: !!addMesa,
  });

  const createMesa = useMutation({
    mutationFn: () => mesasService.create({ numero: parseInt(numero), capacidad: parseInt(capacidad) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mesas'] }); setShowCreate(false); toast.success(t('Mesa creada')); },
    onError: () => toast.error(t('Error al crear mesa')),
  });

  const updateMesaMut = useMutation({
    mutationFn: ({ id, numero, capacidad }: { id: string; numero: number; capacidad: number }) =>
      mesasService.update(id, { numero, capacidad }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mesas'] }); setEditMesa(null); toast.success(t('Mesa actualizada')); },
    onError: () => toast.error(t('Error al actualizar mesa')),
  });

  const liberarSinPedido = useMutation({
    mutationFn: (mesaId: string) => mesasService.updateEstado(mesaId, 'LIBRE'),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['mesas'] }); toast.success(t('Mesa liberada')); },
    onError: () => toast.error(t('Error al actualizar mesa')),
  });

  const entregar = useMutation({
    mutationFn: (pedidoId: string) => pedidosService.updateEstado(pedidoId, 'ENTREGADO'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mesas'] }); toast.success(t('Pedido entregado al cliente')); },
    onError: () => toast.error(t('Error al entregar pedido')),
  });

  const registrarPago = useMutation({
    mutationFn: ({ pedidoId, metodo }: { pedidoId: string; metodo: string }) =>
      pedidosService.registrarPago(pedidoId, metodo, Number(pagoMesa?.pedidoActivo?.total ?? 0)),
    onSuccess: (resp, vars) => {
      const ped = pagoMesa?.pedidoActivo;
      qc.invalidateQueries({ queryKey: ['mesas'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setPagoMesa(null);
      toast.success(t('¡Pago registrado! Mesa liberada'));
      if (ped) void printAfterPayment(ped, vars.metodo, resp);   // чек сразу после оплаты
    },
    onError: (error: any) => {
      if (error?.response?.status === 409) { setPagoMesa(null); void qc.invalidateQueries({ queryKey: ['mesas'] }); }
      toast.error(apiError(error, t('Error al registrar pago')));
    },
  });

  const addItems = useMutation({
    mutationFn: ({ pedidoId, items }: { pedidoId: string; items: { productoId: string; cantidad: number }[] }) =>
      pedidosService.addItems(pedidoId, items),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mesas'] });
      qc.invalidateQueries({ queryKey: ['pedidosActivos'] });
      closeAddModal();
      toast.success(t('Productos añadidos al pedido'));
    },
    onError: () => toast.error(t('Error al añadir productos')),
  });

  const openEdit = (mesa: Mesa) => { setEditMesa(mesa); setEditNumero(String(mesa.numero)); setEditCapacidad(String(mesa.capacidad)); };
  const openPago = (mesa: Mesa) => {
    if (!can(rol, 'caja')) return;
    setPagoMesa(mesa);
    setMetodoPago('Efectivo');
  };
  const openAdd  = (mesa: Mesa) => { setAddMesa(mesa); setCarrito({}); setCatFiltro('todas'); };
  const closeAddModal = () => { setAddMesa(null); setCarrito({}); setSearch(''); };

  const cambiarCantidad = (productoId: string, delta: number) => {
    setCarrito((prev) => {
      const actual = prev[productoId] ?? 0;
      const nuevo = Math.max(0, actual + delta);
      if (nuevo === 0) { const { [productoId]: _, ...rest } = prev; return rest; }
      return { ...prev, [productoId]: nuevo };
    });
  };

  const totalCarrito = Object.entries(carrito).reduce((sum, [id, qty]) => {
    const p = productos.find((x) => x.id === id);
    return sum + (p ? Number(p.precio) * qty : 0);
  }, 0);
  const itemsCarrito = Object.keys(carrito).length;

  const filtroProd = useCallback((p: Producto) => p.disponible && (catFiltro === 'todas' || p.categoriaId === catFiltro), [catFiltro]);
  const found = useProductSearch(productos, search, filtroProd);
  const prodVisibles = found.items;

  const libres   = mesas.filter((m) => m.estado === 'LIBRE').length;
  const ocupadas = mesas.filter((m) => m.estado === 'OCUPADA').length;
  const enEspera = mesas.filter((m) => m.estado === 'EN_ESPERA').length;

  if (isLoading) {
    return <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">{[...Array(10)].map((_, i) => <div key={i} className="h-40 bg-card border border-border rounded-xl animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-5">
      {/* Stats + Actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-5 text-sm flex-wrap">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full inline-block bg-success" />
            <span className="text-foreground font-medium">○ {libres} {t('Libres')}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full inline-block bg-error" />
            <span className="text-foreground font-medium">● {ocupadas} {t('Ocupadas')}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full inline-block bg-warning" />
            <span className="text-foreground font-medium">◔ {enEspera} {t('En espera')}</span>
          </span>
        </div>
        <div className="flex gap-2">
          {can(rol, 'mesero') && (
            <Button size="sm" variant="secondary" onClick={() => navigate('/mesero')} title={t('Vista para celular')}>
              <Smartphone size={14} /> {t('Vista Mesero')}
            </Button>
          )}
          {isAdmin && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={14} /> {t('Nueva Mesa')}
            </Button>
          )}
        </div>
      </div>

      {/* Mesa Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-4">
        {mesas.map((mesa) => (
          <div key={mesa.id} className={cn('bg-card border-2 rounded-xl p-3.5 sm:p-4 flex flex-col gap-3 transition-all', getMesaBorder(mesa))}>
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <span className="text-lg font-bold text-foreground whitespace-nowrap">{t('Mesa')} {mesa.numero}</span>
              <div className="flex items-center gap-1.5 ml-auto">
                <StatusBadge variant={mesa.estado.toLowerCase()} />
                {isAdmin && (
                  <button onClick={() => openEdit(mesa)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    aria-label={t('Editar mesa {n}', { n: mesa.numero })}>
                    <Pencil size={12} />
                  </button>
                )}
              </div>
            </div>

            <div className="text-xs text-muted-foreground">{mesa.capacidad} {t('personas')}</div>

            {mesa.estado === 'OCUPADA' && (
              <div className="space-y-1">
                {mesa.pedidoActivo?.mesero?.nombre && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <User size={12} /> {t('Pedido registrado por')}: {mesa.pedidoActivo.mesero.nombre}
                    {mesa.pedidoActivo.mesero.rol ? ` (${rolLabel(mesa.pedidoActivo.mesero.rol)})` : ''}
                  </div>
                )}
                {mesa.pedidoActivo?.cocineroNombre && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {t('Готовность отметил')}: {mesa.pedidoActivo.cocineroNombre}
                  </div>
                )}
                {mesa.timerRestante != null && (
                  <div className="flex items-center gap-1.5 text-xs font-medium" style={getTimerColor(mesa.timerRestante)}>
                    <Clock size={12} />
                    {mesa.timerRestante <= 0 ? t('TIEMPO AGOTADO') : t('{n} min restantes', { n: mesa.timerRestante })}
                  </div>
                )}
              </div>
            )}

            <div className="mt-auto space-y-1.5">
              {mesa.estado === 'LIBRE' ? (
                <Button size="sm" className="w-full" onClick={() => navigate(`/pedidos/nuevo?mesaId=${mesa.id}`)}>
                  {t('Asignar Pedido')}
                </Button>
              ) : !mesa.pedidoActivo ? (
                <>
                  <div className="text-xs text-center text-muted-foreground">{t('Sin pedido activo')}</div>
                  {isAdmin && <Button size="sm" variant="secondary" className="w-full" loading={liberarSinPedido.isPending}
                    onClick={() => liberarSinPedido.mutate(mesa.id)}>{t('Liberar mesa')}</Button>}
                </>
              ) : mesa.pedidoActivo?.estado === 'LISTO' ? (
                <>
                  <div className="text-xs text-center font-semibold text-success py-0.5">{t('✓ Listo para servir')}</div>
                  {can(rol, 'mesero') ? (
                    <Button size="sm" className="w-full" loading={entregar.isPending}
                      onClick={() => entregar.mutate(mesa.pedidoActivo!.id)}>
                      {t('Entregar al cliente')}
                    </Button>
                  ) : (
                    <div className="text-xs text-center text-muted-foreground">{t('Esperando entrega en sala')}</div>
                  )}
                  <button onClick={() => openAdd(mesa)}
                    className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-1 hover:bg-muted rounded-lg transition-colors">
                    <Plus size={10} /> {t('Añadir productos')}
                  </button>
                </>
              ) : mesa.pedidoActivo?.estado === 'ENTREGADO' ? (
                <>
                  <div className="text-xs text-center font-medium text-info py-0.5">{t('Entregado — esperando pago')}</div>
                  <button onClick={() => printOrder('cuenta', mesa.pedidoActivo!)}
                    className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-1 hover:bg-muted rounded-lg transition-colors">
                    <FileText size={11} /> {t('Cuenta previa')}
                  </button>
                  {can(rol, 'caja') && (
                    <Button size="sm" variant="secondary" className="w-full border-success/50 text-success hover:bg-success/10"
                      onClick={() => openPago(mesa)}>
                      <CreditCard size={13} /> {t('Cliente pagó')}
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <div className="text-xs text-center text-muted-foreground py-0.5">
                    {mesa.pedidoActivo?.estado === 'EN_COCINA' ? t('🍳 En cocina...') :
                     mesa.pedidoActivo?.estado === 'EN_PREPARACION' ? t('👨‍🍳 Preparando · {n} min', { n: minutesSince(mesa.pedidoActivo.tiempoInicio, now) }) : t('Ocupada')}
                  </div>
                  {mesa.pedidoActivo && (
                    <button onClick={() => openAdd(mesa)}
                      className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-1.5 hover:bg-muted rounded-lg transition-colors border border-border">
                      <ShoppingCart size={11} /> {t('Añadir productos')}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Modal Nueva Mesa ── */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t('Nueva Mesa')}>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">{t('Número de mesa')}</label>
            <input type="number" value={numero} onChange={(e) => setNumero(e.target.value)}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={t('Ej: 13')} autoFocus />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">{t('Capacidad (personas)')}</label>
            <input type="number" value={capacidad} onChange={(e) => setCapacidad(e.target.value)}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowCreate(false)}>{t('Cancelar')}</Button>
            <Button className="flex-1" loading={createMesa.isPending} onClick={() => createMesa.mutate()}>{t('Crear Mesa')}</Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Editar Mesa ── */}
      <Modal open={!!editMesa} onClose={() => setEditMesa(null)} title={t('Editar Mesa {n}', { n: editMesa?.numero ?? '' })}>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">{t('Número de mesa')}</label>
            <input type="number" value={editNumero} onChange={(e) => setEditNumero(e.target.value)}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" autoFocus />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">{t('Capacidad (personas)')}</label>
            <input type="number" value={editCapacidad} onChange={(e) => setEditCapacidad(e.target.value)}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setEditMesa(null)}>{t('Cancelar')}</Button>
            <Button className="flex-1" loading={updateMesaMut.isPending}
              onClick={() => editMesa && updateMesaMut.mutate({ id: editMesa.id, numero: parseInt(editNumero), capacidad: parseInt(editCapacidad) })}>
              {t('Guardar cambios')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Registrar Pago ── */}
      <Modal open={!!pagoMesa && can(rol, 'caja')} onClose={() => setPagoMesa(null)} title={t('Pago — Mesa {n}', { n: pagoMesa?.numero ?? '' })}>
        <div className="space-y-4">
          {pagoMesa?.pedidoActivo && (
            <div className="bg-muted rounded-xl p-3">
              <p className="text-sm text-muted-foreground mb-1">{t('Total a cobrar')}</p>
              {Number(pagoMesa.pedidoActivo.servicePercent ?? 0) > 0 && <p className="text-sm text-muted-foreground">{t('Обслуживание {n}%', { n: Number(pagoMesa.pedidoActivo.servicePercent) })}: {fmtMoney(Number(pagoMesa.pedidoActivo.serviceAmount ?? 0))}</p>}
              <p className="text-2xl font-bold text-foreground">{fmtMoney(Number(pagoMesa.pedidoActivo.total ?? 0))}</p>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">{t('Método de pago')}</label>
            <div className="grid grid-cols-2 gap-2">
              {METODOS_PAGO.map((m) => (
                <button key={m} onClick={() => setMetodoPago(m)}
                  className={cn('px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors',
                    metodoPago === m ? 'bg-primary text-white border-primary' : 'bg-muted text-muted-foreground border-border hover:text-foreground')}>
                  {t(m)}
                </button>
              ))}
            </div>
          </div>
          {metodoPago === 'QR' && pagoMesa?.pedidoActivo && <PayQr total={Number(pagoMesa.pedidoActivo.total ?? 0)} numero={pagoMesa.pedidoActivo.numero} />}
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setPagoMesa(null)}>{t('Cancelar')}</Button>
            <Button className="flex-1" loading={registrarPago.isPending}
              onClick={() => pagoMesa?.pedidoActivo && registrarPago.mutate({ pedidoId: pagoMesa.pedidoActivo.id, metodo: metodoPago })}>
              {t('Confirmar pago')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Añadir productos a pedido activo ── */}
      <Modal open={!!addMesa} onClose={closeAddModal} title={t('Añadir a Mesa {n}', { n: addMesa?.numero ?? '' })}>
        <div className="space-y-3">
          <SearchInput value={search} onChange={setSearch} autoFocus />

          {/* Filtro categoría */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setCatFiltro('todas')}
              className={cn('px-3 py-1 rounded-full text-xs font-medium transition-colors',
                catFiltro === 'todas' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground')}>
              {t('Todos')}
            </button>
            {categorias.map((c) => (
              <button key={c.id} onClick={() => setCatFiltro(c.id)}
                className={cn('px-3 py-1 rounded-full text-xs font-medium transition-colors',
                  catFiltro === c.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground')}>
                {c.nombre}
              </button>
            ))}
          </div>

          {/* Lista de productos */}
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {prodVisibles.map((prod) => {
              const qty = carrito[prod.id] ?? 0;
              return (
                <div key={prod.id} className="flex items-center gap-3 bg-muted/50 rounded-xl p-2">
                  {prod.imagen ? (
                    <img src={prod.imagen} alt={prod.nombre} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate"><Highlight text={prod.nombre} ranges={found.ranges.get(prod.id)} /></p>
                    <p className="text-xs text-primary font-semibold">{formatCurrency(Number(prod.precio))}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => cambiarCantidad(prod.id, -1)}
                      className="w-7 h-7 rounded-full bg-muted hover:bg-error/20 text-foreground font-bold flex items-center justify-center transition-colors">
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-bold text-foreground">{qty}</span>
                    <button onClick={() => cambiarCantidad(prod.id, 1)}
                      className="w-7 h-7 rounded-full bg-muted hover:bg-success/20 text-foreground font-bold flex items-center justify-center transition-colors">
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Resumen carrito */}
          {itemsCarrito > 0 && (
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 space-y-1">
              <div className="flex items-center justify-between"><span className="text-sm text-foreground">{t('Productos seleccionados: {n}', { n: itemsCarrito })}</span><span>{formatCurrency(totalCarrito)}</span></div>
              {addMesa?.pedidoActivo && Number(addMesa.pedidoActivo.servicePercent ?? 0) > 0 && <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{t('Обслуживание {n}%', { n: Number(addMesa.pedidoActivo.servicePercent) })}</span>
                <span>{formatCurrency(addedServiceCharge(addMesa.pedidoActivo, totalCarrito))}</span>
              </div>}
              <div className="flex items-center justify-between font-bold text-primary"><span>{t('Итого добавится')}</span><span>{formatCurrency(totalCarrito + (addMesa?.pedidoActivo ? addedServiceCharge(addMesa.pedidoActivo, totalCarrito) : 0))}</span></div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={closeAddModal}>{t('Cancelar')}</Button>
            <Button className="flex-1" loading={addItems.isPending} disabled={itemsCarrito === 0}
              onClick={() => addMesa?.pedidoActivo && addItems.mutate({
                pedidoId: addMesa.pedidoActivo.id,
                items: Object.entries(carrito).map(([productoId, cantidad]) => ({ productoId, cantidad })),
              })}>
              <ShoppingCart size={14} /> {t('Añadir al pedido')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
