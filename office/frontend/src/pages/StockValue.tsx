import { AlertTriangle } from 'lucide-react';
import { get } from '../api';
import { HBars } from '../charts';
import { money, num } from '../format';
import { Col, DataTable, ErrorBox, Loading, PageHeader, StatCard, useFetch } from '../ui';

interface S {
  total: number; groups: { category: string; value: number; items: number; noCost: number; negative: number }[];
  rows: { id: string; nombre: string; categoria: string; unidad: string; stock: number; costo: number | null; value: number | null }[];
}

export default function StockValue() {
  const { data, error, reload } = useFetch(() => get<S>('/acc/stock'), []);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const noCost = data.groups.reduce((a, g) => a + g.noCost, 0), neg = data.groups.reduce((a, g) => a + g.negative, 0);
  const cols: Col<S['rows'][number]>[] = [
    { key: 'n', header: 'Сырьё', render: (r) => r.nombre, sort: (r) => r.nombre, csv: (r) => r.nombre },
    { key: 'c', header: 'Категория', render: (r) => <span className="text-muted">{r.categoria}</span>, sort: (r) => r.categoria, csv: (r) => r.categoria, hideOnMobile: true },
    { key: 's', header: 'Остаток', align: 'right', render: (r) => <span className={r.stock < 0 ? 'text-bad' : ''}>{num(r.stock, 3)} {r.unidad}</span>, sort: (r) => r.stock, csv: (r) => r.stock },
    { key: 'p', header: 'Цена', align: 'right', render: (r) => (r.costo === null ? <span className="text-warn">нет цены</span> : money(r.costo)), csv: (r) => r.costo, hideOnMobile: true },
    { key: 'v', header: 'Стоимость', align: 'right', render: (r) => <b>{money(r.value)}</b>, sort: (r) => r.value, csv: (r) => r.value },
  ];
  return (
    <>
      <PageHeader title="Склад в деньгах" subtitle="Остатки сырья × закупочная цена. Отрицательные остатки в сумму не входят." />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Стоимость остатков" value={money(data.total)} sub={`${data.rows.length} позиций`} />
        <StatCard label="Позиций без цены" value={num(noCost)} tone={noCost ? 'warn' : 'good'} sub="не учтены в сумме" />
        <StatCard label="С отрицательным остатком" value={num(neg)} tone={neg ? 'bad' : 'good'} sub="нужна ревизия на складе" />
      </div>
      {(noCost > 0 || neg > 0) && <div className="mb-5 flex items-start gap-2 rounded-xl border border-warn/40 bg-warn/10 p-3.5 text-sm text-warn"><AlertTriangle size={16} className="mt-0.5 shrink-0" />Оценка неполная: у части сырья нет цены или остаток ушёл в минус из-за неточной ревизии.</div>}
      <div className="mb-5 grid gap-5 xl:grid-cols-3">
        <section className="card p-4"><h2 className="mb-3 font-semibold">По категориям</h2><HBars rows={data.groups.filter((g) => g.value > 0).map((g) => ({ name: g.category, value: g.value, sub: `${g.items} позиций` }))} /></section>
        <div className="xl:col-span-2"><DataTable cols={cols} rows={data.rows} rowKey={(r) => r.id} csvName="stock_value" maxHeight="520px" dense initialSort={{ key: 'v', dir: 'desc' }} /></div>
      </div>
    </>
  );
}
