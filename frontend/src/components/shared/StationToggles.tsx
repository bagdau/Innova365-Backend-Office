import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChefHat } from 'lucide-react';
import { impresionService } from '../../services/impresion.service';
import { getStationsOff, setStationOff } from '../../lib/printClient';
import { t } from '../../i18n';
import { cn } from '../../utils/cn';

/**
 * Станции (кухня, бар, самса): на какие принтеры вместе с чеком уходят тикеты. Кнопка включена — тикеты печатаются.
 * Выбор запоминается на этой кассе и действует во всех окнах печати.
 */
export function StationToggles({ className }: { className?: string }) {
  const { data: list = [] } = useQuery({ queryKey: ['impresoras', 'disponibles'], queryFn: impresionService.disponibles, staleTime: 60_000 });
  const [off, setOff] = useState<string[]>(getStationsOff);

  useEffect(() => {
    const sync = () => setOff(getStationsOff());
    window.addEventListener('innova:stations', sync);
    return () => window.removeEventListener('innova:stations', sync);
  }, []);

  const stations = list.filter((p) => p.tipo !== 'NAVEGADOR' && p.usos.includes('COCINA'));
  if (stations.length === 0) return null;
  return (
    <div className={cn('flex items-center gap-2 flex-wrap text-xs text-muted-foreground', className)}
      title={t('Тикеты позиций печатаются на выбранных станциях вместе с чеком. Категории привязываются к станциям в Меню.')}>
      <ChefHat size={14} className="flex-shrink-0" />
      <span>{t('Станции')}:</span>
      {stations.map((p) => {
        const on = !off.includes(p.id);
        return (
          <button key={p.id} type="button" data-sound="none" aria-pressed={on}
            onClick={() => setStationOff(p.id, on)}
            className={cn('px-2.5 py-1 rounded-m border text-xs font-medium transition-colors',
              on ? 'bg-primary text-white border-primary' : 'bg-muted text-muted-foreground border-border line-through')}>
            {p.nombre}
          </button>
        );
      })}
    </div>
  );
}
