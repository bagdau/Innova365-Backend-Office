import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Key, Loader2 } from 'lucide-react';
import type { Cell } from '../grid';

export interface ColInfo {
  name: string; type: string; typeName: string; notnull: boolean; default: string | null;
  identity: string; generated: string; isPk: boolean; num: number; comment: string | null;
}
export type FieldMode = 'value' | 'null' | 'default';
export type CellValue = { v?: string | null; null?: boolean; def?: boolean };

const hasDefault = (c: ColInfo) => !!c.default || !!c.identity;
const isBool = (c: ColInfo) => c.typeName === 'bool';
const isBig = (c: ColInfo) => ['text', 'json', 'jsonb', 'xml', 'bytea'].includes(c.typeName) || c.typeName === 'varchar' && /\(\s*\d{3,}\s*\)/.test(c.type);

/** Форма строки: используется и для вставки, и для редактирования. */
export function RowForm({ columns, initial, mode, busy, onSubmit, onCancel }: {
  columns: ColInfo[]; initial?: Record<string, Cell>; mode: 'insert' | 'edit'; busy?: boolean;
  onSubmit: (values: Record<string, CellValue>) => void; onCancel?: () => void;
}) {
  const editable = useMemo(() => columns.filter((c) => !c.generated), [columns]);
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(editable.map((c) => [c.name, initial?.[c.name] ?? ''])));
  const [modes, setModes] = useState<Record<string, FieldMode>>(() => Object.fromEntries(editable.map((c) => {
    if (mode === 'edit') return [c.name, initial?.[c.name] === null || initial?.[c.name] === undefined ? 'null' : 'value'];
    return [c.name, hasDefault(c) ? 'default' : c.notnull ? 'value' : 'null'];
  })));

  const setVal = (n: string, v: string) => { setVals((s) => ({ ...s, [n]: v })); setModes((m) => ({ ...m, [n]: 'value' })); };

  const submit = () => {
    const out: Record<string, CellValue> = {};
    for (const c of editable) {
      const m = modes[c.name];
      if (mode === 'edit') {
        const before = initial?.[c.name] ?? null;
        if (m === 'null') { if (before !== null) out[c.name] = { null: true }; }
        else if (m === 'default') out[c.name] = { def: true };
        else if (vals[c.name] !== before) out[c.name] = { v: vals[c.name] };
      } else if (m === 'default') { /* пропускаем — вставит DEFAULT */ }
      else if (m === 'null') out[c.name] = { null: true };
      else out[c.name] = { v: vals[c.name] };
    }
    onSubmit(out);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-3">
      {editable.map((c) => {
        const m = modes[c.name];
        const off = m !== 'value';
        return (
          <div key={c.name} className="rounded-xl border border-line bg-surface2/30 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              {c.isPk && <Key size={13} className="text-warn" />}
              <span className="font-mono text-[13px] font-semibold">{c.name}</span>
              <span className="font-mono text-[11px] text-muted">{c.type}</span>
              {c.notnull && <span className="chip bg-danger/10 text-danger">NOT NULL</span>}
              {hasDefault(c) && <span className="chip bg-info/10 text-info" title={c.default || 'identity'}>{c.identity ? 'identity' : 'default'}</span>}
              <div className="ml-auto flex overflow-hidden rounded-lg border border-line text-[11px] font-semibold">
                {(['value', 'null', 'default'] as FieldMode[]).filter((x) => (x !== 'null' || !c.notnull || mode === 'edit') && (x !== 'default' || hasDefault(c))).map((x) => (
                  <button type="button" key={x} onClick={() => setModes((s) => ({ ...s, [c.name]: x }))}
                    className={clsx('px-2.5 py-1 transition', m === x ? 'bg-accent text-accentfg' : 'bg-surface text-muted hover:text-ink')}>
                    {x === 'value' ? 'Значение' : x === 'null' ? 'NULL' : 'DEFAULT'}
                  </button>
                ))}
              </div>
            </div>
            {isBool(c) ? (
              <select className="input" disabled={off} value={vals[c.name] === 't' || vals[c.name] === 'true' ? 'true' : vals[c.name] === 'f' || vals[c.name] === 'false' ? 'false' : ''} onChange={(e) => setVal(c.name, e.target.value)}>
                <option value="">— выберите —</option><option value="true">true</option><option value="false">false</option>
              </select>
            ) : isBig(c) ? (
              <textarea className="input font-mono text-[12.5px]" rows={4} disabled={off} value={vals[c.name]} onChange={(e) => setVal(c.name, e.target.value)} placeholder={m === 'default' ? c.default || 'значение по умолчанию' : m === 'null' ? 'NULL' : ''} />
            ) : (
              <input className="input font-mono text-[12.5px]" disabled={off} value={vals[c.name]} onChange={(e) => setVal(c.name, e.target.value)} placeholder={m === 'default' ? c.default || 'значение по умолчанию' : m === 'null' ? 'NULL' : ''} />
            )}
            {c.comment && <div className="mt-1 text-[11px] text-muted">{c.comment}</div>}
          </div>
        );
      })}
      <div className="sticky bottom-0 -mx-5 -mb-4 flex justify-end gap-2 border-t border-line bg-surface px-5 py-3">
        {onCancel && <button type="button" className="btn btn-soft" onClick={onCancel}>Отмена</button>}
        <button className="btn btn-primary" disabled={busy}>{busy && <Loader2 size={15} className="spin" />}{mode === 'insert' ? 'Вставить строку' : 'Сохранить'}</button>
      </div>
    </form>
  );
}
