// Domain types for GEP Financials

export type Estado = 'Cobrado' | 'Pagado' | 'Pendiente' | 'Vencido' | string;

export interface Venta {
  fecha: Date | null;
  num: string;
  vencimiento: Date | null;
  cliente: string;
  descripcion: string;
  tags: string[];
  cuenta: string;
  formaPago: string;
  proyecto: string;
  subtotal: number;
  iva: number;
  retencion: number;
  empleados: number;
  recEq: number;
  total: number;
  cobrado: number;
  pendiente: number;
  estado: Estado;
  fechaCobro: Date | null;
}

export interface Gasto {
  fechaEmision: Date | null;
  num: string;
  numInterno: string;
  fechaContable: Date | null;
  vencimiento: Date | null;
  proveedor: string;
  descripcion: string;
  tags: string[];
  cuenta: string;
  proyecto: string;
  subtotal: number;
  iva: number;
  retencion: number;
  empleados: number;
  recEq: number;
  total: number;
  pagado: number;
  pendiente: number;
  estado: Estado;
  fechaPago: Date | null;
}

export interface FinancialData {
  ventas: Venta[];
  gastos: Gasto[];
  lastUpdated: Date;
  source: 'api' | 'mock';
}

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  metric?: string;
  action?: string;
  amount?: number;
}

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';
