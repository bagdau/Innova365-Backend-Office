import crypto from 'crypto';

const dbUrl = process.env.DATABASE_URL || 'postgresql://restaurantos:restaurantos@localhost:5432/restaurantos';

export const config = {
  port: Number(process.env.PORT || 8300),
  databaseUrl: dbUrl,
  /** Секрет подписи токенов. Если не задан — выводится из пароля БД (стабилен между перезапусками, не лежит в коде). */
  jwtSecret: process.env.OFFICE_JWT_SECRET || crypto.createHash('sha256').update('innova-office|' + dbUrl).digest('hex'),
  tokenHours: Number(process.env.TOKEN_HOURS || 12),
  publicDir: process.env.PUBLIC_DIR || 'public',
  migrationsDir: process.env.MIGRATIONS_DIR || 'migrations',
  /** Часовой пояс отчётов по умолчанию (если не задан в настройках). */
  /** Каталог данных Office: вложения, резервные копии (том Docker). */
  dataDir: process.env.DATA_DIR || './data',
  timezone: process.env.OFFICE_TZ || process.env.TZ || 'Asia/Almaty',
};
