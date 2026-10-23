import { useState } from 'react';
import { get, qs } from '../api';
import { fmtDateTime, money } from '../format';
import { Badge, Col, DataTable, ErrorBox, Loading, PageHeader, PeriodPicker, useFetch, usePeriod } from '../ui';
import { Chips, fmtQty } from '../ui2';

interface Row { id: string; tipo: string; cantidad: number; saldo: number; costo: number | null; motivo: string | null; at: string; insumoId: string; nombre: string; unidad: string; who: string | null }
interface Resp { total: number; canCost: boolean; rows: Row[] }

const TYPES: Record<string, { label: string; tone: 'good' | 'bad' | 'warn' | 'info' | 'brand' | 'muted' }> = {
  COMPRA: { label: 'Приёмка', tone: 'good' }, CONSUMO: { label: 'Расход по продажам', tone: 'muted' }, MERMA: { label: 'Списание', tone: 'bad' },
  REVISION: { label: 'Инвентаризация', tone: 'brand' }, AJUSTE: { label: 'Корректировка', tone: 'warn' }, DEVOLUCION: { label: 'Возврат', tone: 'info' }, INICIAL: { label: 'Начальный остаток', tone: 'muted' },
};
const GROUPS = { all: '', manual: 'MERMA,REVISION,AJUSTE', in: 'COMPRA,DEVOLUCION,INICIAL', sales: 'CONSUMO' } as const;
const PAGE = 100;

/** Журнал движения: каждая операция со складом — приёмка, расход по продажам, списание, инвентаризация. */
export default function Movements() {
  const [period, setPeriod] = usePeriod('week');
  const [group, setGroup] = useState<keyof typeof GROUPS>('all');
  const [page, setPage] = useState(0);
  const { data, error, reload, loading } = useFetch(() => get<Resp>('/inv/movements' + qs({ ...period, tipo: GROUPS[group], limit: PAGE, offset: page * PAGE })), [period.from, period.to, group, page]);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const cols: Col<Row>[] = [
    { key: 'at', header: 'Время', render: (r) => <span className="whitespace-nowrap text-muted">{fmtDateTime(r.at)}</span>, sort: (r) => r.at, csv: (r) => r.at },
    { key: 't', header: 'Операция', render: (r) => <Badge tone={TYPES[r.tipo]?.tone ?? 'muted'}>{TYPES[r.tipo]?.label ?? r.tipo}</Badge>, csv: (r) => TYPES[r.tipo]?.label ?? r.tipo },
    { key: 'n', header: 'Сырьё', render: (r) => <span className="font-medium">{r.nombre}</span>, sort: (r) => r.nombre, csv: (r) => r.nombre },
    { key: 'q', header: 'Количество', align: 'right', render: (r) => <b className={r.cantidad < 0 ? 'text-bad' : 'text-good'}>{r.cantidad > 0 ? '+' : ''}{fmtQty(r.cantidad)} <span className="font-normal text-muted">{r.unidad}</span></b>, sort: (r) => r.cantidad, csv: (r) => r.cantidad },
    { key: 's', header: 'Остаток после', align: 'right', render: (r) => fmtQty(r.saldo), hideOnMobile: true, csv: (r) => r.saldo },
    ...(data.canCost ? [{ key: 'c', header: 'Сумма', align: 'right' as const, render: (r: Row) => (r.costo === null ? '—' : money(Math.abs(r.cantidad) * r.costo)), hideOnMobile: true, csv: (r: Row) => (r.costo === null ? null : Math.abs(r.cantidad) * r.costo) }] : []),
    { key: 'm', header: 'Основание', render: (r) => <span className="text-muted">{r.motivo ?? '—'}</span>, csv: (r) => r.motivo, hideOnMobile: true },
    { key: 'w', header: 'Кто', render: (r) => <span className="text-xs text-muted">{r.who ?? 'система'}</span>, csv: (r) => r.who, hideOnMobile: true },
  ];
  return (
    <>
      <PageHeader title="Движение товаров" subtitle="Общий журнал склада: то же, что видит касса. Строки нельзя изменить — только добавить новыми операциями" />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <PeriodPicker value={period} onChange={(p) => { setPeriod(p); setPage(0); }} />
        <Chips value={group} onChange={(g) => { setGroup(g); setPage(0); }} options={[{ id: 'all', label: 'Все' }, { id: 'manual', label: 'Ручные (списания, ревизии)' }, { id: 'in', label: 'Приход' }, { id: 'sales', label: 'Расход по продажам' }]} />
      </div>
      <div className={loading ? 'opacity-60 transition' : 'transition'}>
        <DataTable cols={cols} rows={data.rows} rowKey={(r) => r.id} csvName="movements" dense />
        <div className="mt-3 flex items-center justify-between text-sm text-muted">
          <span>Показано {data.rows.length} из {data.total}</span>
          <div className="flex gap-2"><button className="btn btn-soft btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>← Новее</button><button className="btn btn-soft btn-sm" disabled={(page + 1) * PAGE >= data.total} onClick={() => setPage(page + 1)}>Старше →</button></div>
        </div>
      </div>
    </>
  );
}
