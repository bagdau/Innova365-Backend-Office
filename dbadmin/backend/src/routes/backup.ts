import { Router } from 'express';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import multer from 'multer';
import { HttpError, pgEnv } from '../sessions';
import { ah, requireWrite } from '../util';

export const router = Router();

const upload = multer({ dest: path.join(os.tmpdir(), 'dbstudio-import'), limits: { fileSize: 512 * 1024 * 1024 } });

/** Резервная копия базы: pg_dump → скачивание файлом. */
router.get('/backup', ah(async (req, res) => {
  const s = req.session!;
  const db = req.db || s.defaultDb;
  const q = req.query;
  const args = ['--no-owner', '--no-privileges'];
  if (q.owner === '1') args.splice(args.indexOf('--no-owner'), 1);
  if (q.privileges === '1') args.splice(args.indexOf('--no-privileges'), 1);
  if (q.schemaOnly === '1') args.push('--schema-only');
  if (q.dataOnly === '1') args.push('--data-only');
  if (q.inserts === '1') args.push('--column-inserts');
  if (q.clean === '1') args.push('--clean', '--if-exists');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  res.setHeader('Content-Type', 'application/sql; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${db.replace(/[^\w.-]/g, '_')}-${stamp}.sql"`);
  console.log(`[backup] ${s.user} ${db} ${args.join(' ')}`);
  const p = spawn('pg_dump', args, { env: pgEnv(s, db) });
  let err = '';
  p.stderr.on('data', (d) => { err += d.toString(); });
  p.stdout.pipe(res);
  p.on('error', (e) => { if (!res.headersSent) res.status(500).json({ error: 'pg_dump недоступен: ' + e.message }); else res.end(); });
  p.on('close', (code) => { if (code !== 0) console.warn('[backup] pg_dump exit', code, err.slice(0, 500)); });
  req.on('close', () => p.kill());
}));

/** Импорт SQL-файла: psql в одной транзакции, при первой ошибке всё откатывается. */
router.post('/import', upload.single('file'), ah(async (req, res) => {
  requireWrite(req);
  const f = req.file;
  if (!f) throw new HttpError(400, 'Выберите .sql файл');
  const s = req.session!;
  const db = req.db || s.defaultDb;
  try {
    console.log(`[import] ${s.user} -> ${db}: ${f.originalname} (${f.size} bytes)`);
    const out = await new Promise<{ code: number; out: string }>((resolve, reject) => {
      const p = spawn('psql', ['-v', 'ON_ERROR_STOP=1', '--single-transaction', '-X', '-q', '-f', f.path], { env: pgEnv(s, db) });
      let buf = '';
      const add = (d: Buffer) => { buf += d.toString(); if (buf.length > 20000) buf = buf.slice(-20000); };
      p.stdout.on('data', add); p.stderr.on('data', add);
      p.on('error', reject);
      p.on('close', (code) => resolve({ code: code ?? 1, out: buf }));
    });
    if (out.code !== 0) throw new HttpError(400, 'Импорт отменён: ' + (out.out.trim().split('\n').slice(-6).join('\n') || 'ошибка psql'), { output: out.out });
    res.json({ ok: true, output: out.out });
  } finally {
    fs.unlink(f.path, () => undefined);
  }
}));
