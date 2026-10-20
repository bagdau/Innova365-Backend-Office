import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Printer, ClipboardCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { SearchInput } from '../../components/shared/SearchInput';
import { TableWrapper, Tr, Td } from '../../components/shared/TableWrapper';
import { inventarioService } from '../../services/inventario.service';
import { almacenService, uid } from '../../services/almacen.service';
import { reportesService } from '../../services/reportes.service';
import { useInsumoSearch } from '../../search/useSearch';
import { printRevisionSheet } from '../../lib/documents';
import { fmtMoney, fmtQty } from '../../lib/print';
import { cn } from '../../utils/cn';
import { t, apiError } from '../../i18n';
import type { Insumo } from '../../types';

const costoDe = (i: Insumo) => Number((i as Insumo & { costoUnitario?: number | string | null }).costoUnitario ?? 0);

export default function RevisionTab() {
  const qc = useQueryClient();
  const { data: insumos = [], isLoading } = useQuery<Insumo[]>({ queryKey: ['inventario'], queryFn: inventarioService.getAll });
  const { data: rest } = useQuery({ queryKey: ['restaurante'], queryFn: reportesService.getRestaurante, staleTime: 300_000 });
  const [conteo, setConteo] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [notas, setNotas] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [clave, setClave] = useState(uid);
  const visible = useInsumoSearch(insumos, search);

  const contados = useMemo(() => insumos.filter((i) => conteo[i.id] !== undefined && conteo[i.id] !== '' && Number.isFinite(Number(conteo[i.id]))), [insumos, conteo]);
  const difs = contados.map((i) => ({ i, dif: Number(conteo[i.id]) - Number(i.stockActual) })).filter((x) => Math.abs(x.dif) > 1e-9);
  const impacto = difs.reduce((s, x) => s + x.dif * costoDe(x.i), 0);

  const apply = useMutation({
    mutationFn: () => almacenService.revision({ clave, notas: notas || undefined, conteos: contados.map((i) => ({ insumoId: i.id, contado: Number(conteo[i.id]) })) }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['inventario'] });
      qc.invalidateQueries({ queryKey: ['movimientos'] });
      toast.success(t('Revisión aplicada: diferencias — {n}', { n: r.conDiferencia }));
      setConteo({}); setNotas(''); setConfirm(false); setClave(uid());
    },
    onError: (e) => toast.error(apiError(e, 'Error al guardar')),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SearchInput value={search} onChange={setSearch} placeholder={t('Buscar insumo...')} hotkey="/" className="w-72" />
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="secondary" onClick={() => printRevisionSheet(insumos, rest)}><Printer size={14} /> {t('Imprimir hoja de conteo')}</Button>
          <Button size="sm" disabled={contados.length === 0} onClick={() => setConfirm(true)}><ClipboardCheck size={14} /> {t('Aplicar revisión')} ({contados.length})</Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t('Cuenta el stock real y escríbelo en «Contado». Solo se cambian los insumos que llenaste.')}</p>

      <TableWrapper
        headers={[t('Insumo'), t('En el sistema'), t('Contado'), t('Diferencia')]}
        isEmpty={visible.length === 0}
        emptyMessage={isLoading ? t('Cargando...') : t('Sin insumos registrados')}
      >
        {visible.map((i) => {
          const raw = conteo[i.id];
          const has = raw !== undefined && raw !== '';
          const dif = has ? Number(raw) - Number(i.stockActual) : 0;
          return (
            <Tr key={i.id}>
              <Td className="font-medium">{i.nombre}</Td>
              <Td>{fmtQty(Number(i.stockActual))} {i.unidad}</Td>
              <Td>
                <div className="flex items-center gap-2">
                  <input type="number" step="any" min="0" inputMode="decimal" value={raw ?? ''} placeholder="—"
                    onChange={(e) => setConteo((p) => ({ ...p, [i.id]: e.target.value }))}
                    className="w-28 bg-muted border border-border rounded-m px-2 py-1.5 text-sm text-right text-foreground focus:outline-none focus:border-primary" />
                  <span className="text-xs text-muted-foreground">{i.unidad}</span>
                </div>
              </Td>
              <Td className={cn('font-bold', !has ? 'text-muted-foreground' : Math.abs(dif) < 1e-9 ? 'text-success' : dif > 0 ? 'text-info' : 'text-error')}>
                {!has ? '—' : Math.abs(dif) < 1e-9 ? t('Coincide') : `${dif > 0 ? '+' : ''}${fmtQty(Math.round(dif * 1000) / 1000)} ${i.unidad}`}
              </Td>
            </Tr>
          );
        })}
      </TableWrapper>

      <Modal open={confirm} onClose={() => setConfirm(false)} title={t('Aplicar revisión')}>
        <div className="space-y-4">
          <p className="text-sm text-foreground">{t('Se contarán {a} insumos; diferencias: {b}.', { a: contados.length, b: difs.length })}</p>
          {difs.length > 0 && (
            <div className="max-h-56 overflow-y-auto border border-border rounded-m divide-y divide-border">
              {difs.map(({ i, dif }) => (
                <div key={i.id} className="flex justify-between px-3 py-2 text-sm">
                  <span>{i.nombre}</span>
                  <span className={dif > 0 ? 'text-info font-bold' : 'text-error font-bold'}>{dif > 0 ? '+' : ''}{fmtQty(Math.round(dif * 1000) / 1000)} {i.unidad}</span>
                </div>
              ))}
            </div>
          )}
          {difs.length > 0 && costoDe(difs[0].i) >= 0 && (
            <p className="text-sm text-muted-foreground">{t('Efecto en dinero (por el último precio)')}: <b className={impacto < 0 ? 'text-error' : 'text-info'}>{fmtMoney(impacto)}</b></p>
          )}
          <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder={t('Comentario (opcional)')}
            className="w-full bg-muted border border-border rounded-m px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirm(false)}>{t('Cancelar')}</Button>
            <Button className="flex-1" loading={apply.isPending} onClick={() => apply.mutate()}>{t('Aplicar revisión')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
