import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Search, ImagePlus, ChefHat, Coffee, ClipboardList } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { Select } from '../../components/ui/Select';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { menuService } from '../../services/menu.service';
import { formatCurrency } from '../../utils/cn';
import type { Producto, Categoria } from '../../types';
import toast from 'react-hot-toast';
import { cn } from '../../utils/cn';
import { SearchInput } from '../../components/shared/SearchInput';
import { useProductSearch } from '../../search/useSearch';
import { currencySymbol } from '../../lib/currency';
import { TechCardModal } from './TechCardModal';
import { recetasService } from '../../services/recetas.service';
import { t, apiError } from '../../i18n';

const schema = z.object({
  nombre:         z.string().min(1, t('Requerido')),
  descripcion:    z.string().optional(),
  precio:         z.number({ invalid_type_error: t('Precio requerido') }).positive(t('Debe ser positivo')),
  categoriaId:    z.string().min(1, t('Selecciona una categoría')),
  disponible:     z.boolean(),
  requiereCocina: z.boolean(),
});

type FormData = z.infer<typeof schema>;

/** Фото с телефона бывает 5–10 МБ: уменьшаем до 1280 px и JPEG 85% (в разы быстрее по мобильной сети). */
async function shrinkImage(file: File): Promise<File> {
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
    if (k === 1 && file.size < 600 * 1024) return file;
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const ctx = c.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch { return file; } // формат не поддерживается браузером — отправим как есть, сервер проверит
}

export default function MenuPage() {
  const qc = useQueryClient();
  const [catActiva, setCatActiva] = useState('todas');
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '');
  const [editing, setEditing] = useState<Producto | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [techProd, setTechProd] = useState<Producto | null>(null);
  const { data: recetas = [] } = useQuery({ queryKey: ['recetas'], queryFn: recetasService.list });
  const recetaOf = new Map(recetas.map((r) => [r.productoId, r]));
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [editingCat, setEditingCat] = useState<Categoria | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imagenUrl, setImagenUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: productos = [] } = useQuery<Producto[]>({ queryKey: ['productos'], queryFn: menuService.getProductos });
  const { data: categorias = [] } = useQuery<Categoria[]>({ queryKey: ['categorias'], queryFn: menuService.getCategorias });

  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { disponible: true, requiereCocina: true },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error(t('Файл не является изображением')); e.target.value = ''; return; }
    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);
    try {
      const { url } = await menuService.uploadImagen(await shrinkImage(file));
      setImagenUrl(url);
      toast.success(t('Imagen subida'));
    } catch (e) {
      toast.error(apiError(e, 'Error al subir imagen'));
      setPreviewUrl(null);
    } finally {
      setUploading(false);
      e.target.value = ''; // чтобы можно было выбрать тот же файл повторно
    }
  };

  const save = useMutation({
    mutationFn: (data: FormData) => {
      const payload = { ...data, descripcion: data.descripcion?.trim() || null, imagen: imagenUrl };
      return editing
        ? menuService.updateProducto(editing.id, payload)
        : menuService.createProducto(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['productos'] });
      closeModal();
      toast.success(editing ? t('Producto actualizado') : t('Producto creado'));
    },
    onError: (e) => toast.error(apiError(e, 'Error al guardar producto')),
  });

  const del = useMutation({
    mutationFn: (id: string) => menuService.deleteProducto(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['productos'] }); toast.success(t('Producto eliminado')); },
    onError: (e) => toast.error(apiError(e, 'Error al eliminar')),
  });

  const addCat = useMutation({
    mutationFn: () => editingCat ? menuService.updateCategoria(editingCat.id, newCat.trim()) : menuService.createCategoria(newCat.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categorias'] });
      qc.invalidateQueries({ queryKey: ['productos'] });
      toast.success(editingCat ? t('Categoría actualizada') : t('Categoría creada'));
      closeCat();
    },
    onError: (e) => toast.error(apiError(e, 'Error al guardar')),
  });

  const delCat = useMutation({
    mutationFn: (id: string) => menuService.deleteCategoria(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categorias'] }); setCatActiva('todas'); toast.success(t('Categoría eliminada')); },
    onError: (e) => toast.error(apiError(e, 'Error al eliminar')),
  });

  const closeCat = () => { setShowCatModal(false); setNewCat(''); setEditingCat(null); };

  const openNew = () => {
    setEditing(null);
    setImagenUrl(null); setPreviewUrl(null);
    reset({ disponible: true, requiereCocina: true });
    setShowModal(true);
  };

  const openEdit = (p: Producto) => {
    setEditing(p);
    setImagenUrl(p.imagen ?? null);
    setPreviewUrl(p.imagen ?? null);
    reset({
      nombre: p.nombre,
      descripcion: p.descripcion ?? '',
      precio: Number(p.precio),
      categoriaId: p.categoriaId,
      disponible: p.disponible,
      requiereCocina: p.requiereCocina,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false); setEditing(null);
    setImagenUrl(null); setPreviewUrl(null);
    reset();
  };

  const filtroCat = useCallback((p: Producto) => catActiva === 'todas' || p.categoriaId === catActiva, [catActiva]);
  const found = useProductSearch(productos, search, filtroCat);
  const visible = found.items;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 sm:gap-3 flex-wrap">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0 w-full sm:w-auto">
          <SearchInput value={search} onChange={setSearch} hotkey="/" className="w-full sm:w-60" />
          <div className="flex gap-1.5 sm:gap-2 flex-nowrap sm:flex-wrap overflow-x-auto sm:overflow-visible -mx-1 px-1 pb-1 sm:pb-0 w-full sm:w-auto">
            <button onClick={() => setCatActiva('todas')}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0',
                catActiva === 'todas' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground')}>
              {t('Todas ({n})', { n: productos.length })}
            </button>
            {categorias.map((c) => (
              <button key={c.id} onClick={() => setCatActiva(c.id)}
                className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0',
                  catActiva === c.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground')}>
                {c.nombre}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
          {catActiva !== 'todas' && (() => { const c = categorias.find((x) => x.id === catActiva); return c ? (<>
            <button type="button" aria-label={t('Renombrar categoría')} title={t('Renombrar categoría')}
              onClick={() => { setEditingCat(c); setNewCat(c.nombre); setShowCatModal(true); }}
              className="!flex-none w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted"><Pencil size={14} /></button>
            <button type="button" aria-label={t('Eliminar categoría')} title={t('Eliminar categoría')}
              onClick={() => { if (confirm(t('¿Eliminar la categoría «{n}»?', { n: c.nombre }))) delCat.mutate(c.id); }}
              className="!flex-none w-9 h-9 flex items-center justify-center rounded-lg border border-border text-error hover:bg-error/10"><Trash2 size={14} /></button>
          </>) : null; })()}
          <Button size="sm" variant="secondary" onClick={() => setShowCatModal(true)}>
            <Plus size={14} /> {t('Categoría')}
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus size={14} /> {t('Nuevo Producto')}
          </Button>
        </div>
      </div>

      {/* Grid de productos */}
      {visible.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ChefHat size={40} className="mx-auto mb-3 opacity-20" />
          <p>{t('No hay productos. ¡Crea el primero!')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4">
          {visible.map((prod) => (
            <div key={prod.id} className="bg-card border border-border rounded-xl overflow-hidden flex flex-col group">
              {/* Imagen */}
              <div className="relative h-20 min-[480px]:h-28 sm:h-36 bg-muted overflow-hidden">
                {prod.imagen ? (
                  <img src={prod.imagen} alt={prod.nombre}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40">
                    <ImagePlus size={22} />
                    <span className="hidden sm:block text-xs mt-1">{t('Sin imagen')}</span>
                  </div>
                )}
                {/* Badge cocina/complemento */}
                <div className={cn(
                  'absolute top-1 left-1 sm:top-2 sm:left-2 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold flex items-center gap-1',
                  prod.requiereCocina
                    ? 'bg-warning/90 text-background'
                    : 'bg-info/90 text-background'
                )}>
                  {prod.requiereCocina ? <><ChefHat size={10} /> <span className="hidden sm:inline">{t('Cocina')}</span></> : <><Coffee size={10} /> <span className="hidden sm:inline">{t('Complemento')}</span></>}
                </div>
                {/* телефон: статус точкой на фото (на планшете — бейджем ниже) */}
                <span className={cn('sm:hidden absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-card', prod.disponible ? 'bg-success' : 'bg-error')} title={prod.disponible ? t('Activo') : t('Inactivo')} />
              </div>

              <div className="p-1.5 sm:p-3 flex flex-col gap-1 sm:gap-1.5 flex-1">
                <div className="flex items-start justify-between gap-1 sm:flex-wrap">
                  <p className="text-[11px] leading-tight sm:text-sm font-semibold text-foreground line-clamp-2 flex-1 sm:min-w-[6rem]">{prod.nombre}</p>
                  <span className="hidden sm:block"><StatusBadge variant={prod.disponible ? 'activo' : 'inactivo'} /></span>
                </div>
                {prod.descripcion && (
                  <p className="hidden sm:block text-xs text-muted-foreground line-clamp-2">{prod.descripcion}</p>
                )}
                <p className="text-primary font-bold text-xs sm:text-base">{formatCurrency(Number(prod.precio))}</p>
                <p className="hidden sm:block text-xs text-muted-foreground">{prod.categoria?.nombre}</p>

                {(() => { const rs = recetaOf.get(prod.id); return rs?.tieneReceta ? (<>
                  <p className="sm:hidden text-[10px] leading-none">{rs.margen !== null && <span className={cn(rs.margen < 50 ? 'text-warning' : 'text-success')}>{rs.margen.toFixed(0)}%</span>}{rs.porciones !== null && <span className={cn('text-muted-foreground', rs.porciones <= 5 && 'text-error font-semibold')}> · {rs.porciones}</span>}</p>
                  <p className="hidden sm:block text-[11px] text-muted-foreground" title={t('Costo de la porción')}>
                    {t('Costo')}: {formatCurrency(rs.costo)}{rs.margen !== null && <> · <span className={cn(rs.margen < 50 ? 'text-warning' : 'text-success')}>{rs.margen.toFixed(0)}%</span></>}
                    {rs.porciones !== null && <> · <span className={cn(rs.porciones <= 5 && 'text-error font-semibold')}>{t('{n} porc.', { n: rs.porciones })}</span></>}
                  </p></>
                ) : <p className="text-[10px] sm:text-[11px] text-warning leading-tight"><span className="sm:hidden">⚠</span><span className="hidden sm:inline">{t('Sin ficha técnica')}</span></p>; })()}
                <div className="flex gap-1 sm:gap-1.5 mt-auto pt-0.5 sm:pt-1">
                  <button onClick={() => setTechProd(prod)} aria-label={t('Ficha técnica')} title={t('Ficha técnica')}
                    className="flex-1 sm:flex-none flex items-center justify-center px-1 sm:px-2.5 py-1.5 bg-primary/10 text-primary text-xs rounded-lg hover:bg-primary/20 transition-colors">
                    <ClipboardList size={12} />
                  </button>
                  <button onClick={() => openEdit(prod)} aria-label={t('Editar')} title={t('Editar')}
                    className="flex-1 flex items-center justify-center gap-1 px-1 sm:px-2 py-1.5 bg-muted text-xs text-muted-foreground hover:text-foreground rounded-lg transition-colors">
                    <Pencil size={11} /> <span className="hidden sm:inline">{t('Editar')}</span>
                  </button>
                  <button onClick={() => { if (confirm(t('¿Eliminar este producto?'))) del.mutate(prod.id); }}
                    aria-label={t('Eliminar')} title={t('Eliminar')}
                    className="flex-1 sm:flex-none flex items-center justify-center px-1 sm:px-2.5 py-1.5 bg-error/10 text-error text-xs rounded-lg hover:bg-error/20 transition-colors">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <TechCardModal producto={techProd} open={!!techProd} onClose={() => setTechProd(null)} />

      {/* Modal producto */}
      <Modal open={showModal} onClose={closeModal} title={editing ? t('Editar Producto') : t('Nuevo Producto')}>
        <form onSubmit={handleSubmit((d) => save.mutate(d))} className="space-y-4">

          {/* Upload imagen */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">{t('Imagen del producto')}</label>
            <div
              className="relative h-28 rounded-xl border-2 border-dashed border-border bg-muted overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {previewUrl ? (
                <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <ImagePlus size={28} className="mb-2" />
                  <span className="text-sm">{t('Haz clic para subir imagen')}</span>
                  <span className="text-xs mt-1">{t('JPG, PNG, WebP · máx 5 MB')}</span>
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                  <div className="text-sm text-foreground font-medium animate-pulse">{t('Subiendo...')}</div>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            {previewUrl && (
              <button type="button" onClick={() => { setPreviewUrl(null); setImagenUrl(null); }}
                className="text-xs text-error mt-1 hover:underline">
                {t('Quitar imagen')}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-sm font-medium text-foreground block mb-1.5">{t('Nombre *')}</label>
              <input {...register('nombre')}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
              {errors.nombre && <p className="text-xs text-error mt-1">{errors.nombre.message}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">{t('Precio ({c}) *', { c: currencySymbol() })}</label>
              <input type="number" step="0.01" {...register('precio', { valueAsNumber: true })}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
              {errors.precio && <p className="text-xs text-error mt-1">{errors.precio.message}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">{t('Categoría *')}</label>
              <Controller name="categoriaId" control={control} render={({ field }) => (
                <Select value={field.value ?? ''} onChange={field.onChange} invalid={!!errors.categoriaId}
                  options={[{ value: '', label: t('Seleccionar...') }, ...categorias.map((c) => ({ value: c.id, label: c.nombre }))]} />
              )} />
              {errors.categoriaId && <p className="text-xs text-error mt-1">{errors.categoriaId.message}</p>}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">{t('Descripción')}</label>
            <textarea {...register('descripcion')} rows={2}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary resize-none" />
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('disponible')} className="accent-primary w-4 h-4" />
              <span className="text-sm text-foreground">{t('Disponible')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('requiereCocina')} className="accent-warning w-4 h-4" />
              <span className="text-sm text-foreground flex items-center gap-1">
                <ChefHat size={13} className="text-warning" /> {t('Va a cocina')}
              </span>
            </label>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            {t('Desmarca «Va a cocina» para complementos (gaseosas, salsas, etc.) que el mesero sirve directamente.')}
          </p>

          <div className="flex gap-3 pt-1">
            <Button variant="secondary" type="button" className="flex-1" onClick={closeModal}>{t('Cancelar')}</Button>
            <Button type="submit" className="flex-1" loading={isSubmitting || uploading}>
              {editing ? t('Actualizar') : t('Crear producto')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal nueva categoría */}
      <Modal open={showCatModal} onClose={closeCat} title={editingCat ? t('Renombrar categoría') : t('Nueva Categoría')}>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">{t('Nombre de la categoría')}</label>
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)}
              placeholder={t('Ej: Combos, Bebidas, Ensaladas...')}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              onKeyDown={(e) => e.key === 'Enter' && newCat.trim() && addCat.mutate()} />
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={closeCat}>{t('Cancelar')}</Button>
            <Button className="flex-1" loading={addCat.isPending} disabled={!newCat.trim()} onClick={() => addCat.mutate()}>
              {editingCat ? t('Guardar cambios') : t('Crear categoría')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
