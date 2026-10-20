import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ArrowLeft, Crown, KeyRound, Plus, Save, Search, ShieldCheck, Trash2, UserCog, Users } from 'lucide-react';
import { del, enc, get, patch, post } from '../api';
import { go, useApp } from '../ctx';
import { Empty, ErrorBox, fmtDate, Loading, Modal, Spinner, Toggle, useUi } from '../ui';

interface Role { oid: number; name: string; super: boolean; inherit: boolean; createrole: boolean; createdb: boolean; login: boolean; replication: boolean; bypassrls: boolean; connlimit: number; valid_until: string | null; member_of: string[]; sessions: number; owned_tables: number }
interface Priv { schema: string; name: string; kind: string; select: boolean; insert: boolean; update: boolean; delete: boolean; truncate: boolean; references: boolean; trigger: boolean }
const PRIVS = ['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger'] as const;
const PL: Record<string, string> = { select: 'SELECT', insert: 'INSERT', update: 'UPDATE', delete: 'DELETE', truncate: 'TRUNCATE', references: 'REFS', trigger: 'TRIGGER' };

export default function Roles({ selected }: { selected?: string }) {
  const { session, db } = useApp();
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);

  const reload = useCallback(async () => { try { setRoles(await get<Role[]>('/roles')); setError(null); } catch (e) { setError(e); } }, []);
  useEffect(() => { void reload(); }, [reload, db]);

  const filtered = useMemo(() => (roles ?? []).filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase())), [roles, q]);
  const cur = roles?.find((r) => r.name === selected);

  if (error && !roles) return <ErrorBox error={error} onRetry={reload} />;
  if (!roles) return <Loading />;

  return (
    <div className="flex h-full min-h-0">
      <div className={clsx('flex w-full min-w-0 flex-col border-line lg:w-[320px] lg:shrink-0 lg:border-r', selected && 'hidden lg:flex')}>
        <div className="flex gap-2 border-b border-line p-3">
          <div className="relative flex-1"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input !h-8 !pl-8 text-[13px]" placeholder="Поиск ролей…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <button className="btn btn-primary btn-sm" disabled={session.readOnly} onClick={() => setCreating(true)} title={session.readOnly ? 'Включите режим записи' : ''}><Plus size={14} /> Роль</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtered.map((r) => (
            <a key={r.oid} href={`#/roles/${enc(r.name)}`} className={clsx('flex items-center gap-3 border-b border-line/50 px-4 py-3 transition hover:bg-surface2/60', selected === r.name && 'bg-accent/10')}>
              <div className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold', r.super ? 'bg-warn/20 text-warn' : r.login ? 'bg-accent/15 text-accent' : 'bg-info/15 text-info')}>{r.super ? <Crown size={16} /> : r.name.slice(0, 2).toUpperCase()}</div>
              <div className="min-w-0 flex-1"><div className="truncate text-[13.5px] font-semibold">{r.name}{r.name === session.user && <span className="ml-1.5 text-[11px] font-normal text-accent">это вы</span>}</div>
                <div className="truncate text-[11px] text-muted">{r.login ? 'вход разрешён' : 'группа (без входа)'}{r.sessions ? ` · сессий: ${r.sessions}` : ''}{r.owned_tables ? ` · таблиц: ${r.owned_tables}` : ''}</div></div>
            </a>
          ))}
          {!filtered.length && <Empty icon={<Users size={34} />} title="Роли не найдены" />}
        </div>
      </div>
      <div className={clsx('min-w-0 flex-1 overflow-auto', !selected && 'hidden lg:block')}>
        {cur ? <RoleDetail key={cur.name} role={cur} all={roles} reload={reload} />
          : <Empty icon={<UserCog size={40} />} title="Выберите пользователя" text="Справа появятся права доступа, членство в группах и привилегии на таблицы." />}
      </div>
      {creating && <CreateRole onClose={() => setCreating(false)} onDone={(n) => { setCreating(false); void reload(); go(`roles/${enc(n)}`); }} />}
    </div>
  );
}

function RoleDetail({ role, all, reload }: { role: Role; all: Role[]; reload: () => void }) {
  const { session } = useApp();
  const { toast, confirm } = useUi();
  const canWrite = !session.readOnly;
  const [attrs, setAttrs] = useState({ login: role.login, super: role.super, createdb: role.createdb, createrole: role.createrole, inherit: role.inherit, replication: role.replication });
  const [limit, setLimit] = useState(String(role.connlimit));
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);
  const [privs, setPrivs] = useState<Priv[] | null>(null);
  const [pq, setPq] = useState('');
  const dirty = JSON.stringify(attrs) !== JSON.stringify({ login: role.login, super: role.super, createdb: role.createdb, createrole: role.createrole, inherit: role.inherit, replication: role.replication }) || limit !== String(role.connlimit) || pwd !== '';

  const loadPrivs = useCallback(() => { get<Priv[]>(`/roles/${enc(role.name)}/privileges`).then(setPrivs).catch(() => setPrivs([])); }, [role.name]);
  useEffect(() => { loadPrivs(); }, [loadPrivs]);

  const save = async () => {
    setBusy(true);
    try { await patch(`/roles/${enc(role.name)}`, { ...attrs, connlimit: limit === '' ? undefined : Number(limit), password: pwd || undefined }); toast('ok', 'Сохранено'); setPwd(''); reload(); }
    catch (e) { toast('err', (e as Error).message); } finally { setBusy(false); }
  };

  const toggle = async (p: Priv, priv: string, grant: boolean) => {
    setPrivs((list) => list && list.map((x) => (x === p ? { ...x, [priv]: grant } : x)));
    try { await post(`/roles/${enc(role.name)}/privileges`, { schema: p.schema, table: p.name, privileges: [priv], grant }); }
    catch (e) { toast('err', (e as Error).message); loadPrivs(); }
  };
  const bulk = async (p: Priv, grant: boolean) => {
    try { await post(`/roles/${enc(role.name)}/privileges`, { schema: p.schema, table: p.name, privileges: p.kind === 'r' || p.kind === 'p' ? PRIVS.map((x) => x.toUpperCase()) : ['SELECT'], grant }); loadPrivs(); }
    catch (e) { toast('err', (e as Error).message); }
  };
  const bulkAll = async (grant: boolean, privs_: string[]) => {
    if (!(await confirm({ title: `${grant ? 'Выдать' : 'Забрать'} ${privs_.join(', ')} на все таблицы?`, text: `Роль «${role.name}», показанные таблицы (${filteredPrivs.length}).`, danger: !grant, confirmLabel: grant ? 'Выдать' : 'Забрать' }))) return;
    setBusy(true);
    try { for (const p of filteredPrivs) await post(`/roles/${enc(role.name)}/privileges`, { schema: p.schema, table: p.name, privileges: privs_, grant }); toast('ok', 'Готово'); loadPrivs(); }
    catch (e) { toast('err', (e as Error).message); loadPrivs(); } finally { setBusy(false); }
  };
  const filteredPrivs = (privs ?? []).filter((p) => !pq || p.name.toLowerCase().includes(pq.toLowerCase()));

  const groups = all.filter((r) => !r.login && r.name !== role.name);
  const member = async (g: string, grant: boolean) => { try { await post(`/roles/${enc(role.name)}/membership`, { group: g, grant }); reload(); } catch (e) { toast('err', (e as Error).message); } };

  return (
    <div className="mx-auto max-w-[1100px] space-y-5 p-3 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-ghost btn-sm !px-2 lg:hidden" onClick={() => go('roles')}><ArrowLeft size={17} /></button>
        <div className={clsx('grid h-12 w-12 place-items-center rounded-2xl text-lg font-semibold', role.super ? 'bg-warn/20 text-warn' : 'bg-accent/15 text-accent')}>{role.super ? <Crown size={22} /> : role.name.slice(0, 2).toUpperCase()}</div>
        <div className="min-w-0 flex-1"><div className="truncate text-xl font-semibold">{role.name}</div><div className="text-xs text-muted">{role.login ? 'Может входить в систему' : 'Групповая роль'} · срок действия: {role.valid_until && role.valid_until !== 'infinity' ? fmtDate(role.valid_until) : 'бессрочно'}</div></div>
        {role.name !== session.user && <button className="btn btn-danger btn-sm" disabled={!canWrite} onClick={async () => {
          if (!(await confirm({ title: `Удалить роль «${role.name}»?`, text: role.owned_tables ? `Роль владеет таблицами (${role.owned_tables}) — удаление не пройдёт, пока они не переданы.` : 'Роль будет удалена безвозвратно.', danger: true, confirmLabel: 'Удалить', typeToConfirm: role.name }))) return;
          try { await del(`/roles/${enc(role.name)}`); toast('ok', 'Роль удалена'); go('roles'); reload(); } catch (e) { toast('err', (e as Error).message); }
        }}><Trash2 size={14} /> Удалить</button>}
      </div>

      <section className="card p-4">
        <h2 className="mb-3 flex items-center gap-2 font-semibold"><ShieldCheck size={16} className="text-accent" />Атрибуты</h2>
        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <Toggle checked={attrs.login} disabled={!canWrite} onChange={(v) => setAttrs({ ...attrs, login: v })} label="LOGIN — может входить" />
          <Toggle checked={attrs.super} disabled={!canWrite} onChange={(v) => setAttrs({ ...attrs, super: v })} label="SUPERUSER — полный доступ" />
          <Toggle checked={attrs.createdb} disabled={!canWrite} onChange={(v) => setAttrs({ ...attrs, createdb: v })} label="CREATEDB — создавать базы" />
          <Toggle checked={attrs.createrole} disabled={!canWrite} onChange={(v) => setAttrs({ ...attrs, createrole: v })} label="CREATEROLE — создавать роли" />
          <Toggle checked={attrs.inherit} disabled={!canWrite} onChange={(v) => setAttrs({ ...attrs, inherit: v })} label="INHERIT — наследовать права групп" />
          <Toggle checked={attrs.replication} disabled={!canWrite} onChange={(v) => setAttrs({ ...attrs, replication: v })} label="REPLICATION" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div><label className="label">Лимит подключений (-1 — без лимита)</label><input className="input" type="number" min={-1} disabled={!canWrite} value={limit} onChange={(e) => setLimit(e.target.value)} /></div>
          <div><label className="label"><KeyRound size={11} className="mr-1 inline" />Новый пароль</label><input className="input" type="password" autoComplete="new-password" disabled={!canWrite} placeholder="оставьте пустым, чтобы не менять" value={pwd} onChange={(e) => setPwd(e.target.value)} /></div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-3">
          {!canWrite && <span className="text-xs text-warn">Включите режим записи, чтобы менять роль</span>}
          <button className="btn btn-primary" disabled={!canWrite || !dirty || busy} onClick={() => void save()}>{busy ? <Spinner size={15} /> : <Save size={15} />} Сохранить</button>
        </div>
      </section>

      {groups.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">Членство в группах</h2>
          <div className="flex flex-wrap gap-2">{groups.map((g) => {
            const on = role.member_of.includes(g.name);
            return <button key={g.name} disabled={!canWrite} onClick={() => void member(g.name, !on)} className={clsx('rounded-lg border px-3 py-1.5 text-[13px] font-medium transition disabled:opacity-50', on ? 'border-accent bg-accent/15 text-accent' : 'border-line text-muted hover:text-ink')}>{g.name}</button>;
          })}</div>
        </section>
      )}
      {role.member_of.length > 0 && groups.length === 0 && <section className="card p-4 text-sm">Состоит в группах: {role.member_of.join(', ')}</section>}

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <h2 className="mr-auto font-semibold">Привилегии на таблицы</h2>
          <div className="relative"><Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" /><input className="input !h-8 !w-44 !pl-7 text-[13px]" placeholder="Фильтр…" value={pq} onChange={(e) => setPq(e.target.value)} /></div>
          <button className="btn btn-soft btn-sm" disabled={!canWrite || busy} onClick={() => void bulkAll(true, ['SELECT'])}>+ SELECT всем</button>
          <button className="btn btn-soft btn-sm" disabled={!canWrite || busy} onClick={() => void bulkAll(true, ['SELECT', 'INSERT', 'UPDATE', 'DELETE'])}>+ CRUD всем</button>
          <button className="btn btn-danger btn-sm" disabled={!canWrite || busy} onClick={() => void bulkAll(false, ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'])}>Забрать всё</button>
        </div>
        {role.super && <div className="border-b border-line bg-warn/10 px-4 py-2 text-xs text-warn">Суперпользователь имеет все права независимо от матрицы.</div>}
        {!privs ? <Loading /> : (
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full text-[13px]">
              <thead><tr><th className="th">Таблица</th>{PRIVS.map((p) => <th key={p} className="th text-center">{PL[p]}</th>)}<th className="th" /></tr></thead>
              <tbody>
                {filteredPrivs.map((p) => (
                  <tr key={p.schema + p.name} className="hover:bg-surface2/40">
                    <td className="td whitespace-nowrap font-mono font-medium">{p.schema !== 'public' && <span className="text-muted">{p.schema}.</span>}{p.name}{(p.kind === 'v' || p.kind === 'm') && <span className="chip ml-2 bg-info/10 text-info">view</span>}</td>
                    {PRIVS.map((k) => (
                      <td key={k} className="td text-center">
                        <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={p[k]} disabled={!canWrite} onChange={(e) => void toggle(p, k.toUpperCase(), e.target.checked)} />
                      </td>
                    ))}
                    <td className="td whitespace-nowrap text-right">
                      <button className="btn btn-ghost btn-sm !h-7 !px-2 text-[12px]" disabled={!canWrite} onClick={() => void bulk(p, true)}>все</button>
                      <button className="btn btn-ghost btn-sm !h-7 !px-2 text-[12px]" disabled={!canWrite} onClick={() => void bulk(p, false)}>нет</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function CreateRole({ onClose, onDone }: { onClose: () => void; onDone: (name: string) => void }) {
  const { toast } = useUi();
  const [name, setName] = useState(''); const [password, setPassword] = useState('');
  const [login, setLogin] = useState(true); const [createdb, setCreatedb] = useState(false); const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { await post('/roles', { name: name.trim(), password: password || undefined, login, createdb, createrole: false, super: false }); toast('ok', 'Роль создана'); onDone(name.trim()); }
    catch (e) { toast('err', (e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title="Новая роль" width={460} footer={<><button className="btn btn-soft" onClick={onClose}>Отмена</button><button className="btn btn-primary" disabled={!name.trim() || busy} onClick={() => void submit()}>Создать</button></>}>
      <div className="space-y-3">
        <div><label className="label">Имя</label><input className="input font-mono" autoFocus value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label">Пароль</label><input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <Toggle checked={login} onChange={setLogin} label="Может входить (LOGIN)" />
        <Toggle checked={createdb} onChange={setCreatedb} label="Может создавать базы (CREATEDB)" />
        <p className="text-xs text-muted">Новая роль ничего не может читать, пока вы не выдадите привилегии на таблицы.</p>
      </div>
    </Modal>
  );
}
