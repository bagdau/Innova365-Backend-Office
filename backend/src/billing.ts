/** One calendar month in UTC. Month-end dates are clamped, never rolled into the following month. */
export function addBillingMonths(start: Date, months: number): Date {
  if (!Number.isInteger(months) || months < 1 || months > 24 || !Number.isFinite(start.getTime())) throw new Error('Неверный срок продления');
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + months;
  const day = Math.min(start.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return new Date(Date.UTC(year, month, day, start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds(), start.getUTCMilliseconds()));
}

export function billingStatus(paidUntil: Date | null, now = new Date()) {
  if (!paidUntil) return { state: 'unconfigured' as const, paidUntil: null, remainingMs: null, remainingDays: null };
  const remainingMs = paidUntil.getTime() - now.getTime();
  return { state: remainingMs > 0 ? 'active' as const : 'expired' as const,
    paidUntil: paidUntil.toISOString(), remainingMs: Math.max(0, remainingMs), remainingDays: Math.max(0, Math.ceil(remainingMs / 86_400_000)) };
}
