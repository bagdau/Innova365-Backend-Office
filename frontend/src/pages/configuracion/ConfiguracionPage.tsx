import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Button } from '../../components/ui/Button';
import { mesasService } from '../../services/mesas.service';
import { reportesService } from '../../services/reportes.service';
import type { Restaurante, Mesa } from '../../types';
import toast from 'react-hot-toast';
import { cn } from '../../utils/cn';
import { Select } from '../../components/ui/Select';
import { t, apiError } from '../../i18n';
import PrintersSettings from './PrintersSettings';
import { CURRENCIES, currencyName } from '../../lib/currency';

const TABS = ['General', 'Pagos y moneda', 'Mesas', 'Impresoras', 'Notificaciones'];

export default function ConfiguracionPage() {
  const [tab, setTab] = useState('General');
  const [timer, setTimer] = useState<number>(45);
  const qc = useQueryClient();

  const { data: restaurante } = useQuery<Restaurante>({ queryKey: ['restaurante'], queryFn: reportesService.getRestaurante });
  const { data: mesas = [] } = useQuery<Mesa[]>({ queryKey: ['mesas'], queryFn: mesasService.getAll });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();
  useEffect(() => {
    if (restaurante) {
      reset(restaurante);
      setTimer(restaurante.timerMesa ?? 45);
    }
  }, [restaurante]);

  const saveGeneral = useMutation({
    mutationFn: (data: any) => reportesService.updateRestaurante(data),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ['restaurante'] });
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success(t('Configuración guardada'));
      if (r?.correos?.cambios > 0) toast.success(t('Correos del personal actualizados: {n} → @{d}', { n: r.correos.cambios, d: r.correos.dominio }), { duration: 8000 });
    },
    onError: () => toast.error(t('Error al guardar')),
  });

  const saveTimer = useMutation({
    mutationFn: () => reportesService.updateRestaurante({ timerMesa: timer }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['restaurante'] }); toast.success(t('Timer actualizado')); },
    onError: () => toast.error(t('Error al guardar')),
  });

  const [moneda, setMoneda] = useState('KZT');
  const [qrPago, setQrPago] = useState('');
  useEffect(() => {
    if (restaurante) { setMoneda((restaurante as any).moneda ?? 'KZT'); setQrPago((restaurante as any).qrPago ?? ''); }
  }, [restaurante]);
  const savePagos = useMutation({
    mutationFn: () => reportesService.updateRestaurante({ moneda, qrPago: qrPago.trim() || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['restaurante'] }); toast.success(t('Configuración guardada')); },
    onError: (e) => toast.error(apiError(e, 'Error al guardar')),
  });

  const delMesa = useMutation({
    mutationFn: (id: string) => mesasService.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mesas'] }); toast.success(t('Mesa eliminada')); },
  });

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-6">
      {/* Разделы: на телефоне — горизонтальная лента, на планшете/десктопе — колонка слева */}
      <div className="md:w-44 md:flex-shrink-0 flex md:block gap-1.5 md:space-y-1 overflow-x-auto pb-1 md:pb-0 -mx-1 px-1">
        {TABS.map((tabName) => (
          <button key={tabName} onClick={() => setTab(tabName)}
            className={cn('md:w-full text-left px-3 py-2.5 rounded-m text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0', tab === tabName ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}>
            {t(tabName)}
          </button>
        ))}
      </div>

      <div className="flex-1 min-w-0">
        {tab === 'General' && (
          <div className="bg-card border border-border rounded-l p-6">
            <h3 className="text-base font-semibold text-foreground mb-5">{t('Datos del restaurante')}</h3>
            <form onSubmit={handleSubmit((d) => saveGeneral.mutate(d))} className="space-y-4 max-w-lg">
              {[['nombre', t('Nombre del restaurante')], ['direccion', t('Dirección')], ['telefono', t('Teléfono')], ['pieTicket', t('Texto al pie del recibo')], ['qrTicket', t('Contenido del QR en el recibo (enlace)')]].map(([field, label]) => (
                <div key={field}>
                  <label className="text-sm font-medium text-foreground block mb-1.5">{label}</label>
                  <input {...register(field)} className="w-full bg-muted border border-border rounded-m px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
                  {field === 'nombre' && <p className="text-xs text-muted-foreground mt-1">{t('Al cambiar el nombre, los correos del personal reciben el nuevo dominio (nombre@restaurante.com). Hay que entrar con el correo nuevo.')}</p>}
                </div>
              ))}
              <Button type="submit" loading={isSubmitting}>{t('Guardar cambios')}</Button>
            </form>
          </div>
        )}

        {tab === 'Pagos y moneda' && (
          <div className="bg-card border border-border rounded-l p-6 space-y-6 max-w-lg">
            <div>
              <h3 className="text-base font-semibold text-foreground mb-1">{t('Moneda del restaurante')}</h3>
              <p className="text-sm text-muted-foreground mb-3">{t('Todos los precios, recibos e informes se muestran en esta moneda. Los importes guardados no se convierten: si cambias la moneda, revisa los precios del menú.')}</p>
              <Select value={moneda} onChange={setMoneda} searchable
                options={CURRENCIES.map((c) => ({ value: c.code, label: `${currencyName(c.code)} — ${c.code} (${c.symbol})`, text: `${currencyName(c.code)} ${c.code}` }))} />
              <p className="text-xs text-muted-foreground mt-2">{t('Ejemplo')}: {(() => { const c = CURRENCIES.find((x) => x.code === moneda); if (!c) return ''; const n = new Intl.NumberFormat(undefined, { minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals }).format(1500.5); return 'before' in c && c.before ? `${c.symbol}${n}` : `${n} ${c.symbol}`; })()}</p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground mb-1">{t('QR para pago')}</h3>
              <p className="text-sm text-muted-foreground mb-3">{t('Enlace o datos que se codifican en el QR al pagar con «QR». Puedes usar {total}, {numero}, {moneda}, {restaurante}.')}</p>
              <input value={qrPago} onChange={(e) => setQrPago(e.target.value)} placeholder="https://pay.example.com/shop?amount={total}"
                className="w-full bg-muted border border-border rounded-m px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <Button loading={savePagos.isPending} onClick={() => savePagos.mutate()}>{t('Guardar cambios')}</Button>
          </div>
        )}

        {tab === 'Mesas' && (
          <div className="bg-card border border-border rounded-l p-6">
            <h3 className="text-base font-semibold text-foreground mb-5">{t('Gestión de mesas')}</h3>
            <div className="mb-4 flex items-end gap-3">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">{t('Timer de mesa (minutos)')}</label>
                <input
                  type="number"
                  value={timer}
                  onChange={(e) => setTimer(parseInt(e.target.value) || 45)}
                  className="w-32 bg-muted border border-border rounded-m px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <Button size="sm" loading={saveTimer.isPending} onClick={() => saveTimer.mutate()}>
                {t('Guardar timer')}
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {mesas.map((m) => (
                <div key={m.id} className="bg-muted border border-border rounded-m p-3 flex flex-col items-center gap-2">
                  <span className="font-bold text-foreground">{t('Mesa')} {m.numero}</span>
                  <span className="text-xs text-muted-foreground">{m.capacidad} {t('personas')}</span>
                  <button onClick={() => delMesa.mutate(m.id)} className="text-xs text-error hover:underline">{t('Eliminar')}</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'Impresoras' && <PrintersSettings />}

        {tab === 'Notificaciones' && (
          <div className="bg-card border border-border rounded-l p-6">
            <h3 className="text-base font-semibold text-foreground mb-5">{t('Preferencias de notificación')}</h3>
            <div className="space-y-4">
              {[t('Pedido listo para entregar'), t('Stock bajo en inventario'), t('Nuevo usuario registrado'), t('Mesa con timer vencido')].map((item) => (
                <div key={item} className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{item}</span>
                  <input type="checkbox" defaultChecked className="accent-primary w-4 h-4" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
