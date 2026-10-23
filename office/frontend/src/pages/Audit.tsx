import { useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { get, qs } from '../api';
import { fmtDateTime } from '../format';
import { Badge, ErrorBox, Loading, PageHeader, useFetch } from '../ui';

interface Row { id: number; user_name: string | null; role: string | null; action: string; entity: string | null; entity_id: string | null; detail: unknown; at: string }

const LABEL: Record<string, string> = {
  login: 'Вход', 'staff.create': 'Сотрудник добавлен', 'staff.update': 'Сотрудник изменён', 'staff.delete': 'Сотрудник удалён', 'password.change': 'Смена пароля', 'settings.update': 'Настройки изменены',
  'outlet.create': 'Точка создана', 'outlet.update': 'Точка изменена', 'outlet.delete': 'Точка удалена', 'outlet.categories': 'Категории точки', 'settlement.create': 'Расчёт сформирован', 'settlement.recalc': 'Расчёт пересчитан',
  'settlement.issued': 'Расчёт выставлен', 'settlement.paid': 'Расчёт выплачен', 'settlement.delete': 'Расчёт удалён', 'techcard.save': 'Техкарта сохранена', 'techcard.submit': 'Техкарта на согласование',
  'techcard.approve': 'Техкарта утверждена', 'techcard.reject': 'Техкарта возвращена', 'techcard.reopen': 'Техкарта в работу', 'techcard.restore': 'Версия восстановлена', 'ingredient.create': 'Сырьё добавлено', 'ingredient.update': 'Сырьё изменено',
  'expense.create': 'Расход добавлен', 'expense.update': 'Расход изменён', 'expense.delete': 'Расход удалён', 'purchase.payment': 'Оплата поставщику', 'purchase.payment.delete': 'Оплата удалена',
};
const tone = (a: string) => (a.includes('delete') ? 'bad' : a.includes('approve') || a.includes('paid') ? 'good' : a === 'login' ? 'muted' : 'brand') as 'bad' | 'good' | 'muted' | 'brand';

export default function Audit() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const limit = 50;
  const { data, error, reload, loading } = useFetch(() => get<{ total: number; rows: Row[] }>('/audit' + qs({ q, limit, offset: page * limit })), [q, page]);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const pages = Math.max(1, Math.ceil(data.total / limit));
  return (
    <>
      <PageHeader title="Журнал действий" subtitle="Кто и что менял в офисе: входы, техкарты, расчёты, расходы, настройки" />
      <div className="relative mb-4 w-full sm:w-80"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input !pl-9" placeholder="Поиск по действию или сотруднику…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /></div>
      <div className={`card overflow-hidden transition ${loading ? 'opacity-60' : ''}`}>
        <table className="w-full text-[13px]"><thead><tr><th className="th">Время</th><th className="th">Сотрудник</th><th className="th">Действие</th><th className="th hidden md:table-cell">Подробности</th></tr></thead>
          <tbody>{data.rows.map((r) => (
            <tr key={r.id} className="hover:bg-surface2/50"><td className="td whitespace-nowrap text-muted">{fmtDateTime(r.at)}</td><td className="td"><div className="font-medium">{r.user_name}</div><div className="text-[11px] text-muted">{r.role}</div></td>
              <td className="td"><Badge tone={tone(r.action)}>{LABEL[r.action] ?? r.action}</Badge></td>
              <td className="td hidden max-w-[420px] md:table-cell"><code className="line-clamp-2 break-all text-[11.5px] text-muted">{r.detail ? JSON.stringify(r.detail) : r.entity_id ?? ''}</code></td></tr>))}
            {!data.rows.length && <tr><td colSpan={4} className="td py-10 text-center text-muted">Записей нет</td></tr>}</tbody></table>
        <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-muted"><span>Всего записей: {data.total}</span>
          <div className="flex items-center gap-1"><button className="btn btn-ghost btn-sm !px-2" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></button><span className="px-2">{page + 1} / {pages}</span><button className="btn btn-ghost btn-sm !px-2" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></button></div></div>
      </div>
    </>
  );
}
