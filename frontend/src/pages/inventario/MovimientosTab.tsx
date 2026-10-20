import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { SearchInput } from '../../components/shared/SearchInput';
import { TableWrapper, Tr, Td } from '../../components/shared/TableWrapper';
import { almacenService } from '../../services/almacen.service';
import { reportesService } from '../../services/reportes.service';
import { printMovimientos, tipoLabel } from '../../lib/documents';
import { fmtDateTime, fmtQty } from '../../lib/print';
import { cn } from '../../utils/cn';
import { t } from '../../i18n';
import { SearchIndex } from '../../search/engine';
import type { Movimiento, TipoMovimiento } from '../../types';
import { useMemo } from 'react';

const TIPOS: Array<{ id: TipoMovimiento | 'TODOS'; label: () => string }> = [
  { id: 'TODOS', label: () => t('Todos') },
  { id: 'COMPRA', label: () => t('Compra') },
  { id: 'CONSUMO', label: () => t('Consumo') },
  { id: 'DEVOLUCION', label: () => t('Devolución al almacén') },
  { id: 'MERMA', label: () => t('Merma') },
  { id: 'AJUSTE', label: () => t('Ajuste') },
  { id: 'REVISION', label: () => t('Revisión') },
  { id: 'INICIAL', label: () => t('Saldo inicial') },
];

const tone = (m: Movimiento) => (m.cantidad > 0 ? 'text-success' : 'text-error');

export default function MovimientosTab() {
  const [tipo, setTipo] = useState<TipoMovimiento | 'TODOS'>('TODOS');
  const [search, setSearch] = useState('');
  const { data = [], isLoading } = useQuery<Movimiento[]>({
    queryKey: ['movimientos', tipo],
    queryFn: () => almacenService.getMovimientos({ limit: 300, ...(tipo !== 'TODOS' ? { tipo } : {}) }),
  });
  const { data: rest } = useQuery({ queryKey: ['restaurante'], queryFn: reportesService.getRestaurante, staleTime: 300_000 });

  const index = useMemo(() => new SearchIndex<Movimiento>(data, [{ get: (m) => m.insumo, weight: 3 }, { get: (m) => m.usuario, weight: 1 }, { get: (m) => m.motivo, weight: 1 }]), [data]);
  const rows = search.trim() ? index.search(search, { limit: 300 }).map((h) => h.item) : data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {TIPOS.map((x) => (
            <button key={x.id} onClick={() => setTipo(x.id)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors', tipo === x.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground')}>
              {x.label()}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder={t('Buscar insumo...')} className="w-56" />
          <Button size="sm" variant="secondary" onClick={() => printMovimientos(rows, rest)}><Printer size={14} /> {t('Imprimir')}</Button>
        </div>
      </div>

      <TableWrapper
        headers={[t('Fecha'), t('Insumo'), t('Tipo'), t('Cantidad'), t('Saldo'), t('Usuario'), t('Motivo')]}
        isEmpty={rows.length === 0}
        emptyMessage={isLoading ? t('Cargando...') : t('Aún no hay movimientos')}
      >
        {rows.map((m) => (
          <Tr key={m.id}>
            <Td className="text-muted-foreground whitespace-nowrap">{fmtDateTime(m.creadoEn)}</Td>
            <Td className="font-medium">{m.insumo}</Td>
            <Td>{tipoLabel(m.tipo)}</Td>
            <Td className={cn('font-bold whitespace-nowrap', tone(m))}>{m.cantidad > 0 ? '+' : ''}{fmtQty(m.cantidad)} {m.unidad}</Td>
            <Td className="whitespace-nowrap">{fmtQty(m.saldo)} {m.unidad}</Td>
            <Td className="text-muted-foreground">{m.usuario ?? '—'}</Td>
            <Td className="text-muted-foreground whitespace-normal min-w-[10rem]">{m.motivo ?? ""}</Td>
          </Tr>
        ))}
      </TableWrapper>
    </div>
  );
}
