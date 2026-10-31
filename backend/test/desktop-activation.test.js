const test = require('node:test');
const assert = require('node:assert/strict');
const { createActivationCode, activateDesktop } = require('../dist/controllers/desktop.controller');
const { desktopRestaurant } = require('../dist/controllers/desktop.controller');
const { prisma } = require('../dist/prisma');
const { createHash } = require('crypto');
const jwt = require('jsonwebtoken');
const { authMiddleware } = require('../dist/middleware/auth.middleware');

test('restaurant activation codes have twelve unambiguous random characters', () => {
  const codes = new Set(Array.from({ length: 200 }, createActivationCode));
  assert.equal(codes.size, 200);
  for (const code of codes) assert.match(code, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
});

test('an activated device cannot use another restaurant session', async (t) => {
  const old = prisma.desktopInstallation.findUnique;
  t.after(() => { prisma.desktopInstallation.findUnique = old; });
  prisma.desktopInstallation.findUnique = async () => ({ restauranteId: 'aisultan', revokedAt: null });
  process.env.JWT_SECRET = 'desktop-test-secret';
  const access = jwt.sign({ userId: 'u', restauranteId: 'other', rol: 'ADMIN', email: 'x@y.kz' }, process.env.JWT_SECRET);
  const req = { headers: { authorization: `Bearer ${access}`, 'x-innova-device': 'a'.repeat(64) } };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  let next = false;
  await authMiddleware(req, res, () => { next = true; });
  assert.equal(res.statusCode, 401);
  assert.equal(next, false);
});

test('device token resolves only an active restaurant and is never stored in plaintext', async (t) => {
  const old = prisma.desktopInstallation.findUnique;
  t.after(() => { prisma.desktopInstallation.findUnique = old; });
  const token = 'a'.repeat(64);
  let lookedUp;
  prisma.desktopInstallation.findUnique = async ({ where }) => { lookedUp = where.tokenHash; return { restauranteId: 'aisultan', revokedAt: null }; };
  assert.equal(await desktopRestaurant({ headers: { 'x-innova-device': token } }), 'aisultan');
  assert.equal(lookedUp, createHash('sha256').update(token).digest('hex'));
  assert.equal(await desktopRestaurant({ headers: { 'x-innova-device': 'bad' } }), false);
  prisma.desktopInstallation.findUnique = async () => ({ restauranteId: 'aisultan', revokedAt: new Date() });
  assert.equal(await desktopRestaurant({ headers: { 'x-innova-device': token } }), false);
});

test('revoked installation can be reactivated only for the same restaurant with a current code', async (t) => {
  const oldRestaurant = prisma.restaurante.findUnique;
  const oldFind = prisma.desktopInstallation.findUnique;
  const oldUpsert = prisma.desktopInstallation.upsert;
  t.after(() => { prisma.restaurante.findUnique = oldRestaurant; prisma.desktopInstallation.findUnique = oldFind; prisma.desktopInstallation.upsert = oldUpsert; });
  const code = 'ABCD-EFGH-JKLM';
  const codeHash = createHash('sha256').update(code.replaceAll('-', '')).digest('hex');
  prisma.restaurante.findUnique = async ({ where }) => where.activationCodeHash === codeHash ? { id: 'aisultan', nombre: 'Aisultan' } : null;
  let currentRestaurant = 'aisultan';
  prisma.desktopInstallation.findUnique = async () => ({ restauranteId: currentRestaurant, revokedAt: new Date() });
  let saved;
  prisma.desktopInstallation.upsert = async (query) => { saved = query; return {}; };
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  const req = { body: { code, installationId: '11111111-1111-4111-8111-111111111111' }, ip: '192.0.2.1' };
  const active = response();
  await activateDesktop(req, active);
  assert.equal(active.statusCode, 200);
  assert.equal(saved.update.revokedAt, null);
  assert.equal(saved.create.restauranteId, 'aisultan');
  assert.notEqual(saved.update.tokenHash, active.body.token);
  currentRestaurant = 'other';
  const blocked = response();
  await activateDesktop(req, blocked);
  assert.equal(blocked.statusCode, 409);
});
