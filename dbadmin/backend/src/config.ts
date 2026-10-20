/** Настройки сервиса из переменных окружения. */
export const config = {
  port: Number(process.env.PORT || 8200),
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: Number(process.env.DB_PORT || 5432),
  /** База по умолчанию при входе (можно сменить в интерфейсе). */
  dbName: process.env.DB_NAME || 'postgres',
  /** Время бездействия сессии, минут. */
  idleMinutes: Number(process.env.SESSION_IDLE_MIN || 30),
  maxSessions: Number(process.env.MAX_SESSIONS || 20),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  /** Таймаут одного запроса, мс. */
  statementTimeoutMs: Number(process.env.STATEMENT_TIMEOUT_MS || 30000),
  /** Сколько строк максимум возвращает SQL-консоль. */
  maxConsoleRows: Number(process.env.MAX_CONSOLE_ROWS || 10000),
  publicDir: process.env.PUBLIC_DIR || 'public',
};
