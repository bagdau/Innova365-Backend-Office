import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { cashReportHtml, receiptHtml, type RestauranteInfo } from '../../lib/documents';
import { printHtml } from '../../lib/printPanel';
import { DEFAULT_PRINT_SETTINGS, printSettings, type PrintSettings } from '../../lib/printSettings';
import { reportesService } from '../../services/reportes.service';
import type { Pedido, Restaurante } from '../../types';
import type { CashReport } from '../../types/cashReport';

const widths = [58, 76, 80, 90].map((width) => ({ value: String(width), label: `${width} мм` }));
const inputClass = 'w-full rounded-m border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary';

function sampleOrder(): Pedido {
  const now = new Date().toISOString();
  return {
    id: 'preview', numero: 21, tipo: 'EN_MESA', estado: 'PAGADO', mesa: { numero: 4 },
    restauranteId: 'preview', items: [
      { id: '1', productoId: '1', producto: { nombre: 'Баурсаки (порция)' }, cantidad: 1, precio: 600, subtotal: 600, servido: true },
      { id: '2', productoId: '2', producto: { nombre: 'Айран' }, cantidad: 1, precio: 500, subtotal: 500, servido: true },
    ], pagado: true, metodoPago: 'QR', cajeroNombre: 'Кассир', cajeroRol: 'CAJERO', mesero: { nombre: 'Айгерим', rol: 'MESERO' }, servicePercent: 10, serviceAmount: 110, total: 1210,
    creadoEn: now, actualizadoEn: now,
  };
}

function sampleReport(): CashReport {
  const now = new Date().toLocaleString('ru-RU');
  return {
    period: 'hoy', from: now, to: now, generatedAt: now,
    created: 3, paid: 2, cancelled: 1, open: 0, positions: 3, orderedPositions: 4,
    cancelledPositions: 1, revenue: 1700, cancelAmount: 300, average: 850,
    methods: [{ name: 'QR', count: 1, total: 1100 }, { name: 'Efectivo', count: 1, total: 600 }],
    staff: [{ name: 'Кассир', count: 2, total: 1700 }],
    categories: [], service: [{ name: 'Стол', count: 1, total: 1100 }, { name: 'С собой', count: 1, total: 600 }],
    departments: [{ name: 'Кухня', count: 3, total: 1700 }],
    clients: [{ name: 'Частное лицо', bills: 2, positions: 3, total: 1700 }],
  };
}

export default function PrintEditor({ restaurante }: { restaurante?: Restaurante }) {
  const queryClient = useQueryClient();
  const [documentType, setDocumentType] = useState<'receipt' | 'report'>('receipt');
  const [settings, setSettings] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState('');

  useEffect(() => {
    if (restaurante && !dirty) setSettings(printSettings(restaurante.printSettings));
  }, [restaurante, dirty]);

  const previewRestaurante: RestauranteInfo = {
    nombre: restaurante?.nombre || 'Innova365', direccion: restaurante?.direccion,
    telefono: restaurante?.telefono, pieTicket: restaurante?.pieTicket,
    qrTicket: restaurante?.qrTicket, printSettings: settings,
  };

  useEffect(() => {
    let active = true;
    if (documentType === 'report') setPreview(cashReportHtml(sampleReport(), previewRestaurante));
    else void receiptHtml(sampleOrder(), previewRestaurante, 'recibo').then((html) => { if (active) setPreview(html); });
    return () => { active = false; };
  }, [documentType, settings, restaurante]);

  const save = useMutation({
    mutationFn: () => reportesService.updateRestaurante({ printSettings: settings }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['restaurante'], updated);
      setSettings(printSettings(updated.printSettings));
      setDirty(false);
      void queryClient.invalidateQueries({ queryKey: ['restaurante'] });
      toast.success('Шаблоны печати сохранены');
    },
    onError: () => toast.error('Не удалось сохранить шаблоны печати'),
  });

  const receipt = (patch: Partial<PrintSettings['receipt']>) => {
    setSettings((current) => ({ ...current, receipt: { ...current.receipt, ...patch } }));
    setDirty(true);
  };
  const report = (patch: Partial<PrintSettings['report']>) => {
    setSettings((current) => ({ ...current, report: { ...current.report, ...patch } }));
    setDirty(true);
  };
  const width = documentType === 'receipt' ? settings.receipt.width : settings.report.width;
  const title = documentType === 'receipt' ? settings.receipt.title : settings.report.title;

  return (
    <div className="space-y-5">
      <div className="rounded-l border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-foreground">Редактор чеков и отчётов</h2>
        <p className="mt-1 text-sm text-muted-foreground">Настройте вид документов и проверьте образец перед печатью. Настройки сохраняются для всех касс ресторана.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant={documentType === 'receipt' ? 'primary' : 'secondary'} onClick={() => setDocumentType('receipt')}>Чек продажи</Button>
          <Button variant={documentType === 'report' ? 'primary' : 'secondary'} onClick={() => setDocumentType('report')}>Итоговый отчёт</Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(280px,1fr)_minmax(360px,1.2fr)]">
        <div className="rounded-l border border-border bg-card p-5 space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Ширина предпросмотра и печати через браузер</label>
            <Select value={String(width)} onChange={(value) => documentType === 'receipt' ? receipt({ width: Number(value) }) : report({ width: Number(value) })} options={widths} />
            <p className="mt-1 text-xs text-muted-foreground">Для XP‑76 выберите 76 мм. У физического принтера ширина также задаётся в разделе «Принтеры».</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Заголовок документа</label>
            <input className={inputClass} maxLength={80} value={title} onChange={(event) => documentType === 'receipt' ? receipt({ title: event.target.value }) : report({ title: event.target.value })} />
          </div>

          {documentType === 'receipt' && <>
            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground">Показывать на чеке</p>
              {([
                ['showAddress', 'Адрес ресторана'], ['showPhone', 'Телефон'],
                ['showCashier', 'Кассир или администратор'], ['showQr', 'QR-код чека'],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex cursor-pointer items-center gap-3 text-sm text-foreground">
                  <input type="checkbox" className="h-4 w-4 accent-primary" checked={settings.receipt[key]} onChange={(event) => receipt({ [key]: event.target.checked })} />
                  {label}
                </label>
              ))}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Подпись внизу чека</label>
              <input className={inputClass} maxLength={160} value={settings.receipt.footer} onChange={(event) => receipt({ footer: event.target.value })} />
            </div>
          </>}

          {documentType === 'report' && <p className="rounded-m bg-muted p-3 text-sm text-muted-foreground">В отчёте сохраняются таблицы по видам оплаты, сотрудникам, подразделениям, обслуживанию и клиентам. Меняются заголовок и ширина ленты.</p>}

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button loading={save.isPending} disabled={!dirty || !settings.receipt.title.trim() || !settings.report.title.trim()} onClick={() => save.mutate()}>Сохранить шаблоны</Button>
            <Button variant="secondary" disabled={!preview} onClick={() => void printHtml(preview, { title: `${title} — образец`, paper: width })}>Распечатать образец</Button>
          </div>
        </div>

        <div className="rounded-l border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-foreground">Предпросмотр образца</h3>
            <span className="text-xs text-muted-foreground">{width} мм</span>
          </div>
          <div className="flex justify-center overflow-auto rounded-m bg-muted p-4">
            <iframe title="Предпросмотр печатного документа" className="border-0 bg-white shadow" style={{ width: `${width}mm`, minWidth: `${width}mm`, height: '740px' }}
              srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:3mm 4mm 4mm;width:${width}mm;font:12px/1.35 Arial,sans-serif;color:#000;background:#fff}table{width:100%;border-collapse:collapse}th,td{padding:4px;text-align:left;vertical-align:top}.right{text-align:right}.center{text-align:center}.bold{font-weight:700}.muted{color:#555}</style></head><body>${preview}</body></html>`} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Это пример с условными товарами и суммами. На XP‑76 текст и переносы могут отличаться из-за встроенного шрифта принтера.</p>
        </div>
      </div>
    </div>
  );
}
