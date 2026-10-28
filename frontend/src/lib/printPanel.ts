import { create } from 'zustand';
import type { Paper } from './print';

/** Задание для окна печати. server — если документ можно отправить на чековый принтер в ESC/POS (без окна браузера). */
export interface PrintJob {
  title: string;
  /** HTML содержимого (предпросмотр и печать через браузер) */
  html: string;
  paper: Paper;
  server?: { tipo: 'recibo' | 'cuenta' | 'cocina' | 'cierre'; pedidoId?: string; periodo?: 'hoy' | 'semana' | 'mes' };
  /** сразу начать печать при открытии (чек после оплаты) */
  autoPrint?: boolean;
}

interface PanelState {
  job: PrintJob | null;
  done: (() => void) | null;
  open: (job: PrintJob) => Promise<void>;
  close: () => void;
}

export const usePrintPanel = create<PanelState>((set, get) => ({
  job: null,
  done: null,
  open: (job) => new Promise<void>((resolve) => {
    get().done?.();
    set({ job, done: resolve });
  }),
  close: () => { get().done?.(); set({ job: null, done: null }); },
}));

/** Открывает собственное окно печати (предпросмотр, выбор принтера и размера). Вместо прямого window.print(). */
export const printHtml = (html: string, opts: { title: string; paper?: Paper; server?: PrintJob['server']; autoPrint?: boolean }): Promise<void> =>
  usePrintPanel.getState().open({ title: opts.title, html, paper: opts.paper ?? 'A4', server: opts.server, autoPrint: opts.autoPrint });

const QUICK_KEY = 'innova365-print-quick';
/** «Печатать сразу, без окна» — для кассира, которому не нужен предпросмотр на каждом чеке. */
export const getQuickPrint = (): boolean => { try { return localStorage.getItem(QUICK_KEY) === '1'; } catch { return false; } };
export const setQuickPrint = (v: boolean) => { try { v ? localStorage.setItem(QUICK_KEY, '1') : localStorage.removeItem(QUICK_KEY); } catch { /* ignore */ } };
