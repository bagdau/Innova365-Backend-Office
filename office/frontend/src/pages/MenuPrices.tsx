import { useMemo, useState } from 'react';
import { History, Layers, Plus, Settings2, Trash2 } from 'lucide-react';
import { del, get, patch, post, qs } from '../api';
import { useAuth } from '../auth';
import { fmtDateTime, money, num, pct } from '../format';
import { Badge, Col, DataTable, ErrorBox, Field, Loading, Modal, PageHeader, PeriodPicker, StatCard, Tabs, Toggle, useFetch, usePeriod, useUi } from '../ui';
import { Chips, parseNum, SearchBox } from '../ui2';

interface Item {
  id: string; nombre: string; categoriaId: string; categoria: string; precio: number; disponible: boolean; descripcion: string | null; hasCard: boolean; incompleto: boolean;
  unitCost: number | null; cm: number | null; marginPct: number | null; qty: number; revenue: number; share: number; class: string; classLabel: string;
}
interface Resp { from: string; to: string; canCost: boolean; canEdit: boolean; items: Item[]; categories: { id: string; nombre: string }[]; avgCm: number | null; popThreshold: number }
interface Hist { id: number; productoId: string; nombre: string; from: number | null; to: number; reason: string | null; who: string | null; at: string }

const CLS: Record<string, { tone: 'good' | 'info' | 'warn' | 'bad' | 'muted'; hint: string }> = {
  star: { tone: 'good', hint: 'Популярны и прибыльны — берегите, не трогайте цену без причины' },
  horse: { tone: 'info', hint: 'Популярны, но маржа ниже средней — попробуйте поднять цену или снизить себестоимость' },
  puzzle: { tone: 'warn', hint: 'Прибыльны, но продаются мало — продвигайте: позиция в меню, подсказки официантам' },
  dog: { tone: 'bad', hint: 'Непопулярны и малоприбыльны — кандидаты на замену или исключение' },
  no_card: { tone: 'muted', hint: 'Нет техкарты — себестоимость неизвестна' },
  no_sales: { tone: 'muted', hint: 'За период не продавалось' },
};

export default function MenuPrices() {
  const { can } = useAuth();
  const [tab, setTab] = useState<'menu' | 'eng' | 'history'>('menu');
  const [period, setPeriod] = usePeriod('month');
  const { data, error, reload } = useFetch(() => get<Resp>('/mn/items' + qs(period)), [period.from, period.to]);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  return (
    <>
      <PageHeader title="Меню и цены" subtitle="Цены, доступность и маржинальность блюд. Изменения сразу видны на кассе; каждая смена цены сохраняется в истории" />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'menu', label: 'Меню и цены' }, ...(data.canCost ? [{ id: 'eng' as const, label: 'Маржинальность' }] : []), { id: 'history', label: 'История цен' }]} />
      {tab !== 'history' && <div className="mb-4"><PeriodPicker value={period} onChange={setPeriod} /></div>}
      {tab === 'menu' && <MenuTab data={data} reload={reload} canEdit={can('menu.edit')} />}
      {tab === 'eng' && <Engineering data={data} />}
      {tab === 'history' && <HistoryTab />}
    </>
  );
}

/* ───────── Меню и цены ───────── */
function MenuTab({ data, reload, canEdit }: { data: Resp; reload: () => void; canEdit: boolean }) {
  const { toast } = useUi();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState(false);
  const [cats, setCats] = useState(false);
  const [adding, setAdding] = useState(false);
  const rows = useMemo(() => data.items.filter((i) => (!cat || i.categoriaId === cat) && (!q || i.nombre.toLowerCase().includes(q.toLowerCase()))), [data.items, cat, q]);
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOn = rows.length > 0 && rows.every((r) => sel.has(r.id));

  const savePrice = async (i: Item, raw: string) => {
    const v = parseNum(raw);
    if (!Number.isFinite(v) || v === i.precio) return;
    try { const r = await patch<{ warning: string | null }>('/mn/items/' + i.id, { precio: v }); toast(r.warning ? 'info' : 'ok', r.warning ? `Цена сохранена. ${r.warning}` : 'Цена сохранена'); reload(); } catch (e) { toast('err', (e as Error).message); }
  };
  const cols: Col<Item>[] = [
    ...(canEdit ? [{ key: 'sel', header: <input type="checkbox" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(rows.map((r) => r.id)))} className="h-4 w-4 accent-[rgb(var(--brand))]" />, render: (i: Item) => <input type="checkbox" checked={sel.has(i.id)} onChange={() => toggle(i.id)} className="h-4 w-4 accent-[rgb(var(--brand))]" />, width: 40 }] : []),
    { key: 'n', header: 'Блюдо', render: (i) => <div><div className="font-medium">{i.nombre}</div><div className="text-xs text-muted">{i.categoria}</div></div>, sort: (i) => i.nombre, csv: (i) => i.nombre },
    { key: 'p', header: 'Цена', align: 'right', render: (i) => (canEdit ? <PriceInput value={i.precio} onSave={(v) => void savePrice(i, v)} /> : <b>{money(i.precio)}</b>), sort: (i) => i.precio, csv: (i) => i.precio },
    ...(data.canCost ? [
      { key: 'c', header: 'Себестоимость', align: 'right' as const, render: (i: Item) => (i.unitCost === null ? <span className="text-muted">нет техкарты</span> : <span>{money(i.unitCost)}{i.incompleto && <span title="В техкарте есть сырьё без цены" className="ml-1 text-warn">⚠</span>}</span>), sort: (i: Item) => i.unitCost, csv: (i: Item) => i.unitCost },
      { key: 'm', header: 'Маржа', align: 'right' as const, render: (i: Item) => (i.marginPct === null ? '—' : <b className={i.marginPct < 50 ? 'text-bad' : i.marginPct < 65 ? 'text-warn' : 'text-good'}>{pct(i.marginPct)}</b>), sort: (i: Item) => i.marginPct, csv: (i: Item) => i.marginPct }] : []),
    { key: 'q', header: 'Продано', align: 'right', render: (i) => num(i.qty), sort: (i) => i.qty, hideOnMobile: true, csv: (i) => i.qty },
    { key: 'a', header: 'В продаже', render: (i) => (canEdit ? <Toggle checked={i.disponible} onChange={(v) => void patch('/mn/items/' + i.id, { disponible: v }).then(reload).catch((e) => toast('err', e.message))} /> : <Badge tone={i.disponible ? 'good' : 'muted'}>{i.disponible ? 'да' : 'нет'}</Badge>), csv: (i) => (i.disponible ? 'да' : 'нет') },
  ];
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className="input !h-8 !w-auto text-[13px]" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Все категории</option>{data.categories.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
        <SearchBox value={q} onChange={setQ} placeholder="Найти блюдо…" className="w-56" />
        {canEdit && <div className="ml-auto flex flex-wrap gap-2">
          <button className="btn btn-soft btn-sm" onClick={() => setCats(true)}><Settings2 size={14} /> Категории</button>
          <button className="btn btn-soft btn-sm" onClick={() => setAdding(true)}><Plus size={14} /> Новое блюдо</button>
          <button className="btn btn-primary btn-sm" disabled={!sel.size} onClick={() => setBulk(true)}><Layers size={14} /> Массово ({sel.size})</button>
        </div>}
      </div>
      <DataTable cols={cols} rows={rows} rowKey={(i) => i.id} csvName="menu" dense />
      {bulk && <BulkModal ids={[...sel]} items={data.items} onClose={() => setBulk(false)} onDone={() => { setBulk(false); setSel(new Set()); reload(); }} />}
      {cats && <CategoriesModal onClose={() => setCats(false)} onChanged={reload} />}
      {adding && <NewDishModal cats={data.categories} onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload(); }} />}
    </>
  );
}

function PriceInput({ value, onSave }: { value: number; onSave: (v: string) => void }) {
  const [v, setV] = useState(String(value));
  const [focus, setFocus] = useState(false);
  return <input className="input tnum !h-8 !w-[110px] text-right font-semibold" inputMode="decimal" value={focus ? v : num(Number(v) || value, 2)} onFocus={(e) => { setFocus(true); setV(String(value)); e.target.select(); }}
    onChange={(e) => setV(e.target.value)} onBlur={() => { setFocus(false); onSave(v); }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setV(String(value)); (e.target as HTMLInputElement).blur(); } }} />;
}

function BulkModal({ ids, items, onClose, onDone }: { ids: string[]; items: Item[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useUi();
  const [mode, setMode] = useState<'percent' | 'add' | 'set' | 'availability'>('percent');
  const [value, setValue] = useState('10');
  const [roundTo, setRoundTo] = useState('10');
  const [avail, setAvail] = useState(true);
  const [busy, setBusy] = useState(false);
  const chosen = items.filter((i) => ids.includes(i.id));
  const v = parseNum(value);
  const preview = (i: Item) => { let np = mode === 'percent' ? i.precio * (1 + v / 100) : mode === 'add' ? i.precio + v : v; const r = Number(roundTo); np = r ? Math.round(np / r) * r : Math.round(np * 100) / 100; return np; };
  const run = async () => {
    setBusy(true);
    try { const r = await post<{ changed: number }>('/mn/items/bulk', { ids, mode, value: mode === 'availability' ? undefined : v, available: mode === 'availability' ? avail : undefined, roundTo: mode === 'availability' || mode === 'set' ? undefined : Number(roundTo), reason: 'Массовое изменение в Office' }); toast('ok', `Изменено блюд: ${r.changed}`); onDone(); } catch (e) { toast('err', (e as Error).message); setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Массовое изменение · ${ids.length} блюд`} width={600} footer={<><button className="btn btn-soft" onClick={onClose}>Отмена</button><button className="btn btn-primary" disabled={busy || (mode !== 'availability' && !Number.isFinite(v))} onClick={() => void run()}>Применить</button></>}>
      <div className="mb-3"><Chips value={mode} onChange={setMode} options={[{ id: 'percent', label: 'На процент' }, { id: 'add', label: 'Прибавить сумму' }, { id: 'set', label: 'Одна цена' }, { id: 'availability', label: 'Доступность' }]} /></div>
      {mode === 'availability' ? <Toggle checked={avail} onChange={setAvail} label={avail ? 'Включить в продажу' : 'Убрать из продажи (стоп-лист)'} /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={mode === 'percent' ? 'Процент (минус — снизить)' : mode === 'add' ? 'Сумма (минус — снизить)' : 'Новая цена'}><input className="input tnum" autoFocus inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /></Field>
          {mode !== 'set' && <Field label="Округлить до"><select className="input" value={roundTo} onChange={(e) => setRoundTo(e.target.value)}>{['0', '1', '5', '10', '50', '100', '500'].map((r) => <option key={r} value={r}>{r === '0' ? 'до копеек' : r}</option>)}</select></Field>}
        </div>
      )}
      {mode !== 'availability' && <div className="mt-4 max-h-56 overflow-y-auto rounded-lg border border-line"><table className="w-full text-[13px]"><thead><tr><th className="th">Блюдо</th><th className="th text-right">Было</th><th className="th text-right">Станет</th></tr></thead>
        <tbody>{chosen.slice(0, 60).map((i) => { const np = preview(i); return <tr key={i.id}><td className="td">{i.nombre}</td><td className="td tnum text-right text-muted">{money(i.precio)}</td><td className={`td tnum text-right font-semibold ${Number.isFinite(np) && np < i.precio ? 'text-bad' : 'text-good'}`}>{Number.isFinite(np) ? money(np) : '—'}</td></tr>; })}</tbody></table></div>}
    </Modal>
  );
}

function CategoriesModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const { toast, confirm } = useUi();
  const { data, reload } = useFetch(() => get<{ id: string; nombre: string; items: number }[]>('/mn/categories'), [], { live: false });
  const [name, setName] = useState('');
  const act = async (fn: () => Promise<unknown>) => { try { await fn(); await reload(); onChanged(); } catch (e) { toast('err', (e as Error).message); } };
  return (
    <Modal open onClose={onClose} title="Категории меню" width={480} footer={<button className="btn btn-primary" onClick={onClose}>Готово</button>}>
      <div className="mb-3 flex gap-2"><input className="input" placeholder="Новая категория" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) void act(() => post('/mn/categories', { nombre: name }).then(() => setName(''))); }} /><button className="btn btn-primary" disabled={!name.trim()} onClick={() => void act(() => post('/mn/categories', { nombre: name }).then(() => setName('')))}>Добавить</button></div>
      {!data ? <Loading /> : <ul className="divide-y divide-line/70">{data.map((c) => (
        <li key={c.id} className="flex items-center gap-2 py-2 text-[13.5px]">
          <input className="input !h-8 flex-1" defaultValue={c.nombre} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.nombre) void act(() => patch('/mn/categories/' + c.id, { nombre: v })); }} />
          <span className="w-16 text-right text-xs text-muted">{c.items} блюд</span>
          <button className="btn btn-ghost btn-sm !px-1.5 hover:!text-bad" onClick={async () => { if (await confirm({ title: `Удалить категорию «${c.nombre}»?`, danger: true, confirmLabel: 'Удалить' })) void act(() => del('/mn/categories/' + c.id)); }}><Trash2 size={14} /></button>
        </li>))}</ul>}
    </Modal>
  );
}

function NewDishModal({ cats, onClose, onDone }: { cats: { id: string; nombre: string }[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useUi();
  const [f, setF] = useState({ nombre: '', precio: '', categoriaId: cats[0]?.id ?? '', descripcion: '' });
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await post('/mn/items', { nombre: f.nombre, precio: parseNum(f.precio), categoriaId: f.categoriaId, descripcion: f.descripcion || null }); toast('ok', 'Блюдо добавлено. Создайте для него техкарту'); onDone(); } catch (e) { toast('err', (e as Error).message); setBusy(false); } };
  return (
    <Modal open onClose={onClose} title="Новое блюдо" width={480} footer={<><button className="btn btn-soft" onClick={onClose}>Отмена</button><button className="btn btn-primary" disabled={busy || !f.nombre.trim() || !f.precio || !f.categoriaId} onClick={() => void save()}>Добавить</button></>}>
      <div className="space-y-3">
        <Field label="Название"><input className="input" autoFocus value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Цена"><input className="input tnum" inputMode="decimal" value={f.precio} onChange={(e) => setF({ ...f, precio: e.target.value })} /></Field>
          <Field label="Категория"><select className="input" value={f.categoriaId} onChange={(e) => setF({ ...f, categoriaId: e.target.value })}>{cats.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Field></div>
        <Field label="Описание"><input className="input" value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></Field>
        <p className="text-xs text-muted">Фото блюда добавляется в кассе. Состав и себестоимость — в «Техкартах».</p>
      </div>
    </Modal>
  );
}

/* ───────── Меню-инжиниринг ───────── */
function Engineering({ data }: { data: Resp }) {
  const [cls, setCls] = useState('');
  const withClass = data.items.filter((i) => ['star', 'horse', 'puzzle', 'dog'].includes(i.class));
  const groups = ['star', 'horse', 'puzzle', 'dog'].map((c) => ({ c, label: { star: 'Звёзды', horse: 'Рабочие лошадки', puzzle: 'Загадки', dog: 'Балласт' }[c]!, items: withClass.filter((i) => i.class === c).sort((a, b) => b.revenue - a.revenue) }));
  const shown = data.items.filter((i) => !cls || i.class === cls);
  const cols: Col<Item>[] = [
    { key: 'n', header: 'Блюдо', render: (i) => <div><div className="font-medium">{i.nombre}</div><div className="text-xs text-muted">{i.categoria}</div></div>, sort: (i) => i.nombre, csv: (i) => i.nombre },
    { key: 'cl', header: 'Класс', render: (i) => <Badge tone={CLS[i.class].tone}>{i.classLabel}</Badge>, sort: (i) => i.class, csv: (i) => i.classLabel },
    { key: 'q', header: 'Продано', align: 'right', render: (i) => num(i.qty), sort: (i) => i.qty, csv: (i) => i.qty },
    { key: 'sh', header: 'Доля продаж', align: 'right', render: (i) => (i.hasCard ? pct(i.share) : '—'), sort: (i) => i.share, csv: (i) => i.share },
    { key: 'cm', header: 'Прибыль с порции', align: 'right', render: (i) => (i.cm === null ? '—' : money(i.cm)), sort: (i) => i.cm, csv: (i) => i.cm },
    { key: 'm', header: 'Маржа', align: 'right', render: (i) => (i.marginPct === null ? '—' : pct(i.marginPct)), sort: (i) => i.marginPct, csv: (i) => i.marginPct },
    { key: 'r', header: 'Выручка', align: 'right', render: (i) => money(i.revenue), sort: (i) => i.revenue, csv: (i) => i.revenue },
    { key: 'tot', header: 'Прибыль всего', align: 'right', render: (i) => (i.cm === null ? '—' : <b>{money(i.cm * i.qty)}</b>), sort: (i) => (i.cm === null ? null : i.cm * i.qty), csv: (i) => (i.cm === null ? null : i.cm * i.qty) },
  ];
  return (
    <>
      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {groups.map((g) => (
          <button key={g.c} onClick={() => setCls(cls === g.c ? '' : g.c)} className={`card p-4 text-left transition hover:border-brand/50 ${cls === g.c ? 'border-brand ring-2 ring-brand/15' : ''}`}>
            <div className="flex items-center justify-between"><Badge tone={CLS[g.c].tone}>{g.label}</Badge><span className="tnum text-2xl font-semibold">{g.items.length}</span></div>
            <p className="mt-2 text-[12px] leading-relaxed text-muted">{CLS[g.c].hint}</p>
            <div className="mt-2 truncate text-xs">{g.items.slice(0, 3).map((i) => i.nombre).join(', ') || '—'}</div>
          </button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted">
        <StatCard label="Средняя прибыль с порции" value={money(data.avgCm)} />
        <span>Порог популярности: {data.popThreshold}% продаж. Блюдо «популярно», если его доля не ниже порога, и «прибыльно», если прибыль с порции не ниже средней.</span>
      </div>
      <DataTable cols={cols} rows={shown} rowKey={(i) => i.id} csvName="menu-engineering" initialSort={{ key: 'tot', dir: 'desc' }} />
    </>
  );
}

/* ───────── История цен ───────── */
function HistoryTab() {
  const { data, error, reload } = useFetch(() => get<Hist[]>('/mn/history?limit=300'), []);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const cols: Col<Hist>[] = [
    { key: 'at', header: 'Когда', render: (h) => <span className="whitespace-nowrap text-muted">{fmtDateTime(h.at)}</span>, sort: (h) => h.at, csv: (h) => h.at },
    { key: 'n', header: 'Блюдо', render: (h) => <span className="font-medium">{h.nombre}</span>, sort: (h) => h.nombre, csv: (h) => h.nombre },
    { key: 'f', header: 'Было', align: 'right', render: (h) => (h.from === null ? '—' : money(h.from)), csv: (h) => h.from },
    { key: 't', header: 'Стало', align: 'right', render: (h) => <b>{money(h.to)}</b>, csv: (h) => h.to },
    { key: 'd', header: 'Изменение', align: 'right', render: (h) => (h.from ? <span className={h.to > h.from ? 'text-bad' : 'text-good'}>{h.to > h.from ? '▲' : '▼'} {Math.abs(((h.to - h.from) / h.from) * 100).toFixed(1)}%</span> : '—'), csv: (h) => (h.from ? ((h.to - h.from) / h.from) * 100 : null) },
    { key: 'w', header: 'Кто', render: (h) => <span className="text-xs text-muted">{h.who ?? '—'}</span>, csv: (h) => h.who, hideOnMobile: true },
    { key: 'r', header: 'Причина', render: (h) => <span className="text-muted">{h.reason ?? '—'}</span>, csv: (h) => h.reason, hideOnMobile: true },
  ];
  return <DataTable cols={cols} rows={data} rowKey={(h) => String(h.id)} csvName="price-history" initialSort={{ key: 'at', dir: 'desc' }} empty={<div className="py-12 text-center text-sm text-muted"><History size={28} className="mx-auto mb-2 opacity-40" />Цены из Office ещё не менялись</div>} />;
}
