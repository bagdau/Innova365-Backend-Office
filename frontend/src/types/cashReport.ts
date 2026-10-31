export type CashReportPeriod = 'hoy' | 'semana' | 'mes';
export interface CashReportRow { name: string; count: number; total: number }
export interface CashReportClientRow { name: string; bills: number; positions: number; total: number }
export interface CashReport {
  period: CashReportPeriod; from: string; to: string; generatedAt: string;
  created: number; paid: number; cancelled: number; open: number; positions: number; orderedPositions: number; cancelledPositions: number;
  revenue: number; cancelAmount: number; average: number;
  methods: CashReportRow[]; staff: CashReportRow[]; categories: CashReportRow[]; service: CashReportRow[];
  departments: CashReportRow[]; clients: CashReportClientRow[];
}
