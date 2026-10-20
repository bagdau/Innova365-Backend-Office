import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Search, Wifi, Printer, CheckCircle2, AlertTriangle, XCircle, ChevronDown } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { impresionService, type EstadoPrinter } from '../../services/impresion.service';
import { cn } from '../../utils/cn';
import { t, apiError } from '../../i18n';

const inputCls = 'w-full bg-muted border border-border rounded-m px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary';
const KEY = 'innova365-subnet';

/** Подсеть по умолчанию: из адреса, по которому открыто приложение (если это IPv4), иначе последняя использованная. */
function defaultSubnet(): string {
  const h = window.location.hostname;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return h.split('.').slice(0, 3).join('.');
  try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; }
}

function EstadoBadge({ e }: { e: EstadoPrinter }) {
  if (!e.escpos) return <span className="text-[11px] px-2 py-0.5 rounded-full bg-warning-bg text-warning">{t('Puerto abierto, estado no disponible')}</span>;
  return (
    <div className="flex gap-1.5 flex-wrap">
      <span className="text-[11px] px-2 py-0.5 rounded-full bg-success-bg text-success">{t('Impresora ESC/POS')}</span>
      <span className={cn('text-[11px] px-2 py-0.5 rounded-full', e.enLinea ? 'bg-success-bg text-success' : 'bg-error-bg text-error')}>{e.enLinea ? t('En línea') : t('Fuera de línea')}</span>
      {e.papel && <span className={cn('text-[11px] px-2 py-0.5 rounded-full', e.papel === 'ok' ? 'bg-success-bg text-success' : e.papel === 'poco' ? 'bg-warning-bg text-warning' : 'bg-error-bg text-error')}>
        {e.papel === 'ok' ? t('Papel: hay') : e.papel === 'poco' ? t('Papel: poco') : t('Papel: se acabó')}
      </span>}
    </div>
  );
}

export function DiscoverPrinters({ open, onClose, onPick }: {
  open: boolean; onClose: () => void; onPick: (ip: string, puerto: number, nombre: string) => void;
}) {
  const [subred, setSubred] = useState(defaultSubnet);
  const [manual, setManual] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);

  const scan = useMutation({
    mutationFn: () => impresionService.descubrir(subred.trim()),
    onSuccess: (r) => { try { localStorage.setItem(KEY, r.subred); } catch { /* ignore */ } setSubred(r.subred); },
  });
  const check = useMutation({ mutationFn: () => impresionService.comprobar(manual.trim(), 9100) });

  // при открытии окна сразу ищем (если знаем подсеть)
  useEffect(() => {
    if (open) { scan.reset(); check.reset(); if (subred) scan.mutate(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const hosts = scan.data?.hosts ?? [];

  return (
    <Modal open={open} onClose={onClose} title={t('Buscar impresoras en la red')} width="max-w-2xl">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t('¿La impresora está conectada por cable Ethernet al router? Pulsa «Escanear»: la aplicación buscará en tu red dispositivos con el puerto 9100 abierto (el estándar de las impresoras de recibos).')}
        </p>

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground block mb-1">{t('Red local')}</label>
            <div className="flex items-center gap-1">
              <input value={subred} onChange={(e) => setSubred(e.target.value)} placeholder="192.168.1" className={inputCls} inputMode="decimal" />
              <span className="text-sm text-muted-foreground whitespace-nowrap">.1 – .254</span>
            </div>
          </div>
          <Button loading={scan.isPending} disabled={!subred.trim()} onClick={() => scan.mutate()}><Search size={14} /> {t('Escanear')}</Button>
        </div>
        {!subred && <p className="text-xs text-warning">{t('Indica los tres primeros números de tu red, por ejemplo 192.168.1 (están en la dirección IP de este equipo).')}</p>}

        {scan.isPending && <p className="text-sm text-muted-foreground flex items-center gap-2"><Wifi size={15} className="animate-pulse" /> {t('Revisando 254 direcciones…')}</p>}
        {scan.isError && <p className="text-sm text-error">{apiError(scan.error, 'Error al guardar')}</p>}

        {scan.isSuccess && hosts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{t('Encontrado: {n} ({ms} ms)', { n: hosts.length, ms: scan.data!.ms })}</p>
            {hosts.map((h) => (
              <div key={h.ip} className="flex items-center gap-3 border border-border rounded-l p-3 bg-muted/30">
                <Printer size={20} className={h.estado.escpos ? 'text-success' : 'text-muted-foreground'} />
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="font-semibold text-foreground">{h.ip}<span className="text-xs text-muted-foreground font-normal"> : {h.puerto}{h.web ? ` · ${h.web}` : ''}</span></p>
                  <EstadoBadge e={h.estado} />
                </div>
                <Button size="sm" onClick={() => onPick(h.ip, h.puerto, h.web && h.web.length < 30 ? `${h.web} (${h.ip})` : `${t('Impresora')} ${h.ip}`)}>{t('Conectar')}</Button>
              </div>
            ))}
          </div>
        )}

        {scan.isSuccess && hosts.length === 0 && (
          <div className="border border-warning/40 bg-warning-bg/40 rounded-l p-4 space-y-2">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2"><AlertTriangle size={16} className="text-warning" /> {t('No se encontró ninguna impresora en {red}.x', { red: scan.data!.subred })}</p>
            <ol className="text-sm text-foreground list-decimal pl-5 space-y-1">
              <li>{t('La impresora está encendida y el cable Ethernet va al router (en el conector deben parpadear los indicadores).')}</li>
              <li>{t('Imprime la hoja de autodiagnóstico: apaga la impresora, mantén pulsado FEED y enciéndela. En la hoja aparece su dirección IP.')}</li>
              <li>{t('La IP debe empezar igual que tu red ({red}.x). Si empieza distinto (por ejemplo 192.168.123.100), hay que cambiarla: ver «Cómo cambiar la IP» abajo.')}</li>
              <li>{t('Escribe esa IP en «Comprobar una dirección» y pulsa «Comprobar».')}</li>
            </ol>
          </div>
        )}

        <div className="border-t border-border pt-4 space-y-2">
          <label className="text-sm font-medium text-foreground block">{t('Comprobar una dirección')}</label>
          <div className="flex gap-2">
            <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="192.168.1.50" className={inputCls} inputMode="decimal" />
            <Button variant="secondary" loading={check.isPending} disabled={!manual.trim()} onClick={() => check.mutate()}>{t('Comprobar')}</Button>
          </div>
          {check.isError && <p className="text-sm text-error">{apiError(check.error, 'Dirección de impresora inválida')}</p>}
          {check.data && (
            <div className={cn('flex items-center gap-3 rounded-l p-3 border', check.data.alcanzable ? 'border-success/40 bg-success-bg/40' : 'border-error/40 bg-error-bg/40')}>
              {check.data.alcanzable ? <CheckCircle2 size={18} className="text-success flex-shrink-0" /> : <XCircle size={18} className="text-error flex-shrink-0" />}
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm text-foreground">{check.data.alcanzable ? t('{ip} responde en el puerto 9100', { ip: check.data.host }) : t('{ip} no responde. Revisa el cable, la IP y que esté en la misma red.', { ip: check.data.host })}</p>
                {!check.data.alcanzable && subred.trim() && check.data.host.split('.').slice(0, 3).join('.') !== subred.trim() && (
                  <p className="text-xs text-warning">{t('La IP {ip} es de otra red ({otra}.x), distinta a la de este servidor ({red}.x). Conecta el PC del servidor por cable al router de la impresora, o mueve la impresora a la red {red}.x.', { ip: check.data.host, otra: check.data.host.split('.').slice(0, 3).join('.'), red: subred.trim() })}</p>
                )}
                {check.data.alcanzable && <EstadoBadge e={check.data.estado} />}
              </div>
              {check.data.alcanzable && <Button size="sm" onClick={() => onPick(check.data!.host, check.data!.puerto, `${t('Impresora')} ${check.data!.host}`)}>{t('Conectar')}</Button>}
            </div>
          )}
        </div>

        <div className="border border-border rounded-l">
          <button type="button" onClick={() => setHelpOpen((v) => !v)} className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground">
            {t('Cómo cambiar la IP de la impresora')}
            <ChevronDown size={16} className={cn('transition-transform', helpOpen && 'rotate-180')} />
          </button>
          {helpOpen && (
            <div className="px-4 pb-4 text-sm text-foreground space-y-2">
              <p className="text-muted-foreground">{t('Muchas impresoras de red vienen con una IP fija de fábrica de otra red (por ejemplo 192.168.123.100) y el router no las ve. Hay que darles una IP de tu red.')}</p>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>{t('Conecta la impresora al router y añade al PC una IP temporal de su red (PowerShell como administrador):')}
                  <code className="block mt-1 bg-muted rounded-m px-2 py-1.5 text-xs select-all">netsh interface ip add address "Ethernet" 192.168.123.10 255.255.255.0</code></li>
                <li>{t('Abre en el navegador la IP de la impresora (por ejemplo http://192.168.123.100) y en los ajustes de red pon una IP libre de tu red (por ejemplo {red}.200), máscara 255.255.255.0 y puerta de enlace = IP del router.', { red: subred.trim() || '192.168.1' })}</li>
                <li>{t('Guarda, reinicia la impresora y quita la IP temporal:')}
                  <code className="block mt-1 bg-muted rounded-m px-2 py-1.5 text-xs select-all">netsh interface ip delete address "Ethernet" 192.168.123.10</code></li>
                <li>{t('Escanea de nuevo. Recomendado: en el router reserva esa IP para la impresora (DHCP) para que no cambie.')}</li>
              </ol>
              <p className="text-xs text-muted-foreground">{t('Si la impresora no tiene página web de ajustes, usa la utilidad del fabricante (Printer Net Tool / NetSet) o el manual de tu modelo.')}</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
