import { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { t } from '../../i18n';

interface Props {
  headers: string[];
  children: ReactNode;
  className?: string;
  emptyMessage?: string;
  isEmpty?: boolean;
  /** номера колонок, которые на телефоне скрываются (скрывайте и ячейки: className="hidden md:table-cell") */
  mobileHide?: number[];
}

export function TableWrapper({ headers, children, className, emptyMessage = t('Sin datos'), isEmpty, mobileHide = [] }: Props) {
  return (
    <div className={cn('overflow-x-auto rounded-l border border-border', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {headers.map((h, i) => (
              <th key={h} className={cn('text-left px-3 sm:px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap', mobileHide.includes(i) && 'hidden md:table-cell')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isEmpty ? (
            <tr>
              <td colSpan={headers.length} className="text-center py-12 text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          ) : children}
        </tbody>
      </table>
    </div>
  );
}

export function Tr({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <tr className={cn('border-b border-border hover:bg-muted/30 transition-colors', className)}>
      {children}
    </tr>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <td className={cn('px-3 sm:px-4 py-3 text-foreground whitespace-nowrap', className)}>
      {children}
    </td>
  );
}
