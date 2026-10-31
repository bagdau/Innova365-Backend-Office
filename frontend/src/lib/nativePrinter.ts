export interface NativePrinter {
  name: string;
  displayName: string;
  isDefault: boolean;
}

interface NativePrinterBridge {
  isDesktop: boolean;
  systemPrinters?: () => Promise<{ ok: boolean; printers?: NativePrinter[]; error?: string }>;
  printDocument?: (html: string, deviceName: string, page: { widthMm: number; heightMm: number }) => Promise<{ ok: boolean; error?: string }>;
}

declare global {
  interface Window { innovaNative?: NativePrinterBridge }
}

const KEY = 'innova365-native-printer';
export const hasNativePrinter = () => !!window.innovaNative?.systemPrinters && !!window.innovaNative?.printDocument;
export const getNativePrinter = (): string | null => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const setNativePrinter = (name: string) => { try { localStorage.setItem(KEY, name); } catch { /* ignore */ } };

export async function systemPrinters(): Promise<NativePrinter[]> {
  const result = await window.innovaNative?.systemPrinters?.();
  if (!result?.ok) throw new Error(result?.error || 'Windows printer list unavailable');
  return result.printers ?? [];
}

export async function printNativeDocument(html: string, deviceName: string, page: { widthMm: number; heightMm: number }): Promise<void> {
  const result = await window.innovaNative?.printDocument?.(html, deviceName, page);
  if (!result?.ok) throw new Error(result?.error || 'Windows printing failed');
}
