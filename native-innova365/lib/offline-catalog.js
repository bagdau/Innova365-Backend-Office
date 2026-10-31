// @ts-check
'use strict';
/** Safe catalog import from a plain PostgreSQL dump. No SQL from the dump is executed. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const TABLES = new Set(['Restaurante', 'Categoria', 'Producto', 'Mesa', 'Insumo', 'Receta', 'RecetaItem']);

/** @param {string} value */
function decodeCopy(value) {
  if (value === '\\N') return null;
  return value.replace(/\\([\\nrt])/g, (_all, char) => ({ '\\': '\\', n: '\n', r: '\r', t: '\t' })[char]);
}

/** @param {string} sql */
function parseCatalog(sql) {
  /** @type {Record<string, Record<string, string | null>[]>} */
  const out = Object.fromEntries([...TABLES].map((table) => [table, []]));
  /** @type {{name:string,columns:string[]}|null} */ let current = null;
  for (const line of sql.split(/\r?\n/)) {
    if (!current) {
      const match = /^COPY public\."([A-Za-z]+)" \((.+)\) FROM stdin;$/.exec(line);
      if (match && TABLES.has(match[1])) current = {
        name: match[1], columns: match[2].split(', ').map((column) => column.replace(/^"|"$/g, '')),
      };
      continue;
    }
    if (line === '\\.') { current = null; continue; }
    const values = line.split('\t');
    if (values.length !== current.columns.length) throw new Error(`Malformed COPY row: ${current.name}`);
    out[current.name].push(Object.fromEntries(current.columns.map((column, index) => [column, decodeCopy(values[index])])));
  }
  if (current) throw new Error(`Unterminated COPY: ${current.name}`);
  return out;
}

/** @param {string} dumpPath @param {string} databasePath */
function importCatalog(dumpPath, databasePath) {
  const bytes = fs.readFileSync(dumpPath);
  const rows = parseCatalog(bytes.toString('utf8'));
  if (rows.Restaurante.length !== 1) throw new Error('Ожидается дамп ровно одного заведения');
  const restaurant = { ...rows.Restaurante[0] };
  const restaurantId = restaurant.id;
  if (!restaurantId) throw new Error('У ресторана нет ID');
  delete restaurant.activationCodeHash;
  /** @type {Record<string, Record<string, string | null>[]>} */
  const filtered = { ...rows, Restaurante: [restaurant] };
  for (const name of ['Categoria', 'Producto', 'Mesa', 'Insumo', 'Receta']) {
    filtered[name] = rows[name].filter((row) => row.restauranteId === restaurantId);
  }
  const recipeIds = new Set(filtered.Receta.map((row) => row.id));
  filtered.RecetaItem = rows.RecetaItem.filter((row) => recipeIds.has(row.recetaId));
  if (fs.existsSync(databasePath)) throw new Error('Локальная база уже существует: импорт не должен перезаписывать продажи');
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  try {
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE catalog (kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(kind,id));
      CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
    const insert = db.prepare('INSERT INTO catalog (kind,id,data) VALUES (?,?,?)');
    const putMeta = db.prepare('INSERT INTO metadata (key,value) VALUES (?,?)');
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const [kind, items] of Object.entries(filtered)) {
        for (const row of items) {
          if (!row.id) throw new Error(`ID отсутствует: ${kind}`);
          insert.run(kind, row.id, JSON.stringify(row));
        }
      }
      putMeta.run('restaurantId', restaurantId);
      putMeta.run('sourceSha256', crypto.createHash('sha256').update(bytes).digest('hex'));
      putMeta.run('importedAt', new Date().toISOString());
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    return { restaurantId, counts: Object.fromEntries(Object.entries(filtered).map(([kind, items]) => [kind, items.length])) };
  } finally { db.close(); }
}

module.exports = { parseCatalog, importCatalog };
