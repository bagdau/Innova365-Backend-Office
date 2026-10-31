import { getCurrency } from './currency';

/** Предпросмотр суммы; окончательный расчёт делает сервер при сохранении заказа. */
export function serviceCharge(base: number, percent: number, decimals = getCurrency().decimals): number {
  const factor = 10 ** decimals;
  return Math.round(Math.round(base * 100) * percent * factor / 10_000) / factor;
}

export function addedServiceCharge(order: { total?: number; serviceAmount?: number; servicePercent?: number; serviceDecimals?: number }, addedBase: number): number {
  const oldCharge = Number(order.serviceAmount ?? 0);
  const oldBase = Number(order.total ?? 0) - oldCharge;
  return serviceCharge(oldBase + addedBase, Number(order.servicePercent ?? 0), order.serviceDecimals ?? getCurrency().decimals) - oldCharge;
}
