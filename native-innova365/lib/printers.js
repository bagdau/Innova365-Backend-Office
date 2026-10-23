'use strict';
/** Классификация принтеров и «умный» выбор кассового (те же правила, что в print-agent/agent.ps1). Без зависимостей от Electron. */

const THERMAL = /(pos|xprinter|xp-|receipt|thermal|tm-|rp-?\d|bixolon|star|citizen|sam4s|rongta|gprinter|zjiang|(58|80)\s?mm)/i;
const VIRTUAL = /(pdf|xps|onenote|fax|microsoft|anydesk|virtual|send to)/i;

/** raw: { name, port, driver, isDefault, offline } → с признаками usb / thermal и оценкой пригодности для чеков. */
function classify(raw) {
  const name = String(raw.name ?? ''), port = String(raw.port ?? '');
  const usb = /^(USB|DOT4|COM|LPT)/i.test(port);
  const thermal = THERMAL.test(name);
  const virtual = VIRTUAL.test(name);
  let score = 0;
  if (thermal) score += 4;
  if (usb || /^(IP_|\d+\.)/i.test(port)) score += 2;
  if (raw.isDefault) score += 1;
  if (virtual) score -= 10;
  if (raw.offline) score -= 20;
  return { name, port, driver: String(raw.driver ?? ''), isDefault: !!raw.isDefault, offline: !!raw.offline, usb, thermal, score };
}

const classifyAll = (list) => (Array.isArray(list) ? list : []).map(classify);

/** Лучший кассовый принтер или null, если подходящего нет. */
function pickBest(items) {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  return best && best.score > -5 ? best : null;
}

/** Похож ли принтер на кассовый: по названию (POS/XP/Receipt/Thermal…) либо «Generic / Text Only» (универсальный драйвер для чековых принтеров). */
const looksLikeReceipt = (p) => !!p && (p.thermal || /(generic|text only)/i.test(p.name));

module.exports = { classify, classifyAll, pickBest, looksLikeReceipt };
