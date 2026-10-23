import { useState } from 'react';
import { ArrowLeftRight, Banknote, CreditCard, Landmark, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { del, get, patch, post, put, qs } from '../api';
import { useAuth } from '../auth';
import { fmtDate, money, todayIn } from '../format';
import { Badge, Col, DataTable, ErrorBox, Field, Loading, Modal, PageHeader, PeriodPicker, StatCard, Toggle, useFetch, usePeriod, useUi } from '../ui';
import { parseNum } from '../ui2';

interface Acc { id: string; name: string; kind: 'cash' | 'bank' | 'card' | 'other'; openingBalance: number; openingDate: string; methods: string[]; active: boolean; note: string | null; balance: number; monthIn: number; monthOut: number }
interface Row { date: string; accountId: string | null; account: string; dir: 'in' | 'out'; amount: number; category: string; label: string; source: 'sales' | 'expense' | 'purchase' | 'manual' | 'transfer'; ref: string | null; editable: boolean }
interface Ledger { hasAccounts: boolean; opening: number; closing: number; totalIn: number; totalOut: number; unassigned: number; rows: Row[] }

const KIND = { cash: { label: 'Наличные', icon: Banknote }, bank: { label: 'Банк', icon: Landmark }, card: { label: 'Карта', icon: CreditCard }, other: { label: 'Другое', icon: Wallet } };
const SRC: Record<Row['source'], { label: string; tone: 'good' | 'warn' | 'info' | 'muted' | 'brand' }> = { sales: { label: 'Продажи', tone: 'good' }, expense: { label: 'Расход', tone: 'warn' }, purchase: { label: 'Поставщик', tone: 'info' }, manual: { label: 'Вручную', tone: 'brand' }, transfer: { label: 'Перевод', tone: 'muted' } };
const METHOD_PRESETS = ['Наличные', 'Карта', 'QR', 'Перевод', 'Kaspi'];

/** Счета и журнал движения денег: остатки, поступления, выплаты, переводы. */
export default function Accounts() {
  const { can, me } = useAuth();
  const { toast, confirm } = useUi();
  const write = can('fin.write');
  const [period, setPeriod] = usePeriod('month');
  const [accId, setAccId] = useState('');
  const [editAcc, setEditAcc] = useState<Acc | 'new' | null>(null);
  const [tx, setTx] = useState<Row | 'in' | 'out' | null>(null);
  const [transfer, setTransfer] = useState(false);
  const accounts = useFetch(() => get<{ rows: Acc[]; total: number }>('/fin/accounts'), []);
  const ledger = useFetch(() => get<Ledger>('/fin/ledger' + qs({ ...period, accountId: accId })), [period.from, period.to, accId]);
  if (accounts.error && !accounts.data) return <ErrorBox error={accounts.error} onRetry={accounts.reload} />;
  if (!accounts.data || !ledger.data) return <Loading />;
  const accs = accounts.data.rows, L = ledger.data;
  const reloadAll = () => { void accounts.reload(); void ledger.reload(); };

  const confirmDel = async (r: Row) => confirm({ title: r.source === 'transfer' ? 'Удалить перевод?' : 'Удалить операцию?', text: r.source === 'transfer' ? 'Будут удалены обе стороны перевода.' : `${r.category}, ${money(r.amount)} от ${fmtDate(r.date)}`, danger: true, confirmLabel: 'Удалить' });

  const cols: Col<Row>[] = [
    { key: 'd', header: 'Дата', render: (r) => <span className="whitespace-nowrap">{fmtDate(r.date)}</span>, sort: (r) => r.date, csv: (r) => r.date },
    { key: 'a', header: 'Счёт', render: (r) => <span className={r.accountId ? '' : 'text-muted'}>{r.account}</span>, sort: (r) => r.account, csv: (r) => r.account },
    { key: 's', header: 'Источник', render: (r) => <Badge tone={SRC[r.source].tone}>{SRC[r.source].label}</Badge>, csv: (r) => SRC[r.source].label, hideOnMobile: true },
    { key: 'c', header: 'Статья', render: (r) => <div><div>{r.category}</div>{r.label && r.label !== r.category && <div className="text-xs text-muted">{r.label}</div>}</div>, sort: (r) => r.category, csv: (r) => `${r.category} ${r.label}` },
    { key: 'am', header: 'Сумма', align: 'right', render: (r) => <b className={r.dir === 'in' ? 'text-good' : 'text-bad'}>{r.dir === 'in' ? '+' : '−'} {money(r.amount)}</b>, sort: (r) => (r.dir === 'in' ? r.amount : -r.amount), csv: (r) => (r.dir === 'in' ? r.amount : -r.amount) },
    ...(write ? [{ key: 'x', header: '', align: 'right' as const, render: (r: Row) => (r.editable ? (
      <span className="inline-flex gap-0.5">{r.source === 'manual' && <button className="btn btn-ghost btn-sm !px-1.5" onClick={(e) => { e.stopPropagation(); setTx(r); }}><Pencil size={14} /></button>}
        <button className="btn btn-ghost btn-sm !px-1.5 hover:!text-bad" title="Удалить" onClick={async (e) => { e.stopPropagation(); if (await confirmDel(r)) { try { await del('/fin/tx/' + r.ref); toast('ok', 'Операция удалена'); reloadAll(); } catch (x) { toast('err', (x as Error).message); } } }}><Trash2 size={14} /></button></span>) : null) }] : []),
  ];

  return (
    <>
      <PageHeader title="Счета и деньги" subtitle="Где лежат деньги и куда они движутся. Продажи, оплаченные расходы и платежи поставщикам попадают сюда сами"
        actions={write && accs.length > 0 && <><button className="btn btn-soft" onClick={() => setTransfer(true)}><ArrowLeftRight size={15} /> Перевод</button><button className="btn btn-soft" onClick={() => setTx('out')}>− Выплата</button><button className="btn btn-primary" onClick={() => setTx('in')}>+ Поступление</button></>} />
      {accs.length === 0 ? (
        <div className="card p-10 text-center">
          <Wallet size={34} className="mx-auto mb-3 text-muted/50" />
          <h2 className="text-lg font-semibold">Счетов пока нет</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">Создайте кассу для наличных и банковский счёт — система распределит по ним продажи и расходы по способам оплаты и покажет остатки.</p>
          {write && <div className="mt-4 flex justify-center gap-2"><button className="btn btn-primary" onClick={async () => { try { await post('/fin/accounts/defaults'); reloadAll(); } catch (e) { toast('err', (e as Error).message); } }}>Создать «Касса» и «Банк»</button><button className="btn btn-soft" onClick={() => setEditAcc('new')}>Свой счёт</button></div>}
        </div>
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Всего денег" value={money(accounts.data.total)} icon={<Wallet size={16} />} sub={`на сегодня, ${accs.filter((a) => a.active).length} активных счетов`} />
            {accs.map((a) => { const K = KIND[a.kind].icon; return (
              <button key={a.id} onClick={() => setAccId(accId === a.id ? '' : a.id)} className={`card p-4 text-left transition hover:border-brand/50 ${accId === a.id ? 'border-brand ring-2 ring-brand/15' : ''} ${a.active ? '' : 'opacity-60'}`}>
                <div className="flex items-center justify-between text-xs font-medium text-muted"><span className="truncate">{a.name}</span><K size={16} className="text-muted/60" /></div>
                <div className={`tnum mt-1.5 text-[22px] font-semibold ${a.balance < 0 ? 'text-bad' : ''}`}>{money(a.balance)}</div>
                <div className="mt-0.5 text-xs text-muted">в этом месяце <span className="text-good">+{money(a.monthIn)}</span> · <span className="text-bad">−{money(a.monthOut)}</span></div>
                {write && <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-brand" onClick={(e) => { e.stopPropagation(); setEditAcc(a); }}><Pencil size={11} /> настроить</span>}
              </button>); })}
            {write && <button className="card flex items-center justify-center gap-2 border-dashed p-4 text-sm text-muted transition hover:border-brand/50 hover:text-brand" onClick={() => setEditAcc('new')}><Plus size={16} /> Новый счёт</button>}
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-3"><PeriodPicker value={period} onChange={setPeriod} />{accId && <button className="btn btn-soft btn-sm" onClick={() => setAccId('')}>Показать все счета ×</button>}</div>
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <StatCard label="На начало" value={money(L.opening)} /><StatCard label="Поступило" value={money(L.totalIn)} tone="good" /><StatCard label="Выплачено" value={money(L.totalOut)} tone="bad" /><StatCard label="На конец" value={money(L.closing)} />
          </div>
          {L.unassigned !== 0 && !accId && <p className="mb-3 rounded-lg bg-warn/10 p-3 text-[13px] text-warn">Часть движения ({money(L.unassigned)}) не попала ни на один счёт: оно было до даты открытия счетов. На остатки это не влияет.</p>}
          <DataTable cols={cols} rows={L.rows} rowKey={(r) => `${r.source}:${r.ref ?? ''}:${r.date}:${r.label}:${r.dir}:${r.amount}:${r.accountId}`} csvName="money-ledger" dense initialSort={{ key: 'd', dir: 'desc' }} empty={<div className="py-12 text-center text-sm text-muted">За период движения денег не было</div>} />
        </>
      )}
      {editAcc && <AccountModal a={editAcc === 'new' ? null : editAcc} tz={me!.settings.timezone} onClose={() => setEditAcc(null)} onSaved={() => { setEditAcc(null); reloadAll(); }} />}
      {tx && <TxModal accounts={accs.filter((a) => a.active)} t={typeof tx === 'string' ? null : tx} dir={typeof tx === 'string' ? tx : tx.dir} tz={me!.settings.timezone} onClose={() => setTx(null)} onSaved={() => { setTx(null); reloadAll(); }} />}
      {transfer && <TransferModal accounts={accs.filter((a) => a.active)} tz={me!.settings.timezone} onClose={() => setTransfer(false)} onSaved={() => { setTransfer(false); reloadAll(); }} />}
    </>
  );
}

function AccountModal({ a, tz, onClose, onSaved }: { a: Acc | null; tz: string; onClose: () => void; onSaved: () => void }) {
  const { toast, confirm } = useUi();
  const [f, setF] = useState({ name: a?.name ?? '', kind: a?.kind ?? 'bank', openingBalance: String(a?.openingBalance ?? 0), openingDate: a?.openingDate ?? todayIn(tz), methods: a?.methods ?? [], note: a?.note ?? '', active: a?.active ?? true });
  const [busy, setBusy] = useState(false);
  const toggleM = (m: string) => setF({ ...f, methods: f.methods.some((x) => x.toLowerCase() === m.toLowerCase()) ? f.methods.filter((x) => x.toLowerCase() !== m.toLowerCase()) : [...f.methods, m] });
  const save = async () => {
    setBusy(true);
    try {
      const body = { name: f.name, kind: f.kind, openingBalance: parseNum(f.openingBalance) || 0, openingDate: f.openingDate, methods: f.methods, note: f.note || null, active: f.active };
      if (a) await patch('/fin/accounts/' + a.id, body); else await post('/fin/accounts', body);
      toast('ok', 'Сохранено'); onSaved();
    } catch (e) { toast('err', (e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={a ? 'Настроить счёт' : 'Новый счёт'} width={560}
      footer={<>{a && <button className="btn btn-ghost mr-auto hover:!text-bad" onClick={async () => { if (await confirm({ title: 'Удалить счёт?', text: 'Удалить можно только счёт без операций.', danger: true, confirmLabel: 'Удалить' })) { try { await del('/fin/accounts/' + a.id); onSaved(); } catch (e) { toast('err', (e as Error).message); } } }}><Trash2 size={15} /></button>}
        <button className="btn btn-soft" onClick={onClose}>Отмена</button><button className="btn btn-primary" disabled={busy || f.name.trim().length < 2} onClick={() => void save()}>Сохранить</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Название"><input className="input" autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Тип"><select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Acc['kind'] })}>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
        <Field label="Начальный остаток" hint="Сколько было на счёте в день открытия"><input className="input tnum" inputMode="decimal" value={f.openingBalance} onChange={(e) => setF({ ...f, openingBalance: e.target.value })} /></Field>
        <Field label="Дата открытия" hint="Движение до этой даты на счёт не относится"><input type="date" className="input" value={f.openingDate} onChange={(e) => setF({ ...f, openingDate: e.target.value })} /></Field>
        <div className="sm:col-span-2"><label className="label">Способы оплаты, которые идут на этот счёт</label>
          <div className="flex flex-wrap gap-1.5">{METHOD_PRESETS.map((m) => { const on = f.methods.some((x) => x.toLowerCase() === m.toLowerCase()); return <button key={m} type="button" onClick={() => toggleM(m)} className={`rounded-md border px-2.5 py-1 text-[12.5px] font-medium transition ${on ? 'border-brand bg-brand/10 text-brand' : 'border-line text-muted hover:text-ink'}`}>{m}</button>; })}</div>
          <p className="mt-1.5 text-[11px] text-muted">Продажи и расходы с таким способом оплаты автоматически попадут на этот счёт. Что не подошло ни к одному — на банковский счёт.</p></div>
        <Field label="Заметка" className="sm:col-span-2"><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        {a && <div className="sm:col-span-2"><Toggle checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="Счёт активен" /></div>}
      </div>
    </Modal>
  );
}

function TxModal({ accounts, t, dir, tz, onClose, onSaved }: { accounts: Acc[]; t: Row | null; dir: 'in' | 'out'; tz: string; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const [f, setF] = useState({ accountId: t?.accountId ?? accounts[0]?.id ?? '', date: t?.date ?? todayIn(tz), amount: t ? String(t.amount) : '', category: t?.category ?? '', description: t?.label ?? '' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const body = { accountId: f.accountId, date: f.date, direction: dir, amount: parseNum(f.amount), category: f.category || null, description: f.description || null };
      if (t?.ref) await put('/fin/tx/' + t.ref, body); else await post('/fin/tx', body);
      toast('ok', 'Сохранено'); onSaved();
    } catch (e) { toast('err', (e as Error).message); } finally { setBusy(false); }
  };
  const presets = dir === 'in' ? ['Внесение владельцем', 'Возврат от поставщика', 'Прочие поступления'] : ['Вывод владельцу', 'Инкассация', 'Прочие расходы'];
  return (
    <Modal open onClose={onClose} title={`${t ? 'Изменить' : 'Новая'} операция: ${dir === 'in' ? 'поступление' : 'выплата'}`} width={500}
      footer={<><button className="btn btn-soft" onClick={onClose}>Отмена</button><button className="btn btn-primary" disabled={busy || !f.accountId || !(parseNum(f.amount) > 0)} onClick={() => void save()}>Сохранить</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Счёт"><select className="input" value={f.accountId} onChange={(e) => setF({ ...f, accountId: e.target.value })}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <Field label="Дата"><input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Сумма"><input className="input tnum" autoFocus inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Статья"><input className="input" list="fin-cats" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /><datalist id="fin-cats">{presets.map((p) => <option key={p} value={p} />)}</datalist></Field>
        <Field label="Комментарий" className="sm:col-span-2"><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      </div>
      <p className="mt-3 text-xs text-muted">Расходы на аренду, зарплату, коммунальные и закупки вносите в «Расходах» и «Закупках» — они попадут сюда автоматически. Здесь — то, что не относится к ним.</p>
    </Modal>
  );
}

function TransferModal({ accounts, tz, onClose, onSaved }: { accounts: Acc[]; tz: string; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const [f, setF] = useState({ fromId: accounts[0]?.id ?? '', toId: accounts[1]?.id ?? '', date: todayIn(tz), amount: '', note: '' });
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await post('/fin/transfers', { ...f, amount: parseNum(f.amount), note: f.note || null }); toast('ok', 'Перевод выполнен'); onSaved(); } catch (e) { toast('err', (e as Error).message); setBusy(false); } };
  return (
    <Modal open onClose={onClose} title="Перевод между счетами" width={480} footer={<><button className="btn btn-soft" onClick={onClose}>Отмена</button><button className="btn btn-primary" disabled={busy || f.fromId === f.toId || !(parseNum(f.amount) > 0)} onClick={() => void save()}>Перевести</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Откуда"><select className="input" value={f.fromId} onChange={(e) => setF({ ...f, fromId: e.target.value })}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <Field label="Куда"><select className="input" value={f.toId} onChange={(e) => setF({ ...f, toId: e.target.value })}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <Field label="Сумма"><input className="input tnum" autoFocus inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Дата"><input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Комментарий" className="sm:col-span-2"><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="например: сдача выручки в банк" /></Field>
      </div>
    </Modal>
  );
}
