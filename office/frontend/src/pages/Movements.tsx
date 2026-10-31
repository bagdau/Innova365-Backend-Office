import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Download, FileSpreadsheet, Printer } from 'lucide-react';
import { get, qs } from '../api';
import { fmtDateTime, money, num } from '../format';
import { locale } from '../i18n';
import { Badge, Col, ErrorBox, exportCsv, exportXlsx, Loading, PageHeader, PeriodPicker, useFetch, usePeriod } from '../ui';
import { Chips, fmtQty } from '../ui2';

interface Line { id: string; nombre: string; unidad: string; cantidad: number; saldo: number; costo: number | null; at: string; motivo: string | null }
interface Operation {
  key: string; at: string; tipo: string; motivo: string | null; who: string | null;
  pedidoNumero: number | null; compraNumero: number | null; lineCount: number; amount: number | null; lines: Line[];
}
interface Resp { total: number; canCost: boolean; timezone: string; groups: Operation[] }
interface ExportLine extends Line { operation: string; who: string | null }

const TYPES: Record<string, { label: string; tone: 'good' | 'bad' | 'warn' | 'info' | 'brand' | 'muted' }> = {
  COMPRA: { label: 'Поступление', tone: 'good' }, CONSUMO: { label: 'Продажа', tone: 'muted' }, MERMA: { label: 'Списание', tone: 'bad' },
  REVISION: { label: 'Инвентаризация', tone: 'brand' }, AJUSTE: { label: 'Корректировка', tone: 'warn' },
  DEVOLUCION: { label: 'Возврат', tone: 'info' }, INICIAL: { label: 'Начальный остаток', tone: 'muted' },
};
const FILTERS = { all: '', sales: 'CONSUMO', in: 'COMPRA,DEVOLUCION,INICIAL', writeoffs: 'MERMA', stocktakes: 'REVISION', adjustments: 'AJUSTE' } as const;
const PAGE = 25;

function operationTitle(o: Operation): string {
  const number = o.pedidoNumero ?? (Number(o.motivo?.match(/^№(\d+)$/)?.[1]) || null);
  if (o.tipo === 'CONSUMO') return number ? `Заказ №${number}` : 'Продажа';
  if (o.tipo === 'DEVOLUCION') return number ? `Возврат по заказу №${number}` : 'Возврат сырья';
  if (o.tipo === 'COMPRA') return o.compraNumero ? `Приёмка закупки №${o.compraNumero}` : 'Поступление сырья';
  if (o.tipo === 'MERMA') return o.motivo?.match(/^Списание №\d+/)?.[0] ?? 'Списание сырья';
  if (o.tipo === 'REVISION') return o.motivo?.match(/^Инвентаризация №\d+/)?.[0] ?? 'Инвентаризация';
  return TYPES[o.tipo]?.label ?? 'Изменение остатка';
}

function operationNote(o: Operation): string | null {
  if (o.tipo === 'CONSUMO' || o.tipo === 'DEVOLUCION' || o.tipo === 'COMPRA') return null;
  return o.motivo?.replace(/^(?:Списание|Инвентаризация) №\d+ \(Office\):\s*/, '').trim() || null;
}

function dayLabel(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat(locale(), { timeZone: timezone, day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}
function timeLabel(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}
function positionCount(count: number): string {
  const tail = count % 10;
  return `${count} ${count % 100 >= 11 && count % 100 <= 14 ? 'позиций' : tail === 1 ? 'позиция' : tail >= 2 && tail <= 4 ? 'позиции' : 'позиций'} сырья`;
}
function operationCount(count: number): string {
  const tail = count % 10;
  return `${num(count)} ${count % 100 >= 11 && count % 100 <= 14 ? 'операций' : tail === 1 ? 'операция' : tail >= 2 && tail <= 4 ? 'операции' : 'операций'}`;
}

/** Одна операция в списке, сырьё и точные остатки — по раскрытию. */
export default function Movements() {
  const [period, setPeriod] = usePeriod('week');
  const [filter, setFilter] = useState<keyof typeof FILTERS>('all');
  const [page, setPage] = useState(0);
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const { data, error, reload, loading } = useFetch(
    () => get<Resp>('/inv/movements' + qs({ ...period, tipo: FILTERS[filter], limit: PAGE, offset: page * PAGE })),
    [period.from, period.to, filter, page],
  );
  useEffect(() => { if (!loading && page > 0 && data?.groups.length === 0) setPage(0); }, [data, loading, page]);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const exportRows: ExportLine[] = data.groups.flatMap((o) => o.lines.map((line) => ({ ...line, operation: operationTitle(o), who: o.who })));
  const cols: Col<ExportLine>[] = [
    { key: 'date', header: 'Дата и время', render: (r) => fmtDateTime(r.at), csv: (r) => fmtDateTime(r.at) },
    { key: 'operation', header: 'Операция', render: (r) => r.operation, csv: (r) => r.operation },
    { key: 'name', header: 'Сырьё', render: (r) => r.nombre, csv: (r) => r.nombre },
    { key: 'quantity', header: 'Изменение', render: (r) => r.cantidad, csv: (r) => r.cantidad },
    { key: 'unit', header: 'Ед. изм.', render: (r) => r.unidad, csv: (r) => r.unidad },
    { key: 'stock', header: 'Остаток после', render: (r) => r.saldo, csv: (r) => r.saldo },
    ...(data.canCost ? [{ key: 'cost', header: 'Стоимость сырья', render: (r: ExportLine) => r.costo === null ? '—' : money(Math.abs(r.cantidad) * r.costo), csv: (r: ExportLine) => r.costo === null ? null : Math.abs(r.cantidad) * r.costo }] : []),
    { key: 'who', header: 'Ответственный', render: (r) => r.who ?? 'Система', csv: (r) => r.who ?? 'Система' },
  ];
  let currentDay = '';
  return (
    <>
      <PageHeader title="Движение товаров" subtitle="Здесь видно, когда и почему изменились запасы. Откройте операцию, чтобы посмотреть сырьё и остатки." />
      <div className="no-print mb-4 space-y-3">
        <div><div className="mb-1 text-xs font-medium text-muted">Период</div><PeriodPicker value={period} onChange={(p) => { setPeriod(p); setPage(0); }} /></div>
        <div><div className="mb-1 text-xs font-medium text-muted">Тип операции</div><Chips value={filter} onChange={(f) => { setFilter(f); setPage(0); }} options={[
          { id: 'all', label: 'Все изменения' }, { id: 'sales', label: 'Продажи' }, { id: 'in', label: 'Пополнение' },
          { id: 'writeoffs', label: 'Списания' }, { id: 'stocktakes', label: 'Инвентаризация' }, { id: 'adjustments', label: 'Корректировки' },
        ]} /></div>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
        <div><b>{operationCount(data.total)}</b><span className="ml-2 text-muted">за выбранный период · время заведения</span></div>
        {exportRows.length > 0 && <div className="no-print flex flex-wrap gap-1">
          <button className="btn btn-ghost btn-sm" onClick={() => window.print()} title="Печать или сохранение в PDF"><Printer size={14} /> Печать / PDF</button>
          <button className="btn btn-ghost btn-sm" onClick={() => exportXlsx('dvizhenie-tovarov', cols, exportRows)}><FileSpreadsheet size={14} /> Excel</button>
          <button className="btn btn-ghost btn-sm" onClick={() => exportCsv('dvizhenie-tovarov', cols, exportRows)}><Download size={14} /> CSV</button>
        </div>}
      </div>
      {error && <ErrorBox error={error} onRetry={reload} />}
      <div className={loading ? 'space-y-3 opacity-60 transition' : 'space-y-3 transition'}>
        {data.groups.length === 0 && <div className="card px-6 py-10 text-center text-muted">За выбранный период движений товара нет.</div>}
        {data.groups.map((o) => {
          const day = dayLabel(o.at, data.timezone);
          const showDay = day !== currentDay;
          currentDay = day;
          const isOpen = !!opened[o.key];
          const note = operationNote(o);
          const showLineTime = o.lines.some((line) => Math.abs(Date.parse(line.at) - Date.parse(o.at)) >= 60_000);
          return <div key={o.key}>
            {showDay && <h2 className="mb-2 mt-5 text-sm font-semibold text-muted first:mt-0">{day}</h2>}
            <section className="card overflow-hidden">
              <button type="button" className="no-print flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left hover:bg-surface2/50" aria-expanded={isOpen} onClick={() => setOpened((prev) => ({ ...prev, [o.key]: !prev[o.key] }))}>
                <span className="text-muted">{isOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}</span>
                <span className="min-w-[55px] text-sm text-muted">{timeLabel(o.at, data.timezone)}</span>
                <Badge tone={TYPES[o.tipo]?.tone ?? 'muted'}>{TYPES[o.tipo]?.label ?? 'Операция'}</Badge>
                <span className="min-w-[180px] flex-1 font-semibold">{operationTitle(o)}</span>
                <span className="text-sm text-muted">{positionCount(o.lineCount)}</span>
                {data.canCost && <span className="min-w-[110px] text-right font-semibold">{money(o.amount)}</span>}
              </button>
              <div className="hidden border-b border-line px-4 py-3 text-sm print:block"><b>{operationTitle(o)}</b> · {fmtDateTime(o.at)} · {positionCount(o.lineCount)}</div>
              <div className={isOpen ? 'border-t border-line px-4 pb-4 pt-3' : 'hidden border-t border-line px-4 pb-4 pt-3 print:block'}>
                <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
                  <span>Ответственный: {o.who ?? 'Система'}</span>
                  {note && <span>Основание: {note}</span>}
                </div>
                <div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead><tr>{showLineTime && <th className="th">Время строки</th>}<th className="th">Сырьё</th><th className="th !text-right">Изменение</th><th className="th !text-right">Остаток после</th>{data.canCost && <th className="th !text-right">Стоимость сырья</th>}</tr></thead>
                  <tbody>{o.lines.map((line) => <tr key={line.id}>
                    {showLineTime && <td className="td whitespace-nowrap text-muted">{fmtDateTime(line.at)}</td>}
                    <td className="td font-medium">{line.nombre}</td>
                    <td className={'td tnum text-right ' + (line.cantidad < 0 ? 'text-bad' : 'text-good')}>{line.cantidad > 0 ? '+' : ''}{fmtQty(line.cantidad)} {line.unidad}</td>
                    <td className="td tnum text-right">{fmtQty(line.saldo)} {line.unidad}</td>
                    {data.canCost && <td className="td tnum text-right">{line.costo === null ? '—' : money(Math.abs(line.cantidad) * line.costo)}</td>}
                  </tr>)}</tbody>
                </table></div>
              </div>
            </section>
          </div>;
        })}
      </div>
      {data.canCost && data.groups.length > 0 && <p className="mt-3 text-xs text-muted">Стоимость сырья показывает себестоимость изменения запасов. Это не сумма чека и не выручка.</p>}
      {data.total > PAGE && <div className="no-print mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <span>Операции {page * PAGE + 1}–{Math.min((page + 1) * PAGE, data.total)} из {data.total}. Печать и выгрузка относятся к этой странице.</span>
        <div className="flex gap-2"><button className="btn btn-soft btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>← Новее</button><button className="btn btn-soft btn-sm" disabled={(page + 1) * PAGE >= data.total} onClick={() => setPage(page + 1)}>Старше →</button></div>
      </div>}
    </>
  );
}
