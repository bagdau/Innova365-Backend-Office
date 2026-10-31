'use strict';
const path = require('node:path');
const { startLocalRuntime } = require('../lib/local-runtime');
const { loadSecrets } = require('../lib/local-runtime');

const root = path.join(__dirname, '..');
const dataDir = process.argv[2];
if (!dataDir) { process.stderr.write('Usage: node tools/smoke-local-runtime.js <empty-test-data-dir>\n'); process.exit(2); }
(async () => {
  const options = {
    pgDir: path.join(root, 'vendor', 'pgsql'),
    backendDir: path.join(root, '..', 'backend'),
    seedPath: path.join(root, 'vendor', 'seed.sql'),
    manifestPath: path.join(root, 'vendor', 'offline-manifest.json'),
    dataDir: path.resolve(dataDir), execPath: process.execPath,
    log: (line) => process.stdout.write(line + '\n'),
  };
  let runtime = await startLocalRuntime(options);
  try {
    const health = await fetch(runtime.apiUrl + '/health').then((r) => r.json());
    if (!health.ok) throw new Error('Backend health check failed');
    const { Client } = require(path.join(options.backendDir, 'node_modules', 'pg'));
    const bcrypt = require(path.join(options.backendDir, 'node_modules', 'bcryptjs'));
    const secrets = loadSecrets(options.dataDir);
    const client = new Client({ host: '127.0.0.1', port: runtime.databasePort, user: 'innova', password: secrets.dbPassword, database: 'postgres' });
    await client.connect();
    const owner = (await client.query('SELECT id,email FROM "Usuario" WHERE rol=\'SUPERADMIN\' AND activo=true LIMIT 1')).rows[0];
    if (!owner) throw new Error('Owner missing in local data');
    const password = 'LocalSmoke-' + Date.now();
    await client.query('UPDATE "Usuario" SET "pinHash"=NULL WHERE id<>$1', [owner.id]);
    await client.query('UPDATE "Usuario" SET "passwordHash"=$1,"pinHash"=$2,"pinKey"=NULL WHERE id=$3', [bcrypt.hashSync(password, 10), bcrypt.hashSync('2468', 10), owner.id]);
    await client.query('UPDATE "Impresora" SET auto=false, activa=false');
    await client.end();
    const call = async (base, url, method = 'GET', body, token) => {
      const response = await fetch(base + url, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
      const result = await response.json();
      if (!response.ok) throw new Error(`${method} ${url}: ${response.status} ${JSON.stringify(result)}`);
      return result;
    };
    const login = await call(runtime.apiUrl, '/api/auth/login', 'POST', { email: owner.email, password });
    const pinLogin = await call(runtime.apiUrl, '/api/auth/login', 'POST', { pin: '2468' });
    if (pinLogin.user.id !== login.user.id) throw new Error('Local PIN mapped to another user');
    const products = await call(runtime.apiUrl, '/api/menu/productos', 'GET', null, login.accessToken);
    const product = products.find((item) => item.disponible && !item.requiereCocina) || products.find((item) => item.disponible);
    if (!product) throw new Error('No available product in local data');
    const order = await call(runtime.apiUrl, '/api/pedidos', 'POST', { tipo: 'PARA_LLEVAR', items: [{ productoId: product.id, cantidad: 2 }] }, login.accessToken);
    if (order.estado !== 'LISTO') await call(runtime.apiUrl, `/api/pedidos/${order.id}/estado`, 'PATCH', { estado: 'LISTO' }, login.accessToken);
    await call(runtime.apiUrl, `/api/pedidos/${order.id}/estado`, 'PATCH', { estado: 'ENTREGADO' }, login.accessToken);
    const paid = await call(runtime.apiUrl, `/api/pedidos/${order.id}/pago`, 'PATCH', { metodoPago: 'Efectivo', expectedTotal: Number(order.total) }, login.accessToken);
    if (paid.estado !== 'PAGADO') throw new Error('Order not paid');
    runtime.stop();
    runtime = await startLocalRuntime(options);
    const persisted = await call(runtime.apiUrl, `/api/pedidos/${order.id}`, 'GET', null, login.accessToken);
    if (persisted.estado !== 'PAGADO') throw new Error('Paid order missing after restart');
    process.stdout.write(JSON.stringify({ health: health.ok, pin: true, products: products.length, orderNumber: order.numero, total: Number(order.total), persisted: true }) + '\n');
  } finally { runtime.stop(); }
})().catch((error) => { process.stderr.write(String(error.stack || error) + '\n'); process.exitCode = 1; });
