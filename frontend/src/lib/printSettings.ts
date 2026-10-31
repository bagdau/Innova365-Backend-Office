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
    width: 80, title: 'Чек', showAddress: false, showPhone: false, showQr: true, showCashier: true,
    footer: 'Автоматизировано с помощью Innova365',
  },
  report: { width: 80, title: 'Итоговый отчёт' },
};

export function printSettings(value: PrintSettings | null | undefined): PrintSettings {
  return {
    receipt: { ...DEFAULT_PRINT_SETTINGS.receipt, ...value?.receipt },
    report: { ...DEFAULT_PRINT_SETTINGS.report, ...value?.report },
  };
}
