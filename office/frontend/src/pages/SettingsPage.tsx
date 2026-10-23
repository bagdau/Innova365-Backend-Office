import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { get, put } from '../api';
import { useAuth } from '../auth';
import { ErrorBox, Field, Loading, PageHeader, Toggle, useFetch, useUi } from '../ui';

interface S { company: string; bin: string; address: string; signer: string; vat: number; vatEnabled: boolean; timezone: string; currency: string }

const ZONES = ['Asia/Almaty', 'Asia/Aqtobe', 'Asia/Aqtau', 'Asia/Tashkent', 'Asia/Bishkek', 'Europe/Moscow', 'Europe/Minsk', 'Europe/Kyiv', 'Asia/Tbilisi', 'Asia/Yerevan', 'Asia/Baku', 'UTC'];

export default function SettingsPage() {
  const { reload: reloadMe } = useAuth();
  const { toast } = useUi();
  const { data, error, reload } = useFetch(() => get<S>('/settings'), [], { live: false });
  const [f, setF] = useState<S | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setF(data); }, [data]);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!f) return <Loading />;
  const save = async () => {
    setBusy(true);
    try { await put('/settings', { company: f.company, bin: f.bin, address: f.address, signer: f.signer, vat: Number(f.vat), vatEnabled: f.vatEnabled, timezone: f.timezone }); toast('ok', 'Настройки сохранены'); await reloadMe(); await reload(); }
    catch (e) { toast('err', (e as Error).message); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title="Настройки офиса" subtitle="Реквизиты для печатных документов, НДС и часовой пояс отчётов" actions={<button className="btn btn-primary" disabled={busy} onClick={() => void save()}><Save size={15} /> Сохранить</button>} />
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card space-y-3 p-5"><h2 className="font-semibold">Реквизиты организации</h2>
          <Field label="Название организации"><input className="input" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} placeholder="ТОО «…»" /></Field>
          <Field label="БИН"><input className="input" inputMode="numeric" value={f.bin} onChange={(e) => setF({ ...f, bin: e.target.value })} /></Field>
          <Field label="Адрес"><input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
          <Field label="Подписант (ФИО на актах)"><input className="input" value={f.signer} onChange={(e) => setF({ ...f, signer: e.target.value })} /></Field>
        </section>
        <section className="card space-y-4 p-5"><h2 className="font-semibold">Учёт</h2>
          <Toggle checked={f.vatEnabled} onChange={(v) => setF({ ...f, vatEnabled: v })} label="Выручка включает НДС" />
          <Field label="Ставка НДС, %" hint="Для Казахстана — 12%. НДС выделяется из выручки в отчётах и ОПУ"><input className="input tnum !w-32" inputMode="decimal" disabled={!f.vatEnabled} value={f.vat} onChange={(e) => setF({ ...f, vat: e.target.value as unknown as number })} /></Field>
          <Field label="Часовой пояс отчётов" hint="По нему определяются границы «дня» в выручке и Z-отчёте"><select className="input" value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })}>{[...new Set([f.timezone, ...ZONES])].map((z) => <option key={z}>{z}</option>)}</select></Field>
          <Field label="Валюта" hint="Задаётся в кассовой системе (Настройки → Валюта)"><input className="input !w-32" disabled value={f.currency} /></Field>
        </section>
      </div>
    </>
  );
}
