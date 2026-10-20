import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { recetasService, type Consumo } from '../../services/recetas.service';
import { TableWrapper, Tr, Td } from '../../components/shared/TableWrapper';
import { MetricCard } from '../../components/shared/MetricCard';
import { fmtQty } from '../../lib/print';
import { formatCurrency, cn } from '../../utils/cn';
import { t } from '../../i18n';
import { TrendingDown, Wallet, Percent } from 'lucide-react';

const PERIODOS = [
  { key: 'hoy', label: () => t('Hoy') },
  { key: 'semana', label: () => t('Esta semana') },
  { key: 'mes', label: () => t('Este mes') },
];

/** Куда уходят продукты: расход ингредиентов по продажам (по тех-картам) и продажи блюд с себестоимостью. */
export default function ConsumoTab() {
  const [periodo, setPeriodo] = useState('semana');
  const { data, isLoading } = useQuery<Consumo>({ queryKey: ['consumo', periodo], queryFn: () => recetasService.consumo(periodo) });

  const costoTotal = (data?.ingredientes ?? []).reduce((s, i) => s + (i.costo ?? 0), 0);
  const ingresos = (data?.platos ?? []).reduce((s, p) => s + p.ingresos, 0);
  const foodCost = ingresos > 0 ? (costoTotal / ingresos) * 100 : 0;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">{t('Los productos se descuentan solos al vender un plato, según su ficha técnica. Si se cancela el pedido, vuelven al almacén.')}</p>

      <div className="flex gap-2">
        {PERIODOS.map((p) => (
          <button key={p.key} onClick={() => setPeriodo(p.key)}
            className={cn('px-4 py-1.5 rounded-m text-sm font-medium transition-colors', periodo === p.key ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground')}>
            {p.label()}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard title={t('Costo de productos gastados')} value={formatCurrency(costoTotal)} icon={<TrendingDown size={16} className="text-warning" />} iconBg="bg-warning-bg" />
        <MetricCard title={t('Ingresos por platos')} value={formatCurrency(ingresos)} icon={<Wallet size={16} className="text-success" />} iconBg="bg-success-bg" />
        <MetricCard title={t('Costo de materia prima, %')} value={`${foodCost.toFixed(1)}%`} icon={<Percent size={16} className="text-info" />} iconBg="bg-info-bg" />
      </div>

      <div className="bg-card border border-border rounded-l">
        <div className="px-5 py-4 border-b border-border"><h3 className="text-sm font-semibold text-foreground">{t('Productos gastados')}</h3></div>
        <TableWrapper headers={[t('Insumo'), t('Gastado'), t('Costo'), t('Stock actual'), t('Alcanza para')]} isEmpty={!data || data.ingredientes.length === 0} emptyMessage={isLoading ? t('Cargando...') : t('Aún no hay gasto: aparecerá cuando se vendan platos con ficha técnica')}>
          {data?.ingredientes.map((i) => (
            <Tr key={i.insumoId}>
              <Td className="font-medium">{i.nombre}</Td>
              <Td>{fmtQty(Math.round(i.consumo * 1000) / 1000)} {i.unidad}</Td>
              <Td>{i.costo === null ? '—' : formatCurrency(i.costo)}</Td>
              <Td className={cn(i.stock <= 0 && 'text-error font-bold')}>{fmtQty(Math.round(i.stock * 1000) / 1000)} {i.unidad}</Td>
              <Td className={cn(i.diasRestantes !== null && i.diasRestantes <= 2 && 'text-error font-bold', i.diasRestantes !== null && i.diasRestantes > 2 && i.diasRestantes <= 5 && 'text-warning')}>
                {i.diasRestantes === null ? '—' : t('{n} d.', { n: i.diasRestantes })}
              </Td>
            </Tr>
          ))}
        </TableWrapper>
      </div>

      <div className="bg-card border border-border rounded-l">
        <div className="px-5 py-4 border-b border-border"><h3 className="text-sm font-semibold text-foreground">{t('Platos vendidos')}</h3></div>
        <TableWrapper headers={[t('Producto'), t('Cantidad vendida'), t('Ingresos'), t('Costo'), t('Margen')]} isEmpty={!data || data.platos.length === 0} emptyMessage={isLoading ? t('Cargando...') : t('Sin datos')}>
          {data?.platos.map((p) => {
            const margen = p.costo !== null && p.ingresos > 0 ? (1 - p.costo / p.ingresos) * 100 : null;
            return (
              <Tr key={p.productoId}>
                <Td className="font-medium">{p.nombre}</Td>
                <Td>{p.vendidos}</Td>
                <Td>{formatCurrency(p.ingresos)}</Td>
                <Td>{p.sinReceta ? <span className="text-warning text-xs">{t('Sin ficha técnica')}</span> : formatCurrency(p.costo ?? 0)}</Td>
                <Td className={cn(margen !== null && margen < 50 && 'text-warning')}>{margen === null ? '—' : `${margen.toFixed(0)}%`}</Td>
              </Tr>
            );
          })}
        </TableWrapper>
      </div>
    </div>
  );
}
