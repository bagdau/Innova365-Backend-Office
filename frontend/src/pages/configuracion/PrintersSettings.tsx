import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Printer, Usb, Network, Monitor, Search, CheckCircle2, XCircle, Wifi } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { impresionService, type Impresora, type ImpresoraInput, type PrinterWindows, type UsoImpresora } from '../../services/impresion.service';
import { fmtDateTime } from '../../lib/print';
import { DevicePrinter } from '../../components/shared/DevicePrinter';
import { DiscoverPrinters } from './DiscoverPrinters';
import { cn } from '../../utils/cn';
import { Select } from '../../components/ui/Select';

const ANCHOS = [{ value: '80', label: '80 mm' }, { value: '90', label: '90 mm' }, { value: '58', label: '58 mm' }];
import { t, apiError, printLang as lang } from '../../i18n';

const inputCls = 'w-full bg-muted border border-border rounded-m px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary';
const USOS: Array<{ id: UsoImpresora; label: () => string }> = [
  { id: 'RECIBO', label: () => t('Recibos') },
  { id: 'CUENTA', label: () => t('Cuentas previas') },
  { id: 'COCINA', label: () => t('Tickets de cocina') },
  { id: 'REPORTE', label: () => t('Resúmenes del día') },
];
const TIPOS = [
  { id: 'RED' as const, icon: Network, title: () => t('Red (LAN / Wi-Fi)'), hint: () => t('Impresora con IP, puerto 9100') },
  { id: 'AGENTE' as const, icon: Usb, title: () => t('USB / Windows'), hint: () => t('Mediante el agente en el PC con la impresora') },
  { id: 'NAVEGADOR' as const, icon: Monitor, title: () => t('Navegador'), hint: () => t('Diálogo de impresión del sistema (A4, cualquier impresora)') },
];

const EMPTY: ImpresoraInput = {
  nombre: '', tipo: 'RED', host: '', puerto: 9100, nombreSistema: '', token: '', ancho: 80, codepage: 'cp866',
  usos: ['RECIBO', 'CUENTA'], corte: true, cajon: false, copias: 1, auto: false, activa: true,
};

export default function PrintersSettings() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<{ id?: string; data: ImpresoraInput } | null>(null);
  const [found, setFound] = useState<PrinterWindows[] | null>(null);
  const [discover, setDiscover] = useState(false);
  const [linkMsg, setLinkMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data: printers = [], isLoading } = useQuery({ queryKey: ['impresoras'], queryFn: impresionService.list });
  const { data: trabajos = [] } = useQuery({ queryKey: ['impresoras', 'trabajos'], queryFn: impresionService.trabajos, refetchInterval: 30_000 });

  const save = useMutation({
    mutationFn: () => {
      const d = { ...edit!.data };
      if (d.tipo === 'RED') { d.nombreSistema = null; d.token = null; }
      return edit!.id ? impresionService.update(edit!.id, d) : impresionService.create(d);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['impresoras'] }); setEdit(null); setFound(null); toast.success(t('Impresora guardada')); },
    onError: (e) => toast.error(apiError(e, 'Error al guardar')),
  });

  const del = useMutation({
    mutationFn: (id: string) => impresionService.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['impresoras'] }); toast.success(t('Impresora eliminada')); },
    onError: (e) => toast.error(apiError(e, 'Error al eliminar')),
  });

  const probar = useMutation({
    mutationFn: (id: string) => impresionService.prueba(id, lang),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['impresoras', 'trabajos'] });
      r.ok ? toast.success(t('Página de prueba impresa ({ms} ms)', { ms: r.ms })) : toast.error(`${t('No se pudo imprimir')}${r.detalle ? ' — ' + r.detalle : ''}`, { duration: 8000 });
    },
    onError: (e) => toast.error(apiError(e, 'No se pudo imprimir')),
  });

  const buscar = useMutation({
    mutationFn: () => impresionService.agente(String(edit!.data.host ?? ''), edit!.data.token ? String(edit!.data.token) : undefined),
    onSuccess: (list) => { setFound(list); if (!list.length) toast(t('No se encontraron impresoras')); },
    onError: (e) => toast.error(apiError(e, 'El agente de impresión no respondió')),
  });

  const set = (patch: Partial<ImpresoraInput>) => setEdit((s) => s && { ...s, data: { ...s.data, ...patch } });
  const d = edit?.data;
  const toggleUso = (u: UsoImpresora) => set({ usos: d!.usos!.includes(u) ? d!.usos!.filter((x) => x !== u) : [...d!.usos!, u] });
  const canSave = !!d && d.nombre!.trim().length >= 2 && (d.tipo === 'NAVEGADOR' || !!String(d.host ?? '').trim()) && (d.tipo !== 'AGENTE' || !!String(d.nombreSistema ?? '').trim());

  const openNew = () => { setFound(null); setLinkMsg(null); setEdit({ data: { ...EMPTY } }); };
  const pick = (ip: string, puerto: number, nombre: string) => { setDiscover(false); setFound(null); setLinkMsg(null); setEdit({ data: { ...EMPTY, nombre, host: ip, puerto } }); };
  const comprobarLink = async () => {
    if (!d?.host) return;
    setLinkMsg(null);
    try {
      const r = await impresionService.comprobar(String(d.host).trim(), d.puerto ?? 9100);
      setLinkMsg(r.alcanzable ? { ok: true, text: r.estado.escpos ? t('Conexión correcta: impresora en línea') : t('El puerto responde, pero el dispositivo no contestó como impresora') } : { ok: false, text: t('No hay conexión. Revisa el cable, la IP y la red.') });
    } catch (e) { setLinkMsg({ ok: false, text: apiError(e, 'Dirección de impresora inválida') }); }
  };
  const openEdit = (p: Impresora) => { setLinkMsg(null); setFound(null); setEdit({ id: p.id, data: { ...p, token: p.tieneToken ? '••••••' : '' } }); };

  return (
    <div className="space-y-5">
      <div className="bg-card border border-border rounded-l p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">{t('Impresoras')}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{t('Recibos, tickets de cocina y reportes. Si no hay impresora de caja, se usa el diálogo del navegador.')}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={() => setDiscover(true)}><Wifi size={14} /> {t('Buscar en la red')}</Button>
            <Button size="sm" onClick={openNew}><Plus size={14} /> {t('Añadir impresora')}</Button>
          </div>
        </div>

        <div className="mb-4 pb-4 border-b border-border"><DevicePrinter /><p className="text-[11px] text-muted-foreground mt-1">{t('Cada caja puede imprimir en su propia impresora: elige aquí la de este equipo.')}</p></div>

        {isLoading && <p className="text-sm text-muted-foreground">{t('Cargando...')}</p>}
        {!isLoading && printers.length === 0 && (
          <div className="border border-dashed border-border rounded-l py-10 text-center text-muted-foreground">
            <Printer size={30} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">{t('Aún no hay impresoras. Los documentos se imprimen con el diálogo del navegador.')}</p>
            <Button size="sm" className="mt-4" onClick={() => setDiscover(true)}><Wifi size={14} /> {t('Buscar en la red')}</Button>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {printers.map((p) => {
            const T = TIPOS.find((x) => x.id === p.tipo)!;
            return (
              <div key={p.id} className={cn('border rounded-l p-4 space-y-2', p.activa ? 'border-border bg-muted/30' : 'border-border opacity-60')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <T.icon size={18} className="text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{p.nombre}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {T.title()}{p.host ? ` · ${p.host}${p.tipo === 'RED' ? ':' + p.puerto : ''}` : ''}{p.nombreSistema ? ` · ${p.nombreSistema}` : ''}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{p.ancho} mm</span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {p.usos.map((u) => <span key={u} className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{USOS.find((x) => x.id === u)?.label()}</span>)}
                  {p.auto && <span className="text-[11px] px-2 py-0.5 rounded-full bg-success-bg text-success">{t('Auto')}</span>}
                  {p.cajon && <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{t('Cajón')}</span>}
                  {!p.activa && <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{t('Apagada')}</span>}
                </div>
                <div className="flex gap-2 pt-1">
                  {p.tipo !== 'NAVEGADOR' && <Button size="sm" variant="secondary" loading={probar.isPending && probar.variables === p.id} onClick={() => probar.mutate(p.id)}><Printer size={13} /> {t('Prueba')}</Button>}
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Pencil size={13} /> {t('Editar')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm(t('¿Eliminar esta impresora?'))) del.mutate(p.id); }}><Trash2 size={13} /></Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-card border border-border rounded-l p-6">
        <h3 className="text-base font-semibold text-foreground mb-3">{t('Registro de impresión')}</h3>
        {trabajos.length === 0 ? <p className="text-sm text-muted-foreground">{t('Aún no hay trabajos de impresión')}</p> : (
          <div className="divide-y divide-border max-h-64 overflow-y-auto">
            {trabajos.map((j) => (
              <div key={j.id} className="flex items-center gap-3 py-2 text-sm">
                {j.ok ? <CheckCircle2 size={15} className="text-success flex-shrink-0" /> : <XCircle size={15} className="text-error flex-shrink-0" />}
                <span className="text-foreground w-20 flex-shrink-0">{j.tipo}</span>
                <span className="text-muted-foreground flex-1 truncate">{j.impresora ?? '—'}{j.error ? ` — ${j.error}` : ''}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{j.ms ?? 0} ms · {fmtDateTime(j.creadoEn)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <DiscoverPrinters open={discover} onClose={() => setDiscover(false)} onPick={pick} />

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? t('Editar impresora') : t('Añadir impresora')} width="max-w-2xl">
        {d && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">{t('Nombre')} *</label>
              <input value={d.nombre ?? ''} onChange={(e) => set({ nombre: e.target.value })} placeholder={t('Ej: Caja 1')} className={inputCls} />
            </div>

            <div className="grid sm:grid-cols-3 gap-2">
              {TIPOS.map((x) => (
                <button key={x.id} type="button" onClick={() => { set({ tipo: x.id }); setFound(null); }}
                  className={cn('text-left p-3 rounded-l border transition-colors', d.tipo === x.id ? 'border-primary bg-primary/10' : 'border-border bg-muted/30 hover:bg-muted/60')}>
                  <x.icon size={18} className={d.tipo === x.id ? 'text-primary' : 'text-muted-foreground'} />
                  <p className="text-sm font-semibold text-foreground mt-1">{x.title()}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">{x.hint()}</p>
                </button>
              ))}
            </div>

            {d.tipo === 'RED' && (
              <div className="grid grid-cols-[1fr_110px] gap-3">
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">{t('Dirección IP de la impresora')} *</label>
                  <input value={d.host ?? ''} onChange={(e) => { set({ host: e.target.value }); setLinkMsg(null); }} placeholder="192.168.1.50" className={inputCls} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">{t('Puerto')}</label>
                  <input type="number" value={d.puerto ?? 9100} onChange={(e) => set({ puerto: Number(e.target.value) || 9100 })} className={inputCls} />
                </div>
                <div className="col-span-2 flex items-center gap-3">
                  <Button type="button" size="sm" variant="secondary" disabled={!String(d.host ?? '').trim()} onClick={comprobarLink}><Wifi size={14} /> {t('Comprobar conexión')}</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setEdit(null); setDiscover(true); }}><Search size={14} /> {t('Buscar en la red')}</Button>
                  {linkMsg && <span className={cn('text-xs', linkMsg.ok ? 'text-success' : 'text-error')}>{linkMsg.text}</span>}
                </div>
              </div>
            )}

            {d.tipo === 'AGENTE' && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground bg-muted/40 rounded-m p-3">
                  {t('Ejecuta «start-agent.bat» (carpeta print-agent) en el PC al que está conectada la impresora USB. Si es este mismo PC, la dirección es host.docker.internal:9101.')}
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1.5">{t('Dirección del agente')} *</label>
                    <input value={d.host ?? ''} onChange={(e) => set({ host: e.target.value })} placeholder="192.168.1.20:9101" className={inputCls} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1.5">{t('Token del agente')}</label>
                    <input value={d.token ?? ''} onChange={(e) => set({ token: e.target.value })} className={inputCls} autoComplete="off" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">{t('Impresora en Windows')} *</label>
                  <div className="flex gap-2">
                    {found && found.length > 0 ? (
                      <Select value={d.nombreSistema ?? ''} onChange={(v) => set({ nombreSistema: v })}
                        options={[{ value: '', label: t('Seleccionar...') }, { value: 'auto', label: t('Auto (inteligente)') }, ...found.map((w) => ({ value: w.name, label: `${w.name}${w.isDefault ? ' ★' : ''}` }))]} />
                    ) : (
                      <input value={d.nombreSistema ?? ''} onChange={(e) => set({ nombreSistema: e.target.value })} placeholder="POS-80" className={inputCls} />
                    )}
                    <Button type="button" size="sm" variant="secondary" disabled={!String(d.host ?? '').trim()} loading={buscar.isPending} onClick={() => buscar.mutate()}><Search size={14} /> {t('Buscar')}</Button>
                  </div>
                </div>
              </div>
            )}

            {d.tipo === 'NAVEGADOR' && (
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">{t('Ancho del papel')}</label>
                <Select value={String(d.ancho)} onChange={(v) => set({ ancho: Number(v) })} options={ANCHOS} />
                <p className="text-xs text-muted-foreground mt-1">{t('Los recibos salen en rollo de este ancho; los reportes siempre en A4.')}</p>
              </div>
            )}

            {d.tipo !== 'NAVEGADOR' && (
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">{t('Ancho del papel')}</label>
                  <Select value={String(d.ancho)} onChange={(v) => set({ ancho: Number(v) })} options={ANCHOS} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">{t('Codificación')}</label>
                  <Select value={d.codepage ?? 'cp866'} onChange={(v) => set({ codepage: v as Impresora['codepage'] })}
                    options={[{ value: 'cp866', label: `CP866 (${t('cirílico')})` }, { value: 'cp1251', label: `CP1251 (${t('cirílico')})` }, { value: 'ascii', label: t('Latín (translit)') }]} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">{t('Copias')}</label>
                  <input type="number" min={1} max={5} value={d.copias ?? 1} onChange={(e) => set({ copias: Math.min(5, Math.max(1, Number(e.target.value) || 1)) })} className={inputCls} />
                </div>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-foreground mb-1.5">{t('Qué imprime')}</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {USOS.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm text-foreground bg-muted/40 rounded-m px-3 py-2 cursor-pointer">
                    <input type="checkbox" className="accent-primary" checked={d.usos!.includes(u.id)} onChange={() => toggleUso(u.id)} /> {u.label()}
                  </label>
                ))}
              </div>
            </div>

            {d.tipo !== 'NAVEGADOR' && (
              <div className="grid sm:grid-cols-3 gap-2 text-sm text-foreground">
                <label className="flex items-center gap-2 bg-muted/40 rounded-m px-3 py-2 cursor-pointer"><input type="checkbox" className="accent-primary" checked={!!d.corte} onChange={(e) => set({ corte: e.target.checked })} /> {t('Cortar papel')}</label>
                <label className="flex items-center gap-2 bg-muted/40 rounded-m px-3 py-2 cursor-pointer"><input type="checkbox" className="accent-primary" checked={!!d.cajon} onChange={(e) => set({ cajon: e.target.checked })} /> {t('Abrir cajón de dinero')}</label>
                <label className="flex items-center gap-2 bg-muted/40 rounded-m px-3 py-2 cursor-pointer"><input type="checkbox" className="accent-primary" checked={!!d.auto} onChange={(e) => set({ auto: e.target.checked })} /> {t('Imprimir automáticamente')}</label>
              </div>
            )}
            {d.auto && <p className="text-xs text-muted-foreground">{t('Automático: el ticket de cocina sale al crear el pedido y el recibo al cobrar.')}</p>}

            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer"><input type="checkbox" className="accent-primary" checked={!!d.activa} onChange={(e) => set({ activa: e.target.checked })} /> {t('Impresora activa')}</label>

            <div className="flex gap-3 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setEdit(null)}>{t('Cancelar')}</Button>
              <Button className="flex-1" disabled={!canSave} loading={save.isPending} onClick={() => save.mutate()}>{t('Guardar')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
