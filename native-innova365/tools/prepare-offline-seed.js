'use strict';
/** Build a cafe-specific POS seed; keep the original dump outside the installer. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { startLocalRuntime, loadSecrets } = require('../lib/local-runtime');

const exec = promisify(execFile);
const root = path.join(__dirname, '..');
const source = process.argv[2];
const output = process.argv[3] || path.join(root, 'vendor', 'seed.sql');
if (!source || !fs.existsSync(source)) { process.stderr.write('Usage: node tools/prepare-offline-seed.js <source-dump.sql> [output-seed.sql]\n'); process.exit(2); }

(async () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'innova-seed-prep-'));
  const runtime = await startLocalRuntime({ pgDir: path.join(root, 'vendor', 'pgsql'), backendDir: path.join(root, '..', 'backend'),
    seedPath: path.resolve(source), dataDir: scratch, execPath: process.execPath });
  try {
    const { Client } = require(path.join(root, '..', 'backend', 'node_modules', 'pg'));
    const password = loadSecrets(scratch).dbPassword;
    const client = new Client({ host: '127.0.0.1', port: runtime.databasePort, user: 'innova', password, database: 'postgres' });
    await client.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM "TrabajoImpresion"');
      await client.query('DELETE FROM "Impresora"');
      await client.query('DELETE FROM "DesktopInstallation"');
      await client.query('DELETE FROM "OperacionIdem"');
      await client.query('DELETE FROM "RegistroActividad"');
      await client.query('UPDATE "Restaurante" SET "activationCodeHash"=NULL');
      await client.query('UPDATE "Usuario" SET "pinKey"=NULL, "pinAttempts"=0, "pinLockedUntil"=NULL');
      await client.query('COMMIT');
      const cafe = (await client.query('SELECT id,nombre FROM "Restaurante"')).rows;
      if (cafe.length !== 1) throw new Error('В установочном дампе должно быть ровно одно заведение');
      const tmp = path.resolve(output) + '.tmp';
      await exec(path.join(root, 'vendor', 'pgsql', 'bin', 'pg_dump.exe'),
        ['-h', '127.0.0.1', '-p', String(runtime.databasePort), '-U', 'innova', '-d', 'postgres', '-n', 'public', '--no-owner', '--no-privileges', '-f', tmp],
        { env: { ...process.env, PGPASSWORD: password }, windowsHide: true, timeout: 120_000 });
      // initdb already creates the public schema in the empty local database.
      const sql = fs.readFileSync(tmp, 'utf8');
      if (!sql.includes('CREATE SCHEMA public;')) throw new Error('Неверный формат экспорта public');
      fs.writeFileSync(tmp, sql.replace('CREATE SCHEMA public;', '-- public schema is created by initdb'));
      fs.renameSync(tmp, path.resolve(output));
      const manifest = { format: 1, restaurantId: cafe[0].id, restaurantName: cafe[0].nombre,
        seedSha256: crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex') };
      fs.writeFileSync(path.join(path.dirname(path.resolve(output)), 'offline-manifest.json'), JSON.stringify(manifest, null, 2));
      process.stdout.write(JSON.stringify({ restaurantId: cafe[0].id, restaurant: cafe[0].nombre, output: path.resolve(output), bytes: fs.statSync(output).size }) + '\n');
    } finally { await client.end(); }
  } finally { runtime.stop(); }
})().catch((error) => { process.stderr.write(String(error.stack || error) + '\n'); process.exitCode = 1; });
