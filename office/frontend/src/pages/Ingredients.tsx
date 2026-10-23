import { useMemo, useState } from 'react';
import { AlertTriangle, Pencil, Plus, Search, TrendingUp } from 'lucide-react';
import { get, patch, post } from '../api';
import { useAuth } from '../auth';
import { money, num, pct } from '../format';
import { Badge, Col, DataTable, ErrorBox, Field, Loading, Modal, PageHeader, StatCard, useFetch, useUi } from '../ui';

interface Ing { id: string; nombre: string; categoria: string | null; unidad: string; costo: number | null; stock: number; minimo: number; used: number }
interface Impact { ingrediente: string; unidad: string; costoActual: number | null; costoNuevo: number; afectados: { productoId: string; nombre: string; costoBefore: number; costoAfter: number; delta: number; margenBefore: number | null; margenAfter: number | null }[] }

export default function Ingredients() {
  const { can } = useAuth();
  const { data, error, reload } = useFetch(() => get<Ing[]>('/tc/ingredients'), []);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Ing | 'new' | null>(null);
  const rows = useMemo(() => (data ?? []).filter((i) => !q || i.nombre.toLowerCase().includes(q.toLowerCase()) || (i.categoria ?? '').toLowerCase().includes(q.toLowerCase())), [data, q]);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const showCost = data.some((i) => i.costo !== null);
  const noCost = data.filter((i) => i.costo === null).length, unused = data.filter((i) => i.used === 0).length;

  const cols: Col<Ing>[] = [
    { key: 'n', header: 'Сырьё', render: (i) => <b>{i.nombre}</b>, sort: (i) => i.nombre, csv: (i) => i.nombre },
    { key: 'c', header: 'Категория', render: (i) => <span className="text-muted">{i.categoria ?? '—'}</span>, sort: (i) => i.categoria, csv: (i) => i.categoria, hideOnMobile: true },
    { key: 'u', header: 'Ед.', render: (i) => i.unidad, csv: (i) => i.unidad },
    ...(showCost ? [{ key: 'p', header: 'Цена за ед.', align: 'right' as const, render: (i: Ing) => (i.costo === null ? <Badge tone="warn">нет цены</Badge> : money(i.costo)), sort: (i: Ing) => i.costo, csv: (i: Ing) => i.costo }] : []),
    { key: 's', header: 'Остаток', align: 'right', render: (i) => <span className={i.stock < 0 ? 'text-bad' : i.stock < i.minimo ? 'text-warn' : ''}>{num(i.stock, 3)}</span>, sort: (i) => i.stock, csv: (i) => i.stock, hideOnMobile: true },
    { key: 'used', header: 'В техкартах', align: 'right', render: (i) => (i.used ? i.used : <span className="text-muted">—</span>), sort: (i) => i.used, csv: (i) => i.used },
    ...(can('ing.edit') || can('ing.cost') ? [{ key: 'a', header: '', align: 'right' as const, render: (i: Ing) => <button className="btn btn-ghost btn-sm !px-1.5" onClick={() => setEdit(i)}><Pencil size={14} /></button> }] : []),
  ];

  return (
    <>
      <PageHeader title="Сырьё и цены" subtitle="Справочник ингредиентов. Цены закупки задаёт бухгалтерия — от них зависит себестоимость блюд" actions={can('ing.edit') && <button className="btn btn-primary" onClick={() => setEdit('new')}><Plus size={15} /> Новое сырьё</button>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Позиций сырья" value={num(data.length)} />
        <StatCard label="Без цены" value={num(noCost)} tone={noCost ? 'warn' : 'good'} sub={showCost ? 'блюда с ними считаются неполно' : 'цены скрыты для вашей роли'} />
        <StatCard label="Не используются в техкартах" value={num(unused)} sub="можно не заказывать" />
      </div>
      <div className="relative mb-4 w-full sm:w-80"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input !pl-9" placeholder="Поиск сырья…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <DataTable cols={cols} rows={rows} rowKey={(i) => i.id} csvName="ingredients" maxHeight="640px" dense />
      {edit && <EditModal ing={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void reload(); }} />}
    </>
  );
}

function EditModal({ ing, onClose, onSaved }: { ing: Ing | null; onClose: () => void; onSaved: () => void }) {
  const { can } = useAuth();
  const { toast } = useUi();
  const [f, setF] = useState({ nombre: ing?.nombre ?? '', categoria: ing?.categoria ?? '', unidad: ing?.unidad ?? 'кг', costo: ing?.costo === null || !ing ? '' : String(ing.costo) });
  const [busy, setBusy] = useState(false);
  const [impact, setImpact] = useState<Impact | null>(null);
  const canName = can('ing.edit'), canCost = can('ing.cost');
  const costNum = f.costo.trim() === '' ? null : Number(f.costo.replace(',', '.'));

  const preview = async () => {
    if (!ing || costNum === null) return;
    try { setImpact(await get<Impact>(`/tc/impact?insumoId=${ing.id}&cost=${costNum}`)); } catch (e) { toast('err', (e as Error).message); }
  };
  const save = async () => {
    setBusy(true);
    try {
      if (!ing) await post('/tc/ingredients', { nombre: f.nombre, categoria: f.categoria || null, unidad: f.unidad, costo: canCost ? costNum : null });
      else await patch('/tc/ingredients/' + ing.id, { ...(canName ? { nombre: f.nombre, categoria: f.categoria || null } : {}), ...(canCost ? { costo: costNum } : {}) });
      toast('ok', 'Сохранено'); onSaved();
    } catch (e) { toast('err', (e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={ing ? `Сырьё: ${ing.nombre}` : 'Новое сырьё'} width={620}
      footer={<><button className="btn btn-soft" onClick={onClose}>Отмена</button><button className="btn btn-primary" disabled={busy || !f.nombre.trim()} onClick={() => void save()}>Сохранить</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Название" className="sm:col-span-2"><input className="input" disabled={!canName} autoFocus value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></Field>
        <Field label="Категория"><input className="input" disabled={!canName} value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })} placeholder="Мясо, Овощи…" /></Field>
        <Field label="Единица"><select className="input" disabled={!!ing} value={f.unidad} onChange={(e) => setF({ ...f, unidad: e.target.value })}>{['кг', 'л', 'шт', 'г', 'мл'].map((u) => <option key={u}>{u}</option>)}</select></Field>
        {canCost && <Field label={`Цена закупки за 1 ${f.unidad}`} className="sm:col-span-2" hint="Меняет себестоимость всех блюд, где используется сырьё"><div className="flex gap-2"><input className="input tnum" inputMode="decimal" value={f.costo} onChange={(e) => { setF({ ...f, costo: e.target.value }); setImpact(null); }} placeholder="не задана" />
          {ing && <button className="btn btn-soft shrink-0" disabled={costNum === null} onClick={() => void preview()}><TrendingUp size={15} /> Влияние</button>}</div></Field>}
        {!canCost && <p className="text-xs text-muted sm:col-span-2">Цену закупки задаёт бухгалтер, администратор или владелец.</p>}
      </div>
      {impact && (
        <div className="mt-4 rounded-xl border border-line bg-surface2/50 p-3">
          <div className="mb-2 text-sm font-semibold">Если цена станет {money(impact.costoNuevo)} (сейчас {money(impact.costoActual)}) — изменится {impact.afectados.length} блюд</div>
          {impact.afectados.length ? <div className="max-h-56 overflow-auto"><table className="w-full text-[12.5px]"><thead><tr><th className="py-1 text-left text-muted">Блюдо</th><th className="py-1 text-right text-muted">Себестоимость</th><th className="py-1 text-right text-muted">Маржа</th></tr></thead><tbody>
            {impact.afectados.map((a) => <tr key={a.productoId}><td className="py-1">{a.nombre}</td><td className="tnum py-1 text-right">{money(a.costoBefore)} → <b>{money(a.costoAfter)}</b></td><td className={`tnum py-1 text-right ${(a.margenAfter ?? 0) < 50 ? 'text-bad' : ''}`}>{pct(a.margenBefore)} → <b>{pct(a.margenAfter)}</b></td></tr>)}
          </tbody></table></div> : <p className="flex items-center gap-1.5 text-sm text-muted"><AlertTriangle size={14} />Сырьё не используется в техкартах — на блюда не повлияет.</p>}
        </div>
      )}
    </Modal>
  );
}
