import { useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { get } from '../api';
import { fmtDate, fmtDateTime, money, num, pct } from '../format';
import { ErrorBox, Loading, useFetch } from '../ui';

interface Card {
  productoId: string; nombre: string; categoria: string; precio: number; rendimiento: number | null; tecnologia: string; costo: number; margen: number | null;
  items: { id: string; tipo: 'insumo' | 'plato'; nombre: string; unidad: string; cantidad: number; neto: number | null; costo: number | null }[];
  state: { status: string; statusLabel: string; version: number | null; updatedBy: string | null; updatedAt: string | null; approvedBy: string | null; approvedAt: string | null };
}

const f = (u: string) => (u === 'кг' || u === 'л' ? 1000 : 1);
const du = (u: string) => (u === 'кг' ? 'г' : u === 'л' ? 'мл' : u);

/** Технологическая карта: печатная форма А4 (состав на 1 порцию, выход, технология, подписи). */
export default function TechCardPrint() {
  const { id } = useParams();
  const { data, error } = useFetch(() => get<Card>('/tc/cards/' + id), [id], { live: false });
  const { data: st } = useFetch(() => get<{ company: string; bin: string; signer: string }>('/settings'), []);
  if (error) return <ErrorBox error={error} />;
  if (!data || !st) return <Loading />;
  const approved = data.state.status === 'approved';
  return (
    <div className="min-h-full bg-slate-100 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] justify-end"><button className="btn btn-primary" onClick={() => window.print()}><Printer size={15} /> Печать / PDF</button></div>
      <article className="print-page mx-auto min-h-[297mm] max-w-[210mm] bg-white p-[15mm] text-[12.5px] leading-relaxed text-black shadow-lg">
        <div className="flex items-start justify-between gap-6">
          <div className="text-[11px]"><div className="font-semibold">{st.company}</div>{st.bin && <div>БИН {st.bin}</div>}</div>
          <div className="w-[230px] text-[11px]"><div className="font-semibold uppercase">Утверждаю</div><div>{approved ? `${data.state.approvedBy}` : '_______________ / ____________'}</div><div>{approved ? fmtDate(data.state.approvedAt) : '«___» __________ 20__ г.'}</div></div>
        </div>
        <h1 className="my-5 text-center text-[17px] font-bold uppercase tracking-wide">Технологическая карта</h1>
        <div className="mb-4 grid grid-cols-2 gap-x-8 gap-y-1 border-y border-gray-400 py-2 text-[13px]">
          <div><span className="text-gray-500">Блюдо:</span> <b>{data.nombre}</b></div><div><span className="text-gray-500">Раздел меню:</span> {data.categoria}</div>
          <div><span className="text-gray-500">Выход готового блюда:</span> <b>{data.rendimiento ? `${num(data.rendimiento)} г/мл` : '—'}</b></div><div><span className="text-gray-500">Редакция:</span> {data.state.version ? `v${data.state.version}` : '—'} · {data.state.statusLabel}</div>
        </div>
        <table className="mb-4 w-full border-collapse text-[12px]">
          <thead><tr className="bg-gray-100"><th className="w-8 border border-gray-400 p-1.5">№</th><th className="border border-gray-400 p-1.5 text-left">Наименование сырья и продуктов</th><th className="w-[90px] border border-gray-400 p-1.5 text-right">Брутто</th><th className="w-[90px] border border-gray-400 p-1.5 text-right">Нетто</th></tr></thead>
          <tbody>
            {data.items.map((i, k) => (
              <tr key={i.id}><td className="border border-gray-400 p-1.5 text-center">{k + 1}</td><td className="border border-gray-400 p-1.5">{i.nombre}{i.tipo === 'plato' ? ' (готовое блюдо)' : ''}</td>
                <td className="border border-gray-400 p-1.5 text-right">{num(i.cantidad * f(i.unidad), 3)} {du(i.unidad)}</td><td className="border border-gray-400 p-1.5 text-right">{i.neto !== null ? `${num(i.neto * f(i.unidad), 3)} ${du(i.unidad)}` : '—'}</td></tr>
            ))}
            <tr className="font-semibold"><td className="border border-gray-400 p-1.5" colSpan={3}>Выход</td><td className="border border-gray-400 p-1.5 text-right">{data.rendimiento ? `${num(data.rendimiento)}` : '—'}</td></tr>
          </tbody>
        </table>
        <section className="mb-4"><h2 className="mb-1 text-[13px] font-bold uppercase">Технология приготовления</h2><div className="whitespace-pre-wrap text-[12.5px]">{data.tecnologia || '—'}</div></section>
        <section className="mb-6 grid grid-cols-3 gap-3 border border-gray-400 p-2 text-center text-[12px]">
          <div><div className="text-gray-500">Себестоимость порции</div><b>{money(data.costo)}</b></div><div><div className="text-gray-500">Цена продажи</div><b>{money(data.precio)}</b></div><div><div className="text-gray-500">Маржа</div><b>{pct(data.margen)}</b></div>
        </section>
        <section className="mt-12 grid grid-cols-2 gap-10 text-[12px]">
          <div><div className="mb-7">Технолог:</div><div className="border-t border-black pt-1">{data.state.updatedBy || '_______________'} / подпись</div></div>
          <div><div className="mb-7">Шеф-повар / заведующий производством:</div><div className="border-t border-black pt-1">_______________ / подпись</div></div>
        </section>
        <footer className="mt-8 text-[10px] text-gray-500">Innova Office · карта изменена {fmtDateTime(data.state.updatedAt)} · нормы закладки в г/мл · ID {data.productoId}</footer>
      </article>
    </div>
  );
}
