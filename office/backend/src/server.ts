import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { config } from './config';
import { migrate, pool } from './db';
import { auth } from './auth';
import { bumpData } from './cache';
import { eventsHandler, startListener } from './events';
import { errorHandler, HttpError } from './util';
import { router as authRouter } from './routes/auth';
import { router as staffRouter } from './routes/staff';
import { router as adminRouter } from './routes/admin';
import { router as filesRouter } from './routes/files';
import { router as inv } from './routes/inv';
import { router as sup } from './routes/sup';
import { router as menu } from './routes/menu';
import { router as ctl } from './routes/ctl';
import { router as fin } from './routes/fin';
import { router as hr } from './routes/hr';
import { router as leases } from './routes/leases';
import { router as invoices } from './routes/invoices';
import { router as tenant } from './routes/tenant';
import { router as reminders } from './routes/reminders';
import { router as notify, startNotifyScheduler } from './routes/notify';
import { router as rep } from './routes/rep';
import { router as security } from './routes/security';
import { router as search } from './routes/search';
import { router as importer } from './routes/import';
import { startSecurityJanitor } from './security';
import { router as sys, startBackupScheduler } from './routes/sys';
import { router as fc } from './routes/fc';
import { router as tc } from './routes/tc';
import { router as acc } from './routes/acc';
import { router as dashboard } from './routes/dashboard';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback, linklocal, uniquelocal');   // за системным nginx: https и IP клиента берём из X-Forwarded-*
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));

app.use((_req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'");
  next();
});

// CSRF: изменяющие запросы принимаются только с нашим заголовком (чужой сайт не может его выставить без CORS)
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.header('x-requested-with') !== 'office') { res.status(403).json({ error: 'Запрос отклонён' }); return; }
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'HEAD') { bumpData(); res.on('finish', bumpData); }   // собственные правки сразу видны в отчётах
  next();
});

app.get('/health', async (_req, res) => {
  try { await pool.query('select 1'); res.json({ ok: true }); } catch { res.status(503).json({ ok: false }); }
});

app.get('/api/events', auth, eventsHandler);
app.use('/api', authRouter, staffRouter, adminRouter, filesRouter, inv, sup, menu, ctl, fin, hr, leases, invoices, tenant, reminders, notify, rep, security, search, importer, sys, dashboard, fc, tc, acc);
app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Не найдено')));

const pub = path.resolve(config.publicDir);
if (fs.existsSync(pub)) {
  app.use('/assets', express.static(path.join(pub, 'assets'), { maxAge: '1y', immutable: true }));
  app.use(express.static(pub, { maxAge: '1h', index: false, setHeaders: (res, file) => { if (/[\/](sw\.js|manifest\.webmanifest)$/.test(file)) res.setHeader('Cache-Control', 'no-cache'); } }));
  app.get('*', (_req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(pub, 'index.html')); });
}
app.use(errorHandler);

migrate().then(() => {
  app.listen(config.port, () => console.log(`Innova Office: http://localhost:${config.port}`));
  startListener();
  startBackupScheduler();
  startNotifyScheduler();
  startSecurityJanitor();
}).catch((e) => { console.error('[fatal] миграции не применены:', e.message); process.exit(1); });
