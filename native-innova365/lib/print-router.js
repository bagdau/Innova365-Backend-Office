'use strict';
/**
 * Маршрутизация печати «байты ESC/POS → очередь Windows по имени».
 *  1. Очередь не найдена → понятная ошибка со списком имеющихся (вместо тихого сбоя WritePrinter).
 *  2. Очередь с сетевым портом (IP_192.168.x.x) → напрямую на порт 9100, при сбое — через спулер Windows.
 *  3. Остальные (USB001 и т.п.) → спулер Windows, RAW; при сбое одна повторная попытка.
 * Результат «задание передано» не доказывает, что чек физически вышел: состояние бумаги и ошибки читаем отдельно (status).
 * Без зависимостей от Electron.
 */
const { isRelayHost } = require('./url');

const TCP_PORT_NAME = /^(?:IP_)?(\d{1,3}(?:\.\d{1,3}){3})(?:_\d+)?$/i;

/** IP-адрес из имени порта Windows («192.168.1.5», «IP_192.168.1.5», «IP_192.168.1.5_1»), либо null. */
function ipFromPort(port) {
  const m = TCP_PORT_NAME.exec(String(port ?? '').trim());
  return m && isRelayHost(m[1]) ? m[1] : null;
}

class PrintError extends Error {
  /** @param {'not_found'|'offline'|'failed'} code @param {string} message @param {any[]} [attempts] @param {string[]} [available] */
  constructor(code, message, attempts = [], available = []) {
    super(message); this.name = 'PrintError'; this.code = code; this.attempts = attempts; this.available = available;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class PrintRouter {
  /** @param {{printer: any, log?: (m: string) => void, tcpPort?: number, retryDelayMs?: number}} o */
  constructor({ printer, log = () => undefined, tcpPort = 9100, retryDelayMs = 700 }) {
    this.printer = printer; this.log = log; this.tcpPort = tcpPort; this.retryDelayMs = retryDelayMs;
  }

  /** Ищет очередь по имени без учёта регистра и пробелов по краям. */
  async resolve(name) {
    let list;
    try { list = await this.printer.list(); } catch (e) { return { item: null, list: [], listFailed: /** @type {Error} */ (e).message }; }
    const want = String(name ?? '').trim().toLowerCase();
    const item = list.find((p) => p.name === name) ?? list.find((p) => p.name.trim().toLowerCase() === want) ?? null;
    return { item, list };
  }

  /**
   * @param {string} name имя очереди Windows
   * @param {Buffer} data
   * @returns {Promise<{ok: true, printer: string, via: 'tcp'|'spooler', ms: number, attempts: any[]}>}
   */
  async send(name, data) {
    const t0 = Date.now();
    const { item, list, listFailed } = await this.resolve(name);
    if (listFailed) {
      // список очередей получить не удалось — не блокируем печать: пробуем спулер по указанному имени
      this.log(`[print] список принтеров недоступен (${listFailed}), отправляю на «${name}» напрямую`);
      await this.printer.print(name, data);
      return this.done(name, 'spooler', t0, [{ via: 'spooler', ok: true }]);
    }
    if (!item) {
      const available = list.filter((p) => !/pdf|xps|onenote|fax|virtual/i.test(p.name)).map((p) => p.name);
      throw new PrintError('not_found', `Принтер «${name}» не найден в Windows. Доступны: ${available.join(', ') || 'нет'}`, [], available);
    }
    const attempts = [];
    const ip = ipFromPort(item.port);
    const note = (via, e) => attempts.push({ via, ok: !e, error: e ? e.message : undefined, ms: Date.now() - t0 });

    if (ip) {
      try { await this.printer.relay(ip, this.tcpPort, data); note('tcp'); return this.done(item.name, 'tcp', t0, attempts); }
      catch (e) { note('tcp', e); this.log(`[print] ${item.name}: прямая отправка на ${ip}:${this.tcpPort} не удалась (${e.message}), пробую спулер Windows`); }
    }
    if (item.offline && !ip) {
      throw new PrintError('offline', `Принтер «${item.name}» отключён в Windows (работает автономно). Включите питание и кабель, затем снимите «Работать автономно».`, attempts);
    }
    for (let i = 0; i < 2; i++) {
      try { await this.printer.print(item.name, data); note('spooler'); return this.done(item.name, 'spooler', t0, attempts); }
      catch (e) { note('spooler', e); if (i === 0) await sleep(this.retryDelayMs); }
    }
    const last = attempts[attempts.length - 1];
    throw new PrintError('failed', `Не удалось отправить на «${item.name}»: ${last.error}`, attempts);
  }

  done(printer, via, t0, attempts) {
    const ms = Date.now() - t0;
    this.log(`[print] "${printer}" через ${via === 'tcp' ? 'сеть 9100' : 'спулер Windows'} ${ms} мс`);
    return { ok: /** @type {const} */ (true), printer, via, ms, attempts };
  }

  /** Состояние очереди: автономный режим, бумага, ошибки, число заданий (если ОС умеет сообщить). */
  async status(name) {
    const { item, list } = await this.resolve(name);
    if (!item) return { ok: false, found: false, available: list.map((p) => p.name) };
    const ip = ipFromPort(item.port);
    let os = null;
    if (typeof this.printer.status === 'function') os = await this.printer.status(item.name).catch(() => null);
    return { ok: !item.offline && !(os && os.problem), found: true, name: item.name, port: item.port, driver: item.driver, transport: ip ? 'tcp' : 'spooler', ip, offline: item.offline, os };
  }
}

module.exports = { PrintRouter, PrintError, ipFromPort };
