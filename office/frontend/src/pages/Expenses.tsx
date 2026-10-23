import { useState } from 'react';
import { Pencil, Plus, Settings2, Trash2 } from 'lucide-react';
import { Attachments } from '../Attachments';
import { del, get, post, put, qs } from '../api';
import { useAuth } from '../auth';
import { fmtDate, money, todayIn } from '../format';
import { Badge, Col, DataTable, ErrorBox, Field, Loading, Modal, PageHeader, PeriodPicker, StatCard, Toggle, useFetch, usePeriod, useUi } from '../ui';

interface Exp { source: string | null; id: string; date: string; categoryId: string; category: string; kind: string; amount: number; description: string | null; docNumber: string | null; counterparty: string | null; method: string | null; status: 'paid' | 'pending' }
interface Resp { from: string; to: string; rows: Exp[]; total: number; pending: number; byCategory: { category: string; kind: string; total: number }[] }
interface Cat { id: string; name: string; kind: string; kindLabel: string; active: boolean; used: number }

const METHODS = ['Наличные', 'Перевод', 'Карта', 'Kaspi'];

export default function Expenses() {
  const { can, me } = useAuth();
  const { toast, confirm } = useUi();
  const [period, setPeriod] = usePeriod('month');
  const [cat, setCat] = useState('');
  const [status, setStatus] = useState('');
  const [edit, setEdit] = useState<Exp | 'new' | null>(null);
  const [cats, setCats] = useState(false);
  const { data, error, reload, loading } = useFetch(() => get<Resp>('/acc/expenses' + qs({ ...period, categoryId: cat, status })), [period.from, period.to, cat, status]);
  const { data: categories, reload: reloadCats } = useFetch(() => get<Cat[]>('/acc/expense-categories'), []);
  const write = can('acc.write');

  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data || !categories) return <Loading />;

  const cols: Col<Exp>[] = [
    { key: 'date', header: 'Дата', render: (e) => fmtDate(e.date), sort: (e) => e.date, csv: (e) => e.date },
    { key: 'cat', header: 'Категория', render: (e) => e.category, sort: (e) => e.category, csv: (e) => e.category },
    { key: 'desc', header: 'Описание', render: (e) => <span className="text-muted">{e.description || '—'}{e.counterparty ? ` · ${e.counterparty}` : ''}{e.docNumber ? ` · № ${e.docNumber}` : ''}</span>, csv: (e) => `${e.description ?? ''} ${e.counterparty ?? ''}`.trim(), hideOnMobile: true },
    { key: 'status', header: 'Статус', render: (e) => (e.status === 'paid' ? <Badge tone="good">Оплачен</Badge> : <Badge tone="warn">К оплате</Badge>), csv: (e) => e.status },
    { key: 'amount', header: 'Сумма', align: 'right', render: (e) => <b>{money(e.amount)}</b>, sort: (e) => e.amount, csv: (e) => e.amount },
    ...(write ? [{ key: 'act', header: '', align: 'right' as const, render: (e: Exp) => e.source ? <Badge tone="info">{e.source === 'advance' ? 'аванс' : 'зарплата'}</Badge> : (
      <span className="inline-flex gap-0.5">
        <button className="btn btn-ghost btn-sm !px-1.5" onClick={(ev) => { ev.stopPropagation(); setEdit(e); }} title="Изменить"><Pencil size={14} /></button>
        <button className="btn btn-ghost btn-sm !px-1.5 hover:!text-bad" title="Удалить" onClick={async (ev) => {
          ev.stopPropagation();
          if (!(await confirm({ title: 'Удалить расход?', text: `${e.category}, ${money(e.amount)} от ${fmtDate(e.date)}`, danger: true, confirmLabel: 'Удалить' }))) return;
          try { await del('/acc/expenses/' + e.id); toast('ok', 'Расход удалён'); void reload(); } catch (x) { toast('err', (x as Error).message); }
        }}><Trash2 size={14} /></button>
      </span>) }] : []),
  ];

  return (
    <>
      <PageHeader title="Расходы" subtitle="Операционные расходы: аренда, зарплата, коммунальные, налоги и другие"
        actions={<>{write && <button className="btn btn-soft" onClick={() => setCats(true)}><Settings2 size={15} /> Категории</button>}{write && <button className="btn btn-primary" onClick={() => setEdit('new')}><Plus size={15} /> Добавить расход</button>}</>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <PeriodPicker value={period} onChange={setPeriod} />
        <select className="input !h-8 !w-auto text-[13px]" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Все категории</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select className="input !h-8 !w-auto text-[13px]" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Любой статус</option><option value="paid">Оплачен</option><option value="pending">К оплате</option></select>
      </div>
      <div className={loading ? 'opacity-60 transition' : 'transition'}>
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <StatCard label="Расходы за период" value={money(data.total)} sub={`${data.rows.length} записей`} />
          <StatCard label="К оплате (не оплачено)" value={money(data.pending)} tone={data.pending ? 'warn' : undefined} />
          <StatCard label="Крупнейшая категория" value={data.byCategory[0]?.category ?? '—'} sub={data.byCategory[0] ? money(data.byCategory[0].total) : undefined} />
        </div>
        {data.byCategory.length > 0 && (
          <section className="card mb-5 p-4"><h2 className="mb-3 font-semibold">По категориям</h2>
            <div className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">{data.byCategory.map((c) => (
              <div key={c.category}><div className="mb-1 flex justify-between text-[13px]"><span>{c.category}</span><span className="tnum font-medium">{money(c.total)}</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(2, (c.total / data.total) * 100)}%` }} /></div></div>))}</div></section>
        )}
        <DataTable cols={cols} rows={data.rows} rowKey={(e) => e.id} csvName={`expenses_${data.from}_${data.to}`} onRowClick={write ? (e) => { if (e.source) toast('info', 'Расход создан автоматически — измените его в разделе «Персонал»'); else setEdit(e); } : undefined} initialSort={{ key: 'date', dir: 'desc' }}
          footer={<tr><td className="td" colSpan={3}>Итого</td><td className="td" /><td className="td tnum text-right">{money(data.total)}</td>{write && <td className="td" />}</tr>} />
      </div>
      {edit && <ExpenseModal exp={edit === 'new' ? null : edit} cats={categories.filter((c) => c.active || (edit !== 'new' && c.id === edit.categoryId))} tz={me!.settings.timezone} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void reload(); }} />}
      {cats && <CategoriesModal cats={categories} onClose={() => setCats(false)} onChanged={() => { void reloadCats(); void reload(); }} />}
    </>
  );
}

function ExpenseModal({ exp, cats, tz, onClose, onSaved }: { exp: Exp | null; cats: Cat[]; tz: string; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const { can } = useAuth();
  const [f, setF] = useState({ date: exp?.date ?? todayIn(tz), categoryId: exp?.categoryId ?? cats[0]?.id ?? '', amount: exp ? String(exp.amount) : '', description: exp?.description ?? '', docNumber: exp?.docNumber ?? '', counterparty: exp?.counterparty ?? '', method: exp?.method ?? '', status: exp?.status ?? 'paid' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const body = { date: f.date, categoryId: f.categoryId, amount: Number(f.amount.replace(',', '.')), description: f.description || null, docNumber: f.docNumber || null, counterparty: f.counterparty || null, method: f.method || null, status: f.status };
      if (exp) await put('/acc/expenses/' + exp.id, body); else await post('/acc/expenses', body);
      toast('ok', exp ? 'Расход сохранён' : 'Расход добавлен'); onSaved();
    } catch (e) { toast('err', (e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={exp ? 'Изменить расход' : 'Новый расход'} width={560}
      footer={<><button className="btn btn-soft" onClick={onClose}>Отмена</button><button className="btn btn-primary" disabled={busy || !f.categoryId || !f.amount} onClick={() => void save()}>Сохранить</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Дата"><input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Сумма"><input className="input tnum" inputMode="decimal" autoFocus value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0" /></Field>
        <Field label="Категория" className="sm:col-span-2"><select className="input" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Описание" className="sm:col-span-2"><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Например: аренда за октябрь" /></Field>
        <Field label="Контрагент"><input className="input" value={f.counterparty} onChange={(e) => setF({ ...f, counterparty: e.target.value })} /></Field>
        <Field label="№ документа"><input className="input" value={f.docNumber} onChange={(e) => setF({ ...f, docNumber: e.target.value })} /></Field>
        <Field label="Способ оплаты"><select className="input" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}><option value="">—</option>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></Field>
        <div className="flex items-end pb-1.5"><Toggle checked={f.status === 'paid'} onChange={(v) => setF({ ...f, status: v ? 'paid' : 'pending' })} label={f.status === 'paid' ? 'Оплачен' : 'К оплате'} /></div>
        {exp && <div className="sm:col-span-2"><Attachments entity="expense" entityId={exp.id} canEdit={can('files')} title="Документы" /></div>}
      </div>
    </Modal>
  );
}

function CategoriesModal({ cats, onClose, onChanged }: { cats: Cat[]; onClose: () => void; onChanged: () => void }) {
  const { toast, confirm } = useUi();
  const [name, setName] = useState('');
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast('ok', ok); onChanged(); } catch (e) { toast('err', (e as Error).message); } };
  return (
    <Modal open onClose={onClose} title="Категории расходов" width={520} footer={<button className="btn btn-primary" onClick={onClose}>Готово</button>}>
      <div className="mb-4 flex gap-2"><input className="input" placeholder="Новая категория" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) void act(async () => { await post('/acc/expense-categories', { name: name.trim() }); setName(''); }, 'Категория создана'); }} />
        <button className="btn btn-primary" disabled={!name.trim()} onClick={() => void act(async () => { await post('/acc/expense-categories', { name: name.trim() }); setName(''); }, 'Категория создана')}><Plus size={15} /></button></div>
      <ul className="divide-y divide-line/70">{cats.map((c) => (
        <li key={c.id} className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1"><div className={c.active ? 'font-medium' : 'text-muted line-through'}>{c.name}</div><div className="text-[11px] text-muted">{c.kindLabel} · записей: {c.used}</div></div>
          <Toggle checked={c.active} onChange={(v) => void act(() => put('/acc/expense-categories/' + c.id, { name: c.name, kind: c.kind, active: v }), v ? 'Включена' : 'Отключена')} />
          <button className="btn btn-ghost btn-sm !px-1.5 hover:!text-bad" disabled={c.used > 0} title={c.used ? 'Есть расходы — отключите' : 'Удалить'} onClick={async () => {
            if (await confirm({ title: `Удалить «${c.name}»?`, danger: true, confirmLabel: 'Удалить' })) void act(() => del('/acc/expense-categories/' + c.id), 'Удалено');
          }}><Trash2 size={14} /></button>
        </li>))}</ul>
    </Modal>
  );
}
