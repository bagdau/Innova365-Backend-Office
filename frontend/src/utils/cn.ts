import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { t, locale } from '../i18n';
import { fmtMoney } from '../lib/currency';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = fmtMoney;

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(date));
}

export function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('Ahora');
  if (mins < 60) return t('Hace {n} min', { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('Hace {n} ч', { n: hrs });
  return t('Hace {n} д', { n: Math.floor(hrs / 24) });
}

export function getInitials(nombre: string): string {
  return nombre.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

export function rolColor(rol: string): string {
  switch (rol) {
    case 'SUPERADMIN': return 'text-white bg-primary';
    case 'ADMIN': return 'text-primary bg-primary-soft';
    case 'MESERO': return 'text-info bg-info-bg';
    case 'COCINERO': return 'text-warning bg-warning-bg';
    case 'CAJERO': return 'text-success bg-success-bg';
    case 'REPARTIDOR': return 'text-error bg-error-bg';
    default: return 'text-muted-foreground bg-muted';
  }
}

export function rolLabel(rol: string): string {
  const map: Record<string, string> = {
    SUPERADMIN: t('Propietario'), ADMIN: t('Admin'), MESERO: t('Mesero'), COCINERO: t('Cocinero'), CAJERO: t('Cajero'), REPARTIDOR: t('Repartidor'),
  };
  return map[rol] ?? rol;
}
