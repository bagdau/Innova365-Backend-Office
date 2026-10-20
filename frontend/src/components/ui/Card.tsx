import { cn } from '../../utils/cn';
import { HTMLAttributes } from 'react';

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-card border border-border rounded-l p-4', className)}
      {...props}
    >
      {children}
    </div>
  );
}
