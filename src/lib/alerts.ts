// Alert and risk detection engine for GEP Financials
import type { FinancialData, Alert, RiskLevel } from '../types/financial';
import {
  overdueReceivables,
  overduePayables,
  upcomingReceivables,
  upcomingPayables,
  projectedCashFlow,
  topClientes,
  daysBetween,
} from './calculations';
import { formatCurrency } from './parseData';

export function generateAlerts(data: FinancialData, now = new Date()): Alert[] {
  const alerts: Alert[] = [];
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // CRITICAL: overdue receivables
  const odReceivables = overdueReceivables(data, now);
  if (odReceivables.length > 0) {
    const totalOverdue = odReceivables.reduce((acc, v) => acc + v.pendiente, 0);
    const maxDays = Math.max(
      ...odReceivables.map((v) => daysBetween(v.vencimiento!, today))
    );
    alerts.push({
      id: 'overdue-receivables',
      severity: 'critical',
      title: 'Facturas de clientes vencidas',
      description: `${odReceivables.length} factura(s) de clientes están vencidas y no cobradas. La factura más antigua tiene ${maxDays} días de retraso.`,
      metric: formatCurrency(totalOverdue),
      action: 'Contactar a los clientes en mora y enviar recordatorios de pago.',
      amount: totalOverdue,
    });
  }

  // CRITICAL: overdue payables
  const odPayables = overduePayables(data, now);
  if (odPayables.length > 0) {
    const totalOverdue = odPayables.reduce((acc, g) => acc + g.pendiente, 0);
    alerts.push({
      id: 'overdue-payables',
      severity: 'critical',
      title: 'Pagos a proveedores vencidos',
      description: `${odPayables.length} factura(s) de proveedores vencidas sin pagar. Riesgo de impacto en relaciones comerciales.`,
      metric: formatCurrency(totalOverdue),
      action: 'Priorizar pagos vencidos según importancia del proveedor.',
      amount: totalOverdue,
    });
  }

  // WARNING: receivables due in next 15 days
  const next15Recv = upcomingReceivables(data, 15, now);
  if (next15Recv.length > 0) {
    const total = next15Recv.reduce((acc, v) => acc + v.pendiente, 0);
    alerts.push({
      id: 'upcoming-receivables-15',
      severity: 'warning',
      title: 'Cobros previstos en 15 días',
      description: `${next15Recv.length} factura(s) con vencimiento en los próximos 15 días. Realizar seguimiento proactivo.`,
      metric: formatCurrency(total),
      action: 'Confirmar con clientes el cumplimiento del calendario de pagos.',
      amount: total,
    });
  }

  // WARNING: payables due in next 15 days
  const next15Pay = upcomingPayables(data, 15, now);
  if (next15Pay.length > 0) {
    const total = next15Pay.reduce((acc, g) => acc + g.pendiente, 0);
    alerts.push({
      id: 'upcoming-payables-15',
      severity: 'warning',
      title: 'Pagos previstos en 15 días',
      description: `${next15Pay.length} factura(s) de proveedores con vencimiento en los próximos 15 días.`,
      metric: formatCurrency(total),
      action: 'Asegurar disponibilidad de tesorería para los próximos vencimientos.',
      amount: total,
    });
  }

  // WARNING: negative projected cash flow in 30/60/90 days
  const projection = projectedCashFlow(data, 3, now);
  projection.forEach((p, idx) => {
    if (p.cumulative < 0) {
      alerts.push({
        id: `cashflow-negative-${idx}`,
        severity: 'warning',
        title: `Flujo de caja negativo proyectado: ${p.label}`,
        description: `La proyección de tesorería para ${p.label} muestra un saldo negativo. Hay que tomar medidas correctivas.`,
        metric: formatCurrency(p.cumulative),
        action: 'Acelerar cobros pendientes y/o renegociar plazos con proveedores.',
        amount: p.cumulative,
      });
    }
  });

  // INFO: client concentration risk (YTD active ventas up to today)
  const ytdStart = new Date(today.getFullYear(), 0, 1);
  const ytdVentas = data.ventas.filter(
    (v) => v.estado !== 'Anulado' && v.fecha && v.fecha >= ytdStart && v.fecha <= today
  );
  const totalRevenue = ytdVentas.reduce((acc, v) => acc + v.total, 0);
  const top = topClientes(ytdVentas, 1);
  if (top.length > 0 && totalRevenue > 0) {
    const share = top[0].value / totalRevenue;
    if (share > 0.4) {
      alerts.push({
        id: 'client-concentration',
        severity: 'info',
        title: 'Concentración de clientes elevada',
        description: `El cliente principal "${top[0].name}" representa el ${(share * 100).toFixed(
          1
        )}% de los ingresos. Riesgo de dependencia.`,
        metric: `${(share * 100).toFixed(1)}%`,
        action: 'Diversificar la cartera de clientes para reducir el riesgo de concentración.',
      });
    }
  }

  // INFO: expense trend
  const last3 = monthsGastosAvg(data, now, 0, 3);
  const prev3 = monthsGastosAvg(data, now, 3, 3);
  if (prev3 > 0) {
    const growth = (last3 - prev3) / prev3;
    if (growth > 0.2) {
      alerts.push({
        id: 'expense-trend',
        severity: 'info',
        title: 'Tendencia de gastos al alza',
        description: `La media de gastos en los últimos 3 meses ha aumentado un ${(growth * 100).toFixed(
          1
        )}% respecto a los 3 meses anteriores.`,
        metric: `+${(growth * 100).toFixed(1)}%`,
        action: 'Revisar partidas de gasto y validar si el incremento es estructural o puntual.',
      });
    }
  }

  // INFO: recurring large suppliers
  const recurring = detectRecurringSuppliers(data, now);
  if (recurring.length > 0) {
    const total = recurring.reduce((acc, r) => acc + r.amount, 0);
    alerts.push({
      id: 'recurring-suppliers',
      severity: 'info',
      title: 'Proveedores con pagos recurrentes',
      description: `${recurring.length} proveedor(es) generan pagos recurrentes significativos: ${recurring
        .slice(0, 3)
        .map((r) => r.name)
        .join(', ')}.`,
      metric: formatCurrency(total),
      action: 'Negociar mejores condiciones o consolidar proveedores recurrentes.',
      amount: total,
    });
  }

  return alerts;
}

function monthsGastosAvg(
  data: FinancialData,
  now: Date,
  offsetMonths: number,
  span: number
): number {
  const totals: number[] = [];
  for (let i = 0; i < span; i++) {
    const ref = new Date(now.getFullYear(), now.getMonth() - offsetMonths - i, 1);
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    const total = data.gastos
      .filter((g) => g.fechaEmision && g.fechaEmision >= start && g.fechaEmision <= end)
      .reduce((acc, g) => acc + g.total, 0);
    totals.push(total);
  }
  if (!totals.length) return 0;
  return totals.reduce((a, b) => a + b, 0) / totals.length;
}

function detectRecurringSuppliers(
  data: FinancialData,
  now: Date
): { name: string; amount: number; count: number }[] {
  const today = new Date(now);
  today.setHours(23, 59, 59, 999);
  const map = new Map<string, { name: string; amount: number; count: number }>();
  for (const g of data.gastos) {
    if (!g.proveedor || g.estado === 'Anulado') continue;
    if (!g.fechaEmision || g.fechaEmision > today) continue;
    const entry = map.get(g.proveedor) || { name: g.proveedor, amount: 0, count: 0 };
    entry.amount += g.total;
    entry.count += 1;
    map.set(g.proveedor, entry);
  }
  return Array.from(map.values())
    .filter((e) => e.count >= 3 && e.amount > 1000)
    .sort((a, b) => b.amount - a.amount);
}

export function computeRiskScore(alerts: Alert[]): RiskLevel {
  const criticals = alerts.filter((a) => a.severity === 'critical').length;
  const warnings = alerts.filter((a) => a.severity === 'warning').length;
  if (criticals >= 3) return 'Critical';
  if (criticals >= 1) return 'High';
  if (warnings >= 3) return 'Medium';
  if (warnings >= 1) return 'Medium';
  return 'Low';
}
