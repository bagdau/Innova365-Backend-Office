import { t } from '../i18n';

/** Способы оплаты (значение хранится в заказе как есть). «QR» заменил Yape / Plin. */
export const METODOS_PAGO = ['Efectivo', 'Tarjeta', 'QR', 'Transferencia'] as const;

const LEGACY: Record<string, string> = { 'Yape / Plin': 'QR', 'Yape/Plin': 'QR' };

/** Название способа оплаты на языке интерфейса (старые значения Yape/Plin показываются как QR). */
export const payLabel = (m: string): string => t(LEGACY[m] ?? m);
