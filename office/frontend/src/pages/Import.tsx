import { useMemo, useRef, useState } from 'react';
import { Boxes, Download, FileSpreadsheet, Factory, TrendingUp, UtensilsCrossed, Upload } from 'lucide-react';
import { post } from '../api';
import { useAuth, Perm } from '../auth';
import { Badge, PageHeader, useUi } from '../ui';
import { buildXlsx, downloadBlob, readTable } from '../xlsx';

type Kind = 'ingredients' | 'prices' | 'suppliers' | 'menu-prices';
interface Field { key: string; label: string; required?: boolean; hints: string[]; example: string }
interface Type { id: Kind; label: string; text: string; perm: Perm; icon: React.ElementType; fields: Field[] }
interface Res { row: number; name: string; status: 'create' | 'update' | 'same' | 'error'; changes: string[]; error?: string; warning?: string }
interface Preview { results: Res[]; summary: { create: number; update: number; same: number; error: number } }

const TYPES: Type[] = [
  { id: 'ingredients', label: 'Сырьё', text: 'Новые ингредиенты и изменение существующих (по названию)', perm: 'ing.edit', icon: Boxes, fields: [
    { key: 'nombre', label: 'Название', required: true, hints: ['название', 'наименование', 'сырье', 'сырьё', 'ингредиент', 'товар', 'name'], example: 'Мука пшеничная' },
    { key: 'unidad', label: 'Единица', hints: ['единица', 'ед', 'ед.', 'ед. изм', 'измерение', 'unit', 'unidad'], example: 'кг' },
    { key: 'categoria', label: 'Категория', hints: ['категория', 'группа', 'category'], example: 'Бакалея' },
    { key: 'stockMinimo', label: 'Минимальный остаток', hints: ['минимум', 'мин', 'мин. остаток', 'минимальный остаток', 'min'], example: '10' },
    { key: 'costoUnitario', label: 'Цена за единицу', hints: ['цена', 'стоимость', 'цена за ед', 'price', 'cost'], example: '350' },
    { key: 'proveedor', label: 'Поставщик', hints: ['поставщик', 'supplier'], example: 'ТОО Агро' },
    { key: 'stock', label: 'Начальный остаток (для нового)', hints: ['остаток', 'количество', 'кол-во', 'stock', 'qty'], example: '25' },
  ] },
  { id: 'prices', label: 'Цены сырья', text: 'Обновить закупочные цены существующего сырья (себестоимость блюд пересчитается)', perm: 'ing.cost', icon: TrendingUp, fields: [
    { key: 'nombre', label: 'Название сырья', required: true, hints: ['название', 'наименование', 'сырье', 'сырьё', 'товар', 'name'], example: 'Мука пшеничная' },
    { key: 'costoUnitario', label: 'Новая цена', required: true, hints: ['цена', 'новая цена', 'стоимость', 'price'], example: '365' },
  ] },
  { id: 'suppliers', label: 'Поставщики', text: 'Справочник поставщиков: новые и дополнение существующих', perm: 'sup.edit', icon: Factory, fields: [
    { key: 'nombre', label: 'Название', required: true, hints: ['название', 'наименование', 'поставщик', 'компания', 'name'], example: 'ТОО Агро' },
    { key: 'contacto', label: 'Контактное лицо', hints: ['контакт', 'контактное лицо', 'менеджер', 'contact'], example: 'Ерлан' },
    { key: 'telefono', label: 'Телефон', hints: ['телефон', 'тел', 'phone'], example: '+7 701 000 00 00' },
    { key: 'email', label: 'Email', hints: ['email', 'почта', 'e-mail'], example: 'sales@agro.kz' },
    { key: 'bin', label: 'БИН/ИИН', hints: ['бин', 'иин', 'бин/иин', 'bin'], example: '123456789012' },
    { key: 'category', label: 'Категория', hints: ['категория', 'группа', 'что поставляет'], example: 'Мясо' },
    { key: 'paymentDays', label: 'Отсрочка, дней', hints: ['отсрочка', 'отсрочка платежа', 'дней'], example: '7' },
    { key: 'address', label: 'Адрес', hints: ['адрес', 'address'], example: 'Алматы, ул. Складская 1' },
  ] },
  { id: 'menu-prices', label: 'Цены меню', text: 'Новые цены блюд (изменения попадут в историю цен и сразу появятся на кассе)', perm: 'menu.edit', icon: UtensilsCrossed, fields: [
    { key: 'nombre', label: 'Название блюда', required: true, hints: ['название', 'блюдо', 'наименование', 'name'], example: 'Борщ' },
    { key: 'precio', label: 'Новая цена', required: true, hints: ['цена', 'новая цена', 'стоимость', 'price'], example: '1800' },
  ] },
];
const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9/ ]/g, '').trim();
const STATUS = { create: { label: 'Создать', tone: 'good' as const }, update: { label: 'Изменить', tone: 'info' as const }, same: { label: 'Без изменений', tone: 'muted' as const }, error: { label: 'Ошибка', tone: 'bad' as const } };

/** Импорт из Excel/CSV: выбрать тип → загрузить файл → сопоставить столбцы → проверить → применить. */
export default function Import() {
  const { can } = useAuth();
  const { toast, confirm } = useUi();
  const types = TYPES.filter((t) => can(t.perm));
  const [kind, setKind] = useState<Kind>(types[0]?.id ?? 'ingredients');
  const t = TYPES.find((x) => x.id === kind)!;
  const [table, setTable] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState('');
  const [map, setMap] = useState<Record<string, number>>({});
  const [prev, setPrev] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const reset = () => { setTable(null); setMap({}); setPrev(null); setFileName(''); if (input.current) input.current.value = ''; };
  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      const rows = await readTable(file);
      if (rows.length < 2) throw new Error('В файле должна быть строка заголовков и хотя бы одна строка данных');
      const head = rows[0].map((h) => norm(String(h)));
      const m: Record<string, number> = {};
      for (const f of t.fields) { const i = head.findIndex((h) => f.hints.some((x) => norm(x) === h)); if (i >= 0) m[f.key] = i; }
      setTable(rows); setMap(m); setPrev(null); setFileName(file.name);
    } catch (e) { toast('err', (e as Error).message); reset(); }
  };
  const rows = useMemo(() => (table ? table.slice(1).map((r) => Object.fromEntries(t.fields.filter((f) => map[f.key] !== undefined).map((f) => [f.key, r[map[f.key]] ?? '']))) : []), [table, map, t]);
  const missing = t.fields.filter((f) => f.required && map[f.key] === undefined);
  const template = () => downloadBlob(buildXlsx(t.label, t.fields.map((f) => f.label), [t.fields.map((f) => f.example)]), `shablon_${t.id}.xlsx`);
  const call = async (what: 'preview' | 'commit') => { setBusy(true); try { return await post<Preview>(`/import/${kind}/${what}`, { rows }); } catch (e) { toast('err', (e as Error).message); return null; } finally { setBusy(false); } };
  const check = async () => { const r = await call('preview'); if (r) setPrev(r); };
  const apply = async () => {
    if (!prev) return;
    if (!(await confirm({ title: 'Применить импорт?', text: `Будет создано ${prev.summary.create}, изменено ${prev.summary.update}. Строки с ошибками (${prev.summary.error}) будут пропущены. Это действие нельзя отменить одной кнопкой.`, confirmLabel: 'Применить' }))) return;
    const r = await call('commit');
    if (r) { toast('ok', `Готово: создано ${r.summary.create}, изменено ${r.summary.update}`); reset(); }
  };

  if (!types.length) return <><PageHeader title="Импорт из Excel" /><p className="text-sm text-muted">У вашей роли нет прав на импорт данных.</p></>;
  return (
    <>
      <PageHeader title="Импорт из Excel" subtitle="Загрузите таблицу (.xlsx или .csv) — система покажет, что изменится, и применит только после вашего подтверждения" />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {types.map((x) => <button key={x.id} onClick={() => { setKind(x.id); reset(); }} className={`card p-4 text-left transition hover:border-brand/50 ${kind === x.id ? 'border-brand ring-2 ring-brand/15' : ''}`}><div className="mb-1 flex items-center gap-2 font-semibold"><x.icon size={16} className="text-brand" />{x.label}</div><p className="text-[12.5px] leading-relaxed text-muted">{x.text}</p></button>)}
      </div>
      <section className="card mb-5 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-soft" onClick={template}><Download size={15} /> Скачать шаблон</button>
          <button className="btn btn-primary" onClick={() => input.current?.click()}><Upload size={15} /> Выбрать файл</button>
          <input ref={input} type="file" hidden accept=".xlsx,.csv,.txt" onChange={(e) => void pick(e.target.files?.[0])} />
          {fileName && <span className="flex items-center gap-1.5 text-sm text-muted"><FileSpreadsheet size={15} />{fileName} · {Math.max(0, (table?.length ?? 1) - 1)} строк</span>}
        </div>
        <p className="mt-2 text-xs text-muted">Первая строка — заголовки столбцов. Названия сопоставляются автоматически, при необходимости выберите столбцы вручную. Максимум 2000 строк.</p>
      </section>
      {table && (
        <section className="card mb-5 p-4">
          <h2 className="mb-3 font-semibold">Какой столбец что означает</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {t.fields.map((f) => (
              <div key={f.key}><label className="label">{f.label}{f.required && <span className="text-bad"> *</span>}</label>
                <select className="input" value={map[f.key] ?? ''} onChange={(e) => { const v = e.target.value; setMap((m) => { const n = { ...m }; if (v === '') delete n[f.key]; else n[f.key] = Number(v); return n; }); setPrev(null); }}>
                  <option value="">— не загружать —</option>{table[0].map((h, i) => <option key={i} value={i}>{String(h) || `Столбец ${i + 1}`}</option>)}</select></div>
            ))}
          </div>
          {missing.length > 0 && <p className="mt-3 text-sm text-warn">Укажите столбец: {missing.map((f) => f.label).join(', ')}</p>}
          <div className="mt-4 overflow-x-auto rounded-lg border border-line"><table className="w-full text-[12.5px]"><thead><tr>{t.fields.filter((f) => map[f.key] !== undefined).map((f) => <th key={f.key} className="th">{f.label}</th>)}</tr></thead>
            <tbody>{rows.slice(0, 5).map((r, i) => <tr key={i}>{t.fields.filter((f) => map[f.key] !== undefined).map((f) => <td key={f.key} className="td">{String(r[f.key] ?? '')}</td>)}</tr>)}</tbody></table></div>
          <p className="mt-1 text-xs text-muted">Первые строки файла — для проверки сопоставления.</p>
          <div className="mt-4 flex gap-2"><button className="btn btn-primary" disabled={busy || missing.length > 0} onClick={() => void check()}>Проверить файл</button><button className="btn btn-ghost" onClick={reset}>Сбросить</button></div>
        </section>
      )}
      {prev && (
        <section className="card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2"><h2 className="font-semibold">Результат проверки</h2>
            {(['create', 'update', 'same', 'error'] as const).map((s) => <Badge key={s} tone={STATUS[s].tone}>{STATUS[s].label}: {prev.summary[s]}</Badge>)}
            <button className="btn btn-primary ml-auto" disabled={busy || prev.summary.create + prev.summary.update === 0} onClick={() => void apply()}>Применить ({prev.summary.create + prev.summary.update})</button></div>
          <div className="max-h-[50vh] overflow-auto rounded-lg border border-line"><table className="w-full text-[13px]"><thead className="sticky top-0"><tr><th className="th">Строка</th><th className="th">Название</th><th className="th">Что произойдёт</th></tr></thead>
            <tbody>{prev.results.filter((r) => r.status !== 'same').map((r) => (
              <tr key={r.row}><td className="td tnum text-muted">{r.row}</td><td className="td font-medium">{r.name || '—'}</td>
                <td className="td"><Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge> <span className={r.status === 'error' ? 'text-bad' : 'text-muted'}>{r.error ?? r.changes.join('; ')}</span>{r.warning && <div className="text-xs text-warn">{r.warning}</div>}</td></tr>))}
              {prev.results.every((r) => r.status === 'same') && <tr><td className="td py-8 text-center text-muted" colSpan={3}>Ничего менять не нужно — данные в файле совпадают с системой</td></tr>}</tbody></table></div>
        </section>
      )}
    </>
  );
}
