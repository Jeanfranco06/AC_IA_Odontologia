const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export type ReportStage = 'buyer' | 'lead' | 'payer' | 'customer' | 'turned';

export interface ExecutiveReportCategory {
  categoryName: string;
  items: Array<{
    itemName: string;
    values: Record<string, number | null>;
    total: number | null;
  }>;
  subtotals: Record<string, number | null>;
  subtotalTotal: number | null;
  subtotalLabel: string;
}

export interface ExecutiveReportData {
  stage: 'BUYER' | 'LEAD' | 'PAYER' | 'CUSTOMER' | 'TURNED';
  reportTitle: string;
  period: string;
  metric: string;
  rowHeader: string;
  superHeader: string;
  columns: string[];
  totalColumnName: string;
  categories: ExecutiveReportCategory[];
  grandTotals: Record<string, number | null>;
  grandTotal: number | null;
  grandTotalLabel: string;
  isCurrency: boolean;
  generatedAt: string;
  sourceMart: string;
  /** 'all' o 'YYYY-MM'. Opcional para compatibilidad con backends anteriores. */
  periodKey?: string;
  /** Total del período anterior, si el período consultado admite comparación. */
  comparison?: { periodKey: string; period: string; grandTotal: number | null } | null;
}

export interface AllExecutiveReports {
  buyer: ExecutiveReportData;
  lead: ExecutiveReportData;
  payer: ExecutiveReportData;
  customer: ExecutiveReportData;
  turned?: ExecutiveReportData;
}

export interface MartStatus {
  status: string;
  source: string;
  driver: string;
  database: string;
  serverVersion?: string | null;
  checkedAt?: string;
  latestDataDate?: string | null;
  tables: Array<{ tabla: string; registros: number }>;
}

export interface ReportPeriodOption {
  value: string;
  label: string;
}

export const reportService = {
  sync: async (): Promise<{ success: boolean; message: string }> => {
    const res = await fetch(`${API_URL}/reports/sync`, { method: 'POST' });
    if (!res.ok) throw new Error('Error al sincronizar Data Mart');
    return res.json();
  },
  getStatus: async (): Promise<MartStatus> => {
    const res = await fetch(`${API_URL}/reports/status`);
    if (!res.ok) throw new Error('Error al consultar estado de NexoSalud_Mart');
    return res.json();
  },

  getPeriods: async (): Promise<ReportPeriodOption[]> => {
    const res = await fetch(`${API_URL}/reports/periods`);
    if (!res.ok) throw new Error('Error al consultar períodos disponibles');
    return res.json();
  },

  getAllExecutiveReports: async (
    measures?: { buyer?: string; lead?: string; payer?: string; customer?: string; turned?: string },
    period?: string
  ): Promise<AllExecutiveReports> => {
    const params = new URLSearchParams();
    if (measures) {
      if (measures.buyer) params.append('buyerMeasure', measures.buyer);
      if (measures.lead) params.append('leadMeasure', measures.lead);
      if (measures.payer) params.append('payerMeasure', measures.payer);
      if (measures.customer) params.append('customerMeasure', measures.customer);
      if (measures.turned) params.append('turnedMeasure', measures.turned);
    }
    if (period) params.append('period', period);
    const str = params.toString();
    const res = await fetch(`${API_URL}/reports/all-executive${str ? `?${str}` : ''}`);
    if (!res.ok) throw new Error('Error al obtener reportes ejecutivos');
    return res.json();
  },

  getExecutiveReport: async (stage: ReportStage, measure?: string, period?: string): Promise<ExecutiveReportData> => {
    const params = new URLSearchParams();
    if (measure) params.append('measure', measure);
    if (period) params.append('period', period);
    const str = params.toString();
    const res = await fetch(`${API_URL}/reports/executive/${stage}${str ? `?${str}` : ''}`);
    if (!res.ok) throw new Error(`Error al obtener reporte ejecutivo de ${stage}`);
    return res.json();
  },
};
