import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Search } from 'lucide-react';
import { get } from './api';

export interface PageLink { to: string; label: string; group: string; icon: React.ElementType }
interface Hit { group: string; title: string; sub?: string; link: string }
interface Item { key: string; group: string; title: string; sub?: string; link: string; icon?: React.ElementType }

/** Поиск по Office (Ctrl+K или «/»): разделы системы и данные — блюда, сырьё, поставщики, договоры, счета… */
export function CommandPalette({ open, onClose, pages }: { open: boolean; onClose: () => void; pages: PageLink[] }) {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => { if (open) { setQ(''); setHits([]); setSel(0); setTimeout(() => input.current?.focus(), 30); } }, [open]);
  useEffect(() => {
    if (!open) return;
    const text = q.trim();
    if (text.length < 2) { setHits([]); setBusy(false); return; }
    setBusy(true);
    const id = ++seq.current;
    const t = setTimeout(() => { get<Hit[]>('/search?q=' + encodeURIComponent(text)).then((r) => { if (id === seq.current) { setHits(r); setBusy(false); } }).catch(() => { if (id === seq.current) setBusy(false); }); }, 160);
    return () => clearTimeout(t);
  }, [q, open]);

  const items = useMemo<Item[]>(() => {
    const t = q.trim().toLowerCase();
    const pg = (t ? pages.filter((p) => p.label.toLowerCase().includes(t) || p.group.toLowerCase().includes(t)) : pages.slice(0, 8)).slice(0, t ? 6 : 8)
      .map((p) => ({ key: 'p:' + p.to + p.label, group: t ? 'Разделы' : 'Быстрый переход', title: p.label, sub: p.group, link: p.to, icon: p.icon }));
    return [...pg, ...hits.map((h, i) => ({ key: `h:${i}:${h.link}:${h.title}`, group: h.group, title: h.title, sub: h.sub, link: h.link }))];
  }, [q, hits, pages]);
  useEffect(() => { setSel(0); }, [items.length]);
  if (!open) return null;

  const go = (it: Item) => { onClose(); nav(it.link); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter' && items[sel]) { e.preventDefault(); go(items[sel]); }
    else if (e.key === 'Escape') onClose();
  };
  let lastGroup = '';
  return (
    <div className="no-print fixed inset-0 z-[80] flex items-start justify-center bg-slate-950/55 p-4 pt-[10vh] backdrop-blur-[2px] animate-fade" onMouseDown={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl animate-pop" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line px-4"><Search size={17} className="text-muted" />
          <input ref={input} className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted/70" placeholder="Найти раздел, блюдо, сырьё, поставщика, договор, счёт…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} />
          {busy && <span className="text-xs text-muted">поиск…</span>}<kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-muted">Esc</kbd></div>
        <div className="max-h-[56vh] overflow-y-auto py-1">
          {items.map((it, i) => {
            const head = it.group !== lastGroup ? (lastGroup = it.group, <div className="px-4 pb-1 pt-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted">{it.group}</div>) : null;
            const Icon = it.icon;
            return (
              <div key={it.key}>{head}
                <button className={`flex w-full items-center gap-3 px-4 py-2 text-left transition ${i === sel ? 'bg-brand/10' : 'hover:bg-surface2'}`} onMouseEnter={() => setSel(i)} onClick={() => go(it)}>
                  {Icon && <Icon size={16} className="shrink-0 text-muted" />}
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-medium">{it.title}</span>{it.sub && <span className="block truncate text-xs text-muted">{it.sub}</span>}</span>
                  {i === sel && <CornerDownLeft size={14} className="shrink-0 text-muted" />}
                </button></div>
            );
          })}
          {!items.length && <div className="px-4 py-8 text-center text-sm text-muted">{q.trim().length < 2 ? 'Начните вводить — минимум 2 символа' : busy ? 'Ищем…' : 'Ничего не найдено'}</div>}
        </div>
        <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-[11px] text-muted"><span><kbd className="rounded border border-line px-1">↑↓</kbd> выбор</span><span><kbd className="rounded border border-line px-1">Enter</kbd> открыть</span><span className="ml-auto">Ctrl+K — в любой момент</span></div>
      </div>
    </div>
  );
}
