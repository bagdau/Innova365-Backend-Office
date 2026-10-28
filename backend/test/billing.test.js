const test = require('node:test');
const assert = require('node:assert/strict');
const { addBillingMonths, billingStatus } = require('../dist/billing');

test('billing month clamps month-end in UTC', () => {
  assert.equal(addBillingMonths(new Date('2026-01-31T10:00:00.000Z'), 1).toISOString(), '2026-02-28T10:00:00.000Z');
  assert.equal(addBillingMonths(new Date('2028-01-31T10:00:00.000Z'), 1).toISOString(), '2028-02-29T10:00:00.000Z');
  assert.throws(() => addBillingMonths(new Date(), 0));
});

test('billing timer is explicit about unconfigured and expired periods', () => {
  const now = new Date('2026-10-29T00:00:00Z');
  assert.equal(billingStatus(null, now).state, 'unconfigured');
  assert.equal(billingStatus(new Date('2026-10-30T00:00:00Z'), now).remainingDays, 1);
  assert.equal(billingStatus(new Date('2026-10-28T00:00:00Z'), now).state, 'expired');
});
