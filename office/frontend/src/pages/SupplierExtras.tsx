import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Printer, TrendingUp } from 'lucide-react';
import { get, post } from '../api';
import { useAuth } from '../auth';
import { fmtDate, money } from '../format';
import { Badge, Col, DataTable, ErrorBox, Loading, Modal, PageHeader, StatCard, useFetch, useUi } from '../ui';
import { Chips, fmtQty, SearchBox, Sparkline } from '../ui2';

/* ───────── Акт сверки взаиморасчётов (печатная форма) ───────── */
interface Recon {
  supplier: { nombre: string; bin: string | null; address: string | null }; company: { name: string; bin: string; address: string; signer: string }; from: string; to: string;
  opening: number; delivered: number; paid: number; closing: number; rows: { date: string; kind: 'receipt' | 'payment'; doc: string; amount: number; balance: number }[]; printedAt: string;
}
const th = 'border border-gray-400 p-1.5';

export function ReconciliationPrint() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const from = sp.get('from') ?? '', to = sp.get('to') ?? '';
  const { me } = useAuth();
  const { data, error } = useFetch(() => get<Recon>(`/sup/suppliers/${id}/reconciliation?from=${from}&to=${to}`), [id, from, to], { live: false });
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const cur = (v: number) => money(v);
  return (
    <div className="min-h-full bg-slate-100 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] justify-end"><button className="btn btn-primary" onClick={() => window.print()}><Printer size={15} /> Печать / PDF</button></div>
      <article className="print-page mx-auto min-h-[297mm] max-w-[210mm] bg-white p-[16mm] text-[13px] leading-relaxed text-black shadow-lg">
        <header className="mb-6 text-center"><h1 className="text-[18px] font-bold uppercase tracking-wide">Акт сверки взаиморасчётов</h1><div>за период с {fmtDate(data.from)} по {fmtDate(data.to)}</div></header>
        <section className="mb-5 grid grid-cols-2 gap-6">
          <div><div className="text-[11px] uppercase text-gray-500">Покупатель</div><div className="font-semibold">{data.company.name || me!.settings.company}</div>{data.company.bin && <div>БИН {data.company.bin}</div>}{data.company.address && <div>{data.company.address}</div>}</div>
          <div><div className="text-[11px] uppercase text-gray-500">Поставщик</div><div className="font-semibold">{data.supplier.nombre}</div>{data.supplier.bin && <div>БИН/ИИН {data.supplier.bin}</div>}{data.supplier.address && <div>{data.supplier.address}</div>}</div>
        </section>
        <p className="mb-3 text-[12.5px]">Мы, нижеподписавшиеся, составили настоящий акт о том, что по данным учёта покупателя состояние взаиморасчётов следующее:</p>
        <table className="mb-5 w-full border-collapse text-[12px]">
          <thead><tr className="bg-gray-100"><th className={`${th} text-left`}>Дата</th><th className={`${th} text-left`}>Документ</th><th className={`${th} text-right`}>Поставлено товара</th><th className={`${th} text-right`}>Оплачено</th><th className={`${th} text-right`}>Сальдо (наш долг)</th></tr></thead>
          <tbody>
            <tr className="font-semibold"><td className={th} colSpan={4}>Сальдо на {fmtDate(data.from)}</td><td className={`${th} text-right`}>{cur(data.opening)}</td></tr>
            {data.rows.map((r, i) => <tr key={i}><td className={th}>{fmtDate(r.date)}</td><td className={th}>{r.doc}</td><td className={`${th} text-right`}>{r.kind === 'receipt' ? cur(r.amount) : ''}</td><td className={`${th} text-right`}>{r.kind === 'payment' ? cur(r.amount) : ''}</td><td className={`${th} text-right`}>{cur(r.balance)}</td></tr>)}
            {!data.rows.length && <tr><td className={`${th} text-center`} colSpan={5}>Операций за период не было</td></tr>}
            <tr className="bg-gray-100 font-bold"><td className={th} colSpan={2}>Обороты за период</td><td className={`${th} text-right`}>{cur(data.delivered)}</td><td className={`${th} text-right`}>{cur(data.paid)}</td><td className={th} /></tr>
            <tr className="font-bold"><td className={th} colSpan={4}>Сальдо на {fmtDate(data.to)}</td><td className={`${th} text-right`}>{cur(data.closing)}</td></tr>
          </tbody>
        </table>
        <p className="mb-10 text-[12.5px]">{data.closing > 0 ? <>Задолженность покупателя в пользу поставщика составляет <b>{cur(data.closing)}</b>.</> : data.closing < 0 ? <>Переплата покупателя составляет <b>{cur(-data.closing)}</b>.</> : <>Взаимных задолженностей нет.</>}</p>
        <section className="mt-16 grid grid-cols-2 gap-10 text-[12.5px]">
          <div><div className="mb-8">От покупателя:</div><div className="border-t border-black pt-1">{data.company.signer || '_______________'} / подпись</div><div className="mt-3 text-gray-500">М.П.</div></div>
          <div><div className="mb-8">От поставщика:</div><div className="border-t border-black pt-1">_______________ / подпись</div><div className="mt-3 text-gray-500">М.П.</div></div>
        </section>
        <footer className="mt-10 text-[10.5px] text-gray-500">Сформировано в Innova Office · {me!.name} · {fmtDate(data.printedAt)}</footer>
      </article>
    </div>
  );
}

/* ───────── Динамика закупочных цен ───────── */
interface P { id: string; nombre: string; unidad: string; categoria: string | null; cost: number | null; last: number | null; lastAt: string | null; prev: number | null; change: number | null; drift: number | null; avg90: number | null; min365: number | null; max365: number | null; purchases: number; suppliers: number }
interface Resp { rows: P[]; rising: number; stale: number }
interface Detail { insumo: { nombre: string; unidad: string; cost: number | null }; points: { date: string; price: number; qty: number; supplier: string; purchase: number }[] }

export function SupplierPrices() {
  const { can } = useAuth();
  const { toast, confirm } = useUi();
  const { data, error, reload } = useFetch(() => get<Resp>('/sup/prices'), []);
  const [view, setView] = useState<'all' | 'rising' | 'stale'>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<P | null>(null);
  const rows = useMemo(() => (data?.rows ?? []).filter((r) => r.purchases > 0 && (view === 'all' || (view === 'rising' ? (r.change ?? 0) >= 10 : Math.abs(r.drift ?? 0) >= 5)) && (!q || r.nombre.toLowerCase().includes(q.toLowerCase()))), [data, view, q]);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const apply = async (ids: string[]) => {
    if (!(await confirm({ title: `Обновить цены сырья (${ids.length})?`, text: 'В справочнике сырья цена станет равной цене последней закупки. Себестоимость техкарт пересчитается.', confirmLabel: 'Обновить цены' }))) return;
    try { const r = await post<{ changed: number }>('/sup/prices/apply', { insumoIds: ids }); toast('ok', `Обновлено цен: ${r.changed}`); void reload(); } catch (e) { toast('err', (e as Error).message); }
  };
  const staleIds = data.rows.filter((r) => Math.abs(r.drift ?? 0) >= 5).map((r) => r.id);
  const cols: Col<P>[] = [
    { key: 'n', header: 'Сырьё', render: (r) => <div><div className="font-medium">{r.nombre}</div><div className="text-xs text-muted">{r.categoria ?? '—'} · закупок {r.purchases}, поставщиков {r.suppliers}</div></div>, sort: (r) => r.nombre, csv: (r) => r.nombre },
    { key: 'l', header: 'Последняя закупка', align: 'right', render: (r) => <div><b>{money(r.last)}</b><div className="text-xs text-muted">{r.lastAt ? fmtDate(r.lastAt) : ''}</div></div>, sort: (r) => r.last, csv: (r) => r.last },
    { key: 'p', header: 'Предыдущая', align: 'right', render: (r) => (r.prev === null ? '—' : money(r.prev)), hideOnMobile: true, csv: (r) => r.prev },
    { key: 'c', header: 'Изменение', align: 'right', render: (r) => (r.change === null ? <span className="text-muted">—</span> : <b className={r.change > 0 ? 'text-bad' : r.change < 0 ? 'text-good' : 'text-muted'}>{r.change > 0 ? '▲' : r.change < 0 ? '▼' : ''} {Math.abs(r.change).toFixed(1)}%</b>), sort: (r) => r.change, csv: (r) => r.change },
    { key: 'av', header: 'Средняя 90 дн.', align: 'right', render: (r) => (r.avg90 === null ? '—' : money(r.avg90)), hideOnMobile: true, csv: (r) => r.avg90 },
    { key: 'co', header: 'В справочнике', align: 'right', render: (r) => <div>{r.cost === null ? '—' : money(r.cost)}{r.drift !== null && Math.abs(r.drift) >= 5 && <div className="text-[11px] text-warn">отстаёт на {Math.abs(r.drift).toFixed(0)}%</div>}</div>, sort: (r) => r.cost, csv: (r) => r.cost },
  ];
  return (
    <>
      <PageHeader title="Цены сырья" subtitle="Как менялись закупочные цены. Если цена в справочнике отстала от последней закупки, себестоимость блюд считается неверно"
        actions={can('ing.cost') && staleIds.length > 0 && <button className="btn btn-primary" onClick={() => void apply(staleIds)}><TrendingUp size={15} /> Обновить устаревшие ({staleIds.length})</button>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="С историей закупок" value={data.rows.filter((r) => r.purchases > 0).length} sub={`из ${data.rows.length} позиций`} />
        <StatCard label="Подорожало на 10% и больше" value={data.rising} tone={data.rising ? 'bad' : undefined} />
        <StatCard label="Цена в справочнике устарела" value={data.stale} tone={data.stale ? 'warn' : undefined} sub="расхождение с последней закупкой от 5%" />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Chips value={view} onChange={setView} options={[{ id: 'all', label: 'Все' }, { id: 'rising', label: 'Подорожали', count: data.rising }, { id: 'stale', label: 'Устарел справочник', count: data.stale }]} />
        <SearchBox value={q} onChange={setQ} placeholder="Найти сырьё…" className="w-56" />
      </div>
      <DataTable cols={cols} rows={rows} rowKey={(r) => r.id} csvName="price-dynamics" onRowClick={setOpen} initialSort={{ key: 'c', dir: 'desc' }} empty={<div className="py-12 text-center text-sm text-muted">Пока нет принятых закупок — история цен появится после первой приёмки товара</div>} />
      {open && <PriceModal p={open} onClose={() => setOpen(null)} canApply={can('ing.cost')} onApply={() => apply([open.id])} />}
    </>
  );
}

function PriceModal({ p, onClose, canApply, onApply }: { p: P; onClose: () => void; canApply: boolean; onApply: () => void }) {
  const { data } = useFetch(() => get<Detail>('/sup/prices/' + p.id), [p.id], { live: false });
  const vals = (data?.points ?? []).map((x) => x.price);
  const trend = vals.length > 1 ? (vals[vals.length - 1] > vals[0] ? 'bad' : vals[vals.length - 1] < vals[0] ? 'good' : 'brand') : 'brand';
  return (
    <Modal open onClose={onClose} title={p.nombre} width={620} footer={<>{canApply && p.last !== null && p.cost !== p.last && <button className="btn btn-soft mr-auto" onClick={onApply}>Поставить в справочник {money(p.last)}</button>}<button className="btn btn-primary" onClick={onClose}>Закрыть</button></>}>
      {!data ? <Loading /> : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2 text-center">
            {[['Минимум за год', p.min365], ['Максимум за год', p.max365], ['В справочнике', p.cost]].map(([k, v]) => <div key={k as string} className="rounded-lg bg-surface2 p-3"><div className="tnum text-base font-semibold">{v === null ? '—' : money(v as number)}</div><div className="text-[11px] text-muted">{k}</div></div>)}
          </div>
          <div className="mb-4 flex justify-center rounded-lg border border-line p-3"><Sparkline values={vals} width={540} height={90} tone={trend as 'brand' | 'bad' | 'good'} /></div>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-line">
            <table className="w-full text-[13px]"><thead><tr><th className="th">Дата</th><th className="th">Поставщик</th><th className="th text-right">Количество</th><th className="th text-right">Цена</th></tr></thead>
              <tbody>{[...data.points].reverse().map((x, i) => <tr key={i}><td className="td">{fmtDate(x.date)}</td><td className="td">{x.supplier} <Badge>№{x.purchase}</Badge></td><td className="td tnum text-right">{fmtQty(x.qty)} {data.insumo.unidad}</td><td className="td tnum text-right font-medium">{money(x.price)}</td></tr>)}</tbody></table>
          </div>
        </>
      )}
    </Modal>
  );
}
