import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, UserPlus, Lock } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { TableWrapper, Tr, Td } from '../../components/shared/TableWrapper';
import { reportesService } from '../../services/reportes.service';
import { getInitials, rolColor, rolLabel, formatDate } from '../../utils/cn';
import type { Usuario } from '../../types';
import toast from 'react-hot-toast';
import { cn } from '../../utils/cn';
import { t, apiError } from '../../i18n';
import { useAuthStore } from '../../store/authStore';
import { assignableRoles, canManageUser } from '../../auth/permissions';

const TODOS_ROLES = ['SUPERADMIN', 'ADMIN', 'CAJERO', 'MESERO', 'COCINERO'];

export default function UsuariosPage() {
  const qc = useQueryClient();
  const me = useAuthStore((st) => st.user);
  const ROLES = assignableRoles(me?.rol);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [filtroRol, setFiltroRol] = useState('');
  const { register, control, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  const { data: usuarios = [], isLoading } = useQuery<Usuario[]>({
    queryKey: ['usuarios'],
    queryFn: reportesService.getUsuarios,
  });

  const save = useMutation({
    mutationFn: (data: any) => editing
      ? reportesService.updateUsuario(editing.id, data)
      : reportesService.createUsuario(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      setShowModal(false); setEditing(null); reset();
      toast.success(editing ? t('Usuario actualizado') : t('Usuario creado'));
    },
    onError: (e: any) => toast.error(apiError(e, 'Error al guardar')),
  });

  const del = useMutation({
    mutationFn: (id: string) => reportesService.deleteUsuario(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); toast.success(t('Usuario desactivado')); },
    onError: () => toast.error(t('Error al desactivar')),
  });

  const openEdit = (u: Usuario) => {
    setEditing(u);
    reset({ nombre: u.nombre, email: u.email, rol: u.rol, activo: u.activo });
    setShowModal(true);
  };

  const visibles = filtroRol ? usuarios.filter((u) => u.rol === filtroRol) : usuarios;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFiltroRol('')}
            className={cn('px-3 py-1.5 rounded-pill text-xs font-medium', !filtroRol ? 'bg-primary text-white' : 'bg-muted text-muted-foreground')}>
            {t('Todos')}
          </button>
          {TODOS_ROLES.filter((r) => usuarios.some((u) => u.rol === r)).map((r) => (
            <button key={r} onClick={() => setFiltroRol(r)}
              className={cn('px-3 py-1.5 rounded-pill text-xs font-medium transition-colors', filtroRol === r ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground')}>
              {rolLabel(r)}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => { setEditing(null); reset({ activo: true }); setShowModal(true); }}>
          <UserPlus size={14} /> {t('Nuevo Usuario')}
        </Button>
      </div>

      {/* Телефон: список карточек вместо таблицы */}
      <div className="md:hidden space-y-2">
        {visibles.length === 0 && <p className="text-center py-10 text-sm text-muted-foreground">{isLoading ? t('Cargando...') : t('Sin usuarios')}</p>}
        {visibles.map((u) => (
          <div key={u.id} className="bg-card border border-border rounded-l p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-pill bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">{getInitials(u.nombre)}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-foreground truncate">{u.nombre}</span>
                <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold', rolColor(u.rol))}>{rolLabel(u.rol)}</span>
                {!u.activo && <StatusBadge variant="inactivo" />}
              </div>
              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
            </div>
            {canManageUser(me?.rol, me?.id, u) ? (
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => openEdit(u)} aria-label={t('Editar')} title={t('Editar')} className="p-2.5 rounded-m text-muted-foreground hover:text-primary hover:bg-muted"><Pencil size={16} /></button>
                {u.id !== me?.id && <button onClick={() => { if (confirm(t('¿Desactivar a este usuario?'))) del.mutate(u.id); }} aria-label={t('Desactivar')} title={t('Desactivar')} className="p-2.5 rounded-m text-muted-foreground hover:text-error hover:bg-muted"><Trash2 size={16} /></button>}
              </div>
            ) : <span title={t('Solo el propietario puede cambiar esta cuenta')} className="text-muted-foreground/60 p-2.5"><Lock size={16} /></span>}
          </div>
        ))}
      </div>

      <div className="hidden md:block">
      <TableWrapper
        headers={[t('Usuario'), t('Email'), t('Rol'), t('Estado'), t('Creado'), t('Acciones')]}
        isEmpty={visibles.length === 0}
        emptyMessage={isLoading ? t('Cargando...') : t('Sin usuarios')}
      >
        {visibles.map((u) => (
          <Tr key={u.id}>
            <Td>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-pill bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                  {getInitials(u.nombre)}
                </div>
                <span className="font-medium text-foreground">{u.nombre}</span>
              </div>
            </Td>
            <Td className="text-muted-foreground">{u.email}</Td>
            <Td>
              <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold', rolColor(u.rol))}>
                {rolLabel(u.rol)}
              </span>
            </Td>
            <Td><StatusBadge variant={u.activo ? 'activo' : 'inactivo'} /></Td>
            <Td className="text-muted-foreground text-xs">{formatDate(u.creadoEn)}</Td>
            <Td>
              {canManageUser(me?.rol, me?.id, u) ? (
                <div className="flex gap-2">
                  <button onClick={() => openEdit(u)} aria-label={t('Editar')} title={t('Editar')} className="text-muted-foreground hover:text-primary"><Pencil size={14} /></button>
                  {u.id !== me?.id && <button onClick={() => { if (confirm(t('¿Desactivar a este usuario?'))) del.mutate(u.id); }} aria-label={t('Desactivar')} title={t('Desactivar')} className="text-muted-foreground hover:text-error"><Trash2 size={14} /></button>}
                </div>
              ) : (
                <span title={t('Solo el propietario puede cambiar esta cuenta')} className="text-muted-foreground/60"><Lock size={14} /></span>
              )}
            </Td>
          </Tr>
        ))}
      </TableWrapper>
      </div>

      <Modal open={showModal} onClose={() => { setShowModal(false); setEditing(null); reset(); }}
        title={editing ? t('Editar Usuario') : t('Nuevo Usuario')}>
        <form onSubmit={handleSubmit((d) => save.mutate(d))} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">{t('Nombre completo')}</label>
            <input {...register('nombre', { required: true })} className="w-full bg-muted border border-border rounded-m px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">{t('Email')}</label>
            <input type="email" {...register('email', { required: true })} className="w-full bg-muted border border-border rounded-m px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
          </div>
          {!editing && (
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">{t('Contraseña temporal')}</label>
              <input type="password" {...register('password', { required: !editing })} className="w-full bg-muted border border-border rounded-m px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">{t('Rol')}</label>
            <Controller name="rol" control={control} rules={{ required: true }} render={({ field }) => (
              <Select value={field.value ?? ''} onChange={field.onChange} disabled={!!editing && editing.id === me?.id}
                options={(editing && !ROLES.includes(editing.rol) ? [editing.rol, ...ROLES] : ROLES).map((r) => ({ value: r, label: rolLabel(r), disabled: !ROLES.includes(r) }))} />
            )} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="activo" {...register('activo')} className="accent-primary" />
            <label htmlFor="activo" className="text-sm text-foreground">{t('Activo')}</label>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" type="button" className="flex-1" onClick={() => { setShowModal(false); setEditing(null); reset(); }}>{t('Cancelar')}</Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>{t('Guardar')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
