import { cn } from '../../utils/cn';

interface Props {
  /** Alto del icono en px */
  size?: number;
  /** Muestra el texto "Innova365" junto al icono */
  withText?: boolean;
  className?: string;
  textClassName?: string;
}

export function Logo({ size = 36, withText = true, className, textClassName }: Props) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <img src="/logo-mark.png" alt="Innova365" style={{ height: size, width: 'auto' }} draggable={false} />
      {withText && (
        <span className={cn('font-extrabold tracking-tight text-foreground leading-none', textClassName)} style={{ fontSize: size * 0.55 }}>
          Innova<span className="text-primary">365</span>
        </span>
      )}
    </span>
  );
}
