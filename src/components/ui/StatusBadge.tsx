import type { Estado } from '../../types/financial';

interface StatusBadgeProps {
  estado: Estado;
  vencimiento?: Date | null;
  pendiente?: number;
}

export function StatusBadge({ estado, vencimiento, pendiente }: StatusBadgeProps) {
  const e = (estado || '').toString().toLowerCase().trim();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isOverdue =
    !!vencimiento &&
    (pendiente ?? 0) > 0 &&
    vencimiento.getTime() < today.getTime();

  if (isOverdue) {
    return <span className="badge-red">Vencido</span>;
  }
  if (e === 'cobrado' || e === 'pagado') {
    return <span className="badge-green">{capitalize(estado)}</span>;
  }
  if (e === 'pendiente') {
    return <span className="badge-amber">Pendiente</span>;
  }
  if (e === 'vencido') {
    return <span className="badge-red">Vencido</span>;
  }
  return <span className="badge-gray">{capitalize(estado || '—')}</span>;
}

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
