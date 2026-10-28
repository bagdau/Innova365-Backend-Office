import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { AlertTriangle, ArrowLeft, Check, ChevronDown, History, Plus, Printer, RotateCcw, Save, Send, ShieldCheck, Trash2, Undo2, Utensils, X } from 'lucide-react';
import { get, post, put } from '../api';
import { useAuth } from '../auth';
import { fmtDateTime, money, num, pct } from '../format';
import { Badge, ErrorBox, Field, Loading, Modal, Spinner, useFetch, useUi } from '../ui';
import { marginTone, STATUS_TONE } from './TechCards';

interface CardItem { id: string; tipo: 'insumo' | 'plato'; insumoId: string | null; componenteId: string | null; nombre: string; unidad: string; cantidad: number; neto: number | null; coldLossPct: number | null; hotLossPct: number | null }
interface Card {
  productoId: string; nombre: string; descripcion: string | null; categoria: string; precio: number; hasCard: boolean; rendimiento: number | null; tecnologia: string; items: CardItem[]; costo: number; incompleto: boolean; margen: number | null;
  stock: { status: string; porciones: number | null; ingredients: { insumoId: string; nombre: string; unidad: string; porcion: number; stock: number; minimo: number; porciones: number; status: string }[]; movements: { id: string; insumoId: string; tipo: string; cantidad: number; saldo: number; motivo: string | null; creadoEn: string }[] };
  state: { status: string; statusLabel: string; version: number | null; comment: string | null; updatedBy: string | null; updatedAt: string | null; approvedBy: string | null; approvedAt: string | null };
  versions: { version: number; action: string; comment: string | null; user_name: string; created_at: string }[];
}
interface Options { insumos: { id: string; nombre: string; unidad: string; costo: number | null }[]; platos: { id: string; nombre: string; costo: number }[] }
interface Row { k: number; kind: 'i' | 'p'; refId: string; qty: string; neto: string; cold: string; hot: string }

const ACTION: Record<string, string> = { import: 'Импорт', save: 'Сохранено', submit: 'На согласование', approve: 'Утверждена', reject: 'Возвращена', reopen: 'Возвращена в работу', restore: 'Восстановлена версия', delete: 'Удалена' };

/** Ингредиенты в кг/л удобнее вводить в граммах/мл — как в рецептуре. */
const fac = (unit: string) => (unit === 'кг' || unit === 'л' ? 1000 : 1);
const dispUnit = (unit: string) => (unit === 'кг' ? 'г' : unit === 'л' ? 'мл' : unit);
const r4 = (x: number) => Math.round(x * 10000) / 10000;
const toNum = (s: string) => Number(s.replace(',', '.'));
const MOVEMENT: Record<string, string> = { INICIAL: 'Начальный остаток', COMPRA: 'Пополнение', AJUSTE: 'Корректировка', MERMA: 'Списание', REVISION: 'Инвентаризация', CONSUMO: 'Расход по заказу', DEVOLUCION: 'Возврат после отмены' };
const netOf = (r: Row) => r.cold.trim() || r.hot.trim()
  ? String(r4(toNum(r.qty) * (1 - (toNum(r.cold) || 0) / 100) * (1 - (toNum(r.hot) || 0) / 100))) : r.neto;

export default function TechCardEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const { can, me } = useAuth();
  const { toast, confirm } = useUi();
  const { data: card, error, reload } = useFetch(() => get<Card>('/tc/cards/' + id), [id], { live: false });
  const { data: opts } = useFetch(() => get<Options>('/tc/options'), [], { live: false });
  const [rows, setRows] = useState<Row[]>([]);
  const [yieldV, setYield] = useState('');
  const [tech, setTech] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const seq = useRef(1);
  const initial = useRef('');

  const insMap = useMemo(() => new Map((opts?.insumos ?? []).map((i) => [i.id, i])), [opts]);
  const platoMap = useMemo(() => new Map((opts?.platos ?? []).map((p) => [p.id, p])), [opts]);

  // загрузка карты в форму
  useEffect(() => {
    if (!card || !opts) return;
    const rs: Row[] = card.items.map((it) => {
      const f = it.tipo === 'insumo' ? fac(it.unidad) : 1;
      return { k: seq.current++, kind: it.tipo === 'insumo' ? 'i' : 'p', refId: (it.insumoId ?? it.componenteId)!, qty: String(r4(it.cantidad * f)), neto: it.neto === null ? '' : String(r4(it.neto * f)), cold: it.coldLossPct === null ? '' : String(it.coldLossPct), hot: it.hotLossPct === null ? '' : String(it.hotLossPct) };
    });
    setRows(rs); setYield(card.rendimiento === null ? '' : String(card.rendimiento)); setTech(card.tecnologia); setComment('');
    initial.current = JSON.stringify([rs.map((r) => [r.kind, r.refId, r.qty, r.neto, r.cold, r.hot]), card.rendimiento === null ? '' : String(card.rendimiento), card.tecnologia]);
  }, [card, opts]);

  const state = JSON.stringify([rows.map((r) => [r.kind, r.refId, r.qty, r.neto, r.cold, r.hot]), yieldV, tech]);
  const dirty = !!card && state !== initial.current;
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  if (error && !card) return <ErrorBox error={error} onRetry={reload} />;
  if (!card || !opts) return <Loading />;

  const editable = can('tc.edit');
  const st = card.state.status;

  /* расчёт стоимости в реальном времени */
  const lines = rows.map((r) => {
    const q = toNum(r.qty);
    if (r.kind === 'i') {
      const i = insMap.get(r.refId);
      const f = i ? fac(i.unidad) : 1;
      return { r, unit: i ? dispUnit(i.unidad) : '', price: i?.costo ?? null, cost: i && i.costo !== null && Number.isFinite(q) ? (q / f) * i.costo : null, label: i?.nombre ?? '—' };
    }
    const p = platoMap.get(r.refId);
    return { r, unit: 'порц.', price: p?.costo ?? null, cost: p && Number.isFinite(q) ? p.costo * q : null, label: p?.nombre ?? '—' };
  });
  const known = lines.reduce((a, l) => a + (l.cost ?? 0), 0);
  const incomplete = lines.some((l) => l.r.refId && l.cost === null);
  const margin = card.precio > 0 ? Math.round((1 - known / card.precio) * 1000) / 10 : null;
  const used = new Set(rows.filter((r) => r.kind === 'i').map((r) => r.refId));
  const usedP = new Set(rows.filter((r) => r.kind === 'p').map((r) => r.refId));

  const setRow = (k: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.k === k ? { ...r, ...patch } : r)));
  const payload = () => ({
    rendimiento: yieldV.trim() ? toNum(yieldV) : null, tecnologia: tech,
    items: rows.filter((r) => r.refId).map((r) => {
      const f = r.kind === 'i' ? fac(insMap.get(r.refId)?.unidad ?? '') : 1;
      const neto = netOf(r);
      return { insumoId: r.kind === 'i' ? r.refId : null, componenteId: r.kind === 'p' ? r.refId : null, cantidad: toNum(r.qty) / f,
        neto: neto.trim() ? toNum(neto) / f : null, coldLossPct: r.cold.trim() ? toNum(r.cold) : null, hotLossPct: r.hot.trim() ? toNum(r.hot) : null };
    }),
    comment: comment.trim() || null,
  });
  const validate = (): string | null => {
    if (!rows.length) return 'Добавьте хотя бы один ингредиент';
    if (rows.some((r) => !r.refId)) return 'Выберите ингредиент в каждой строке или удалите пустые строки';
    if (rows.some((r) => !(toNum(r.qty) > 0))) return 'Количество в каждой строке должно быть больше нуля';
    if (rows.some((r) => r.neto.trim() && !(toNum(r.neto) >= 0))) return 'Нетто указано некорректно';
    if (rows.some((r) => [r.cold, r.hot].some((v) => v.trim() && (!Number.isFinite(toNum(v)) || toNum(v) < 0 || toNum(v) > 100)))) return 'Потери при обработке должны быть от 0 до 100%';
    return null;
  };

  const save = async (submit: boolean) => {
    const bad = validate(); if (bad) { toast('err', bad); return; }
    setBusy(true);
    try { await put('/tc/cards/' + id, { ...payload(), submit }); toast('ok', submit ? 'Отправлено на согласование' : 'Сохранено как черновик'); await reload(); }
    catch (e) { toast('err', (e as Error).message); } finally { setBusy(false); }
  };
  const action = async (a: 'approve' | 'reject' | 'reopen' | 'submit', c?: string) => {
    if (dirty && a !== 'reopen') { toast('err', 'Сначала сохраните изменения'); return; }
    setBusy(true);
    try { await post(`/tc/cards/${id}/status`, { action: a, comment: c }); toast('ok', { approve: 'Техкарта утверждена', reject: 'Техкарта возвращена технологу', reopen: 'Техкарта возвращена в работу', submit: 'Отправлено на согласование' }[a]); setRejecting(false); await reload(); }
    catch (e) { toast('err', (e as Error).message); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!(await confirm({ title: 'Удалить техкарту?', text: 'Состав блюда будет удалён: со склада перестанет списываться сырьё. Версия сохранится в истории.', danger: true, confirmLabel: 'Удалить' }))) return;
    try { await put('/tc/cards/' + id, { items: [], tecnologia: '', rendimiento: null }); toast('ok', 'Техкарта удалена'); nav('/techcards'); } catch (e) { toast('err', (e as Error).message); }
  };

  return (
    <>
      <div className="no-print mb-4">
        <Link to="/techcards" onClick={(e) => { if (dirty && !window.confirm('Есть несохранённые изменения. Уйти без сохранения?')) e.preventDefault(); }} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={15} /> Все техкарты</Link>
      </div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5"><h1 className="text-[24px] font-semibold tracking-tight">{card.nombre}</h1>
            <Badge tone={STATUS_TONE[st]}>{card.state.statusLabel}</Badge>{card.state.version && <span className="text-xs text-muted">версия {card.state.version}</span>}{dirty && <Badge tone="warn">есть изменения</Badge>}</div>
          <p className="mt-1 text-sm text-muted">{card.categoria} · цена в меню {money(card.precio)}{card.state.updatedAt && <> · изменена {fmtDateTime(card.state.updatedAt)} ({card.state.updatedBy})</>}</p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <button className="btn btn-soft" onClick={() => setHistOpen(true)}><History size={15} /> История{card.versions.length ? ` (${card.versions.length})` : ''}</button>
          {card.hasCard && <a className="btn btn-soft" href={`/print/techcard/${id}`} target="_blank" rel="noreferrer"><Printer size={15} /> Печать</a>}
        </div>
      </div>

      {card.state.comment && (st === 'rejected' || st === 'review') && (
        <div className={clsx('mb-4 flex items-start gap-2.5 rounded-xl border p-3.5 text-sm', st === 'rejected' ? 'border-bad/40 bg-bad/10 text-bad' : 'border-info/40 bg-info/10 text-info')}><AlertTriangle size={16} className="mt-0.5 shrink-0" /><div><b>{st === 'rejected' ? 'Причина возврата' : 'Комментарий технолога'}:</b> {card.state.comment}</div></div>
      )}
      {st === 'approved' && editable && <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-good/40 bg-good/10 p-3.5 text-sm text-good"><ShieldCheck size={16} className="mt-0.5 shrink-0" />Техкарта утверждена ({card.state.approvedBy}). Любое изменение вернёт её в черновик и потребует нового согласования.</div>}

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-5">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="font-semibold">Состав на 1 порцию</h2><span className="text-xs text-muted">кг и л вводятся в граммах и миллилитрах</span></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-[13.5px]">
                <thead><tr><th className="th w-8">#</th><th className="th">Ингредиент / блюдо</th><th className="th w-[110px] text-right">Брутто</th><th className="th w-[95px] text-right">Холодная, %</th><th className="th w-[95px] text-right">Горячая, %</th><th className="th w-[110px] text-right">Нетто</th><th className="th w-[100px] text-right">Цена</th><th className="th w-[100px] text-right">Стоимость</th>{editable && <th className="th w-10" />}</tr></thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={l.r.k} className="hover:bg-surface2/40">
                      <td className="td text-muted">{i + 1}</td>
                      <td className="td">
                        {editable ? <Combo kind={l.r.kind} value={l.r.refId} onChange={(refId) => setRow(l.r.k, { refId })} options={l.r.kind === 'i' ? opts.insumos.filter((o) => o.id === l.r.refId || !used.has(o.id)).map((o) => ({ id: o.id, label: o.nombre, sub: o.unidad })) : opts.platos.filter((o) => (o.id === l.r.refId || !usedP.has(o.id)) && o.id !== id).map((o) => ({ id: o.id, label: o.nombre, sub: 'блюдо' }))} />
                          : <span>{l.label}</span>}
                        {l.r.kind === 'p' && <span className="ml-2"><Badge tone="brand">блюдо (комбо)</Badge></span>}
                      </td>
                      <td className="td"><QtyInput disabled={!editable} value={l.r.qty} unit={l.unit} onChange={(v) => setRow(l.r.k, { qty: v })} /></td>
                      <td className="td">{l.r.kind === 'i' ? <input className="input tnum w-20 text-right" type="number" min="0" max="100" step="0.01" disabled={!editable} value={l.r.cold} onChange={(e) => setRow(l.r.k, { cold: e.target.value })} placeholder="—" /> : '—'}</td>
                      <td className="td">{l.r.kind === 'i' ? <input className="input tnum w-20 text-right" type="number" min="0" max="100" step="0.01" disabled={!editable} value={l.r.hot} onChange={(e) => setRow(l.r.k, { hot: e.target.value })} placeholder="—" /> : '—'}</td>
                      <td className="td">{l.r.kind === 'i' ? <QtyInput disabled={!editable || !!(l.r.cold || l.r.hot)} value={netOf(l.r)} unit={l.unit} placeholder="—" onChange={(v) => setRow(l.r.k, { neto: v })} /> : <span className="block text-right text-muted">—</span>}</td>
                      <td className="td tnum text-right text-muted">{l.price === null ? <span className="text-warn">нет цены</span> : money(l.price)}</td>
                      <td className="td tnum text-right font-medium">{l.cost === null ? '—' : money(l.cost)}</td>
                      {editable && <td className="td"><button className="btn btn-ghost btn-sm !px-1.5 hover:!text-bad" onClick={() => setRows((rs) => rs.filter((x) => x.k !== l.r.k))} title="Убрать"><X size={15} /></button></td>}
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={9} className="td py-10 text-center text-muted"><Utensils size={30} className="mx-auto mb-2 text-muted/40" />{card.hasCard ? 'Состав пуст' : 'У блюда ещё нет техкарты. Добавьте ингредиенты.'}</td></tr>}
                </tbody>
              </table>
            </div>
            {editable && (
              <div className="flex flex-wrap gap-2 border-t border-line p-3">
                <button className="btn btn-soft btn-sm" onClick={() => setRows((rs) => [...rs, { k: seq.current++, kind: 'i', refId: '', qty: '', neto: '', cold: '', hot: '' }])}><Plus size={14} /> Ингредиент</button>
                <button className="btn btn-soft btn-sm" onClick={() => setRows((rs) => [...rs, { k: seq.current++, kind: 'p', refId: '', qty: '1', neto: '', cold: '', hot: '' }])}><Plus size={14} /> Другое блюдо (для комбо и сетов)</button>
              </div>
            )}
          </section>

          <section className="card p-4">
            <div className="mb-3 flex flex-wrap items-center gap-3"><h2 className="font-semibold">Остатки по техкарте</h2><Badge tone={card.stock.status === 'low' ? 'bad' : card.stock.status === 'surplus' ? 'info' : card.stock.status === 'normal' ? 'good' : 'warn'}>{({ low: 'Заканчивается', surplus: 'В избытке', normal: 'В норме', none: 'Нет состава' } as Record<string, string>)[card.stock.status]}</Badge><span className="text-sm text-muted">Хватит на {card.stock.porciones ?? '—'} порций</span>{can('inv.view') && <Link className="ml-auto text-sm text-brand hover:underline" to="/inventory/stock">Пополнить склад →</Link>}</div>
            <p className="mb-3 text-xs text-muted">Порог «заканчивается»: минимум склада или запас на 3 порции. Избыток: запас на 20 порций и не меньше двойного минимума. При заказе списывается брутто; холодная и горячая обработка рассчитывают нетто.</p>
            <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm"><thead><tr><th className="th">Ингредиент</th><th className="th text-right">На порцию</th><th className="th text-right">Остаток / минимум</th><th className="th text-right">Порций</th></tr></thead><tbody>{card.stock.ingredients.map((i) => <tr key={i.insumoId}><td className="td">{i.nombre}</td><td className="td text-right">{num(i.porcion, 3)} {i.unidad}</td><td className="td text-right">{num(i.stock, 3)} / {num(i.minimo, 3)} {i.unidad}</td><td className="td text-right">{i.porciones}</td></tr>)}</tbody></table></div>
            <h3 className="mb-2 mt-4 text-sm font-semibold">Списание и пополнение</h3>
            {card.stock.movements.length ? <div className="max-h-56 overflow-y-auto text-xs">{card.stock.movements.map((m) => <div key={m.id} className="flex flex-wrap justify-between gap-2 border-t border-line py-2"><span>{card.stock.ingredients.find((i) => i.insumoId === m.insumoId)?.nombre} · {MOVEMENT[m.tipo] ?? m.tipo}{m.motivo ? ` · ${m.motivo}` : ''}</span><span>{m.cantidad > 0 ? '+' : ''}{num(m.cantidad, 3)} · остаток {num(m.saldo, 3)} · {fmtDateTime(m.creadoEn)}</span></div>)}</div> : <p className="text-xs text-muted">Движений пока нет.</p>}
          </section>

          <section className="card p-4">
            <div className="mb-4 grid gap-4 sm:grid-cols-[200px_1fr]">
              <Field label="Выход готового блюда, г/мл"><input className="input tnum" inputMode="decimal" disabled={!editable} value={yieldV} onChange={(e) => setYield(e.target.value)} placeholder="например, 350" /></Field>
              <div className="flex items-end text-[12.5px] text-muted">Выход — масса или объём готовой порции. Он не равен сумме сырья: часть воды испаряется, крупы и тесто впитывают влагу.</div>
            </div>
            <Field label="Технология приготовления, контроль качества, отпуск, аллергены"><textarea className="input min-h-[220px] text-[13.5px] leading-relaxed" disabled={!editable} value={tech} onChange={(e) => setTech(e.target.value)} /></Field>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card p-4">
            <h2 className="mb-3 font-semibold">Калькуляция</h2>
            <dl className="space-y-2.5 text-[14px]">
              <Row k="Себестоимость порции" v={money(known)} strong />
              <Row k="Цена в меню" v={money(card.precio)} />
              <Row k="Наценка / маржа" v={<b className={marginTone(margin)}>{pct(margin)}</b>} />
              <Row k="Прибыль с порции" v={money(card.precio - known)} />
              <Row k="Себестоимость, % от цены" v={card.precio > 0 ? pct((known / card.precio) * 100) : '—'} />
            </dl>
            {incomplete && <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-warn/10 p-2.5 text-xs text-warn"><AlertTriangle size={13} className="mt-0.5 shrink-0" />У части сырья нет цены — стоимость занижена. Цены задаёт бухгалтер в «Сырьё и цены».</p>}
            {margin !== null && margin < 50 && !incomplete && <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-bad/10 p-2.5 text-xs text-bad"><AlertTriangle size={13} className="mt-0.5 shrink-0" />Маржа ниже 50% — пересмотрите состав или цену.</p>}
            {dirty && <p className="mt-3 text-xs text-muted">Показан расчёт по несохранённому составу.</p>}
          </section>

          {editable && (
            <section className="card space-y-3 p-4">
              <h2 className="font-semibold">Действия</h2>
              <Field label="Комментарий к изменению"><input className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Что изменили и почему" /></Field>
              <button className="btn btn-soft w-full" disabled={busy || !dirty} onClick={() => void save(false)}>{busy ? <Spinner size={15} /> : <Save size={15} />} Сохранить черновик</button>
              <button className="btn btn-primary w-full" disabled={busy || (!dirty && st !== 'draft' && st !== 'rejected')} onClick={() => (dirty ? void save(true) : void action('submit'))}><Send size={15} /> {dirty ? 'Сохранить и отправить на согласование' : 'Отправить на согласование'}</button>
              {can('tc.approve') && st === 'review' && !dirty && (
                <div className="grid grid-cols-2 gap-2 border-t border-line pt-3"><button className="btn btn-good" disabled={busy} onClick={() => void action('approve')}><Check size={15} /> Утвердить</button><button className="btn btn-danger" disabled={busy} onClick={() => setRejecting(true)}><Undo2 size={15} /> Вернуть</button></div>
              )}
              {can('tc.approve') && st === 'draft' && card.hasCard && !dirty && <button className="btn btn-good w-full" disabled={busy} onClick={() => void action('approve')}><Check size={15} /> Утвердить сразу</button>}
              {(st === 'approved' || st === 'rejected') && <button className="btn btn-soft w-full" disabled={busy} onClick={() => void action('reopen')}><RotateCcw size={15} /> Вернуть в работу</button>}
              {card.hasCard && <button className="btn btn-ghost w-full text-bad" onClick={() => void remove()}><Trash2 size={15} /> Удалить техкарту</button>}
            </section>
          )}
          {!editable && <p className="rounded-xl bg-surface2 p-3 text-xs text-muted">Только просмотр: изменять техкарты могут технологи, администратор и владелец.</p>}
        </aside>
      </div>

      {histOpen && <HistoryModal card={card} canRestore={editable} onClose={() => setHistOpen(false)} onRestored={() => { setHistOpen(false); void reload(); }} />}
      {rejecting && <RejectModal onClose={() => setRejecting(false)} onSubmit={(c) => void action('reject', c)} />}
      <div className="hidden">{me?.name}</div>
    </>
  );
}

const Row = ({ k, v, strong }: { k: string; v: React.ReactNode; strong?: boolean }) => <div className={clsx('flex justify-between gap-3', strong && 'border-b border-line pb-2.5 text-[16px] font-semibold')}><dt className={strong ? '' : 'text-muted'}>{k}</dt><dd className="tnum">{v}</dd></div>;

function QtyInput({ value, unit, onChange, disabled, placeholder }: { value: string; unit: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string }) {
  return (
    <div className="relative min-w-[100px]"><input className="input tnum !h-8 !pr-9 text-right" inputMode="decimal" disabled={disabled} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted">{unit}</span></div>
  );
}

/** Выпадающий список с поиском (сырьё и блюда). */
function Combo({ options, value, onChange, kind }: { options: { id: string; label: string; sub?: string }[]; value: string; onChange: (id: string) => void; kind: 'i' | 'p' }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const cur = options.find((o) => o.id === value);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const list = options.filter((o) => !q || o.label.toLowerCase().includes(q.toLowerCase())).slice(0, 60);
  return (
    <div ref={ref} className="relative min-w-[200px]">
      <button type="button" onClick={() => { setOpen(!open); setQ(''); }} className={clsx('input flex !h-8 items-center justify-between gap-2 text-left', !cur && 'text-muted')}>
        <span className="truncate">{cur?.label ?? (kind === 'i' ? 'Выберите ингредиент…' : 'Выберите блюдо…')}</span><ChevronDown size={14} className="shrink-0 text-muted" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-[min(340px,86vw)] overflow-hidden rounded-xl border border-line bg-surface shadow-2xl animate-pop">
          <div className="border-b border-line p-2"><input className="input !h-8" autoFocus placeholder="Поиск…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {list.map((o) => <li key={o.id}><button type="button" className={clsx('flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-[13px] hover:bg-surface2', o.id === value && 'bg-brand/10 text-brand')} onClick={() => { onChange(o.id); setOpen(false); }}><span className="truncate">{o.label}</span><span className="shrink-0 text-[11px] text-muted">{o.sub}</span></button></li>)}
            {!list.length && <li className="px-3 py-4 text-center text-sm text-muted">Ничего не найдено</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function RejectModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (c: string) => void }) {
  const [c, setC] = useState('');
  return (
    <Modal open onClose={onClose} title="Вернуть технологу" width={460} footer={<><button className="btn btn-soft" onClick={onClose}>Отмена</button><button className="btn btn-danger" disabled={!c.trim()} onClick={() => onSubmit(c.trim())}>Вернуть</button></>}>
      <Field label="Причина (обязательно)"><textarea className="input" rows={3} autoFocus value={c} onChange={(e) => setC(e.target.value)} placeholder="Что нужно исправить" /></Field>
    </Modal>
  );
}

function HistoryModal({ card, canRestore, onClose, onRestored }: { card: Card; canRestore: boolean; onClose: () => void; onRestored: () => void }) {
  const { toast, confirm } = useUi();
  const [view, setView] = useState<number | null>(null);
  const { data } = useFetch(() => (view ? get<{ version: number; action: string; user: string; createdAt: string; rendimiento: number | null; tecnologia: string; items: { nombre: string; unidad: string; cantidad: number; neto: number | null; componenteId: string | null }[] }>(`/tc/cards/${card.productoId}/versions/${view}`) : Promise.resolve(null)), [view]);
  return (
    <Modal open onClose={onClose} title="История версий" width={720} footer={<button className="btn btn-primary" onClick={onClose}>Закрыть</button>}>
      <ul className="divide-y divide-line/70 rounded-lg border border-line">
        {card.versions.map((v, i) => (
          <li key={i} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-[13px]">
            <span className="chip bg-brand/10 text-brand">v{v.version}</span><span className="font-medium">{ACTION[v.action] ?? v.action}</span><span className="text-muted">{v.user_name}</span><span className="text-muted">{fmtDateTime(v.created_at)}</span>
            {v.comment && <span className="w-full text-xs text-muted sm:w-auto sm:flex-1">«{v.comment}»</span>}
            <span className="ml-auto flex gap-1"><button className="btn btn-ghost btn-sm" onClick={() => setView(view === v.version ? null : v.version)}>{view === v.version ? 'Скрыть' : 'Смотреть'}</button>
              {canRestore && ['save', 'submit', 'import', 'restore'].includes(v.action) && <button className="btn btn-soft btn-sm" onClick={async () => {
                if (!(await confirm({ title: `Восстановить версию ${v.version}?`, text: 'Текущий состав будет заменён, карта вернётся в статус «Черновик». Текущая версия сохранится в истории.', confirmLabel: 'Восстановить' }))) return;
                try { await post(`/tc/cards/${card.productoId}/restore`, { version: v.version }); toast('ok', 'Версия восстановлена'); onRestored(); } catch (e) { toast('err', (e as Error).message); }
              }}><RotateCcw size={13} /> Восстановить</button>}</span>
          </li>))}
        {!card.versions.length && <li className="px-3 py-6 text-center text-sm text-muted">История пуста</li>}
      </ul>
      {view && data && (
        <div className="mt-4 rounded-lg border border-line bg-surface2/50 p-3"><div className="mb-2 text-sm font-semibold">Состав версии {data.version}{data.rendimiento ? ` · выход ${num(data.rendimiento)} г/мл` : ''}</div>
          <table className="w-full text-[13px]"><tbody>{data.items.map((i, k) => <tr key={k}><td className="py-1">{i.nombre}</td><td className="tnum py-1 text-right text-muted">{num(i.cantidad * (i.unidad === 'кг' || i.unidad === 'л' ? 1000 : 1), 3)} {i.unidad === 'кг' ? 'г' : i.unidad === 'л' ? 'мл' : i.unidad}</td></tr>)}</tbody></table>
          {data.tecnologia && <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-surface p-3 font-sans text-[12.5px] leading-relaxed text-muted">{data.tecnologia}</pre>}</div>
      )}
    </Modal>
  );
}
