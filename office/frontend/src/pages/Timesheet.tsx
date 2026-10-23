import { useState } from 'react';
import { CalendarCheck2 } from 'lucide-react';
import { get, put } from '../api';
import { useAuth } from '../auth';
import { todayIn } from '../format';
import { ErrorBox, Loading, Modal, PageHeader, useFetch, useUi } from '../ui';
import { fmtQty, MonthPicker, parseNum } from '../ui2';

type Status = 'work' | 'off' | 'sick' | 'vacation' | 'absent';
interface Cell { status: Status; hours: number | null }
interface Emp { id: string; name: string; position: string | null; payKind: string; active: boolean; cells: Record<string, Cell>; workDays: number; hours: number }
interface Resp { month: string; days: string[]; norm: number; weekends: string[]; employees: Emp[] }

const ST: Record<Status, { short: string; label: string; cls: string }> = {
  work: { short: '✓', label: 'Работал', cls: 'bg-good/15 text-good' }, off: { short: 'В', label: 'Выходной', cls: 'bg-surface2 text-muted' },
  sick: { short: 'Б', label: 'Больничный', cls: 'bg-warn/15 text-warn' }, vacation: { short: 'О', label: 'Отпуск', cls: 'bg-info/15 text-info' }, absent: { short: 'П', label: 'Прогул', cls: 'bg-bad/15 text-bad' },
};
const dow = (iso: string) => ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'][new Date(iso + 'T00:00:00Z').getUTCDay()];

/** Табель: сетка «сотрудник × день». Клик по клетке — отметить статус; почасовым можно указать часы. */
export default function Timesheet() {
  const { me, can } = useAuth();
  const { toast } = useUi();
  const [month, setMonth] = useState(() => todayIn(me!.settings.timezone).slice(0, 7));
  const { data, error, reload } = useFetch(() => get<Resp>('/hr/timesheet?month=' + month), [month]);
  const [edit, setEdit] = useState<{ emp: Emp; date: string } | null>(null);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const write = can('hr.write');
  const today = todayIn(me!.settings.timezone);
  const fillWeekdays = async (e: Emp) => {
    try { const r = await put<{ days: number }>('/hr/timesheet/range', { employeeId: e.id, from: data.days[0], to: data.days[data.days.length - 1], status: 'work', hours: e.payKind === 'hourly' ? 8 : null, weekdaysOnly: true }); toast('ok', `Отмечено рабочих дней: ${r.days}`); void reload(); } catch (x) { toast('err', (x as Error).message); }
  };
  return (
    <>
      <PageHeader title="Табель" subtitle="Кто и когда работал. Оклад считается пропорционально отработанным дням, почасовая оплата — по часам" />
      <div className="mb-4 flex flex-wrap items-center gap-3"><MonthPicker value={month} onChange={setMonth} /><span className="text-xs text-muted">Норма месяца: {data.norm} раб. дн. · выходные подсвечены</span>
        <span className="ml-auto flex flex-wrap gap-1.5 text-[11px]">{(Object.keys(ST) as Status[]).map((s) => <span key={s} className={`rounded px-1.5 py-0.5 font-semibold ${ST[s].cls}`}>{ST[s].short} {ST[s].label}</span>)}</span></div>
      {!data.employees.length ? <div className="card p-10 text-center text-sm text-muted"><CalendarCheck2 size={30} className="mx-auto mb-2 opacity-40" />В штате нет сотрудников. Добавьте их в разделе «Штат».</div> : (
        <div className="card overflow-x-auto">
          <table className="border-collapse text-[12px]">
            <thead>
              <tr><th className="th sticky left-0 z-10 min-w-[190px] bg-surface2">Сотрудник</th>{data.days.map((d) => <th key={d} className={`th !px-0 text-center ${data.weekends.includes(d) ? '!bg-bad/10' : ''} ${d === today ? '!text-brand' : ''}`}><div>{d.slice(8)}</div><div className="font-normal normal-case opacity-70">{dow(d)}</div></th>)}<th className="th text-right">Дней</th><th className="th text-right">Часов</th>{write && <th className="th" />}</tr>
            </thead>
            <tbody>
              {data.employees.map((e) => (
                <tr key={e.id} className={e.active ? '' : 'opacity-60'}>
                  <td className="td sticky left-0 z-[1] bg-surface"><div className="font-medium">{e.name}</div><div className="text-[11px] text-muted">{e.position ?? ''}{e.payKind === 'hourly' ? ' · почасовая' : ''}</div></td>
                  {data.days.map((d) => {
                    const c = e.cells[d];
                    return <td key={d} className={`!p-0 text-center ${data.weekends.includes(d) ? 'bg-bad/5' : ''}`}>
                      <button disabled={!write} onClick={() => setEdit({ emp: e, date: d })} title={c ? `${ST[c.status].label}${c.hours ? `, ${c.hours} ч` : ''}` : 'не отмечено'}
                        className={`m-px h-8 w-8 rounded text-[12px] font-semibold transition ${c ? ST[c.status].cls : 'text-muted/30 hover:bg-surface2'} ${write ? 'cursor-pointer hover:ring-2 hover:ring-brand/40' : 'cursor-default'}`}>{c ? (c.status === 'work' && e.payKind === 'hourly' && c.hours ? c.hours : ST[c.status].short) : '·'}</button></td>;
                  })}
                  <td className="td tnum text-right font-semibold">{e.workDays}</td><td className="td tnum text-right text-muted">{e.hours ? fmtQty(e.hours, 1) : '—'}</td>
                  {write && <td className="td"><button className="btn btn-soft btn-sm" onClick={() => void fillWeekdays(e)} title="Отметить все рабочие дни месяца">Будни</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && <CellModal emp={edit.emp} date={edit.date} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void reload(); }} />}
    </>
  );
}

function CellModal({ emp, date, onClose, onSaved }: { emp: Emp; date: string; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const cur = emp.cells[date];
  const [status, setStatus] = useState<Status | null>(cur?.status ?? 'work');
  const [hours, setHours] = useState(String(cur?.hours ?? 8));
  const save = async (st: Status | null) => { try { await put('/hr/timesheet', { employeeId: emp.id, date, status: st, hours: st === 'work' ? parseNum(hours) || 8 : null }); onSaved(); } catch (e) { toast('err', (e as Error).message); } };
  return (
    <Modal open onClose={onClose} title={`${emp.name} · ${date.split('-').reverse().join('.')}`} width={420} footer={<>{cur && <button className="btn btn-ghost mr-auto" onClick={() => void save(null)}>Очистить</button>}<button className="btn btn-soft" onClick={onClose}>Отмена</button><button className="btn btn-primary" disabled={!status} onClick={() => void save(status)}>Сохранить</button></>}>
      <div className="flex flex-wrap gap-2">{(Object.keys(ST) as Status[]).map((s) => <button key={s} onClick={() => setStatus(s)} className={`rounded-lg border px-3 py-2 text-[13px] font-medium transition ${status === s ? 'border-brand bg-brand/10 text-brand' : 'border-line text-muted hover:text-ink'}`}><span className={`mr-1.5 rounded px-1.5 py-0.5 text-[11px] font-bold ${ST[s].cls}`}>{ST[s].short}</span>{ST[s].label}</button>)}</div>
      {status === 'work' && <div className="mt-4"><label className="label">Часов отработано{emp.payKind === 'hourly' ? ' (по ним считается оплата)' : ''}</label><input className="input tnum !w-28" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} /></div>}
    </Modal>
  );
}
