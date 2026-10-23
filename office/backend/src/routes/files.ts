import crypto from 'crypto';
import express, { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { audit, hasPerm } from '../auth';
import type { Perm } from '../perms';
import { config } from '../config';
import { q, q1 } from '../db';
import { ah, HttpError } from '../util';

/**
 * Вложения: сканы накладных, договоры, акты. Файлы лежат на диске (каталог данных), в БД — описание.
 * К каждому вложению применяются права того раздела, к которому оно относится.
 */
export const router = Router();

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PER_ENTITY = 30;

/** entity → какие права нужны для просмотра и для изменения вложений */
const ENTITY: Record<string, { view: Perm; edit: Perm }> = {
  purchase: { view: 'acc.view', edit: 'acc.write' },
  expense: { view: 'acc.view', edit: 'acc.write' },
  supplier: { view: 'sup.view', edit: 'sup.edit' },
  outlet: { view: 'fc.view', edit: 'fc.edit' },
  lease: { view: 'fc.view', edit: 'fc.edit' },
  invoice: { view: 'fc.view', edit: 'fc.settle' },
  settlement: { view: 'fc.view', edit: 'fc.settle' },
  techcard: { view: 'tc.view', edit: 'tc.edit' },
  stocktake: { view: 'inv.view', edit: 'inv.edit' },
  writeoff: { view: 'inv.view', edit: 'inv.edit' },
  payroll: { view: 'hr.view', edit: 'hr.write' },
  employee: { view: 'hr.view', edit: 'hr.write' },
  fin: { view: 'fin.view', edit: 'fin.write' },
};

const TYPES: Record<string, { ext: string; magic?: (b: Buffer) => boolean; inline: boolean }> = {
  'application/pdf': { ext: '.pdf', magic: (b) => b.subarray(0, 4).toString() === '%PDF', inline: true },
  'image/png': { ext: '.png', magic: (b) => b.subarray(1, 4).toString() === 'PNG', inline: true },
  'image/jpeg': { ext: '.jpg', magic: (b) => b[0] === 0xff && b[1] === 0xd8, inline: true },
  'image/webp': { ext: '.webp', magic: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP', inline: true },
  'text/csv': { ext: '.csv', inline: false },
  'text/plain': { ext: '.txt', inline: false },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: '.xlsx', magic: (b) => b[0] === 0x50 && b[1] === 0x4b, inline: false },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: '.docx', magic: (b) => b[0] === 0x50 && b[1] === 0x4b, inline: false },
  'application/vnd.ms-excel': { ext: '.xls', inline: false },
  'application/msword': { ext: '.doc', inline: false },
};

const dir = (rid: string) => path.resolve(config.dataDir, 'files', rid.replace(/[^\w-]/g, '_'));
const needEntity = (req: express.Request, entity: string, kind: 'view' | 'edit') => {
  const e = ENTITY[entity];
  if (!e) throw new HttpError(400, 'Неизвестный раздел для вложений');
  if (!hasPerm(req.me!, e[kind])) throw new HttpError(403, 'Недостаточно прав для этого действия');
  if (kind === 'edit' && !hasPerm(req.me!, 'files')) throw new HttpError(403, 'Загрузка файлов вам недоступна');
};

router.get('/files', ah(async (req, res) => {
  const entity = String(req.query.entity ?? ''), entityId = String(req.query.entityId ?? '');
  needEntity(req, entity, 'view');
  const rows = await q('select id, name, mime, size, uploaded_by_name, created_at from office.attachment where restaurante_id = $1 and entity = $2 and entity_id = $3 order by created_at desc', [req.me!.rid, entity, entityId]);
  res.json(rows);
}));

router.post('/files', express.raw({ type: () => true, limit: MAX_BYTES + 1024 }), ah(async (req, res) => {
  const entity = String(req.query.entity ?? ''), entityId = String(req.query.entityId ?? '');
  needEntity(req, entity, 'edit');
  if (!entityId) throw new HttpError(400, 'Не указан объект вложения');
  const body = req.body as Buffer;
  if (!Buffer.isBuffer(body) || !body.length) throw new HttpError(400, 'Файл пустой');
  if (body.length > MAX_BYTES) throw new HttpError(413, 'Файл больше 10 МБ');
  const mime = String(req.header('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const t = TYPES[mime];
  if (!t) throw new HttpError(415, 'Допустимы PDF, изображения (PNG, JPG, WebP), Excel, Word, CSV и текст');
  if (t.magic && !t.magic(body)) throw new HttpError(415, 'Содержимое файла не соответствует его типу');
  const name = String(req.query.name ?? 'файл').replace(/[\\/\r\n\0]/g, '_').slice(0, 120) || 'файл';
  const cnt = await q1<{ c: number }>('select count(*)::int as c from office.attachment where restaurante_id = $1 and entity = $2 and entity_id = $3', [req.me!.rid, entity, entityId]);
  if ((cnt?.c ?? 0) >= MAX_PER_ENTITY) throw new HttpError(409, `К одному объекту можно прикрепить не более ${MAX_PER_ENTITY} файлов`);
  const storage = crypto.randomUUID() + t.ext;
  const d = dir(req.me!.rid);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, storage), body);
  const r = await q1('insert into office.attachment (restaurante_id, entity, entity_id, name, mime, size, storage_name, uploaded_by, uploaded_by_name) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id, name, mime, size, uploaded_by_name, created_at',
    [req.me!.rid, entity, entityId, name, mime, body.length, storage, req.me!.id, req.me!.name]);
  await audit(req, 'file.upload', entity, entityId, { name, size: body.length });
  res.status(201).json(r);
}));

async function find(req: express.Request) {
  const f = await q1<{ id: string; entity: string; entity_id: string; name: string; mime: string; storage_name: string }>('select id, entity, entity_id, name, mime, storage_name from office.attachment where id = $1 and restaurante_id = $2', [req.params.id, req.me!.rid]);
  if (!f) throw new HttpError(404, 'Файл не найден');
  return f;
}

router.get('/files/:id', ah(async (req, res) => {
  const f = await find(req);
  needEntity(req, f.entity, 'view');
  const file = path.join(dir(req.me!.rid), f.storage_name);
  if (!fs.existsSync(file)) throw new HttpError(404, 'Файл утерян на диске');
  const inline = TYPES[f.mime]?.inline && req.query.download !== '1';
  res.setHeader('Content-Type', f.mime);
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.name)}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'");
  res.sendFile(file);
}));

router.delete('/files/:id', ah(async (req, res) => {
  const f = await find(req);
  needEntity(req, f.entity, 'edit');
  await q('delete from office.attachment where id = $1', [f.id]);
  fs.rmSync(path.join(dir(req.me!.rid), f.storage_name), { force: true });
  await audit(req, 'file.delete', f.entity, f.entity_id, { name: f.name });
  res.json({ ok: true });
}));
