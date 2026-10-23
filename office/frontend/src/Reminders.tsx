import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { AlertTriangle, Bell, CheckCircle2, ChevronRight, Info } from 'lucide-react';
import { get } from './api';
import { useFetch } from './ui';

export interface Reminder { id: string; kind: string; severity: 'bad' | 'warn' | 'info'; title: string; detail: string; link: string; date?: string | null }
interface Resp { rows: Reminder[]; bad: number; total: number }

const ICON = { bad: <AlertTriangle size={16} className="text-bad" />, warn: <AlertTriangle size={16} className="text-warn" />, info: <Info size={16} className="text-info" /> };

function Row({ r, onGo }: { r: Reminder; onGo?: () => void }) {
  return (
    <Link to={r.link} onClick={onGo} className="group flex items-start gap-3 px-3 py-2.5 transition hover:bg-surface2/70">
      <span className="mt-0.5 shrink-0">{ICON[r.severity]}</span>
      <span className="min-w-0 flex-1"><span className="block text-[13.5px] font-medium leading-snug">{r.title}</span><span className="block text-xs text-muted">{r.detail}</span></span>
      <ChevronRight size={15} className="mt-1 shrink-0 text-muted/40 transition group-hover:text-brand" />
    </Link>
  );
}

/** Колокольчик в шапке: число напоминаний и выпадающий список. */
export function ReminderBell() {
  const { data } = useFetch(() => get<Resp>('/reminders'), []);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const n = data?.total ?? 0;
  return (
    <div ref={box} className="relative no-print">
      <button className="btn btn-ghost btn-sm relative !px-2" onClick={() => setOpen((o) => !o)} title="Требует внимания" aria-label="Напоминания">
        <Bell size={17} />{n > 0 && <span className={clsx('absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-white', data!.bad ? 'bg-bad' : 'bg-warn')}>{n > 99 ? '99+' : n}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-xl border border-line bg-surface shadow-2xl animate-fade">
          <div className="border-b border-line px-3 py-2 text-sm font-semibold">Требует внимания</div>
          <div className="max-h-[70vh] divide-y divide-line/60 overflow-y-auto">
            {data?.rows.length ? data.rows.slice(0, 20).map((r) => <Row key={r.id} r={r} onGo={() => setOpen(false)} />) : <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted"><CheckCircle2 size={18} className="text-good" />Всё в порядке — срочных дел нет</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/** Карточка на панели. */
export function ReminderCard() {
  const { data } = useFetch(() => get<Resp>('/reminders'), []);
  if (!data || !data.rows.length) return null;
  return (
    <section className="card mb-5 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5"><AlertTriangle size={16} className={data.bad ? 'text-bad' : 'text-warn'} /><h2 className="font-semibold">Требует внимания</h2><span className="ml-auto text-xs text-muted">{data.total}</span></div>
      <div className="grid divide-y divide-line/60 md:grid-cols-2 md:divide-y-0">
        {data.rows.slice(0, 8).map((r) => <div key={r.id} className="md:border-b md:border-line/60"><Row r={r} /></div>)}
      </div>
    </section>
  );
}
