import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { cached } from '../cache';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { HttpError } from '../idem';


// Supabase client con service key para uploads (lazy: solo se necesita al subir imágenes)
let supabaseClient: SupabaseClient | null = null;
function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return (supabaseClient ??= createClient(url, key));
}

// Папка для загруженных картинок (volume в docker-compose). Если Supabase не настроен — храним локально.
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

// Multer en memoria; тип проверяем по содержимому файла, а не по имени
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB (фото с телефона)
});

// Определение формата по сигнатуре (magic bytes)
function sniffImage(b: Buffer): { ext: string; mime: string } | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: '.jpg', mime: 'image/jpeg' };
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: '.png', mime: 'image/png' };
  if (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return { ext: '.webp', mime: 'image/webp' };
  if (b.subarray(4, 8).toString() === 'ftyp' && /avif|avis/.test(b.subarray(8, 12).toString())) return { ext: '.avif', mime: 'image/avif' };
  if (b.subarray(0, 4).toString() === 'GIF8') return { ext: '.gif', mime: 'image/gif' };
  return null;
}

export async function uploadImagen(req: Request, res: Response): Promise<void> {
  if (!req.file) throw new HttpError(400, 'Выберите файл изображения (JPG, PNG, WEBP)');
  const kind = sniffImage(req.file.buffer);
  if (!kind) throw new HttpError(400, 'Файл не является изображением (нужен JPG, PNG, WEBP, AVIF или GIF)');

  const filename = `${req.restauranteId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}${kind.ext}`;

  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.storage.from('productos').upload(filename, req.file.buffer, { contentType: kind.mime, upsert: true });
    if (error) { res.status(500).json({ error: 'Error al subir imagen', detail: error.message }); return; }
    const { data } = supabase.storage.from('productos').getPublicUrl(filename);
    res.json({ url: data.publicUrl });
    return;
  }

  // Локальное хранилище: /uploads/<файл> раздаёт сам backend (через nginx — тот же origin)
  await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.promises.writeFile(path.join(UPLOAD_DIR, filename), req.file.buffer);
  res.json({ url: `/uploads/${filename}` });
}

export async function getProductos(req: Request, res: Response): Promise<void> {
  const productos = await cached(`${req.restauranteId}:menu:productos`, 60_000, () => prisma.producto.findMany({
    where: { restauranteId: req.restauranteId! },
    include: { categoria: true },
    orderBy: { nombre: 'asc' },
  }));
  res.json(productos);
}

async function checkCategoria(restauranteId: string, categoriaId: string): Promise<void> {
  const c = await prisma.categoria.findFirst({ where: { id: categoriaId, restauranteId }, select: { id: true } });
  if (!c) throw new HttpError(400, 'Категория не найдена');
}

export async function createProducto(req: Request, res: Response): Promise<void> {
  const { nombre, descripcion, precio, imagen, disponible, categoriaId, requiereCocina } = req.body;
  await checkCategoria(req.restauranteId!, categoriaId);
  const producto = await prisma.producto.create({
    data: {
      nombre, descripcion: descripcion || null, precio, imagen: imagen || null,
      disponible: disponible ?? true,
      requiereCocina: requiereCocina ?? true,
      categoriaId,
      restauranteId: req.restauranteId!,
    },
    include: { categoria: true },
  });
  res.status(201).json(producto);
}

export async function updateProducto(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { nombre, descripcion, precio, imagen, disponible, categoriaId, requiereCocina } = req.body;
  if (categoriaId) await checkCategoria(req.restauranteId!, categoriaId);
  const producto = await prisma.producto.update({
    where: { id, restauranteId: req.restauranteId! },
    data: {
      nombre, precio, disponible, categoriaId, requiereCocina,
      // null/'' = убрать значение; undefined = не трогать
      descripcion: descripcion === undefined ? undefined : (descripcion || null),
      imagen: imagen === undefined ? undefined : (imagen || null),
    },
    include: { categoria: true },
  });
  res.json(producto);
}

export async function deleteProducto(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const used = await prisma.itemPedido.count({ where: { productoId: id } });
  if (used > 0) throw new HttpError(409, 'Блюдо есть в истории заказов — удалить нельзя. Отключите его (снимите «Доступно»), и оно исчезнет из меню');
  const inCombo = await prisma.recetaItem.count({ where: { componenteId: id } });
  if (inCombo > 0) throw new HttpError(409, 'Блюдо входит в состав комбо — сначала уберите его из техкарты комбо');
  await prisma.$transaction([
    prisma.receta.deleteMany({ where: { productoId: id, restauranteId: req.restauranteId! } }),
    prisma.producto.delete({ where: { id, restauranteId: req.restauranteId! } }),
  ]);
  res.status(204).send();
}

export async function getCategorias(req: Request, res: Response): Promise<void> {
  const categorias = await cached(`${req.restauranteId}:menu:categorias`, 60_000, () => prisma.categoria.findMany({
    where: { restauranteId: req.restauranteId! },
    orderBy: { nombre: 'asc' },
  }));
  res.json(categorias);
}

async function nombreLibre(restauranteId: string, nombre: string, exceptId?: string): Promise<void> {
  const dup = await prisma.categoria.findFirst({ where: { restauranteId, nombre: { equals: nombre, mode: 'insensitive' }, ...(exceptId ? { NOT: { id: exceptId } } : {}) }, select: { id: true } });
  if (dup) throw new HttpError(409, 'Категория с таким названием уже есть');
}

async function checkImpresora(restauranteId: string, impresoraId?: string | null): Promise<void> {
  if (!impresoraId) return;
  const p = await prisma.impresora.findFirst({ where: { id: impresoraId, restauranteId }, select: { id: true } });
  if (!p) throw new HttpError(400, 'Принтер не найден');
}

export async function createCategoria(req: Request, res: Response): Promise<void> {
  const { nombre, impresoraId } = req.body;
  await nombreLibre(req.restauranteId!, nombre);
  await checkImpresora(req.restauranteId!, impresoraId);
  const categoria = await prisma.categoria.create({ data: { nombre, restauranteId: req.restauranteId!, impresoraId: impresoraId ?? null } });
  res.status(201).json(categoria);
}

export async function updateCategoria(req: Request, res: Response): Promise<void> {
  const { nombre, impresoraId } = req.body;
  await nombreLibre(req.restauranteId!, nombre, req.params.id);
  await checkImpresora(req.restauranteId!, impresoraId);
  const categoria = await prisma.categoria.update({ where: { id: req.params.id, restauranteId: req.restauranteId! }, data: { nombre, ...(impresoraId !== undefined ? { impresoraId } : {}) } });
  res.json(categoria);
}

export async function deleteCategoria(req: Request, res: Response): Promise<void> {
  const n = await prisma.producto.count({ where: { categoriaId: req.params.id, restauranteId: req.restauranteId! } });
  if (n > 0) throw new HttpError(409, 'В категории есть блюда — сначала перенесите их в другую категорию');
  await prisma.categoria.delete({ where: { id: req.params.id, restauranteId: req.restauranteId! } });
  res.status(204).send();
}
