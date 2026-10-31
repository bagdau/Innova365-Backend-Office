import { useMemo } from 'react';
import { Select } from '../ui/Select';
import { t } from '../../i18n';
import { cn } from '../../utils/cn';

/**
 * Категории меню одним компактным списком вместо ряда кнопок (на узком моноблоке ряд занимал пол-экрана).
 * Сортировка по алфавиту без учёта регистра, справа — число блюд; пустые категории приглушены; есть поиск.
 */
export function CategorySelect({ categorias, productos, value, onChange, className, allLabel }: {
  categorias: { id: string; nombre: string }[];
  productos: { categoriaId: string }[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  allLabel?: string;
}) {
  const options = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of productos) counts.set(p.categoriaId, (counts.get(p.categoriaId) ?? 0) + 1);
    const row = (id: string, name: string, n: number, all = false) => ({
      value: id, text: name,
      label: (
        <span className="flex items-center justify-between gap-3 w-full">
          <span className={cn('truncate', n === 0 && !all && 'text-muted-foreground')}>{name}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{n}</span>
        </span>
      ),
    });
    return [
      row('todas', allLabel ?? t('Todas'), productos.length, true),
      ...[...categorias].sort((x, y) => x.nombre.localeCompare(y.nombre, 'ru', { sensitivity: 'base' })).map((c) => row(c.id, c.nombre, counts.get(c.id) ?? 0)),
    ];
  }, [categorias, productos, allLabel]);

  return <Select className={className} ariaLabel={t('Categoría')} searchable value={value} onChange={onChange} options={options} />;
}
