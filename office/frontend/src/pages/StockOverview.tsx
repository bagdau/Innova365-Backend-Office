import { useMemo, useState } from 'react';
import { AlertTriangle, Boxes, PackageX, TrendingDown, Wallet } from 'lucide-react';
import { get } from '../api';
import { fmtDate, money } from '../format';
import { Badge, Col, DataTable, ErrorBox, Loading, PageHeader, StatCard, useFetch } from '../ui';
import { Chips, fmtQty, SearchBox } from '../ui2';

interface Item { id: string; nombre: string; categoria: string | null; unidad: string; stock: number; minimo: number; perDay: number; daysLeft: number | null; suggest: number; status: 'ok' | 'low' | 'out' | 'soon'; costo: number | null; value: number | null; proveedor: string | null; lastMove: string | null }
interface Resp { items: Item[]; canCost: boolean; totals: { count: number; out: number; low: number; soon: number; value: number | null } }

const STATUS: Record<Item['status'], { label: string; tone: 'good' | 'bad' | 'warn' | 'info' }> = { ok: { label: 'В норме', tone: 'good' }, soon: { label: 'Скоро закончится', tone: 'info' }, low: { label: 'Ниже минимума', tone: 'warn' }, out: { label: 'Нет в наличии', tone: 'bad' } };

/** Остатки склада с расходом за 30 дней, прогнозом «на сколько хватит» и рекомендацией к закупке. */
export default function StockOverview() {
  const { data, error, reload } = useFetch(() => get<Resp>('/inv/stock'), []);
  const [filter, setFilter] = useState<'all' | 'need' | 'out'>('all');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.items ?? []).filter((i) => (filter === 'all' || (filter === 'need' ? i.status !== 'ok' : i.status === 'out')) && (!cat || i.categoria === cat) && (!s || i.nombre.toLowerCase().includes(s)));
  }, [data, filter, q, cat]);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const cats = [...new Set(data.items.map((i) => i.categoria).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'ru'));
  const t = data.totals;
  const cols: Col<Item>[] = [
    { key: 'n', header: 'Сырьё', render: (i) => <div><div className="font-medium">{i.nombre}</div><div className="text-xs text-muted">{i.categoria ?? '—'}{i.proveedor ? ` · ${i.proveedor}` : ''}</div></div>, sort: (i) => i.nombre, csv: (i) => i.nombre },
    { key: 's', header: 'Статус', render: (i) => <Badge tone={STATUS[i.status].tone}>{STATUS[i.status].label}</Badge>, sort: (i) => ['out', 'low', 'soon', 'ok'].indexOf(i.status), csv: (i) => STATUS[i.status].label },
    { key: 'st', header: 'Остаток', align: 'right', render: (i) => <b>{fmtQty(i.stock)} <span className="font-normal text-muted">{i.unidad}</span></b>, sort: (i) => i.stock, csv: (i) => i.stock },
    { key: 'mi', header: 'Минимум', align: 'right', render: (i) => <span className="text-muted">{fmtQty(i.minimo)}</span>, sort: (i) => i.minimo, hideOnMobile: true, csv: (i) => i.minimo },
    { key: 'pd', header: 'Расход/день', align: 'right', render: (i) => (i.perDay ? fmtQty(i.perDay) : <span className="text-muted">—</span>), sort: (i) => i.perDay, hideOnMobile: true, csv: (i) => i.perDay },
    { key: 'dl', header: 'Хватит на', align: 'right', render: (i) => (i.daysLeft === null ? <span className="text-muted">—</span> : <span className={i.daysLeft < 3 ? 'font-semibold text-bad' : i.daysLeft < 7 ? 'text-warn' : ''}>{fmtQty(i.daysLeft, 1)} дн.</span>), sort: (i) => i.daysLeft, csv: (i) => i.daysLeft },
    { key: 'sg', header: 'Заказать', align: 'right', render: (i) => (i.suggest > 0 ? <b className="text-brand">{fmtQty(i.suggest, 2)} {i.unidad}</b> : <span className="text-muted">—</span>), sort: (i) => i.suggest, csv: (i) => i.suggest },
    ...(data.canCost ? [{ key: 'v', header: 'Стоимость', align: 'right' as const, render: (i: Item) => (i.value === null ? '—' : money(i.value)), sort: (i: Item) => i.value, hideOnMobile: true, csv: (i: Item) => i.value }] : []),
    { key: 'lm', header: 'Движение', render: (i) => <span className="text-xs text-muted">{i.lastMove ? fmtDate(i.lastMove) : '—'}</span>, sort: (i) => i.lastMove, hideOnMobile: true, csv: (i) => i.lastMove },
  ];
  return (
    <>
      <PageHeader title="Остатки и заказ" subtitle="Склад сейчас, расход за 30 дней и что пора закупить. Рекомендация — довезти запас до 7 дней расхода" />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Позиций на складе" value={t.count} icon={<Boxes size={16} />} />
        <StatCard label="Нет в наличии" value={t.out} tone={t.out ? 'bad' : undefined} icon={<PackageX size={16} />} />
        <StatCard label="Ниже минимума / скоро закончится" value={`${t.low} / ${t.soon}`} tone={t.low ? 'warn' : undefined} icon={<TrendingDown size={16} />} />
        {data.canCost ? <StatCard label="Склад в деньгах" value={money(t.value)} icon={<Wallet size={16} />} /> : <StatCard label="К заказу" value={data.items.filter((i) => i.suggest > 0).length} sub="позиций" icon={<AlertTriangle size={16} />} />}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Chips value={filter} onChange={setFilter} options={[{ id: 'all', label: 'Всё', count: t.count }, { id: 'need', label: 'Нужна закупка', count: t.low + t.soon + t.out }, { id: 'out', label: 'Нет в наличии', count: t.out }]} />
        <select className="input !h-8 !w-auto text-[13px]" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Все категории</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>
        <SearchBox value={q} onChange={setQ} placeholder="Найти сырьё…" className="w-56" />
      </div>
      <DataTable cols={cols} rows={rows} rowKey={(i) => i.id} csvName="stock" initialSort={{ key: 's', dir: 'asc' }} />
    </>
  );
}
