'use strict';
/** PIN-код на настройки: хранится только хеш scrypt с солью. Без зависимостей от Electron. */
const crypto = require('crypto');

const PIN_RE = /^[0-9A-Za-z]{4,16}$/;
const valid = (pin) => typeof pin === 'string' && PIN_RE.test(pin);

function hashPin(pin) {
  if (!valid(pin)) throw new Error('PIN: от 4 до 16 символов (цифры или латинские буквы)');
  const salt = crypto.randomBytes(16);
  return { salt: salt.toString('hex'), hash: crypto.scryptSync(pin, salt, 32).toString('hex') };
}

function verifyPin(pin, rec) {
  if (!rec || !valid(pin)) return false;
  try {
    const want = Buffer.from(rec.hash, 'hex');
    const got = crypto.scryptSync(pin, Buffer.from(rec.salt, 'hex'), want.length);
    return want.length === got.length && crypto.timingSafeEqual(want, got);
  } catch { return false; }
}

/** Ограничитель подбора: после 5 неверных попыток подряд — пауза 30 секунд. */
class PinLimiter {
  constructor({ max = 5, lockMs = 30_000, now = () => Date.now() } = {}) { this.max = max; this.lockMs = lockMs; this.now = now; this.fails = 0; this.until = 0; }
  /** Сколько миллисекунд ещё ждать (0 — можно пробовать). */
  wait() { return Math.max(0, this.until - this.now()); }
  fail() { this.fails += 1; if (this.fails >= this.max) { this.until = this.now() + this.lockMs; this.fails = 0; } }
  ok() { this.fails = 0; this.until = 0; }
}

module.exports = { hashPin, verifyPin, valid, PinLimiter };
