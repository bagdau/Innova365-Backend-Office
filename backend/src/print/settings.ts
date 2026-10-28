export interface PrintSettings {
  receipt: {
    width: number;
    title: string;
    showAddress: boolean;
    showPhone: boolean;
    showQr: boolean;
    showCashier: boolean;
    footer: string;
  };
  report: { width: number; title: string };
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  receipt: {
    width: 80,
    title: 'Чек',
    showAddress: false,
    showPhone: false,
    showQr: true,
    showCashier: true,
    footer: 'Автоматизировано с помощью Innova365',
  },
  report: { width: 80, title: 'Итоговый отчёт' },
};

/** Старые рестораны без настроек продолжают печатать с безопасными значениями по умолчанию. */
export function printSettings(value: unknown): PrintSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_PRINT_SETTINGS;
  const stored = value as Partial<PrintSettings>;
  return {
    receipt: { ...DEFAULT_PRINT_SETTINGS.receipt, ...stored.receipt },
    report: { ...DEFAULT_PRINT_SETTINGS.report, ...stored.report },
  };
}
