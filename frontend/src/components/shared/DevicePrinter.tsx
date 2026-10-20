import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { impresionService } from '../../services/impresion.service';
import { getDevicePrinter, setDevicePrinter } from '../../lib/printClient';
import { Select } from '../ui/Select';
import { t } from '../../i18n';
import { cn } from '../../utils/cn';

/** Выбор принтера, на который печатает именно это устройство (запоминается в браузере). */
export function DevicePrinter({ className }: { className?: string }) {
  const { data: list = [] } = useQuery({ queryKey: ['impresoras', 'disponibles'], queryFn: impresionService.disponibles, staleTime: 60_000 });
  const [value, setValue] = useState<string>(() => getDevicePrinter() ?? '');

  useEffect(() => {
    const sync = () => setValue(getDevicePrinter() ?? '');
    window.addEventListener('innova:printer', sync);
    return () => window.removeEventListener('innova:printer', sync);
  }, []);

  // сохранённый принтер удалили — сбрасываем выбор
  useEffect(() => {
    if (value && list.length && !list.some((p) => p.id === value)) { setDevicePrinter(null); setValue(''); }
  }, [list, value]);

  if (list.length === 0) return null;
  return (
    <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)} title={t('Impresora de este dispositivo')}>
      <Printer size={14} className="flex-shrink-0" />
      <Select
        size="sm"
        className="w-44"
        ariaLabel={t('Impresora de este dispositivo')}
        value={value}
        onChange={(v) => { setValue(v); setDevicePrinter(v || null); }}
        options={[{ value: '', label: t('Auto (según ajustes)') }, ...list.map((p) => ({ value: p.id, label: p.nombre }))]}
      />
    </div>
  );
}
