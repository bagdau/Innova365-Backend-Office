import { cn } from '../../utils/cn';
import { t } from '../../i18n';

type BadgeVariant =
  | 'pendiente' | 'en_cocina' | 'en_preparacion' | 'listo' | 'entregado' | 'pagado' | 'cancelado'
  | 'libre' | 'ocupada' | 'en_espera'
  | 'ok' | 'bajo' | 'critico'
  | 'activo' | 'inactivo'
  | 'pedida' | 'parcial' | 'recibida' | 'cancelada';

/*
 * Paleta accesible para deuteranopia/protanopia:
 *   success → cyan  (#22D3EE)  nunca confundible con error
 *   error   → rosa  (#F472B6)  no depende canal verde
 *   warning → ámbar (#FBBF24)  visible todos los tipos
 *   info    → azul  (#60A5FA)
 *
 * Cada estado tiene símbolo gráfico (shape) ADEMÁS del color,
 * para usuarios que no distinguen colores.
 */
const badgeConfig: Record<BadgeVariant, { bg: string; text: string; label: string; symbol: string }> = {
  pagado:         { bg: 'rgb(var(--success-bg))', text: 'rgb(var(--success))', label: t('Pagado'),      symbol: '✓' },
  entregado:      { bg: 'rgb(var(--info-bg))', text: 'rgb(var(--info))', label: t('Entregado'),   symbol: '→' },
  listo:          { bg: 'rgb(var(--success-bg))', text: 'rgb(var(--success))', label: t('Listo'),       symbol: '●' },
  en_preparacion: { bg: 'rgb(var(--warning-bg))', text: 'rgb(var(--warning))', label: t('En prep.'),    symbol: '◐' },
  en_cocina:      { bg: 'rgb(var(--warning-bg))', text: 'rgb(var(--warning))', label: t('En cocina'),   symbol: '◐' },
  pendiente:      { bg: 'rgb(var(--muted))', text: 'rgb(var(--muted-foreground))', label: t('Pendiente'),   symbol: '○' },
  cancelado:      { bg: 'rgb(var(--error-bg))', text: 'rgb(var(--error))', label: t('Cancelado'),   symbol: '✕' },
  libre:          { bg: 'rgb(var(--success-bg))', text: 'rgb(var(--success))', label: t('Libre'),       symbol: '○' },
  ocupada:        { bg: 'rgb(var(--error-bg))', text: 'rgb(var(--error))', label: t('Ocupada'),     symbol: '●' },
  en_espera:      { bg: 'rgb(var(--warning-bg))', text: 'rgb(var(--warning))', label: t('En espera'),   symbol: '◔' },
  critico:        { bg: 'rgb(var(--error-bg))', text: 'rgb(var(--error))', label: t('Crítico'),     symbol: '!' },
  bajo:           { bg: 'rgb(var(--warning-bg))', text: 'rgb(var(--warning))', label: t('Bajo'),        symbol: '▲' },
  ok:             { bg: 'rgb(var(--success-bg))', text: 'rgb(var(--success))', label: 'OK',          symbol: '✓' },
  activo:         { bg: 'rgb(var(--success-bg))', text: 'rgb(var(--success))', label: t('Activo'),      symbol: '●' },
  pedida:         { bg: 'rgb(var(--info-bg))',    text: 'rgb(var(--info))',    label: t('Pedida'),     symbol: '○' },
  parcial:        { bg: 'rgb(var(--warning-bg))', text: 'rgb(var(--warning))', label: t('Parcial'),    symbol: '◐' },
  recibida:       { bg: 'rgb(var(--success-bg))', text: 'rgb(var(--success))', label: t('Recibida'),   symbol: '✓' },
  cancelada:      { bg: 'rgb(var(--error-bg))',   text: 'rgb(var(--error))',   label: t('Cancelada'),  symbol: '✕' },
  inactivo:       { bg: 'rgb(var(--muted))', text: 'rgb(var(--muted-foreground))', label: t('Inactivo'),    symbol: '○' },
};

interface Props {
  variant: BadgeVariant | string;
  className?: string;
  noSymbol?: boolean;
}

function normalize(v: string): BadgeVariant {
  return v.toLowerCase().replace(/ /g, '_') as BadgeVariant;
}

export function StatusBadge({ variant, className, noSymbol = false }: Props) {
  const key    = normalize(variant);
  const config = badgeConfig[key] ?? { bg: 'rgb(var(--muted))', text: 'rgb(var(--muted-foreground))', label: variant, symbol: '•' };
  return (
    <span
      className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold tracking-wide', className)}
      style={{ backgroundColor: config.bg, color: config.text }}
      aria-label={config.label}
    >
      {!noSymbol && <span aria-hidden="true" style={{ fontSize: '10px' }}>{config.symbol}</span>}
      {config.label}
    </span>
  );
}
