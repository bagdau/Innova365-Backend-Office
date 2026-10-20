import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Phone, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { almacenService } from '../../services/almacen.service';
import { t, apiError } from '../../i18n';
import type { Proveedor } from '../../types';

const inputCls = 'w-full bg-muted border border-border rounded-m px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary';
const empty = { nombre: '', contacto: '', telefono: '', email: '', notas: '' };

export default function ProveedoresTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Proveedor | 'new' | null>(null);
  const [form, setForm] = useState(empty);

  const { data: proveedores = [], isLoading } = useQuery<Proveedor[]>({ queryKey: ['proveedores', 'todos'], queryFn: () => almacenService.getProveedores(true) });

  const open = (p: Proveedor | 'new') => {
    setEditing(p);
    setForm(p === 'new' ? empty : { nombre: p.nombre, contacto: p.contacto ?? '', telefono: p.telefono ?? '', email: p.email ?? '', notas: p.notas ?? '' });
  };

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, email: form.email || null };
      return editing === 'new' ? almacenService.createProveedor(body) : almacenService.updateProveedor((editing as Proveedor).id, body);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['proveedores'] }); setEditing(null); toast.success(t('Proveedor guardado')); },
    onError: (e) => toast.error(apiError(e, 'Error al guardar')),
  });

  const toggle = useMutation({
    mutationFn: (p: Proveedor) => almacenService.updateProveedor(p.id, { activo: !p.activo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proveedores'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button size="sm" onClick={() => open('new')}><Plus size={14} /> {t('Nuevo proveedor')}</Button></div>

      {isLoading && <p className="text-sm text-muted-foreground text-center py-8">{t('Cargando...')}</p>}
      {!isLoading && proveedores.length === 0 && <p className="text-sm text-muted-foreground text-center py-12 border border-dashed border-border rounded-l">{t('Aún no hay proveedores')}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {proveedores.map((p) => (
          <div key={p.id} className="bg-card border border-border rounded-l p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-foreground">{p.nombre}</p>
                {p.contacto && <p className="text-xs text-muted-foreground">{p.contacto}</p>}
              </div>
              <StatusBadge variant={p.activo ? 'activo' : 'inactivo'} />
            </div>
            {p.telefono && <a href={`tel:${p.telefono}`} className="flex items-center gap-2 text-sm text-foreground hover:text-primary"><Phone size={13} /> {p.telefono}</a>}
            {p.email && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Mail size={13} /> {p.email}</p>}
            {p.notas && <p className="text-xs text-muted-foreground">{p.notas}</p>}
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="secondary" onClick={() => open(p)}><Pencil size={13} /> {t('Editar')}</Button>
              <Button size="sm" variant="ghost" onClick={() => toggle.mutate(p)}>{p.activo ? t('Desactivar') : t('Activar')}</Button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? t('Nuevo proveedor') : t('Editar proveedor')}>
        <div className="space-y-3">
          {([['nombre', t('Nombre')], ['contacto', t('Persona de contacto')], ['telefono', t('Teléfono')], ['email', 'Email']] as const).map(([k, label]) => (
            <div key={k}>
              <label className="text-sm font-medium text-foreground block mb-1.5">{label}{k === 'nombre' && ' *'}</label>
              <input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className={inputCls} />
            </div>
          ))}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">{t('Notas')}</label>
            <textarea rows={2} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className={inputCls} />
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setEditing(null)}>{t('Cancelar')}</Button>
            <Button className="flex-1" disabled={form.nombre.trim().length < 2} loading={save.isPending} onClick={() => save.mutate()}>{t('Guardar')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
