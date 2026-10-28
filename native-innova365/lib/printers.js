'use strict';
/** Классификация принтеров и «умный» выбор кассового (те же правила, что в print-agent/agent.ps1). Без зависимостей от Electron. */

const THERMAL = /(pos|xprinter|xp-|receipt|thermal|tm-|rp-?\d|bixolon|star|citizen|sam4s|rongta|gprinter|zjiang|(58|80)\s?mm|(58|80)\s?(normal|series|printer))/i;
const VIRTUAL = /(pdf|xps|onenote|fax|microsoft|anydesk|virtual|send to)/i;

/** raw: { name, port, driver, isDefault, offline } → с признаками usb / thermal и оценкой пригодности для чеков. */
function classify(raw) {
  const name = String(raw.name ?? ''), port = String(raw.port ?? '');
  const usb = /^(USB|DOT4|COM|LPT)/i.test(port);
  // очереди часто называют по-своему («check», «kuhnya», «bar»), а модель видна только в драйвере
  const thermal = THERMAL.test(name) || THERMAL.test(String(raw.driver ?? ''));
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

/** Похож ли принтер на кассовый: по названию (POS/XP/Receipt/Thermal…) либо «Generic / Text Only» (универсальный драйвер для чековых принтеров). */
const looksLikeReceipt = (p) => !!p && (p.thermal || /(generic|text only)/i.test(p.name) || /(generic|text only)/i.test(p.driver ?? ''));

/** Автовыбор не отправляет ESC/POS-команды на обычный офисный принтер. */
function pickBest(items) {
  const sorted = [...items].filter((p) => !p.offline && p.score > -5 && looksLikeReceipt(p)).sort((a, b) => b.score - a.score);
  return sorted[0] ?? null;
}

module.exports = { classify, classifyAll, pickBest, looksLikeReceipt };
