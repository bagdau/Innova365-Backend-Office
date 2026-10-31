import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer, X, Globe, Sparkles, AlertTriangle, RefreshCw, FileText, ScrollText, Search, Plus, MonitorSmartphone, Usb, Network, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePrintPanel, getQuickPrint, setQuickPrint } from '../../lib/printPanel';
import { layoutDocument, printSrcdoc, type Fit, type LayoutResult, type Orient, type Paper } from '../../lib/print';
import { impresionService, isStationPrinter, type EstadoImpresora, type HostEncontrado, type UsoImpresora } from '../../services/impresion.service';
import { getDevicePrinter, printStations, getStationsOff, setStationOff } from '../../lib/printClient';
import { probeAgent, agentPrinters, rawPrinterName, supportsRaw, printLocal, getLocalCfg, setLocalCfg, type LocalCfg } from '../../lib/localPrinter';
import { hasNativePrinter, systemPrinters, getNativePrinter, setNativePrinter, printNativeDocument } from '../../lib/nativePrinter';
import { Select } from '../ui/Select';
import { useIsMobile } from '../ui/Floating';
import { usbSupport, savedPrinter, connectUsbPrinter, printUsb } from '../../lib/usbPrinter';
import { getIpPrinters, selectedIpPrinter, setSelectedIp, addIpPrinter, removeIpPrinter, parseIp, discoverIp, printIp, getPref, setPref, type IpPrinter, type Pref } from '../../lib/ipPrinters';
import { printLang, apiError } from '../../i18n';
import { useAuthStore } from '../../store/authStore';
import { isAdminLike } from '../../auth/permissions';
import { cn } from '../../utils/cn';
import { t } from '../../i18n';

const PX_PER_MM = 96 / 25.4;
const USO: Record<string, UsoImpresora> = { recibo: 'RECIBO', cuenta: 'CUENTA', cocina: 'COCINA', cierre: 'REPORTE' };
const ROLLS = [58, 76, 80, 90];

const Seg = <T extends string | number>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { v: T; label: string }[] }) => (
  <div className="inline-flex rounded-m border border-border overflow-hidden bg-muted">
    {options.map((o) => (
      <button key={String(o.v)} type="button" data-sound="none" onClick={() => onChange(o.v)}
        className={cn('px-3 py-1.5 text-sm font-medium transition-colors', o.v === value ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground')}>
        {o.label}
      </button>
    ))}
  </div>
);

/** Предпросмотр, выбор чекового принтера и системная печать браузера. */
export function PrintPanel() {
  const { job, close } = usePrintPanel();
  const mobile = useIsMobile();
  const previewRef = useRef<HTMLIFrameElement>(null);

  // Кнопка «Назад» телефона (и стрелка браузера) закрывает окно печати, а не уводит со страницы.
  useEffect(() => {
    if (!job) return;
    const mark = { innovaPrint: Date.now() };
    try { history.pushState(mark, ''); } catch { return; }
    let own = true;
    const onPop = () => { own = false; close(); };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (own && (history.state as { innovaPrint?: number } | null)?.innovaPrint === mark.innovaPrint) history.back();
    };
  }, [job]); // eslint-disable-line react-hooks/exhaustive-deps
  const [target, setTarget] = useState<string>('browser');     // 'auto' | id принтера | 'browser'
  const [paper, setPaper] = useState<Paper>('A4');
  const [fit, setFit] = useState<Fit>('auto');
  const [orient, setOrient] = useState<Orient>('auto');
  const [layoutState, setLayoutState] = useState<{ job: object; paper: Paper; fit: Fit; orient: Orient; value: LayoutResult } | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [quick, setQuick] = useState(getQuickPrint());
  const box = useRef<HTMLDivElement>(null);
  const [boxSize, setBoxSize] = useState({ w: 320, h: 400 });
  const me = useAuthStore((s) => s.user);
  const layout = layoutState?.job === job && layoutState.paper === paper && layoutState.fit === fit && layoutState.orient === orient ? layoutState.value : null;
  // быстрая настройка сетевого принтера прямо из окна печати
  const [ipText, setIpText] = useState('');
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<HostEncontrado[] | null>(null);
  const [setupMsg, setSetupMsg] = useState('');
  const autoDone = useRef<object | null>(null);
  // принтер этого компьютера через агент (ESC/POS «родной» печатью)
  const [lcfg, setLcfg] = useState<LocalCfg>(getLocalCfg());
  const upd = (p: Partial<LocalCfg>) => { setLocalCfg(p); setLcfg(getLocalCfg()); };
  const { data: agent, refetch: refetchAgent } = useQuery({ queryKey: ['localAgent', lcfg.url], queryFn: () => probeAgent(lcfg.url), enabled: !!job?.server && lcfg.enabled, refetchInterval: job ? 8000 : false, staleTime: 3000 });
  const stationsPedido = job?.server?.pedidoId;
  const stationsOn = !!stationsPedido && (job?.server?.tipo === 'recibo' || job?.server?.tipo === 'cuenta');
  const { data: stationList = [] } = useQuery({ queryKey: ['stationsPreview', stationsPedido], queryFn: () => impresionService.estaciones(stationsPedido!, printLang), enabled: stationsOn, staleTime: 15000, retry: false });
  const [stOff, setStOff] = useState<string[]>(getStationsOff);
  const { data: winPrinters = [], isLoading: winPrintersLoading, isSuccess: winPrintersFetched, refetch: refetchWinPrinters } = useQuery({ queryKey: ['localAgentPrinters', lcfg.url], queryFn: () => agentPrinters(lcfg.url), enabled: !!job?.server && !!agent?.online && agent.allowed !== false, staleTime: 15000, retry: false });
  const nativeAvailable = hasNativePrinter();
  const { data: nativePrinters = [], isLoading: nativeLoading, refetch: refetchNative } = useQuery({ queryKey: ['nativeSystemPrinters'], queryFn: systemPrinters, enabled: !!job && nativeAvailable, staleTime: 5000, retry: false });
  const [testing, setTesting] = useState(false);
  // сетевые (IP) принтеры этого рабочего места
  const [ips, setIps] = useState<IpPrinter[]>(getIpPrinters());
  const [selIp, setSelIp] = useState<IpPrinter | null>(selectedIpPrinter());
  const refreshIps = () => { setIps(getIpPrinters()); setSelIp(selectedIpPrinter()); };
  const [ipInput, setIpInput] = useState('');
  const [ipFound, setIpFound] = useState<string[] | null>(null);
  const [ipScanning, setIpScanning] = useState(false);
  const addIp = (raw: string) => {
    const p = parseIp(raw);
    if (!p) { setErrors([t('Dirección de impresora inválida')]); return; }
    addIpPrinter(p.ip, p.port); refreshIps(); setIpInput(''); setIpFound(null); setErrors([]); setTarget('ip');
  };
  const scanIps = async () => {
    setIpScanning(true); setErrors([]); setIpFound(null);
    try {
      const f = (await discoverIp()).filter((ip) => !ips.some((x) => x.ip === ip));
      setIpFound(f);
      if (f.length === 0) setErrors([t('No se encontró ninguna impresora en la red')]);
    } catch (e) { setErrors([(e as Error).message === 'no-subnet' ? t('Para buscar en la red instala el agente print-agent en este equipo o escribe la IP a mano') : t('No se pudo imprimir')]); }
    finally { setIpScanning(false); }
  };
  // USB-принтер напрямую из браузера (WebUSB)
  const usbMode = usbSupport();
  const { data: usbSaved, refetch: refetchUsb } = useQuery({ queryKey: ['usbSaved'], queryFn: savedPrinter, enabled: !!job?.server && !nativeAvailable && usbMode === 'ok', staleTime: 3000 });
  const ipErr = (e: unknown) => {
    const m = (e as Error)?.message ?? '';
    if (m === 'no-ip') return t('Primero añade la IP de la impresora');
    return `${t('No se pudo imprimir')} — ${t('{ip} no responde. Revisa el cable, la IP y que esté en la misma red.', { ip: selIp ? selIp.ip : '' })}${m && m !== 'server' ? ` (${m})` : ''}`;
  };
  const usbErr = (e: unknown) => {
    const m = (e as Error)?.message ?? '';
    if (m === 'insecure') return t('WebUSB недоступен на http-странице: откройте Innova365 через start-pos-browser.bat');
    if (m === 'unsupported') return t('Este navegador no admite USB directo: usa Chrome o Edge');
    if (m === 'no-device') return t('Primero pulsa «Conectar impresora USB»');
    if (m === 'winusb') return t('Windows ocupa la impresora con su controlador: instala WinUSB con Zadig (ver instrucciones abajo)');
    if ((e as Error)?.name === 'NotFoundError') return t('No elegiste ninguna impresora');
    return `${t('No se pudo imprimir')} — ${m}`;
  };

  const { data: estado = [], refetch, isFetching, isLoading: estadoLoading } = useQuery<EstadoImpresora[]>({
    queryKey: ['imprimirEstado'], queryFn: impresionService.estado, enabled: !!job?.server, refetchInterval: job ? 8000 : false, staleTime: 3000,
  });
  const stationPrinters = useMemo(() => estado.filter((p) => p.tipo !== 'NAVEGADOR' && p.usos.includes('COCINA')), [estado]);
  const eligible = useMemo(() => {
    if (!job?.server) return [];
    const uso = USO[job.server.tipo];
    const forReceipt = job.server.tipo === 'recibo' || job.server.tipo === 'cuenta';
    return estado.filter((p) => p.tipo !== 'NAVEGADOR' && !(forReceipt && isStationPrinter(p)) && (p.usos.includes(uso) || estado.every((x) => !x.usos.includes(uso) || (forReceipt && isStationPrinter(x)))));
  }, [estado, job]);
  const bestAuto = useMemo(() => [...eligible].filter((p) => p.online).sort((a, b) => a.ms - b.ms)[0], [eligible]);

  // начальные значения при открытии
  useEffect(() => {
    if (!job) return;
    setErrors([]); setBusy(false); setFit('auto'); setOrient('auto'); setPaper(job.paper);
    setTarget('browser');
    setFound(null); setSetupMsg('');
  }, [job]);

  // «умный» выбор: когда пришло состояние принтеров — закреплённый за устройством, иначе лучший онлайн, иначе браузер
  const picked = useRef<object | null>(null);
  const pickedTarget = useRef('browser');
  useEffect(() => {
    if (!job || (!job.server && !nativeAvailable) || picked.current === job) return;
    const select = (value: string) => { picked.current = job; pickedTarget.current = value; setTarget(value); };
    // В установленном Electron печатаем через очередь Windows. Сохранённый WebUSB-доступ
    // может указывать на составное USB-устройство без интерфейса принтера.
    if (nativeAvailable) {
      if (nativeLoading) return;
      const saved = nativePrinters.find((p) => p.name === getNativePrinter());
      if (saved) { select(`system:${saved.name}`); return; }
      const physical = nativePrinters.filter((p) => !/pdf|xps|onenote|fax|virtual/i.test(p.name));
      const preferred = physical.find((p) => p.isDefault) ?? physical[0] ?? nativePrinters.find((p) => p.isDefault);
      select(preferred ? `system:${preferred.name}` : 'browser');
      return;
    }
    if (lcfg.enabled && agent === undefined) return;                 // ждём ответ агента этого компьютера
    if (getPref() === 'ip' && selectedIpPrinter()) { select('ip'); return; }                       // последний удавшийся способ — IP-принтер
    if (lcfg.enabled && agent?.online && agent.allowed !== false) {
      if (winPrintersLoading) return;
      const ipPrinter = /^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?$/.test(lcfg.printer.trim());
      if (ipPrinter || rawPrinterName(lcfg.printer, winPrinters)) { select('local'); return; }
    }
    if (usbMode === 'ok' && usbSaved === undefined) return;                                                                   // ждём список USB-принтеров
    if (usbSaved) { select('usb'); return; }
    if (nativeAvailable && nativeLoading) return;
    const nativeDefault = nativePrinters.find((p) => p.isDefault) ?? (nativePrinters.length === 1 ? nativePrinters[0] : null);
    if (nativeDefault) { select(`system:${nativeDefault.name}`); return; }
    if (estadoLoading) return;
    const dev = getDevicePrinter();
    if (dev && eligible.some((p) => p.id === dev && p.online)) select(dev);
    else select(bestAuto ? 'auto' : 'browser');
  }, [job, estadoLoading, eligible, bestAuto, agent, lcfg.enabled, lcfg.printer, winPrinters, winPrintersLoading, usbMode, usbSaved, nativeAvailable, nativeLoading, nativePrinters]);
  useEffect(() => { if (!job) picked.current = null; }, [job]);

  const chosen: EstadoImpresora | undefined = target === 'auto' ? bestAuto : eligible.find((p) => p.id === target);
  const physical = target !== 'browser' && (!!job?.server || target.startsWith('system:'));
  const localPrinterName = lcfg.printer === 'auto'
    ? [...winPrinters].filter((p) => !p.offline && p.thermal).sort((a, b) => b.score - a.score)[0]?.name ?? ''
    : lcfg.printer;
  const configuredLocalMissing = agent?.online && agent.allowed !== false && winPrintersFetched && lcfg.printer !== 'auto' &&
    !/^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?$/.test(lcfg.printer) &&
    !winPrinters.some((p) => p.name === lcfg.printer && !p.offline);
  const configuredLocalUnsupported = winPrinters.some((p) => p.name === lcfg.printer && !p.offline && !supportsRaw(p));
  const localWidth = lcfg.ancho === 80 && /XP[-\s]?76/i.test(localPrinterName) ? 76 : lcfg.ancho;
  // ширина ленты подстраивается под выбранный принтер
  useEffect(() => { if (chosen && typeof paper === 'number') setPaper(chosen.ancho); }, [chosen?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if ((target === 'local' || target === 'usb' || target === 'ip') && typeof paper === 'number') setPaper(target === 'local' ? localWidth : lcfg.ancho); }, [target, lcfg.ancho, localWidth]); // eslint-disable-line react-hooks/exhaustive-deps

  // раскладка (предпросмотр = то, что напечатается)
  useEffect(() => {
    if (!job) { setLayoutState(null); return; }
    let off = false;
    layoutDocument(job.html, job.title, { paper, fit, orient }).then((value) => { if (!off) setLayoutState({ job, paper, fit, orient, value }); }).catch(() => undefined);
    return () => { off = true; };
  }, [job, paper, fit, orient]);

  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setBoxSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, [job]);

  const printNow = useCallback(async () => {
    if (!job || busy) return;
    setBusy(true); setErrors([]);
    // чек ушёл на принтер → станции (кухня/бар/самса) получают свои позиции одновременно
    const stations = () => { const sv = job.server; if (sv && sv.pedidoId && (sv.tipo === 'recibo' || sv.tipo === 'cuenta')) void printStations(sv.pedidoId, sv.tipo); };
    try {
      if (target.startsWith('system:')) {
        if (!layout) throw new Error(t('Cargando...'));
        const name = target.slice('system:'.length);
        await printNativeDocument(layout.srcdoc, name, { widthMm: layout.widthMm, heightMm: layout.heightMm });
        setNativePrinter(name);
        setPref('system');
        toast.success(`Задание передано Windows: ${name}`);
        stations();
        close();
        return;
      }
      if (target === 'ip' && job.server) {
        if (!selIp) throw new Error('no-ip');
        const r = await printIp(job.server, selIp, typeof paper === 'number' ? paper : undefined);
        setPref('ip');
        toast.success(t('Impreso: {name}', { name: r.printer }));
        stations();
        close();
        return;
      }
      if (target === 'usb' && job.server) {
        const r = await printUsb(job.server, typeof paper === 'number' ? paper : undefined);
        setPref('usb');
        toast.success(t('Impreso: {name}', { name: r.printer }));
        stations();
        close();
        return;
      }
      if (target === 'local' && job.server) {
        const r = await printLocal(job.server, typeof paper === 'number' ? { ...lcfg, ancho: paper } : lcfg);
        setPref('local');
        toast.success(t('Impreso: {name}', { name: r.printer }));
        stations();
        close();
        return;
      }
      if (physical && job.server) {
        const r = await impresionService.imprimir({ ...job.server, impresoraId: target === 'auto' ? undefined : target, lang: printLang });
        const ok = r.resultados.find((x) => x.ok);
        if (ok) { toast.success(t('Impreso: {name}', { name: ok.impresora })); stations(); close(); return; }
        setErrors(r.resultados.map((x) => `${x.impresora}: ${t('No se pudo imprimir')}${x.detalle ? ' — ' + x.detalle : ''}`).concat(r.resultados.length ? [] : [t('No hay impresora configurada para reportes')]));
        void refetch();
        return;
      }
      if (!layout) return;
      // На телефоне печатаем видимый предпросмотр прямо в окне: скрытый iframe за экраном уводит на пустую страницу без кнопки «Назад».
      const frame = previewRef.current?.contentWindow;
      if (mobile && frame) { frame.focus(); frame.print(); stations(); return; }
      await printSrcdoc(layout.srcdoc);
      stations();
      close();
    } catch (e: any) {
      setErrors([e?.response?.status === 403 ? t('Sin permisos para esta acción') : target === 'local' || target === 'browser' || target.startsWith('system:') ? `${t('No se pudo imprimir')} — ${e?.message ?? ''}` : target === 'usb' ? usbErr(e) : target === 'ip' ? ipErr(e) : t('No se pudo imprimir')]);
    } finally { setBusy(false); }
  }, [job, busy, physical, target, layout, close, refetch, lcfg, selIp, paper, mobile]); // eslint-disable-line react-hooks/exhaustive-deps

  // чек после оплаты: печать стартует сама, как только документ готов
  useEffect(() => {
    if (!job?.autoPrint || !layout || autoDone.current === job || ((job.server || nativeAvailable) && (picked.current !== job || target !== pickedTarget.current))) return;
    autoDone.current = job;
    void printNow();
  }, [job, layout, printNow, agent, winPrinters, winPrintersLoading, usbSaved, estadoLoading, nativePrinters, nativeLoading]);

  useEffect(() => {
    if (!job) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); }
      else if (e.key === 'Enter' && !(e.target as HTMLElement)?.closest('button,input,select,textarea')) { e.preventDefault(); void printNow(); }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [job, close, printNow]);


  const addPrinter = async (ip: string) => {
    try {
      const p = await impresionService.create({ nombre: `${t('Impresora')} ${ip}`, tipo: 'RED', host: ip, puerto: 9100, ancho: 80, codepage: 'cp866', usos: ['RECIBO', 'CUENTA'], corte: true, cajon: false, copias: 1, auto: true, activa: true });
      toast.success(t('Impresora añadida'));
      setFound(null); setIpText('');
      await refetch();
      setTarget(p.id);
    } catch (e) { setSetupMsg(apiError(e, 'Error al guardar')); }
  };
  const findPrinter = async () => {
    const v = ipText.trim();
    setSetupMsg(''); setFound(null);
    const full = /^\d{1,3}(\.\d{1,3}){3}$/.test(v);
    const net = /^\d{1,3}(\.\d{1,3}){2}$/.test(v) ? v : /^(\d{1,3}(?:\.\d{1,3}){2})\.\d{1,3}$/.exec(location.hostname)?.[1];
    setScanning(true);
    try {
      if (full) {
        const r = await impresionService.comprobar(v, 9100);
        if (r.alcanzable) await addPrinter(v); else setSetupMsg(t('{ip} no responde. Revisa el cable, la IP y que esté en la misma red.', { ip: v }));
      } else if (net) {
        const r = await impresionService.descubrir(net, 9100);
        setFound(r.hosts);
        if (r.hosts.length === 0) setSetupMsg(t('No se encontró ninguna impresora en {red}.x', { red: net }));
      } else setSetupMsg(t('Escribe la IP de la impresora o los tres primeros números de la red'));
    } catch (e) { setSetupMsg(apiError(e, 'No se pudo imprimir')); }
    finally { setScanning(false); }
  };

  if (!job) return null;

  const isRoll = typeof paper === 'number';
  const pw = (layout?.widthMm ?? (isRoll ? (paper as number) : 210)) * PX_PER_MM;
  const ph = (layout?.heightMm ?? 200) * PX_PER_MM;
  const s = layout ? Math.min(1.4, Math.max(0.2, layout.roll ? (boxSize.w - 32) / pw : Math.min((boxSize.w - 32) / pw, (boxSize.h - 32) / ph))) : 1;

  const dot = (p: EstadoImpresora) => (
    <span className={cn('inline-block w-2.5 h-2.5 rounded-full flex-shrink-0', p.online ? 'bg-green-500 shadow-[0_0_0_3px_rgba(34,197,94,.25)]' : 'bg-red-500')} />
  );
  const Option = ({ id, icon, title, sub, disabled }: { id: string; icon: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; disabled?: boolean }) => (
    <button type="button" data-sound="none" disabled={disabled} onClick={() => { setTarget(id); setErrors([]); }}
      className={cn('w-full flex items-center gap-3 text-left rounded-l border px-3 py-2.5 transition-colors',
        target === id ? 'border-primary bg-primary/10' : 'border-border bg-muted hover:border-muted-foreground/50', disabled && 'opacity-50 cursor-not-allowed')}>
      <span className={cn('flex-shrink-0', target === id ? 'text-primary' : 'text-muted-foreground')}>{icon}</span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-foreground truncate">{title}</span>{sub && <span className="block text-xs text-muted-foreground truncate">{sub}</span>}</span>
      {target === id && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
    </button>
  );
  const stateTxt = (p: EstadoImpresora) => `${p.online ? t('En línea') : t('Fuera de línea')}${p.online && p.ms ? ` · ${p.ms} ms` : ''}${p.papel === 'poco' ? ` · ${t('Papel: poco')}` : p.papel === 'sin' ? ` · ${t('Papel: se acabó')}` : ''}`;

  return (
    <div className="fixed inset-0 z-[80] flex items-stretch sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={t('Imprimir')}>
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm fade-in" onClick={close} />
      <div className="relative bg-card border border-border sm:rounded-l shadow-2xl w-full sm:w-[min(1080px,96vw)] h-full sm:h-[min(760px,94vh)] flex flex-col pop-in overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={close} data-sound="none" aria-label={t('Назад')} className="sm:hidden -ml-2 flex items-center gap-1 pl-2 pr-3 py-2 rounded-full text-sm font-medium text-foreground hover:bg-muted flex-shrink-0"><ArrowLeft size={18} />{t('Назад')}</button>
            <Printer size={18} className="text-primary flex-shrink-0 hidden sm:block" />
            <h2 className="text-base font-semibold text-foreground truncate">{t('Imprimir')} — {job.title}</h2>
          </div>
          <button onClick={close} data-sound="none" aria-label={t('Cerrar')} className="p-2 -mr-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"><X size={20} /></button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          {/* предпросмотр */}
          <div className="h-[34vh] flex-none lg:h-auto lg:flex-1 lg:min-h-0 bg-muted/60 flex flex-col border-b lg:border-b-0 lg:border-r border-border">
            <div className="px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium uppercase tracking-wide">{t('Vista previa')}</span>
              {layout && <span>{Math.round(layout.widthMm)} × {Math.round(layout.heightMm)} {t('mm')} · {t('escala')} {Math.round(layout.scale * 100)}%{layout.orient === 'landscape' ? ` · ${t('Horizontal')}` : ''}</span>}
            </div>
            <div ref={box} className="flex-1 min-h-0 overflow-auto p-4 flex justify-center items-start">
              {layout ? (
                <div style={{ width: pw * s, height: ph * s }} className="flex-shrink-0 shadow-xl ring-1 ring-black/10 bg-white">
                  <iframe ref={previewRef} title="preview" srcDoc={layout.srcdoc} sandbox="allow-same-origin allow-modals"
                    style={{ width: pw, height: ph, transform: `scale(${s})`, transformOrigin: 'top left', border: 0, background: '#fff', display: 'block' }} />
                </div>
              ) : <div className="text-sm text-muted-foreground py-10">{t('Cargando...')}</div>}
            </div>
          </div>

          {/* настройки */}
          <div className="flex-1 min-h-0 lg:flex-none lg:w-[360px] overflow-y-auto p-4 sm:p-5 space-y-5">
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-foreground">{t('Impresora')}</h3>
                {job.server && <button type="button" data-sound="none" onClick={() => { void refetch(); void refetchAgent(); void refetchWinPrinters(); void refetchUsb(); void refetchNative(); }} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><RefreshCw size={12} className={cn(isFetching && 'animate-spin')} />{t('Actualizar')}</button>}
              </div>
              <div className="space-y-2">
                {!nativeAvailable && job.server && estado.length > 0 && (
                  <Option id="auto" icon={<Sparkles size={18} />} title={t('Auto (inteligente)')}
                    sub={bestAuto ? `${bestAuto.nombre} · ${stateTxt(bestAuto)}` : estado.length ? t('Ninguna impresora del servidor responde') : ''} />
                )}
                {!nativeAvailable && job.server && (
                  <Option id="usb" icon={<Usb size={18} className={usbSaved ? 'text-green-500' : ''} />} title={t('Impresora USB (directo desde el navegador)')}
                    sub={usbMode !== 'ok' ? (usbMode === 'insecure' ? t('WebUSB недоступен на http-странице: откройте Innova365 через start-pos-browser.bat') : t('Este navegador no admite USB directo: usa Chrome o Edge')) : usbSaved ? `${usbSaved.info.name} · ${t('En línea')}` : t('Pulsa para conectar la impresora USB')} />
                )}
                {!nativeAvailable && job.server && (
                  <Option id="ip" icon={<Network size={18} className={selIp ? 'text-green-500' : ''} />} title={t('Impresora de red (IP)')}
                    sub={selIp ? `${selIp.ip}:${selIp.port}${ips.length > 1 ? ` · +${ips.length - 1}` : ''}` : t('Añade la IP de la impresora de red')} />
                )}
                {!nativeAvailable && job.server && lcfg.enabled && (
                  <Option id="local" icon={<MonitorSmartphone size={18} className={agent?.online ? 'text-green-500' : ''} />} title={t('Impresora de este equipo (agente)')}
                    sub={agent === undefined ? t('Cargando...') : agent.online ? (agent.allowed === false ? t('El agente no permite esta página: añádela en allowed-origins.txt') : `${agent.host ?? ''} · ${lcfg.printer === 'auto' ? t('Auto (inteligente)') : lcfg.printer} · ${t('En línea')}`) : t('El agente no está en este equipo: instala print-agent (ver abajo)')} />
                )}
                {!nativeAvailable && eligible.map((p) => (
                  <Option key={p.id} id={p.id} icon={dot(p)} title={p.nombre} sub={`${stateTxt(p)} · ${p.ancho} ${t('mm')}`} />
                ))}
                {nativePrinters.map((p) => (
                  <Option key={`system:${p.name}`} id={`system:${p.name}`} icon={<Printer size={18} />} title={p.displayName || p.name} sub={t('Impresora en Windows')} />
                ))}
                <Option id="browser" icon={<Globe size={18} />} title={t('Diálogo del sistema (navegador)')} sub={t('Cualquier impresora de Windows, A4 o rollo')} />
              </div>
            </section>

            {target === 'ip' && (
              <section className="space-y-3 rounded-l border border-border p-3">
                <h3 className="text-sm font-semibold text-foreground">{t('Impresora de red (IP)')}</h3>
                {ips.length > 0 && (
                  <div className="space-y-1.5">
                    {ips.map((p) => (
                      <div key={p.ip} className={cn('flex items-center gap-2 rounded-m border px-3 py-2', selIp?.ip === p.ip ? 'border-primary bg-primary/10' : 'border-border bg-muted')}>
                        <button type="button" data-sound="none" onClick={() => { setSelectedIp(p.ip); refreshIps(); }} className="flex-1 text-left text-sm font-medium text-foreground">{p.ip}<span className="text-xs text-muted-foreground">:{p.port}</span></button>
                        <button type="button" data-sound="none" aria-label={t('Eliminar')} title={t('Eliminar')} onClick={() => { removeIpPrinter(p.ip); refreshIps(); }} className="p-1.5 rounded-m text-muted-foreground hover:text-error"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input value={ipInput} onChange={(e) => setIpInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); addIp(ipInput); } }} placeholder="192.168.1.50" inputMode="decimal"
                    className="flex-1 min-w-0 bg-muted border border-border rounded-m px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
                  <button type="button" data-sound="none" onClick={() => addIp(ipInput)} disabled={!ipInput.trim()} className="px-3 rounded-m bg-primary text-white text-sm font-medium inline-flex items-center gap-1 disabled:opacity-50"><Plus size={14} />{t('Añadir y usar')}</button>
                </div>
                <button type="button" data-sound="none" onClick={scanIps} disabled={ipScanning} className="text-sm text-primary hover:underline inline-flex items-center gap-1.5 disabled:opacity-60">
                  <Search size={14} className={cn(ipScanning && 'animate-pulse')} />{ipScanning ? t('Revisando 254 direcciones…') : t('Buscar en la red')}
                </button>
                {ipFound && ipFound.map((ip) => (
                  <button key={ip} type="button" data-sound="none" onClick={() => addIp(ip)} className="w-full flex items-center justify-between rounded-m border border-border bg-card px-3 py-2 text-left hover:border-primary">
                    <span className="text-sm font-semibold text-foreground">{ip}</span><span className="text-xs text-primary inline-flex items-center gap-1"><Plus size={13} />{t('Añadir y usar')}</span>
                  </button>
                ))}
                <div className="flex flex-wrap gap-x-5 gap-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t('Ancho del papel')}</p>
                    <Seg<string> value={String(lcfg.ancho)} onChange={(v) => upd({ ancho: Number(v) })} options={ROLLS.map((r) => ({ v: String(r), label: `${r} ${t('mm')}` }))} />
                  </div>
                  <div className="min-w-[10rem]">
                    <p className="text-xs text-muted-foreground mb-1">{t('Codificación')}</p>
                    <Select value={lcfg.codepage} onChange={(v) => upd({ codepage: v as LocalCfg['codepage'] })}
                      options={[{ value: 'cp866', label: `CP866 (${t('cirílico')})` }, { value: 'cp1251', label: `CP1251 (${t('cirílico')})` }, { value: 'ascii', label: t('Latín (translit)') }]} />
                  </div>
                </div>
                <button type="button" data-sound="none" disabled={testing || !selIp} onClick={async () => {
                  if (!selIp) return;
                  setTesting(true); setErrors([]);
                  try { const r = await printIp({ tipo: 'prueba' }, selIp); toast.success(t('Impreso: {name}', { name: r.printer })); }
                  catch (e) { setErrors([ipErr(e)]); }
                  finally { setTesting(false); }
                }} className="text-sm text-primary hover:underline disabled:opacity-50">{testing ? t('Imprimiendo...') : t('Prueba de impresora')}</button>
                <p className="text-xs text-muted-foreground">{t('La impresora debe estar en la misma red que este equipo. Con el agente print-agent se imprime desde este equipo; sin agente, desde el servidor (si está en la misma red).')}</p>
              </section>
            )}

            {!nativeAvailable && target === 'usb' && (
              <section className="space-y-3 rounded-l border border-border p-3">
                <h3 className="text-sm font-semibold text-foreground">{t('Impresora USB (directo desde el navegador)')}</h3>
                {usbMode !== 'ok' ? (
                  <p className="text-xs text-muted-foreground">{usbErr(new Error(usbMode))}</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" data-sound="none" onClick={async () => { setErrors([]); try { await connectUsbPrinter(); await refetchUsb(); } catch (e) { setErrors([usbErr(e)]); } }}
                        className="px-3 py-2 rounded-m bg-primary text-white text-sm font-medium inline-flex items-center gap-1.5"><Usb size={14} />{usbSaved ? t('Cambiar impresora USB') : t('Conectar impresora USB')}</button>
                      {usbSaved && <span className="text-xs text-muted-foreground">{usbSaved.info.name}</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">{t('Ancho del papel')}</p>
                        <Seg<string> value={String(lcfg.ancho)} onChange={(v) => upd({ ancho: Number(v) })} options={ROLLS.map((r) => ({ v: String(r), label: `${r} ${t('mm')}` }))} />
                      </div>
                      <div className="min-w-[10rem]">
                        <p className="text-xs text-muted-foreground mb-1">{t('Codificación')}</p>
                        <Select value={lcfg.codepage} onChange={(v) => upd({ codepage: v as LocalCfg['codepage'] })}
                          options={[{ value: 'cp866', label: `CP866 (${t('cirílico')})` }, { value: 'cp1251', label: `CP1251 (${t('cirílico')})` }, { value: 'ascii', label: t('Latín (translit)') }]} />
                      </div>
                    </div>
                    <button type="button" data-sound="none" disabled={testing || !usbSaved} onClick={async () => {
                      setTesting(true); setErrors([]);
                      try { const r = await printUsb({ tipo: 'prueba' }); toast.success(t('Impreso: {name}', { name: r.printer })); }
                      catch (e) { setErrors([usbErr(e)]); }
                      finally { setTesting(false); }
                    }} className="text-sm text-primary hover:underline disabled:opacity-50">{testing ? t('Imprimiendo...') : t('Prueba de impresora')}</button>
                    <p className="text-xs text-muted-foreground">{t('Una sola vez por equipo: ejecuta Zadig, elige la impresora (XP-76), controlador WinUSB, «Replace Driver». Después Windows ya no imprime en ella, pero Innova365 sí.')}</p>
                  </>
                )}
              </section>
            )}

            {target === 'local' && (
              <section className="space-y-3 rounded-l border border-border p-3">
                <h3 className="text-sm font-semibold text-foreground">{t('Impresora de este equipo (agente)')}</h3>
                {agent?.online && agent.allowed !== false ? (
                  <>
                    {configuredLocalMissing && <p className="text-xs text-error">«{lcfg.printer}»: {t('Fuera de línea')}. {t('Indica el nombre de la impresora en Windows')}</p>}
                    {configuredLocalUnsupported && <p className="text-xs text-error">«{lcfg.printer}»: {t('Esta impresora imprime desde el navegador')}</p>}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">{t('Impresora')}</p>
                      <Select value={winPrinters.some((p) => p.name === lcfg.printer) || lcfg.printer === 'auto' ? lcfg.printer : '__ip'} onChange={(v) => upd({ printer: v === '__ip' ? '' : v })}
                        options={[{ value: 'auto', label: t('Auto (inteligente)') }, ...winPrinters.map((p) => ({ value: p.name, label: `${p.name}${p.offline ? ' (offline)' : ''}`, hint: p.thermal ? '★' : undefined })), { value: '__ip', label: t('Impresora de red por IP…') }]} />
                      {!(winPrinters.some((p) => p.name === lcfg.printer) || lcfg.printer === 'auto') && (
                        <input value={lcfg.printer} onChange={(e) => upd({ printer: e.target.value })} placeholder="192.168.1.50" inputMode="decimal"
                          className="mt-2 w-full bg-muted border border-border rounded-m px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">{t('Ancho del papel')}</p>
                        <Seg<string> value={String(lcfg.ancho)} onChange={(v) => upd({ ancho: Number(v) })} options={ROLLS.map((r) => ({ v: String(r), label: `${r} ${t('mm')}` }))} />
                      </div>
                      <div className="min-w-[10rem]">
                        <p className="text-xs text-muted-foreground mb-1">{t('Codificación')}</p>
                        <Select value={lcfg.codepage} onChange={(v) => upd({ codepage: v as LocalCfg['codepage'] })}
                          options={[{ value: 'cp866', label: `CP866 (${t('cirílico')})` }, { value: 'cp1251', label: `CP1251 (${t('cirílico')})` }, { value: 'ascii', label: t('Latín (translit)') }]} />
                      </div>
                    </div>
                    <button type="button" data-sound="none" disabled={testing} onClick={async () => {
                      setTesting(true); setErrors([]);
                      try { const r = await printLocal({ tipo: 'prueba' }, lcfg); toast.success(t('Impreso: {name}', { name: r.printer })); }
                      catch (e) { setErrors([`${t('No se pudo imprimir')} — ${(e as Error).message}`]); }
                      finally { setTesting(false); }
                    }} className="text-sm text-primary hover:underline disabled:opacity-60">{testing ? t('Imprimiendo...') : t('Prueba de impresora')}</button>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground space-y-1.5">
                    <p>{agent?.online ? t('El agente no permite esta página: añádela en allowed-origins.txt') : t('El agente no está en este equipo: instala print-agent (ver abajo)')}</p>
                    <p>{t('1) Copia la carpeta print-agent a este equipo. 2) Ejecuta install-agent.bat como administrador. 3) Abre Innova365 con start-pos-browser.bat.')}</p>
                    <button type="button" data-sound="none" onClick={() => void refetchAgent()} className="text-primary hover:underline">{t('Actualizar')}</button>
                  </div>
                )}
              </section>
            )}

            {job.server && !isFetching && estado.length === 0 && target !== 'browser' && target !== 'local' && target !== 'usb' && !agent?.online && (
              <section className="rounded-l border border-primary/40 bg-primary/5 p-3 space-y-2.5">
                <h3 className="text-sm font-semibold text-foreground">{t('Sin impresora configurada')}</h3>
                {isAdminLike(me?.rol) ? (
                  <>
                    <p className="text-xs text-muted-foreground">{t('Busca la impresora de red y añádela en un clic')}</p>
                    <div className="flex gap-2">
                      <input value={ipText} onChange={(e) => setIpText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); void findPrinter(); } }}
                        placeholder={t('IP de la impresora o red (192.168.1)')} inputMode="decimal"
                        className="flex-1 min-w-0 bg-muted border border-border rounded-m px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
                      <button type="button" data-sound="none" onClick={findPrinter} disabled={scanning}
                        className="px-3 rounded-m bg-primary text-white text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-60">
                        <Search size={14} className={cn(scanning && 'animate-pulse')} />{scanning ? t('Revisando 254 direcciones…') : t('Buscar en la red')}
                      </button>
                    </div>
                    {found && found.map((h) => (
                      <button key={h.ip} type="button" data-sound="none" onClick={() => addPrinter(h.ip)}
                        className="w-full flex items-center justify-between gap-2 rounded-m border border-border bg-card px-3 py-2 text-left hover:border-primary">
                        <span className="min-w-0"><span className="block text-sm font-semibold text-foreground">{h.ip}</span><span className="block text-xs text-muted-foreground truncate">{h.estado.escpos ? t('Impresora ESC/POS') : h.web ?? t('{ip} responde en el puerto 9100', { ip: h.ip })}</span></span>
                        <span className="text-xs text-primary font-medium inline-flex items-center gap-1 flex-shrink-0"><Plus size={13} />{t('Añadir y usar')}</span>
                      </button>
                    ))}
                    {setupMsg && <p className="text-xs text-error">{setupMsg}</p>}
                  </>
                ) : <p className="text-xs text-muted-foreground">{t('Pídele al administrador que añada la impresora en «Configuración → Impresoras».')}</p>}
              </section>
            )}

            {(target === 'browser' || !job.server) && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">{t('Papel')}</h3>
                <Seg<string> value={isRoll ? String(paper) : 'A4'} onChange={(v) => setPaper(v === 'A4' ? 'A4' : Number(v))}
                  options={[...ROLLS.map((r) => ({ v: String(r), label: `${r} ${t('mm')}` })), { v: 'A4', label: 'A4' }]} />
                <div className="flex flex-wrap gap-x-5 gap-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t('Ajuste de tamaño')}</p>
                    <Seg<Fit> value={fit} onChange={setFit} options={[{ v: 'auto', label: t('Auto') }, { v: 'width', label: t('Al ancho') }, { v: 'none', label: '100%' }]} />
                  </div>
                  {!isRoll && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">{t('Orientación')}</p>
                      <Seg<Orient> value={orient} onChange={setOrient} options={[{ v: 'auto', label: t('Auto') }, { v: 'portrait', label: t('Vertical') }, { v: 'landscape', label: t('Horizontal') }]} />
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  {isRoll ? <ScrollText size={14} className="mt-0.5 flex-shrink-0" /> : <FileText size={14} className="mt-0.5 flex-shrink-0" />}
                  {isRoll ? t('La altura del rollo se calcula por el contenido; si las líneas no caben, la letra se reduce sola.') : t('Si la tabla es más ancha que la hoja, se reduce la escala o se gira la hoja automáticamente.')}
                </p>
              </section>
            )}

            {stationsOn && stationPrinters.length > 0 && (
              <section className="space-y-1.5 rounded-l border border-border bg-muted/40 p-3">
                <p className="text-sm font-medium text-foreground">{t('Печатать также на станциях')}</p>
                {stationPrinters.map((st) => {
                  const n = stationList.find((x) => x.impresoraId === st.id)?.items ?? 0;
                  return (
                    <label key={st.id} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                      <input type="checkbox" className="accent-primary" checked={!stOff.includes(st.id)}
                        onChange={(e) => { setStationOff(st.id, !e.target.checked); setStOff(getStationsOff()); }} />
                      <span>{st.nombre}<span className="text-xs text-muted-foreground"> · {n > 0 ? `${n} ${t('поз.')}` : t('нет позиций в заказе')}</span></span>
                    </label>
                  );
                })}
                <p className="text-xs text-muted-foreground">{t('Выбор запоминается на этой кассе.')}</p>
              </section>
            )}

            {job.server && (
              <label className="flex items-start gap-2 text-sm text-foreground cursor-pointer">
                <input type="checkbox" className="accent-primary mt-0.5" checked={quick} onChange={(e) => { setQuick(e.target.checked); setQuickPrint(e.target.checked); }} />
                <span>{t('Imprimir directamente, sin esta ventana')}<span className="block text-xs text-muted-foreground">{t('Solo en este dispositivo. Los recibos saldrán al instante en la impresora elegida.')}</span></span>
              </label>
            )}

            {errors.length > 0 && (
              <div className="rounded-l border border-error/40 bg-error-bg p-3 text-sm text-error space-y-1">
                <p className="font-semibold flex items-center gap-1.5"><AlertTriangle size={14} />{t('No se pudo imprimir')}</p>
                {errors.map((e, i) => <p key={i} className="text-xs break-words">{e}</p>)}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-t border-border flex-shrink-0 bg-card" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <button onClick={close} data-sound="none" className="px-4 py-2.5 rounded-m bg-muted border border-border text-sm font-medium text-foreground hover:bg-border">{t('Cancelar')}</button>
          <button onClick={printNow} disabled={busy || (!layout && (!physical || target.startsWith('system:')))} data-sound="none"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-m bg-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
            <Printer size={16} className={cn(busy && 'animate-pulse')} />
            {busy ? t('Imprimiendo...') : physical ? `${t('Imprimir')}${chosen ? ` · ${chosen.nombre}` : ''}` : t('Imprimir')}
          </button>
        </div>
      </div>
    </div>
  );
}
