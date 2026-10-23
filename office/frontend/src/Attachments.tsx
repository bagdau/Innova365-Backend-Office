import { useRef, useState } from 'react';
import { FileText, Image as ImageIcon, Paperclip, Trash2, Upload } from 'lucide-react';
import { del, get, upload } from './api';
import { fmtDateTime } from './format';
import { useFetch, useUi } from './ui';

interface F { id: string; name: string; mime: string; size: number; uploaded_by_name: string | null; created_at: string }

const fmtSize = (b: number) => (b < 1024 ? `${b} Б` : b < 1048576 ? `${(b / 1024).toFixed(0)} КБ` : `${(b / 1048576).toFixed(1)} МБ`);

/** Вложения объекта: сканы накладных, договоры, акты. Просмотр, загрузка (если есть право) и удаление. */
export function Attachments({ entity, entityId, canEdit, title = 'Вложения' }: { entity: string; entityId: string; canEdit: boolean; title?: string }) {
  const { toast, confirm } = useUi();
  const { data, reload } = useFetch(() => get<F[]>(`/files?entity=${entity}&entityId=${encodeURIComponent(entityId)}`), [entity, entityId], { live: false });
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) await upload(entity, entityId, f);
      toast('ok', files.length > 1 ? 'Файлы загружены' : 'Файл загружен');
      await reload();
    } catch (e) { toast('err', (e as Error).message); } finally { setBusy(false); if (input.current) input.current.value = ''; }
  };

  return (
    <section className="rounded-lg border border-line p-3">
      <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold"><Paperclip size={14} className="text-muted" />{title}
        {canEdit && (<>
          <button type="button" className="btn btn-soft btn-sm ml-auto" disabled={busy} onClick={() => input.current?.click()}><Upload size={13} /> {busy ? 'Загрузка…' : 'Прикрепить'}</button>
          <input ref={input} type="file" multiple hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.docx,.doc,.csv,.txt" onChange={(e) => void pick(e.target.files)} />
        </>)}
      </div>
      {!data?.length ? <p className="text-xs text-muted">Файлов нет{canEdit ? ' — сканы накладных, договоры, акты можно прикрепить сюда (PDF, фото, Excel, Word до 10 МБ)' : ''}</p> : (
        <ul className="divide-y divide-line/70">
          {data.map((f) => (
            <li key={f.id} className="flex items-center gap-2 py-1.5 text-[13px]">
              {f.mime.startsWith('image/') ? <ImageIcon size={15} className="shrink-0 text-muted" /> : <FileText size={15} className="shrink-0 text-muted" />}
              <a className="min-w-0 flex-1 truncate text-brand hover:underline" href={`/api/files/${f.id}`} target="_blank" rel="noreferrer">{f.name}</a>
              <span className="hidden text-xs text-muted sm:inline">{fmtSize(f.size)} · {f.uploaded_by_name ?? '—'} · {fmtDateTime(f.created_at)}</span>
              {canEdit && <button type="button" className="btn btn-ghost btn-sm !px-1.5 hover:!text-bad" title="Удалить" onClick={async () => {
                if (!(await confirm({ title: 'Удалить файл?', text: f.name, danger: true, confirmLabel: 'Удалить' }))) return;
                try { await del('/files/' + f.id); await reload(); } catch (e) { toast('err', (e as Error).message); }
              }}><Trash2 size={14} /></button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
