import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SalesLineChart } from '../../components/charts/SalesLineChart';
import { Pie3D } from '../../components/charts/Pie3D';
import { Download, TrendingUp } from 'lucide-react';
import { MetricCard } from '../../components/shared/MetricCard';
import { TableWrapper, Tr, Td } from '../../components/shared/TableWrapper';
import { reportesService } from '../../services/reportes.service';
import { formatCurrency } from '../../utils/cn';
import type { VentasReport, TopProducto } from '../../types';
import { cn } from '../../utils/cn';
import { t } from '../../i18n';
import { currencySymbol } from '../../lib/currency';
import { printVentasReport } from '../../lib/documents';
import { Printer } from 'lucide-react';

const PERIODOS = [
  { key: 'hoy', label: t('Hoy') },
  { key: 'semana', label: t('Esta semana') },
  { key: 'mes', label: t('Este mes') },
];

const TABS = ['Ventas', 'Pedidos', 'Productividad'];

export default function ReportesPage() {
  const [tab, setTab] = useState('Ventas');
  const [periodo, setPeriodo] = useState('semana');

  const { data: ventas } = useQuery<VentasReport>({
    queryKey: ['ventas', periodo],
    queryFn: () => reportesService.getVentas(periodo),
  });

  const { data: topProductos = [] } = useQuery<TopProducto[]>({
    queryKey: ['topProductos'],
    queryFn: reportesService.getTopProductos,
  });

  const { data: productividad = [] } = useQuery<any[]>({
    queryKey: ['productividad'],
    queryFn: reportesService.getProductividad,
  });

  const { data: restInfo } = useQuery({ queryKey: ['restaurante'], queryFn: reportesService.getRestaurante, staleTime: 300_000 });
  const pieItems = (() => {
    const sorted = [...topProductos].sort((x, y) => y.ingresos - x.ingresos);
    const head = sorted.slice(0, 5).map((p) => ({ name: p.nombre, value: p.ingresos }));
    const rest = sorted.slice(5).reduce((n, p) => n + p.ingresos, 0);
    return rest > 0 ? [...head, { name: t('Otros'), value: rest }] : head;
  })();

  const printReport = () => printVentasReport({
    periodo: PERIODOS.find((p) => p.key === periodo)?.label ?? periodo,
    totalVentas: ventas?.totalVentas ?? 0,
    totalPedidos: ventas?.totalPedidos ?? 0,
    chartData: ventas?.chartData ?? [],
    top: (topProductos ?? []) as any,
    productividad: (productividad ?? []) as any,
  }, restInfo);

  const exportCSV = () => {
    const rows = [
      [t('Fecha'), t('Ventas ({c})', { c: currencySymbol() })],
      ...(ventas?.chartData ?? []).map((d) => [d.fecha, d.ventas.toFixed(2)]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ventas_${periodo}.csv`; a.click();
  };

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tabName) => (
          <button key={tabName} onClick={() => setTab(tabName)}
            className={cn('px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px', tab === tabName ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {t(tabName)}
          </button>
        ))}
      </div>

      {tab === 'Ventas' && (
        <div className="space-y-5">
          {/* Period Selector */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-1.5 sm:gap-2">
              {PERIODOS.map(({ key, label }) => (
                <button key={key} onClick={() => setPeriodo(key)}
                  className={cn('px-3 sm:px-4 py-1.5 rounded-m text-xs sm:text-sm font-medium transition-colors whitespace-nowrap', periodo === key ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground')}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
            <button onClick={printReport} className="flex items-center gap-2 px-4 py-2 bg-muted border border-border rounded-m text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Printer size={14} /> <span className="hidden sm:inline">{t('Imprimir')}</span>
            </button>
            <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-muted border border-border rounded-m text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Download size={14} /> <span className="hidden sm:inline">{t('Exportar CSV')}</span>
            </button>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <MetricCard title={t('Total ventas')} value={formatCurrency(ventas?.totalVentas ?? 0)} icon={<TrendingUp size={16} className="text-success" />} iconBg="bg-success-bg" />
            <MetricCard title={t('Pedidos pagados')} value={ventas?.totalPedidos ?? 0} icon={<TrendingUp size={16} className="text-info" />} iconBg="bg-info-bg" />
            <MetricCard title={t('Promedio por pedido')} value={formatCurrency(ventas?.totalPedidos ? (ventas.totalVentas / ventas.totalPedidos) : 0)} icon={<TrendingUp size={16} className="text-warning" />} iconBg="bg-warning-bg" />
          </div>

          {/* Chart */}
          <div className="bg-card border border-border rounded-l p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">{t('Ventas por día')}</h3>
            {ventas?.chartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">{t('Sin datos para el período')}</div>
            ) : (
              <SalesLineChart data={ventas?.chartData ?? []} />
            )}
          </div>

          {/* Структура продаж (3D-диаграмма) */}
          {pieItems.length > 0 && (
            <div className="bg-card border border-border rounded-l p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">{t('Estructura de ventas')}</h3>
              <Pie3D items={pieItems} />
            </div>
          )}

          {/* Top Productos */}
          <div className="bg-card border border-border rounded-l">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">{t('Top Productos')}</h3>
            </div>
            <TableWrapper headers={[t('Producto'), t('Cantidad vendida'), t('Ingresos'), t('% del total')]} isEmpty={topProductos.length === 0} emptyMessage={t('Sin datos')}>
              {topProductos.map((p, i) => (
                <Tr key={i}>
                  <Td className="font-medium">{p.nombre}</Td>
                  <Td>{p.cantidad}</Td>
                  <Td>{formatCurrency(p.ingresos)}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-pill overflow-hidden">
                        <div className="h-full bg-primary rounded-pill" style={{ width: `${p.porcentaje}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{p.porcentaje}%</span>
                    </div>
                  </Td>
                </Tr>
              ))}
            </TableWrapper>
          </div>
        </div>
      )}

      {tab === 'Productividad' && (
        <div className="bg-card border border-border rounded-l">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">{t('Productividad por cocinero')}</h3>
          </div>
          <TableWrapper headers={[t('Nombre'), t('Pedidos atendidos'), t('Tiempo promedio (min)')]} isEmpty={productividad.length === 0} emptyMessage={t('Sin datos')}>
            {productividad.map((p, i) => (
              <Tr key={i}>
                <Td className="font-medium">{p.nombre}</Td>
                <Td>{p.pedidos}</Td>
                <Td>{p.tiempoPromedio} {t('min')}</Td>
              </Tr>
            ))}
          </TableWrapper>
        </div>
      )}

      {tab === 'Pedidos' && (
        <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
          {t('Estadísticas de pedidos disponibles próximamente')}
        </div>
      )}
    </div>
  );
}
