import crypto from 'crypto';
import { config } from './config';

/**
 * Секреты каналов (токен Telegram-бота, пароль почты) хранятся в БД только в зашифрованном виде (AES-256-GCM).
 * Ключ выводится из секрета сервиса (OFFICE_JWT_SECRET): без него содержимое базы или её резервной копии ничего не раскрывает.
 * При смене OFFICE_JWT_SECRET секреты придётся ввести заново.
 */
const key = crypto.createHash('sha256').update('office-secrets|' + config.jwtSecret).digest();

export function seal(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return 'v1:' + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}

export function open(sealed: string | null | undefined): string | null {
  if (!sealed || !sealed.startsWith('v1:')) return null;
  try {
    const raw = Buffer.from(sealed.slice(3), 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
  } catch { return null; }
}

/** «••••1234» — показать, что значение задано, не раскрывая его. */
export const mask = (s: string | null): string => (s ? '••••' + s.slice(-4) : '');
