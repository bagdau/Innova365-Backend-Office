import { useEffect, useMemo, useState } from 'react';
import { Lock, RotateCcw, Save } from 'lucide-react';
import { get, post, put } from '../api';
import { ErrorBox, Loading, PageHeader, useFetch, useUi } from '../ui';

interface Resp {
  perms: { id: string; group: string; label: string }[];
  roles: { id: string; label: string; note: string; perms: string[]; locked: string[]; defaults: string[] }[];
}

/** Матрица «роль × право». Закрытые замком права изменить нельзя (защита от блокировки управления). */
export default function Roles() {
  const { toast, confirm } = useUi();
  const { data, error, reload } = useFetch(() => get<Resp>('/roles'), [], { live: false });
  const [draft, setDraft] = useState<Record<string, Set<string>>>({});
  const [busy, setBusy] = useState('');

  useEffect(() => { if (data) setDraft(Object.fromEntries(data.roles.map((r) => [r.id, new Set(r.perms)]))); }, [data]);
  const groups = useMemo(() => {
    const m = new Map<string, Resp['perms']>();
    for (const p of data?.perms ?? []) m.set(p.group, [...(m.get(p.group) ?? []), p]);
    return [...m];
  }, [data]);

  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const dirty = (id: string) => { const a = draft[id], b = new Set(data.roles.find((r) => r.id === id)!.perms); return !a || a.size !== b.size || [...a].some((x) => !b.has(x)); };
  const toggle = (role: string, perm: string) => setDraft((d) => { const s = new Set(d[role]); if (s.has(perm)) s.delete(perm); else s.add(perm); return { ...d, [role]: s }; });
  const save = async (role: string) => {
    setBusy(role);
    try { await put('/roles/' + role, { perms: [...draft[role]] }); toast('ok', 'Права роли сохранены'); await reload(); } catch (e) { toast('err', (e as Error).message); } finally { setBusy(''); }
  };
  const reset = async (role: string, label: string) => {
    if (!(await confirm({ title: `Вернуть права роли «${label}» по умолчанию?`, text: 'Все ваши изменения для этой роли будут сброшены.', confirmLabel: 'Сбросить' }))) return;
    try { await post(`/roles/${role}/reset`); toast('ok', 'Права сброшены'); await reload(); } catch (e) { toast('err', (e as Error).message); }
  };

  return (
    <>
      <PageHeader title="Права доступа" subtitle="Что может каждая роль. Изменения вступают в силу сразу, у вошедших пользователей — при следующем действии" />
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px] text-[13px]">
          <thead>
            <tr>
              <th className="th sticky left-0 z-10 min-w-[260px] bg-surface2">Право</th>
              {data.roles.map((r) => (
                <th key={r.id} className="th text-center" title={r.note}>
                  <div className="whitespace-normal normal-case tracking-normal text-ink">{r.label}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(([g, perms]) => (
              <GroupRows key={g} group={g} perms={perms} roles={data.roles} draft={draft} toggle={toggle} />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="td sticky left-0 bg-surface" />
              {data.roles.map((r) => (
                <td key={r.id} className="td text-center">
                  {r.id === 'owner' ? <span className="text-xs text-muted">без ограничений</span> : (
                    <div className="flex flex-col items-center gap-1.5">
                      <button className="btn btn-primary btn-sm" disabled={!dirty(r.id) || busy === r.id} onClick={() => void save(r.id)}><Save size={14} /> Сохранить</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => void reset(r.id, r.label)}><RotateCcw size={13} /> По умолчанию</button>
                    </div>
                  )}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><Lock size={12} /> Замок — право нельзя изменить: у владельца права не ограничиваются, у администратора защищены управление сотрудниками, настройки и журнал, кабинет арендатора доступен только роли «Арендатор».</p>
    </>
  );
}

function GroupRows({ group, perms, roles, draft, toggle }: { group: string; perms: Resp['perms']; roles: Resp['roles']; draft: Record<string, Set<string>>; toggle: (role: string, perm: string) => void }) {
  return (
    <>
      <tr><td colSpan={roles.length + 1} className="bg-surface2/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{group}</td></tr>
      {perms.map((p) => (
        <tr key={p.id} className="hover:bg-surface2/40">
          <td className="td sticky left-0 bg-surface">{p.label}<span className="ml-2 font-mono text-[10.5px] text-muted/70">{p.id}</span></td>
          {roles.map((r) => {
            const on = draft[r.id]?.has(p.id) ?? false;
            const locked = r.id === 'owner' || r.locked.includes(p.id) || (p.id === 'tenant' && r.id !== 'tenant') || (r.id === 'tenant' && p.id !== 'tenant') || (p.id === 'roles' && r.id !== 'owner');
            return (
              <td key={r.id} className="td text-center">
                {locked ? (on ? <Lock size={13} className="mx-auto text-muted/60" /> : <span className="text-muted/30">—</span>)
                  : <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand))]" checked={on} onChange={() => toggle(r.id, p.id)} />}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
