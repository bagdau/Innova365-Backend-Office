import { Fragment, ReactNode, useEffect, useMemo, useState } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { AlertTriangle, ArrowRight, Check, Lightbulb, Printer, X } from 'lucide-react';
import { useAuth } from '../auth';
import { PageHeader } from '../ui';
import { Chips, SearchBox } from '../ui2';
import { AUDIENCES, GUIDES, OFFICE_START, RESTAURANT_START, type RoleGuide, type Section } from './guideContent';

type Audience = 'office' | 'restaurant';

/** прокручивается область main, а не окно */
const toTop = () => { document.querySelector('main')?.scrollTo({ top: 0 }); window.scrollTo(0, 0); };

/** **жирный** → <b> */
const rich = (s: string): ReactNode => s.split(/\*\*(.+?)\*\*/g).map((p, i) => (i % 2 ? <b key={i} className="font-semibold text-ink">{p}</b> : <Fragment key={i}>{p}</Fragment>));
const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');
const plain = (s: string) => s.replace(/\*\*/g, '');

/** какую памятку открыть по роли Office */
const DEFAULT_GUIDE: Record<string, string> = { owner: 'admin', admin: 'admin', accountant: 'accountant', technologist: 'technologist', foodcourt: 'foodcourt', storekeeper: 'storekeeper', tenant: 'tenant' };

interface Hit { guide: RoleGuide; where: string; title: string; text: string; anchor: string }

function buildIndex(list: RoleGuide[]): Hit[] {
  const out: Hit[] = [];
  const add = (guide: RoleGuide, where: string, title: string, parts: (string | undefined)[], anchor: string) => out.push({ guide, where, title, text: plain(parts.filter(Boolean).join(' · ')), anchor });
  for (const g of list) {
    const start = g.audience === 'office' ? OFFICE_START : RESTAURANT_START;
    start.forEach((s, i) => add(g, 'Начало работы', s.title, [s.title, ...(s.steps ?? []), ...(s.bullets ?? []), s.tip, s.warn], `start-${i}`));
    g.sections.forEach((s, i) => add(g, 'Как работать', s.title, [s.title, ...(s.steps ?? []), ...(s.bullets ?? []), s.tip, s.warn], `sec-${i}`));
    g.faq.forEach((f, i) => add(g, 'Вопросы и ответы', f.q, [f.q, f.a], `faq-${i}`));
    add(g, 'Памятка', 'Правила', [...g.dos, ...g.donts], 'rules');
  }
  return out;
}

export default function Guide() {
  const { me } = useAuth();
  const [params, setParams] = useSearchParams();
  const defGuide = DEFAULT_GUIDE[me?.role ?? ''] ?? 'admin';
  // арендатор видит только свою памятку: служебные инструкции сотрудников ему не нужны
  const tenantOnly = me?.role === 'tenant';
  const all = useMemo(() => (tenantOnly ? GUIDES.filter((g) => g.id === 'tenant') : GUIDES), [tenantOnly]);
  const guideId = params.get('r') ?? defGuide;
  const guide = all.find((g) => g.id === guideId) ?? all.find((g) => g.id === defGuide) ?? all[0];
  const audience: Audience = guide.audience;
  const [q, setQ] = useState('');
  const index = useMemo(() => buildIndex(all), [all]);

  const open = (id: string, anchor?: string) => {
    setParams({ r: id }, { replace: true });
    setQ('');
    if (anchor) setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    else toTop();
  };
  const guides = all.filter((g) => g.audience === audience);

  const terms = norm(q).split(/\s+/).filter((t) => t.length >= 2);
  const hits = useMemo(() => (terms.length ? index.filter((h) => { const t = norm(h.text); return terms.every((w) => t.includes(w)); }).slice(0, 40) : []), [index, q]);

  return (
    <div className="mx-auto max-w-[980px]">
      <PageHeader title="Инструктаж" subtitle="Пошаговые памятки по ролям: что делать, куда нажимать и чего не делать. Для офиса и для ресторана."
        actions={<button className="btn btn-soft" onClick={() => window.print()}><Printer size={15} /> Печать памятки</button>} />

      <div className="no-print mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {!tenantOnly && <Chips value={audience} onChange={(a) => open(all.find((g) => g.audience === a)!.id)} options={AUDIENCES.map((a) => ({ id: a.id, label: a.label }))} />}
          <SearchBox value={q} onChange={setQ} placeholder="Найти в инструктаже: например, «аванс», «оплата», «списание»" className="min-w-[260px] flex-1" />
        </div>
        {!tenantOnly && <p className="text-xs text-muted">{AUDIENCES.find((a) => a.id === audience)!.hint}</p>}
        {!q && !tenantOnly && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {guides.map((g) => (
              <button key={g.id} onClick={() => open(g.id)} className={clsx('card p-3 text-left transition hover:border-brand/50', g.id === guide.id && 'border-brand ring-1 ring-brand/40')}>
                <div className="text-[13.5px] font-semibold leading-tight">{g.title}</div>
                {g.forRoles?.includes(me?.role ?? '') && <div className="mt-1 text-[11px] font-medium text-brand">Ваша роль</div>}
              </button>
            ))}
          </div>
        )}
      </div>

      {q ? <SearchResults q={q} hits={hits} onOpen={open} /> : <GuideView guide={guide} />}
    </div>
  );
}

function SearchResults({ q, hits, onOpen }: { q: string; hits: Hit[]; onOpen: (id: string, anchor?: string) => void }) {
  if (norm(q).trim().length < 2) return <p className="text-sm text-muted">Введите хотя бы два символа.</p>;
  if (!hits.length) return <div className="card p-6 text-center text-sm text-muted">Ничего не найдено. Попробуйте другое слово или спросите администратора.</div>;
  const snip = (t: string) => { const i = norm(t).indexOf(norm(q).split(/\s+/)[0]); const from = Math.max(0, i - 50); return (from ? '…' : '') + t.slice(from, from + 170) + (t.length > from + 170 ? '…' : ''); };
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted">Найдено: {hits.length}</div>
      {hits.map((h, i) => (
        <button key={i} onClick={() => onOpen(h.guide.id, h.anchor)} className="card block w-full p-3 text-left transition hover:border-brand/50">
          <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted"><span className="font-semibold text-brand">{h.guide.title}</span><span>›</span><span>{h.where}</span></div>
          <div className="mt-0.5 text-[14px] font-medium">{h.title}</div>
          <div className="mt-0.5 text-[12.5px] text-muted">{snip(h.text)}</div>
        </button>
      ))}
    </div>
  );
}

function GuideView({ guide }: { guide: RoleGuide }) {
  const start = guide.audience === 'office' ? OFFICE_START : RESTAURANT_START;
  const toc = [
    { id: 'start-0', label: 'Начало работы' },
    ...guide.sections.map((s, i) => ({ id: `sec-${i}`, label: s.title })),
    { id: 'rules', label: 'Памятка' },
    ...(guide.faq.length ? [{ id: 'faq-0', label: 'Вопросы и ответы' }] : []),
  ];
  // при смене памятки возвращаемся к началу
  useEffect(() => { toTop(); }, [guide.id]);

  return (
    <div className="space-y-4">
      <div className="hidden print:block"><div className="text-xs text-muted">Innova365 · Инструктаж</div><h1 className="text-xl font-semibold">{guide.title}</h1></div>

      <div className="card bg-gradient-to-br from-brand/10 to-transparent p-5 print-page">
        <div className="text-xs font-semibold uppercase tracking-wide text-brand">{guide.audience === 'office' ? 'Сотрудники офиса' : 'Сотрудники ресторана'}</div>
        <h2 className="mt-0.5 text-xl font-semibold">{guide.title}</h2>
        <p className="mt-2 text-[14px]"><span className="font-semibold">Чем вы занимаетесь:</span> {guide.who}</p>
        <p className="mt-1 text-[14px]"><span className="font-semibold">Цель:</span> {guide.goal}</p>
      </div>

      <nav className="no-print flex flex-wrap gap-1.5" aria-label="Содержание">
        {toc.map((t) => (
          <button key={t.id} className="rounded-full border border-line bg-surface px-3 py-1 text-[12.5px] text-muted transition hover:border-brand/50 hover:text-ink" onClick={() => document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{t.label}</button>
        ))}
      </nav>

      <GroupTitle>Начало работы (для всех в этой группе)</GroupTitle>
      {start.map((s, i) => <SectionCard key={s.title} id={`start-${i}`} s={s} n={null} />)}

      <GroupTitle>Как работать: {guide.title}</GroupTitle>
      {guide.sections.map((s, i) => <SectionCard key={s.title} id={`sec-${i}`} s={s} n={i + 1} />)}

      <GroupTitle id="rules">Памятка на каждый день</GroupTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card break-inside-avoid p-5"><h3 className="mb-2 flex items-center gap-2 font-semibold text-good"><Check size={17} /> Делайте</h3><ul className="space-y-2 text-[14px]">{guide.dos.map((d) => <li key={d} className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-good" /><span>{d}</span></li>)}</ul></div>
        <div className="card break-inside-avoid p-5"><h3 className="mb-2 flex items-center gap-2 font-semibold text-bad"><X size={17} /> Не делайте</h3><ul className="space-y-2 text-[14px]">{guide.donts.map((d) => <li key={d} className="flex gap-2"><X size={15} className="mt-0.5 shrink-0 text-bad" /><span>{d}</span></li>)}</ul></div>
      </div>

      {guide.faq.length > 0 && (
        <>
          <GroupTitle>Вопросы и ответы</GroupTitle>
          <div className="space-y-2">
            {guide.faq.map((f, i) => (
              <div key={f.q} id={`faq-${i}`} className="card break-inside-avoid scroll-mt-20 p-4"><div className="font-semibold">{f.q}</div><p className="mt-1 text-[14px] text-muted">{rich(f.a)}</p></div>
            ))}
          </div>
        </>
      )}

      <p className="no-print pb-4 pt-2 text-center text-xs text-muted">Не нашли ответ? Обратитесь к администратору. Если в инструктаже что-то не совпадает с программой — сообщите ему, чтобы текст обновили.</p>
    </div>
  );
}

const GroupTitle = ({ children, id }: { children: ReactNode; id?: string }) => <h2 id={id} className="scroll-mt-20 pt-3 text-[13px] font-semibold uppercase tracking-[.12em] text-muted">{children}</h2>;

function SectionCard({ id, s, n }: { id: string; s: Section; n: number | null }) {
  const { can } = useAuth();
  const go = (s.go ?? []).filter((g) => !g.perm || (Array.isArray(g.perm) ? g.perm.some(can) : can(g.perm)));
  return (
    <section id={id} className="card scroll-mt-20 break-inside-avoid p-5 print-page">
      <h3 className="mb-3 flex items-center gap-2.5 text-[16px] font-semibold">
        {n !== null && <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-[12px] font-bold text-brandfg">{n}</span>}
        {s.title}
      </h3>
      {s.steps && (
        <ol className="space-y-2 text-[14px]">
          {s.steps.map((t, i) => (
            <li key={i} className="flex gap-3"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface2 text-[11px] font-semibold text-muted">{i + 1}</span><span className="leading-relaxed">{rich(t)}</span></li>
          ))}
        </ol>
      )}
      {s.bullets && (
        <ul className="space-y-2 text-[14px]">
          {s.bullets.map((t, i) => <li key={i} className="flex gap-2.5"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" /><span className="leading-relaxed">{rich(t)}</span></li>)}
        </ul>
      )}
      {s.tip && <div className="mt-3 flex gap-2 rounded-lg bg-info/10 p-3 text-[13px] text-info"><Lightbulb size={16} className="mt-0.5 shrink-0" /><span>{rich(s.tip)}</span></div>}
      {s.warn && <div className="mt-3 flex gap-2 rounded-lg bg-warn/10 p-3 text-[13px] text-warn"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>{rich(s.warn)}</span></div>}
      {go.length > 0 && (
        <div className="no-print mt-3 flex flex-wrap gap-2">
          {go.map((g) => <NavLink key={g.to + g.label} to={g.to} className="btn btn-soft btn-sm">{g.label} <ArrowRight size={13} /></NavLink>)}
        </div>
      )}
    </section>
  );
}
