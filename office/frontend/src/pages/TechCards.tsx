import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChefHat, Search } from 'lucide-react';
import clsx from 'clsx';
import { get } from '../api';
import { money, pct, fmtDateTime } from '../format';
import { Badge, Col, DataTable, ErrorBox, Loading, PageHeader, useFetch } from '../ui';

export interface CardRow { productoId: string; nombre: string; categoria: string; categoriaId: string; precio: number; disponible: boolean; hasCard: boolean; items: number; costo: number; incompleto: boolean; margen: number | null; status: string; statusLabel: string; version: number | null; updatedAt: string | null; updatedBy: string | null }
interface Resp { summary: Record<string, number>; rows: CardRow[] }

export const STATUS_TONE: Record<string, 'muted' | 'info' | 'good' | 'bad' | 'warn'> = { none: 'warn', draft: 'muted', review: 'info', approved: 'good', rejected: 'bad' };
export const marginTone = (m: number | null) => (m === null ? '' : m < 50 ? 'text-bad' : m < 65 ? 'text-warn' : 'text-good');

const FILTERS: [string, string][] = [['all', 'Все'], ['approved', 'Утверждены'], ['review', 'На согласовании'], ['draft', 'Черновики'], ['rejected', 'Возвращены'], ['none', 'Без техкарты'], ['lowmargin', 'Маржа < 50%']];

export default function TechCards() {
  const nav = useNavigate();
  const { data, error, reload } = useFetch(() => get<Resp>('/tc/cards'), []);
  const [filter, setFilter] = useState('all');
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const cats = useMemo(() => [...new Set((data?.rows ?? []).map((r) => r.categoria))], [data]);
  const rows = useMemo(() => (data?.rows ?? []).filter((r) => {
    if (cat && r.categoria !== cat) return false;
    if (q && !r.nombre.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === 'all') return true;
    if (filter === 'lowmargin') return r.margen !== null && r.margen < 50;
    return r.status === filter;
  }), [data, filter, cat, q]);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const s = data.summary;

  const cols: Col<CardRow>[] = [
    { key: 'n', header: 'Блюдо', render: (r) => <div><div className="font-medium">{r.nombre}</div><div className="text-[11px] text-muted md:hidden">{r.categoria}</div></div>, sort: (r) => r.nombre, csv: (r) => r.nombre },
    { key: 'c', header: 'Категория', render: (r) => <span className="text-muted">{r.categoria}</span>, sort: (r) => r.categoria, csv: (r) => r.categoria, hideOnMobile: true },
    { key: 'st', header: 'Статус', render: (r) => <span className="inline-flex items-center gap-1.5"><Badge tone={STATUS_TONE[r.status]}>{r.statusLabel}</Badge>{r.version ? <span className="text-[11px] text-muted">v{r.version}</span> : null}</span>, sort: (r) => r.status, csv: (r) => r.statusLabel },
    { key: 'it', header: 'Позиций', align: 'right', render: (r) => r.items || '—', sort: (r) => r.items, csv: (r) => r.items, hideOnMobile: true },
    { key: 'cost', header: 'Себестоимость', align: 'right', render: (r) => (r.hasCard ? <span>{money(r.costo)}{r.incompleto && <AlertTriangle size={12} className="ml-1 inline text-warn" />}</span> : '—'), sort: (r) => (r.hasCard ? r.costo : null), csv: (r) => (r.hasCard ? r.costo : null) },
    { key: 'price', header: 'Цена', align: 'right', render: (r) => money(r.precio), sort: (r) => r.precio, csv: (r) => r.precio, hideOnMobile: true },
    { key: 'm', header: 'Маржа', align: 'right', render: (r) => <b className={marginTone(r.margen)}>{pct(r.margen)}</b>, sort: (r) => r.margen, csv: (r) => r.margen },
    { key: 'u', header: 'Изменена', render: (r) => <span className="text-xs text-muted">{r.updatedAt ? `${fmtDateTime(r.updatedAt)} · ${r.updatedBy ?? ''}` : '—'}</span>, hideOnMobile: true, csv: (r) => r.updatedAt },
  ];

  return (
    <>
      <PageHeader title="Технологические карты" subtitle="Состав, выход и технология блюд. Себестоимость считается по ценам сырья, изменения проходят согласование" />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {([['approved', 'Утверждены', 'text-good'], ['review', 'На согласовании', 'text-info'], ['draft', 'Черновики', ''], ['rejected', 'Возвращены', 'text-bad'], ['none', 'Без техкарты', 'text-warn'], ['all', 'Всего блюд', '']] as const).map(([k, l, c]) => (
          <button key={k} onClick={() => setFilter(k === 'all' ? 'all' : k)} className={clsx('card p-3 text-left transition hover:border-brand/50', filter === k && 'border-brand ring-2 ring-brand/15')}>
            <div className={clsx('tnum text-2xl font-semibold', c)}>{k === 'all' ? s.total : s[k]}</div><div className="text-[12px] text-muted">{l}</div></button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input !pl-9" placeholder="Поиск блюда…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="input !h-9 !w-auto" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Все категории</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>
        <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-0.5">{FILTERS.map(([k, l]) => <button key={k} onClick={() => setFilter(k)} className={clsx('rounded-md px-2.5 py-1 text-[12.5px] font-medium', filter === k ? 'bg-brand text-brandfg' : 'text-muted hover:text-ink')}>{l}</button>)}</div>
      </div>
      <DataTable cols={cols} rows={rows} rowKey={(r) => r.productoId} onRowClick={(r) => nav('/techcards/' + r.productoId)} csvName="techcards" initialSort={{ key: 'c', dir: 'asc' }}
        empty={<div className="flex flex-col items-center gap-2 py-12 text-sm text-muted"><ChefHat size={36} className="text-muted/50" />Ничего не найдено</div>} />
    </>
  );
}
