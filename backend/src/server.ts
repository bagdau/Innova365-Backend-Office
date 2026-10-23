import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { router } from './routes/index';
import { errorHandler } from './middleware/error.middleware';
import { UPLOAD_DIR } from './controllers/menu.controller';
import { startDbNotify } from './dbnotify';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)),
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Healthcheck — útil para monitoreo
app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// Загруженные фото блюд (локальное хранилище)
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true, index: false }));

app.use('/api', router);

// Error handler GLOBAL — siempre al final
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Innova365 backend corriendo en http://localhost:${PORT}`);
  startDbNotify();
});

export default app;
