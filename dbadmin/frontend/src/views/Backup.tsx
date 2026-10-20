import { useRef, useState } from 'react';
import { AlertTriangle, DatabaseBackup, Download, FileUp, Loader2, ShieldAlert, Upload } from 'lucide-react';
import { downloadUrl, upload } from '../api';
import { useApp } from '../ctx';
import { fmtBytes, Toggle, useUi } from '../ui';

export default function Backup() {
  const { db, session, refreshTree } = useApp();
  const { toast, confirm } = useUi();
  const [opt, setOpt] = useState({ schemaOnly: false, dataOnly: false, inserts: false, clean: false, owner: false, privileges: false });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ ok: boolean; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const href = downloadUrl('/backup', Object.fromEntries(Object.entries(opt).map(([k, v]) => [k, v ? '1' : ''])));

  const doImport = async () => {
    if (!file) return;
    if (!(await confirm({ title: `Импортировать «${file.name}» в «${db}»?`, text: 'Файл выполнится в одной транзакции: при первой ошибке все изменения откатятся. Если в дампе есть DROP/CREATE, существующие данные могут быть заменены.', danger: true, confirmLabel: 'Импортировать', typeToConfirm: db }))) return;
    setBusy(true); setLog(null);
    try {
      const form = new FormData(); form.append('file', file);
      const r = await upload<{ output: string }>('/import', form);
      setLog({ ok: true, text: r.output.trim() || 'Выполнено без сообщений.' }); toast('ok', 'Импорт завершён'); void refreshTree();
    } catch (e) { setLog({ ok: false, text: (e as Error).message }); toast('err', 'Импорт отменён'); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto grid max-w-[1100px] gap-5 p-3 sm:p-5 lg:grid-cols-2">
      <section className="card p-5">
        <div className="mb-1 flex items-center gap-2.5"><div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent"><DatabaseBackup size={20} /></div><div><h2 className="font-semibold">Резервная копия</h2><p className="text-xs text-muted">pg_dump базы «{db}» → файл .sql</p></div></div>
        <div className="mt-5 space-y-3.5">
          <Toggle checked={opt.schemaOnly} onChange={(v) => setOpt({ ...opt, schemaOnly: v, dataOnly: v ? false : opt.dataOnly })} label="Только структура (без данных)" />
          <Toggle checked={opt.dataOnly} onChange={(v) => setOpt({ ...opt, dataOnly: v, schemaOnly: v ? false : opt.schemaOnly })} label="Только данные (без структуры)" />
          <Toggle checked={opt.inserts} onChange={(v) => setOpt({ ...opt, inserts: v })} label="INSERT с названиями колонок (вместо COPY)" />
          <Toggle checked={opt.clean} onChange={(v) => setOpt({ ...opt, clean: v })} label="Добавить DROP … IF EXISTS перед созданием" />
          <Toggle checked={opt.owner} onChange={(v) => setOpt({ ...opt, owner: v })} label="Сохранить владельцев объектов" />
          <Toggle checked={opt.privileges} onChange={(v) => setOpt({ ...opt, privileges: v })} label="Сохранить права доступа (GRANT)" />
        </div>
        <a href={href} download className="btn btn-primary mt-6 !h-11 w-full text-[15px]"><Download size={18} /> Скачать дамп</a>
        <p className="mt-3 text-xs leading-relaxed text-muted">Дамп содержит данные пользователей системы, включая хэши паролей. Храните его как секретный файл и не публикуйте.</p>
      </section>

      <section className="card p-5">
        <div className="mb-1 flex items-center gap-2.5"><div className="grid h-10 w-10 place-items-center rounded-xl bg-info/15 text-info"><Upload size={20} /></div><div><h2 className="font-semibold">Импорт SQL</h2><p className="text-xs text-muted">Выполнить .sql файл в базе «{db}»</p></div></div>
        <div className="mt-5">
          <button type="button" onClick={() => input.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); }}
            className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line px-4 py-8 text-center transition hover:border-accent/60 hover:bg-accent/5">
            <FileUp size={28} className="text-muted" />
            {file ? <><span className="font-medium">{file.name}</span><span className="text-xs text-muted">{fmtBytes(file.size)}</span></> : <><span className="font-medium">Выберите или перетащите файл</span><span className="text-xs text-muted">.sql, до 512 МБ</span></>}
          </button>
          <input ref={input} type="file" accept=".sql,text/plain,application/sql" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        {session.readOnly && <div className="mt-4 flex items-start gap-2 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2.5 text-xs text-warn"><ShieldAlert size={15} className="mt-0.5 shrink-0" />Для импорта включите режим записи (замок в шапке).</div>}
        <button className="btn btn-primary mt-5 !h-11 w-full text-[15px]" disabled={!file || busy || session.readOnly} onClick={() => void doImport()}>
          {busy ? <Loader2 size={18} className="spin" /> : <Upload size={18} />} Импортировать
        </button>
        <div className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted"><AlertTriangle size={14} className="mt-0.5 shrink-0 text-warn" />Сначала скачайте дамп текущей базы — откатить уже применённый импорт нельзя.</div>
        {log && <pre className={`mt-4 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border p-3 font-mono text-[12px] ${log.ok ? 'border-ok/40 bg-ok/10' : 'border-danger/40 bg-danger/10 text-danger'}`}>{log.text}</pre>}
      </section>
    </div>
  );
}
