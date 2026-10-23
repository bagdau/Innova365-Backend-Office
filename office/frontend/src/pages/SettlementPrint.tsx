import { useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { get } from '../api';
import { useAuth } from '../auth';
import { fmtDate, money, num, pct } from '../format';
import { ErrorBox, Loading, useFetch } from '../ui';
import type { Settlement } from './Settlements';

interface Detail extends Settlement { outlet: { name: string; legalName: string | null; bin: string | null; contact: string | null; phone: string | null; email: string | null }; lines: { nombre: string; qty: number; revenue: number }[] }

/** Акт взаиморасчётов: печатная форма А4. */
export default function SettlementPrint({ tenant }: { tenant?: boolean } = {}) {
  const { id } = useParams();
  const { me } = useAuth();
  const { data, error } = useFetch(() => get<Detail>((tenant ? '/tenant/settlements/' : '/fc/settlements/') + id), [id], { live: false });
  const { data: st } = useFetch(() => get<{ company: string; bin: string; address: string; signer: string }>('/settings'), []);
  if (error) return <ErrorBox error={error} />;
  if (!data || !st) return <Loading />;
  return (
    <div className="min-h-full bg-slate-100 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] justify-end"><button className="btn btn-primary" onClick={() => window.print()}><Printer size={15} /> Печать / PDF</button></div>
      <article className="print-page mx-auto min-h-[297mm] max-w-[210mm] bg-white p-[16mm] text-[13px] leading-relaxed text-black shadow-lg">
        <header className="mb-6 text-center">
          <h1 className="text-[18px] font-bold uppercase tracking-wide">Акт взаиморасчётов № {data.number}</h1>
          <div>за период с {fmtDate(data.periodFrom)} по {fmtDate(data.periodTo)}</div>
        </header>
        <section className="mb-5 grid grid-cols-2 gap-6">
          <div><div className="text-[11px] uppercase text-gray-500">Оператор фудкорта</div><div className="font-semibold">{st.company || me!.settings.company}</div>{st.bin && <div>БИН {st.bin}</div>}{st.address && <div>{st.address}</div>}</div>
          <div><div className="text-[11px] uppercase text-gray-500">Арендатор</div><div className="font-semibold">{data.outlet.legalName || data.outlet.name}</div>{data.outlet.bin && <div>БИН/ИИН {data.outlet.bin}</div>}<div>Точка: {data.outlet.name}</div>{data.outlet.contact && <div>{data.outlet.contact}{data.outlet.phone ? `, ${data.outlet.phone}` : ''}</div>}</div>
        </section>
        <table className="mb-5 w-full border-collapse text-[12.5px]">
          <thead><tr className="bg-gray-100"><th className="border border-gray-400 p-1.5 text-left">Категория меню</th><th className="border border-gray-400 p-1.5 text-right">Кол-во</th><th className="border border-gray-400 p-1.5 text-right">Выручка</th></tr></thead>
          <tbody>
            {data.lines.map((l) => <tr key={l.nombre}><td className="border border-gray-400 p-1.5">{l.nombre}</td><td className="border border-gray-400 p-1.5 text-right">{num(l.qty)}</td><td className="border border-gray-400 p-1.5 text-right">{money(l.revenue)}</td></tr>)}
            <tr className="font-semibold"><td className="border border-gray-400 p-1.5" colSpan={2}>Выручка точки за период ({num(data.orders)} заказов)</td><td className="border border-gray-400 p-1.5 text-right">{money(data.revenue)}</td></tr>
          </tbody>
        </table>
        <table className="mb-8 ml-auto w-[330px] border-collapse text-[13px]">
          <tbody>
            <tr><td className="border border-gray-400 p-1.5">Комиссия фудкорта ({pct(data.commissionPct)})</td><td className="border border-gray-400 p-1.5 text-right">− {money(data.commission)}</td></tr>
            <tr><td className="border border-gray-400 p-1.5">Аренда за период</td><td className="border border-gray-400 p-1.5 text-right">− {money(data.rent)}</td></tr>
            <tr className="bg-gray-100 font-bold"><td className="border border-gray-400 p-1.5">{data.payable >= 0 ? 'К выплате арендатору' : 'К доплате арендатором'}</td><td className="border border-gray-400 p-1.5 text-right">{money(Math.abs(data.payable))}</td></tr>
          </tbody>
        </table>
        <section className="mt-16 grid grid-cols-2 gap-10 text-[12.5px]">
          <div><div className="mb-8">Оператор фудкорта:</div><div className="border-t border-black pt-1">{st.signer || '_______________'} / подпись</div><div className="mt-3 text-gray-500">М.П.</div></div>
          <div><div className="mb-8">Арендатор:</div><div className="border-t border-black pt-1">{data.outlet.contact || '_______________'} / подпись</div><div className="mt-3 text-gray-500">М.П.</div></div>
        </section>
        <footer className="mt-10 text-[10.5px] text-gray-500">Сформировано в Innova Office · {me!.name} · статус: {data.status === 'paid' ? 'выплачено' : data.status === 'issued' ? 'выставлено' : 'черновик'}</footer>
      </article>
    </div>
  );
}
