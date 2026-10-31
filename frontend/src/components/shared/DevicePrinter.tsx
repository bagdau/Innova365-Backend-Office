import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { impresionService, isStationPrinter } from '../../services/impresion.service';
import { getDevicePrinter, setDevicePrinter } from '../../lib/printClient';
import { Select } from '../ui/Select';
import { t } from '../../i18n';
import { cn } from '../../utils/cn';

/** Выбор принтера, на который печатает именно это устройство (запоминается в браузере). */
export function DevicePrinter({ className }: { className?: string }) {
  const { data: list = [] } = useQuery({ queryKey: ['impresoras', 'disponibles'], queryFn: impresionService.disponibles, staleTime: 60_000 });
  const receiptList = list.filter((p) => !isStationPrinter(p));
  const [value, setValue] = useState<string>(() => getDevicePrinter() ?? '');

  useEffect(() => {
    const sync = () => setValue(getDevicePrinter() ?? '');
    window.addEventListener('innova:printer', sync);
    return () => window.removeEventListener('innova:printer', sync);
  }, []);

  // сохранённый принтер удалили — сбрасываем выбор
  useEffect(() => {
    if (value && list.length && !receiptList.some((p) => p.id === value)) { setDevicePrinter(null); setValue(''); }
  }, [list, value]); // eslint-disable-line react-hooks/exhaustive-deps

  if (receiptList.length === 0) return null;
  return (
    <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)} title={t('Принтер чека этой кассы. Станции (кухня, бар, самса) выбираются в меню у категорий и в окне печати.')}>
      <Printer size={14} className="flex-shrink-0" />
      <Select
        size="sm"
        className="w-44"
        ariaLabel={t('Impresora de este dispositivo')}
        value={value}
        onChange={(v) => { setValue(v); setDevicePrinter(v || null); }}
        options={[{ value: '', label: t('Авто (принтер этого компьютера)') }, ...receiptList.map((p) => ({ value: p.id, label: p.nombre }))]}
      />
    </div>
  );
}
