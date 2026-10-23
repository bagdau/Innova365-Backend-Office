import { useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { get } from '../api';
import { useAuth } from '../auth';
import { fmtDate, fmtDateTime, money } from '../format';
import { ErrorBox, Loading, useFetch } from '../ui';
import { fmtQty } from '../ui2';

interface Line { insumoId: string; nombre: string; unidad: string; book: number; actual: number | null; cost: number | null; applied: number | null; qty?: number }
interface Settings { company: string; bin: string; address: string; signer: string }

const th = 'border border-gray-400 p-1.5';

function Shell({ title, sub, st, children, foot }: { title: string; sub: string; st: Settings; children: React.ReactNode; foot: string }) {
  const { me } = useAuth();
  return (
    <div className="min-h-full bg-slate-100 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] justify-end"><button className="btn btn-primary" onClick={() => window.print()}><Printer size={15} /> Печать / PDF</button></div>
      <article className="print-page mx-auto min-h-[297mm] max-w-[210mm] bg-white p-[16mm] text-[13px] leading-relaxed text-black shadow-lg">
        <header className="mb-5 text-center"><div className="text-[12px] text-gray-600">{st.company || me!.settings.company}{st.bin ? ` · БИН ${st.bin}` : ''}</div>
          <h1 className="mt-1 text-[18px] font-bold uppercase tracking-wide">{title}</h1><div>{sub}</div></header>
        {children}
        <footer className="mt-10 text-[10.5px] text-gray-500">{foot} · сформировано в Innova Office · {me!.name}</footer>
      </article>
    </div>
  );
}

/** Акт инвентаризации: расхождения учётных остатков с фактическими. */
export function StocktakePrint() {
  const { id } = useParams();
  const { data, error } = useFetch(() => get<{ number: number; title: string; status: string; closed_at: string | null; closed_by_name: string | null; created_at: string; scope: string | null; shortage_value: number | null; surplus_value: number | null; canCost: boolean; lines: Line[] }>('/inv/stocktakes/' + id), [id], { live: false });
  const { data: st } = useFetch(() => get<Settings>('/settings'), [], { live: false });
  if (error) return <ErrorBox error={error} />;
  if (!data || !st) return <Loading />;
  const counted = data.lines.filter((l) => l.actual !== null);
  const diffs = counted.filter((l) => l.actual !== l.book);
  return (
    <Shell title={`Акт инвентаризации № ${data.number}`} sub={`${data.title} · ${data.scope ? `категория «${data.scope}»` : 'весь склад'} · на ${fmtDate(data.closed_at ?? data.created_at)}`} st={st} foot={`Статус: ${data.status === 'closed' ? 'закрыта' : data.status}`}>
      <p className="mb-3 text-[12.5px]">Проверено позиций: <b>{counted.length}</b> из {data.lines.length}. Выявлено расхождений: <b>{diffs.length}</b>.</p>
      <table className="mb-5 w-full border-collapse text-[12px]">
        <thead><tr className="bg-gray-100"><th className={`${th} text-left`}>№</th><th className={`${th} text-left`}>Наименование</th><th className={th}>Ед.</th><th className={`${th} text-right`}>По учёту</th><th className={`${th} text-right`}>Факт</th><th className={`${th} text-right`}>Разница</th>{data.canCost && <th className={`${th} text-right`}>Сумма</th>}</tr></thead>
        <tbody>
          {diffs.map((l, i) => { const d = (l.actual ?? 0) - l.book; return (
            <tr key={l.insumoId}><td className={th}>{i + 1}</td><td className={th}>{l.nombre}</td><td className={`${th} text-center`}>{l.unidad}</td><td className={`${th} text-right`}>{fmtQty(l.book)}</td><td className={`${th} text-right`}>{fmtQty(l.actual ?? 0)}</td>
              <td className={`${th} text-right font-semibold`}>{d > 0 ? '+' : ''}{fmtQty(d)}</td>{data.canCost && <td className={`${th} text-right`}>{l.cost === null ? '—' : money(d * l.cost)}</td>}</tr>); })}
          {!diffs.length && <tr><td className={`${th} text-center`} colSpan={data.canCost ? 7 : 6}>Расхождений нет</td></tr>}
        </tbody>
        {data.canCost && <tfoot><tr className="font-semibold"><td className={th} colSpan={6}>Недостача</td><td className={`${th} text-right`}>{money(data.shortage_value ?? 0)}</td></tr><tr className="font-semibold"><td className={th} colSpan={6}>Излишек</td><td className={`${th} text-right`}>{money(data.surplus_value ?? 0)}</td></tr></tfoot>}
      </table>
      <section className="mt-14 grid grid-cols-3 gap-8 text-[12px]">{['Председатель комиссии', 'Член комиссии', 'Материально ответственное лицо'].map((r) => <div key={r}><div className="mb-8">{r}:</div><div className="border-t border-black pt-1">подпись / расшифровка</div></div>)}</section>
      <div className="mt-6 text-[11px] text-gray-500">{data.closed_at ? `Закрыта ${fmtDateTime(data.closed_at)} · ${data.closed_by_name ?? ''}` : ''}</div>
    </Shell>
  );
}

/** Акт списания. */
export function WriteoffPrint() {
  const { id } = useParams();
  const { data, error } = useFetch(() => get<{ number: number; date: string; reasonLabel: string; note: string | null; status: string; total_cost: number | null; canCost: boolean; approved_by_name: string | null; created_by_name: string | null; lines: Line[] }>('/inv/writeoffs/' + id), [id], { live: false });
  const { data: st } = useFetch(() => get<Settings>('/settings'), [], { live: false });
  if (error) return <ErrorBox error={error} />;
  if (!data || !st) return <Loading />;
  return (
    <Shell title={`Акт списания № ${data.number}`} sub={`от ${fmtDate(data.date)} · причина: ${data.reasonLabel}`} st={st} foot={`Статус: ${data.status === 'approved' ? 'проведён' : data.status === 'draft' ? 'черновик' : 'отменён'}`}>
      {data.note && <p className="mb-3 text-[12.5px]">Комментарий: {data.note}</p>}
      <table className="mb-5 w-full border-collapse text-[12px]">
        <thead><tr className="bg-gray-100"><th className={`${th} text-left`}>№</th><th className={`${th} text-left`}>Наименование</th><th className={th}>Ед.</th><th className={`${th} text-right`}>Количество</th>{data.canCost && <><th className={`${th} text-right`}>Цена</th><th className={`${th} text-right`}>Сумма</th></>}</tr></thead>
        <tbody>{data.lines.map((l, i) => <tr key={i}><td className={th}>{i + 1}</td><td className={th}>{l.nombre}</td><td className={`${th} text-center`}>{l.unidad}</td><td className={`${th} text-right`}>{fmtQty(l.qty ?? 0)}</td>{data.canCost && <><td className={`${th} text-right`}>{l.cost === null ? '—' : money(l.cost)}</td><td className={`${th} text-right`}>{l.cost === null ? '—' : money((l.qty ?? 0) * l.cost)}</td></>}</tr>)}</tbody>
        {data.canCost && <tfoot><tr className="font-semibold"><td className={th} colSpan={5}>Итого</td><td className={`${th} text-right`}>{money(data.total_cost ?? 0)}</td></tr></tfoot>}
      </table>
      <section className="mt-14 grid grid-cols-3 gap-8 text-[12px]">{['Составил', 'Комиссия', 'Утвердил'].map((r) => <div key={r}><div className="mb-8">{r}:</div><div className="border-t border-black pt-1">подпись / расшифровка</div></div>)}</section>
      <div className="mt-6 text-[11px] text-gray-500">Составил: {data.created_by_name ?? '—'}{data.approved_by_name ? ` · утвердил: ${data.approved_by_name}` : ''}</div>
    </Shell>
  );
}
