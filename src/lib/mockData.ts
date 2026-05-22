// Realistic mock data for GEP Financials demo / fallback
import type { Venta, Gasto } from '../types/financial';

const CLIENTES = [
  'EMPRESA ABC SL',
  'CLIENTE XYZ SA',
  'SERVICIOS 123 SL',
  'CONSULTORA TÉCNICA SL',
  'DISTRIBUCIONES MEDITERRÁNEO SA',
  'INGENIERÍA NORTE SL',
  'GRUPO INDUSTRIAL IBÉRICO SA',
  'INMOBILIARIA CENTRAL SL',
  'TECNOLOGÍAS AVANZADAS SL',
  'COMERCIAL LEVANTE SL',
];

const PROVEEDORES = [
  'TELEFÓNICA ESPAÑA SA',
  'ENDESA ENERGÍA SA',
  'AMAZON WEB SERVICES',
  'MICROSOFT IBÉRICA SRL',
  'IBERDROLA CLIENTES SA',
  'MAPFRE SEGUROS',
  'BANCO SABADELL SA',
  'EL CORTE INGLÉS SA',
  'REPSOL COMERCIAL SA',
  'CORREOS Y TELÉGRAFOS SA',
  'GESTORÍA LÓPEZ SL',
  'OFFICE DEPOT IBÉRICA',
  'GOOGLE SPAIN SL',
  'LINKEDIN IRELAND LTD',
  'ADOBE SYSTEMS IBÉRICA',
];

const CUENTAS_GASTOS = [
  'ALQUILER',
  'SOFTWARE',
  'MARKETING',
  'SEGURO',
  'SUMINISTROS',
  'MANTENIMIENTO',
  'SERVICIOS PROFESIONALES',
  'TELEFONÍA',
  'COMBUSTIBLE',
  'MATERIAL OFICINA',
];

const CUENTAS_VENTAS = [
  'SERVICIOS PROFESIONALES',
  'CONSULTORÍA',
  'DESARROLLO PROYECTO',
  'MANTENIMIENTO',
  'FORMACIÓN',
];

const PROYECTOS = ['TRF', 'RD BSBD', 'RD CXB', 'TRF CXB', 'BSBD TJ', 'CXB MAD', 'TRF VAL'];

const TAGS_POOL = [
  ['#sabadell', '#vehic'],
  ['#marketing', '#digital'],
  ['#oficina'],
  ['#suministros'],
  ['#consultoria'],
  ['#desarrollo'],
  ['#cliente_premium'],
  ['#proyecto_estrategico'],
];

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

// Deterministic pseudo-random based on seed
function rand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function randInt(seed: number, min: number, max: number): number {
  return Math.floor(rand(seed) * (max - min + 1)) + min;
}

function randDate(seed: number, year: number): Date {
  const month = randInt(seed * 2 + 1, 0, 11);
  const day = randInt(seed * 3 + 7, 1, 28);
  return new Date(year, month, day);
}

function addDays(d: Date, days: number): Date {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + days);
  return nd;
}

const TODAY = new Date();
const YEAR = TODAY.getFullYear();

export function generateMockVentas(): Venta[] {
  const list: Venta[] = [];
  for (let i = 0; i < 36; i++) {
    const seed = i + 1;
    const fecha = randDate(seed, YEAR);
    const subtotal = randInt(seed * 5, 800, 18000);
    const iva = Math.round(subtotal * 0.21 * 100) / 100;
    const retencion = i % 4 === 0 ? Math.round(subtotal * 0.15 * 100) / 100 : 0;
    const total = subtotal + iva - retencion;
    const vencimiento = addDays(fecha, [30, 45, 60, 90][randInt(seed * 7, 0, 3)]);

    // Determine estado: ~55% cobrado, ~30% pendiente, ~15% vencido
    let estado: string = 'Cobrado';
    let cobrado = total;
    let pendiente = 0;
    let fechaCobro: Date | null = addDays(fecha, randInt(seed * 11, 20, 75));

    const r = rand(seed * 13);
    if (r < 0.30) {
      estado = 'Pendiente';
      cobrado = 0;
      pendiente = total;
      fechaCobro = null;
    } else if (r < 0.45) {
      estado = 'Pendiente';
      cobrado = 0;
      pendiente = total;
      fechaCobro = null;
      // Make vencimiento in the past => vencido
      const past = new Date(TODAY);
      past.setDate(past.getDate() - randInt(seed * 17, 5, 60));
      vencimiento.setTime(past.getTime());
    }

    list.push({
      fecha,
      num: `F2024-${String(i + 1).padStart(4, '0')}`,
      vencimiento,
      cliente: pick(CLIENTES, seed * 19),
      descripcion: `Servicios profesionales ${pick(PROYECTOS, seed * 23)}`,
      tags: pick(TAGS_POOL, seed * 29),
      cuenta: pick(CUENTAS_VENTAS, seed * 31),
      formaPago: pick(['Transferencia', 'Domiciliación', 'Pagaré', 'Cheque'], seed * 37),
      proyecto: pick(PROYECTOS, seed * 41),
      subtotal,
      iva,
      retencion,
      empleados: 0,
      recEq: 0,
      total,
      cobrado,
      pendiente,
      estado,
      fechaCobro,
    });
  }
  return list.sort((a, b) => (b.fecha?.getTime() || 0) - (a.fecha?.getTime() || 0));
}

export function generateMockGastos(): Gasto[] {
  const list: Gasto[] = [];
  for (let i = 0; i < 48; i++) {
    const seed = i + 100;
    const fechaEmision = randDate(seed, YEAR);
    const subtotal = randInt(seed * 5, 80, 6500);
    const iva = Math.round(subtotal * 0.21 * 100) / 100;
    const retencion = i % 7 === 0 ? Math.round(subtotal * 0.15 * 100) / 100 : 0;
    const total = subtotal + iva - retencion;
    const vencimiento = addDays(fechaEmision, [15, 30, 45, 60][randInt(seed * 7, 0, 3)]);

    let estado: string = 'Pagado';
    let pagado = total;
    let pendiente = 0;
    let fechaPago: Date | null = addDays(fechaEmision, randInt(seed * 11, 5, 40));

    const r = rand(seed * 13);
    if (r < 0.25) {
      estado = 'Pendiente';
      pagado = 0;
      pendiente = total;
      fechaPago = null;
    } else if (r < 0.35) {
      estado = 'Pendiente';
      pagado = 0;
      pendiente = total;
      fechaPago = null;
      const past = new Date(TODAY);
      past.setDate(past.getDate() - randInt(seed * 17, 3, 40));
      vencimiento.setTime(past.getTime());
    }

    list.push({
      fechaEmision,
      num: `G-${String(i + 1).padStart(5, '0')}`,
      numInterno: `INT-${1000 + i}`,
      fechaContable: fechaEmision,
      vencimiento,
      proveedor: pick(PROVEEDORES, seed * 19),
      descripcion: `Factura ${pick(CUENTAS_GASTOS, seed * 23)}`,
      tags: pick(TAGS_POOL, seed * 29),
      cuenta: pick(CUENTAS_GASTOS, seed * 31),
      proyecto: pick(PROYECTOS, seed * 41),
      subtotal,
      iva,
      retencion,
      empleados: 0,
      recEq: 0,
      total,
      pagado,
      pendiente,
      estado,
      fechaPago,
    });
  }
  return list.sort(
    (a, b) => (b.fechaEmision?.getTime() || 0) - (a.fechaEmision?.getTime() || 0)
  );
}
