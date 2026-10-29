'use strict';
/** Кладёт VC++ runtime рядом с бинарниками PostgreSQL, чтобы initdb работал на ПК без Visual C++ Redistributable. */
const fs = require('node:fs');
const path = require('node:path');

const bin = path.join(__dirname, '..', 'vendor', 'pgsql', 'bin');
const system32 = path.join(process.env.SystemRoot || 'C:\Windows', 'System32');
const dlls = ['vcruntime140.dll', 'vcruntime140_1.dll', 'msvcp140.dll'];

if (!fs.existsSync(bin)) { console.error(`Нет ${bin}`); process.exit(1); }
for (const name of dlls) {
  const dest = path.join(bin, name);
  if (fs.existsSync(dest)) continue;
  const src = path.join(system32, name);
  if (!fs.existsSync(src)) { console.error(`Не найден ${src}. Установите Visual C++ Redistributable x64 на сборочной машине.`); process.exit(1); }
  fs.copyFileSync(src, dest);
  console.log(`скопирован ${name}`);
}
