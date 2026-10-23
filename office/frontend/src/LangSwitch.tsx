import { useEffect, useState } from 'react';
import { getLang, Lang, onLangChange, setLang } from './i18n';

/** Переключатель РУС / ҚАЗ. Выбор запоминается в браузере. */
export function LangSwitch({ className = '' }: { className?: string }) {
  const [lang, set] = useState<Lang>(getLang());
  useEffect(() => onLangChange(() => set(getLang())), []);
  return (
    <div className={`no-print inline-flex rounded-lg border border-line bg-surface p-0.5 text-[12px] font-semibold ${className}`} data-no-i18n>
      {(['ru', 'kk'] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)} className={`rounded-md px-2 py-1 transition ${lang === l ? 'bg-brand text-brandfg' : 'text-muted hover:text-ink'}`} aria-pressed={lang === l} title={l === 'ru' ? 'Русский' : 'Қазақша'}>{l === 'ru' ? 'РУС' : 'ҚАЗ'}</button>
      ))}
    </div>
  );
}
