import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { t } from '../../i18n';

import StockTab from './StockTab';
const ComprasTab = lazy(() => import('./ComprasTab'));
const ProveedoresTab = lazy(() => import('./ProveedoresTab'));
const MovimientosTab = lazy(() => import('./MovimientosTab'));
const RevisionTab = lazy(() => import('./RevisionTab'));
const ConsumoTab = lazy(() => import('./ConsumoTab'));

const TABS = [
  { id: 'stock', label: () => t('Stock') },
  { id: 'compras', label: () => t('Compras') },
  { id: 'proveedores', label: () => t('Proveedores') },
  { id: 'consumo', label: () => t('Gasto de productos') },
  { id: 'movimientos', label: () => t('Movimientos') },
  { id: 'revision', label: () => t('Revisión') },
] as const;

type TabId = typeof TABS[number]['id'];

export default function InventarioPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: TabId = (TABS.find((x) => x.id === raw)?.id ?? 'stock') as TabId;
  const go = (id: TabId) => setParams(id === 'stock' ? {} : { tab: id }, { replace: true });

  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-border overflow-x-auto" role="tablist">
        {TABS.map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={tab === x.id}
            data-sound="switch"
            onClick={() => go(x.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
              tab === x.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {x.label()}
          </button>
        ))}
      </div>

      <Suspense fallback={<div className="py-16 flex justify-center"><div className="w-7 h-7 border-[3px] border-primary border-t-transparent rounded-full animate-spin" /></div>}>
        {tab === 'stock' && <StockTab onOrder={() => go('compras')} />}
        {tab === 'compras' && <ComprasTab />}
        {tab === 'proveedores' && <ProveedoresTab />}
        {tab === 'consumo' && <ConsumoTab />}
        {tab === 'movimientos' && <MovimientosTab />}
        {tab === 'revision' && <RevisionTab />}
      </Suspense>
    </div>
  );
}
