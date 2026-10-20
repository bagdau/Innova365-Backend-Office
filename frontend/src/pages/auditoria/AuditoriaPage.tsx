import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { api } from '../../services/api';
import { TableWrapper, Tr, Td } from '../../components/shared/TableWrapper';
import { SearchInput } from '../../components/shared/SearchInput';
import { actionLabel, ACTION_GROUPS } from '../../lib/actions';
import { fmtDateTime } from '../../lib/print';
import { rolColor, rolLabel, cn } from '../../utils/cn';
import { Select } from '../../components/ui/Select';
import { t } from '../../i18n';

interface Registro {
  id: string; usuarioId: string | null; usuarioNombre: string; rol: string; accion: string;
  detalle: string | null; ref: string | null; estado: number; creadoEn: string;
}
interface Respuesta { registros: Registro[]; usuarios: { id: string; nombre: string; rol: string }[] }


/** Журнал действий — только владелец: кто, когда и что сделал в системе. */
export default function AuditoriaPage() {
  const [usuarioId, setUsuarioId] = useState('');
  const [grupo, setGrupo] = useState('');
  const [soloDenegados, setSoloDenegados] = useState(false);
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(100);

  const { data, isLoading } = useQuery<Respuesta>({
    queryKey: ['auditoria', usuarioId, grupo, limit],
    queryFn: () => api.get('/auditoria', { params: { limit, ...(usuarioId ? { usuarioId } : {}), ...(grupo ? { accion: grupo } : {}) } }).then((r) => r.data),
    refetchInterval: 30_000,
  });

  const needle = q.trim().toLowerCase();
  const rows = (data?.registros ?? []).filter((r) =>
    (!soloDenegados || r.accion.endsWith('.denegado')) &&
    (!needle || `${r.usuarioNombre} ${actionLabel(r.accion)} ${r.detalle ?? ''}`.toLowerCase().includes(needle)));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('Aquí ves quién hizo qué y cuándo. Solo lo ve el propietario. No se guardan contraseñas ni datos de pago.')}</p>

      <div className="flex gap-2 flex-wrap items-center">
        <Select className="w-full sm:w-60" value={usuarioId} onChange={setUsuarioId}
          options={[{ value: '', label: t('Todos los usuarios') }, ...(data?.usuarios ?? []).map((u) => ({ value: u.id, label: `${u.nombre} — ${rolLabel(u.rol)}` }))]} />
        <Select className="w-full sm:w-56" value={grupo} onChange={setGrupo}
          options={[{ value: '', label: t('Todas las acciones') }, ...ACTION_GROUPS.map((g) => ({ value: g.prefix, label: g.label() }))]} />
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input type="checkbox" className="accent-primary" checked={soloDenegados} onChange={(e) => setSoloDenegados(e.target.checked)} />
          <ShieldAlert size={14} className="text-error" /> {t('Solo accesos denegados')}
        </label>
        <SearchInput value={q} onChange={setQ} placeholder={t('Buscar en el registro...')} className="w-60 ml-auto" />
      </div>

      {/* Телефон: записи журнала карточками (в таблице действие уходило за край экрана) */}
      <div className="md:hidden space-y-2">
        {rows.length === 0 && <p className="text-center py-10 text-sm text-muted-foreground">{isLoading ? t('Cargando...') : t('Sin datos')}</p>}
        {rows.map((r) => (
          <div key={r.id} className={cn('bg-card border rounded-l p-3', r.accion.endsWith('.denegado') ? 'border-error/40 bg-error-bg/30' : 'border-border')}>
            <p className={cn('text-sm font-medium', r.accion.endsWith('.denegado') ? 'text-error' : 'text-foreground')}>{actionLabel(r.accion)}</p>
            <div className="flex items-center justify-between gap-2 mt-1.5 flex-wrap">
              <span className="text-xs text-foreground">{r.usuarioNombre} <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded ml-1', rolColor(r.rol))}>{rolLabel(r.rol)}</span></span>
              <span className="text-[11px] text-muted-foreground">{fmtDateTime(r.creadoEn)}</span>
            </div>
            {(r.detalle || r.ref) && <p className="text-[11px] text-muted-foreground mt-1 break-words">{r.detalle ?? ''}{r.ref ? ` · ${r.ref.slice(-6)}` : ''}</p>}
          </div>
        ))}
      </div>

      <div className="hidden md:block">
      <TableWrapper
        headers={[t('Fecha'), t('Usuario'), t('Acción'), t('Detalle')]}
        isEmpty={rows.length === 0}
        emptyMessage={isLoading ? t('Cargando...') : t('Sin datos')}
      >
        {rows.map((r) => (
          <Tr key={r.id} className={r.accion.endsWith('.denegado') ? 'bg-error-bg/30' : undefined}>
            <Td className="text-muted-foreground whitespace-nowrap text-xs">{fmtDateTime(r.creadoEn)}</Td>
            <Td>
              <span className="font-medium text-foreground">{r.usuarioNombre}</span>{' '}
              <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', rolColor(r.rol))}>{rolLabel(r.rol)}</span>
            </Td>
            <Td className={cn('whitespace-normal min-w-[12rem]', r.accion.endsWith('.denegado') && 'text-error font-medium')}>{actionLabel(r.accion)}</Td>
            <Td className="text-muted-foreground text-xs whitespace-normal min-w-[10rem]">{r.detalle ?? ''}{r.ref ? ` · ${r.ref.slice(-6)}` : ''}</Td>
          </Tr>
        ))}
      </TableWrapper>
      </div>

      {(data?.registros.length ?? 0) >= limit && (
        <button onClick={() => setLimit((n) => n + 100)} className="w-full text-sm text-primary hover:underline py-2">{t('Mostrar más')}</button>
      )}
    </div>
  );
}
