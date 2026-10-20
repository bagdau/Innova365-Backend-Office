import { useState } from 'react';
import { DatabaseZap, Download, Eraser, Eye, Pencil, Plus, Rows3, Settings2, Sparkles, Table2, Trash2 } from 'lucide-react';
import { downloadUrl, post, tpath } from '../api';
import { go, tableLink, useApp } from '../ctx';
import { ErrorBox, fmtBytes, fmtNum, Loading, Tabs, useUi } from '../ui';
import { RowForm } from './RowForm';
import TableData from './TableData';
import TableStructure, { KIND, TextPrompt, useStructure } from './TableStructure';

type Tab = 'data' | 'structure' | 'insert' | 'ops';

export default function TableView({ schema, name, tab }: { schema: string; name: string; tab: string }) {
  const { session, refreshTree } = useApp();
  const cur = (['data', 'structure', 'insert', 'ops'].includes(tab) ? tab : 'data') as Tab;
  const { data, error, reload } = useStructure(schema, name);
  const isTable = data ? ['r', 'p'].includes(data.kind) : true;

  const setTab = (t: Tab) => { window.location.hash = tableLink(schema, name, t); };
  const tabs = [
    { id: 'data' as Tab, label: 'Данные', icon: <Rows3 size={15} /> },
    { id: 'structure' as Tab, label: 'Структура', icon: <Table2 size={15} /> },
    ...(isTable ? [{ id: 'insert' as Tab, label: 'Вставить', icon: <Plus size={15} /> }] : []),
    { id: 'ops' as Tab, label: 'Операции', icon: <Settings2 size={15} /> },
  ];

  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 pt-3 sm:px-5">
        <div className="flex items-center gap-2">
          {data && !isTable ? <Eye size={18} className="text-info" /> : <Table2 size={18} className="text-accent" />}
          <span className="text-[17px] font-semibold">{name}</span>
          {data && <span className="chip bg-surface2 text-muted">{KIND[data.kind] || data.kind}</span>}
          {schema !== 'public' && <span className="chip bg-info/10 text-info">{schema}</span>}
        </div>
        {data && <div className="text-xs text-muted">{fmtNum(data.stats.est_rows)} строк · {fmtBytes(data.stats.total)} · {data.columns.length} колонок{data.pk.length ? ` · PK: ${data.pk.join(', ')}` : ''}</div>}
        {session.readOnly && isTable && <span className="chip bg-surface2 text-muted">только чтение</span>}
      </div>
      <Tabs tabs={tabs} value={cur} onChange={setTab} />
      <div className="min-h-0 flex-1 overflow-auto">
        {cur === 'data' && <TableData schema={schema} name={name} onInsert={() => setTab('insert')} />}
        {cur === 'structure' && <TableStructure schema={schema} name={name} onChanged={() => { void reload(); void refreshTree(); }} />}
        {cur === 'insert' && (!data ? <Loading /> : <InsertTab schema={schema} name={name} columns={data.columns} done={() => setTab('data')} />)}
        {cur === 'ops' && (!data ? <Loading /> : <OpsTab schema={schema} name={name} kind={data.kind} comment={data.stats.comment} reload={reload} />)}
      </div>
    </div>
  );
}

function InsertTab({ schema, name, columns, done }: { schema: string; name: string; columns: import('./RowForm').ColInfo[]; done: () => void }) {
  const { session } = useApp();
  const { toast } = useUi();
  const [busy, setBusy] = useState(false);
  const [seed, setSeed] = useState(0);
  if (session.readOnly) return <div className="m-5 rounded-xl border border-warn/40 bg-warn/10 p-4 text-sm text-warn">Включён режим «Только чтение». Нажмите замок в шапке, чтобы разрешить запись.</div>;
  return (
    <div className="mx-auto max-w-[760px] p-3 sm:p-5">
      <RowForm key={seed} columns={columns} mode="insert" busy={busy} onSubmit={async (values) => {
        setBusy(true);
        try { await post(`${tpath(schema, name)}/rows`, { values }); toast('ok', 'Строка добавлена'); setSeed(seed + 1); done(); }
        catch (e) { toast('err', (e as Error).message); } finally { setBusy(false); }
      }} />
    </div>
  );
}

function OpsTab({ schema, name, kind, comment, reload }: { schema: string; name: string; kind: string; comment: string | null; reload: () => void }) {
  const { session, refreshTree } = useApp();
  const { toast, confirm } = useUi();
  const [prompt, setPrompt] = useState<null | 'rename' | 'comment'>(null);
  const canWrite = !session.readOnly;
  const isTable = ['r', 'p'].includes(kind);

  const alter = async (body: Record<string, unknown>, ok: string, after?: () => void) => {
    try { await post(`${tpath(schema, name)}/alter`, body); toast('ok', ok); setPrompt(null); await refreshTree(); reload(); after?.(); }
    catch (e) { toast('err', (e as Error).message); }
  };

  const card = 'card p-4';
  return (
    <div className="mx-auto grid max-w-[1100px] gap-4 p-3 sm:p-5 md:grid-cols-2">
      <section className={card}>
        <h3 className="mb-1 flex items-center gap-2 font-semibold"><Download size={16} className="text-accent" />Экспорт всей таблицы</h3>
        <p className="mb-3 text-xs text-muted">Файл формируется потоком — подходит и для больших таблиц.</p>
        <div className="flex flex-wrap gap-2">
          {[['csv', 'CSV (Excel)'], ['json', 'JSON'], ['sql', 'SQL INSERT']].map(([f, l]) => <a key={f} className="btn btn-soft" href={downloadUrl(`${tpath(schema, name)}/export`, { format: f })} download>{l}</a>)}
        </div>
      </section>

      <section className={card}>
        <h3 className="mb-1 flex items-center gap-2 font-semibold"><Pencil size={16} className="text-accent" />Переименование и комментарий</h3>
        <p className="mb-3 text-xs text-muted">{comment ? `Комментарий: ${comment}` : 'Комментарий не задан.'}</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-soft" disabled={!canWrite} onClick={() => setPrompt('rename')}>Переименовать</button>
          <button className="btn btn-soft" disabled={!canWrite || !isTable} onClick={() => setPrompt('comment')}>Комментарий</button>
        </div>
      </section>

      {isTable && (
        <section className={card}>
          <h3 className="mb-1 flex items-center gap-2 font-semibold"><Sparkles size={16} className="text-accent" />Обслуживание</h3>
          <p className="mb-3 text-xs text-muted">VACUUM ANALYZE освобождает место от удалённых строк и обновляет статистику планировщика.</p>
          <button className="btn btn-soft" disabled={!canWrite} onClick={() => void alter({ action: 'vacuum' }, 'VACUUM ANALYZE выполнен')}><DatabaseZap size={15} /> VACUUM ANALYZE</button>
        </section>
      )}

      {isTable && (
        <section className="card border-danger/30 p-4 md:col-span-2">
          <h3 className="mb-1 flex items-center gap-2 font-semibold text-danger"><Trash2 size={16} />Опасная зона</h3>
          <p className="mb-3 text-xs text-muted">Операции необратимы. Перед ними сделайте резервную копию на вкладке «Экспорт / импорт».</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-danger" disabled={!canWrite} onClick={async () => {
              if (await confirm({ title: `Очистить таблицу «${name}»?`, text: 'Все строки будут удалены. Счётчики identity сбросятся.', danger: true, confirmLabel: 'Очистить', typeToConfirm: name }))
                void alter({ action: 'truncate', restart: true }, 'Таблица очищена');
            }}><Eraser size={15} /> Очистить (TRUNCATE)</button>
            <button className="btn btn-danger" disabled={!canWrite} onClick={async () => {
              if (await confirm({ title: `Удалить таблицу «${name}»?`, text: 'Таблица и все её данные будут удалены.', danger: true, confirmLabel: 'Удалить таблицу', typeToConfirm: name }))
                void alter({ action: 'dropTable' }, 'Таблица удалена', () => go(''));
            }}><Trash2 size={15} /> Удалить таблицу</button>
          </div>
          {!canWrite && <p className="mt-3 text-xs text-warn">Включите режим записи, чтобы выполнять эти операции.</p>}
        </section>
      )}

      {prompt === 'rename' && <TextPrompt title="Переименовать" label="Новое имя" initial={name} onClose={() => setPrompt(null)} onSubmit={(v) => void alter({ action: 'renameTable', to: v }, 'Переименовано', () => { window.location.hash = tableLink(schema, v, 'ops'); })} />}
      {prompt === 'comment' && <TextPrompt title="Комментарий к таблице" label="Текст (пусто — убрать)" initial={comment || ''} allowEmpty onClose={() => setPrompt(null)} onSubmit={(v) => void alter({ action: 'setComment', comment: v }, 'Сохранено')} />}
    </div>
  );
}
