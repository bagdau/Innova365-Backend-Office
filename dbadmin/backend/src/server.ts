import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { errorHandler } from './util';
import { router as meta } from './routes/meta';
import { router as tables } from './routes/tables';
import { router as sql } from './routes/sql';
import { router as routines } from './routes/routines';
import { router as roles } from './routes/roles';
import { router as backup } from './routes/backup';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use(cookieParser());
app.use(express.json({ limit: '25mb' }));

// Заголовки безопасности: сервис нельзя встроить в чужую страницу, скрипты — только свои
app.use((_req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'");
  next();
});

// Защита от CSRF: API принимает только запросы с нашим заголовком (чужой сайт не может его выставить без CORS)
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.header('x-requested-with') !== 'dbstudio') {
    res.status(403).json({ error: 'Запрос отклонён' });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api', meta, tables, sql, routines, roles, backup);
app.use('/api', (_req, res) => { res.status(404).json({ error: 'Не найдено' }); });

const pub = path.resolve(config.publicDir);
if (fs.existsSync(pub)) {
  app.use('/assets', express.static(path.join(pub, 'assets'), { maxAge: '1y', immutable: true }));
  app.use(express.static(pub, { maxAge: 0, index: false }));
  app.get('*', (_req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(pub, 'index.html')); });
}

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`DB Studio: http://localhost:${config.port}  →  PostgreSQL ${config.dbHost}:${config.dbPort}/${config.dbName}`);
});
