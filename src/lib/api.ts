// API client for fetching financial data via Netlify function proxy
import { config } from '../config';
import type { BankAccount, FinancialData } from '../types/financial';
import { parseVentasCSV, parseGastosCSV } from './parseData';
import { generateMockVentas, generateMockGastos } from './mockData';

async function fetchSheet(sheet: 'ventas' | 'gastos'): Promise<string> {
  const res = await fetch(`${config.apiBase}/sheets?sheet=${sheet}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Sheet fetch failed: ${res.status}`);
  }
  const json = await res.json();
  if (!json.data) throw new Error('No data field in response');
  return json.data as string;
}

async function fetchBankAccounts(): Promise<BankAccount[]> {
  try {
    const res = await fetch(`${config.apiBase}/holded-bank`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const json = await res.json();
    if (!Array.isArray(json.data)) return [];
    return json.data as BankAccount[];
  } catch {
    return [];
  }
}

export async function fetchFinancialData(): Promise<FinancialData> {
  try {
    const [ventasCSV, gastosCSV, bankAccounts] = await Promise.all([
      fetchSheet('ventas'),
      fetchSheet('gastos'),
      fetchBankAccounts(),
    ]);
    const ventas = parseVentasCSV(ventasCSV);
    const gastos = parseGastosCSV(gastosCSV);

    // If parsing yielded nothing useful, fall back to mock so UI still renders.
    if (ventas.length === 0 && gastos.length === 0) {
      return {
        ventas: generateMockVentas(),
        gastos: generateMockGastos(),
        bankAccounts,
        lastUpdated: new Date(),
        source: 'mock',
      };
    }

    return {
      ventas,
      gastos,
      bankAccounts,
      lastUpdated: new Date(),
      source: 'api',
    };
  } catch (err) {
    console.warn('[GEP] API fetch failed, falling back to mock data:', err);
    return {
      ventas: generateMockVentas(),
      gastos: generateMockGastos(),
      bankAccounts: [],
      lastUpdated: new Date(),
      source: 'mock',
    };
  }
}
