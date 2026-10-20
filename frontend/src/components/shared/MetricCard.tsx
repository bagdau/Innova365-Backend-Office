import { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  iconBg?: string;
  alert?: boolean;
  className?: string;
}

export function MetricCard({ title, value, subtitle, icon, iconBg, alert, className }: Props) {
  return (
    <div className={cn('bg-card border rounded-l p-3 sm:p-5 flex flex-col gap-1.5 sm:gap-3 min-w-0', alert ? 'border-error/40' : 'border-border', className)}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] leading-tight sm:text-sm text-muted-foreground">{title}</span>
        <div className={cn('hidden sm:flex w-9 h-9 rounded-m items-center justify-center flex-shrink-0', iconBg ?? 'bg-muted')}>
          {icon}
        </div>
      </div>
      <div>
        <div className={cn('text-base min-[420px]:text-lg sm:text-2xl font-bold truncate', alert ? 'text-error' : 'text-foreground')}>{value}</div>
        {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
      </div>
    </div>
  );
}
