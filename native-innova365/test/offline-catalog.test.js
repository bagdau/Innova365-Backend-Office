'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { importCatalog } = require('../lib/offline-catalog');

test('imports only one restaurant catalog; excludes secrets, users and previous sales', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'innova-seed-'));
  const dump = path.join(dir, 'dump.sql');
  const output = path.join(dir, 'pos.sqlite');
  fs.writeFileSync(dump, [
    'COPY public."Restaurante" (id, nombre, "activationCodeHash") FROM stdin;',
    'r1\tCafe\\tOne\tsecret-hash', '\\.',
    'COPY public."Categoria" (id, nombre, "restauranteId") FROM stdin;',
    'c1\tЕда\tr1', '\\.',
    'COPY public."Usuario" (id, "passwordHash") FROM stdin;',
    'u1\tsecret-password', '\\.',
    'COPY public."Pedido" (id, total) FROM stdin;',
    'p1\t500', '\\.',
  ].join('\n'));
  try {
    const result = importCatalog(dump, output);
    assert.deepEqual(result.counts, { Restaurante: 1, Categoria: 1, Producto: 0, Mesa: 0, Insumo: 0, Receta: 0, RecetaItem: 0 });
    const db = new DatabaseSync(output);
    try {
      const rows = db.prepare('SELECT kind,data FROM catalog ORDER BY kind').all();
      assert.equal(rows.length, 2);
      assert.equal(JSON.parse(rows[1].data).nombre, 'Cafe\tOne');
      assert.doesNotMatch(rows[1].data, /secret/);
    } finally { db.close(); }
    assert.throws(() => importCatalog(dump, output), /уже существует/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
