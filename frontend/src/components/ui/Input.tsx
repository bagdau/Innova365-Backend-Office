import { cn } from '../../utils/cn';
import { InputHTMLAttributes, forwardRef } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  prefix?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(({ label, error, prefix, className, ...props }, ref) => {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{prefix}</span>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full bg-muted border border-border rounded-m px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground',
            'focus:outline-none focus:border-primary transition-colors',
            prefix && 'pl-8',
            error && 'border-error',
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
});

Input.displayName = 'Input';
