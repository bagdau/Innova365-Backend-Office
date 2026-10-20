import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useQuery } from '@tanstack/react-query';
import { reportesService } from '../../services/reportes.service';
import { currencyCode } from '../../lib/currency';
import { t } from '../../i18n';

/** QR для оплаты клиентом: содержимое берётся из «Настройки → Оплата и валюта». */
export function PayQr({ total, numero }: { total: number; numero?: number }) {
  const { data: rest } = useQuery<{ nombre: string; qrPago?: string | null }>({ queryKey: ['restaurante'], queryFn: reportesService.getRestaurante, staleTime: 300_000 });
  const [img, setImg] = useState('');
  const base = rest?.qrPago?.trim();
  const text = base
    ? base.replace(/\{total\}/g, String(total)).replace(/\{numero\}/g, String(numero ?? '')).replace(/\{moneda\}/g, currencyCode()).replace(/\{restaurante\}/g, rest?.nombre ?? '')
    : '';

  useEffect(() => {
    let off = false;
    if (!text) { setImg(''); return; }
    QRCode.toDataURL(text, { margin: 1, width: 240, errorCorrectionLevel: 'M' }).then((u) => { if (!off) setImg(u); }).catch(() => setImg(''));
    return () => { off = true; };
  }, [text]);

  if (!base) {
    return <p className="text-sm text-muted-foreground bg-muted rounded-m p-3">{t('QR para pago no configurado. El propietario o administrador puede indicarlo en «Configuración → Pagos y moneda».')}</p>;
  }
  return (
    <div className="flex flex-col items-center gap-2 bg-white rounded-l p-3">
      {img && <img src={img} alt="QR" width={200} height={200} />}
      <p className="text-xs text-neutral-600">{t('Muestra el QR al cliente para pagar')}</p>
    </div>
  );
}
