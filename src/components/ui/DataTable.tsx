import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from 'lucide-react';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  accessor: (row: T) => any;
  render?: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  pageSize?: number;
  exportFileName?: string;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  data,
  pageSize = 50,
  exportFileName = 'export.csv',
  emptyMessage = 'No hay datos disponibles',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [visible, setVisible] = useState(pageSize);

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return data;
    const copy = [...data];
    copy.sort((a, b) => {
      const va = col.accessor(a);
      const vb = col.accessor(b);
      const cmp = compare(va, vb);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [data, sortKey, sortDir, columns]);

  const visibleRows = sorted.slice(0, visible);
  const hasMore = sorted.length > visible;

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function exportCSV() {
    const header = columns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(',');
    const rows = sorted.map((r) =>
      columns
        .map((c) => {
          const v = c.accessor(r);
          let s = '';
          if (v instanceof Date) {
            s = formatDateForCSV(v);
          } else if (v === null || v === undefined) {
            s = '';
          } else {
            s = String(v);
          }
          return `"${s.replace(/"/g, '""')}"`;
        })
        .join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gep-dark">
          {sorted.length} registro{sorted.length !== 1 ? 's' : ''}
        </span>
        <button
          type="button"
          onClick={exportCSV}
          className="btn-secondary text-xs"
          aria-label="Exportar a CSV"
        >
          <Download className="w-3.5 h-3.5" />
          Exportar CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-2.5 text-xs uppercase tracking-wider font-semibold text-gray-600 ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  } ${col.sortable !== false ? 'cursor-pointer select-none' : ''}`}
                  onClick={() => col.sortable !== false && toggleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable !== false && (
                      sortKey === col.key ? (
                        sortDir === 'asc' ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visibleRows.map((row, i) => (
                <tr
                  key={i}
                  className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-2.5 text-sm text-gep-dark border-t border-gray-100 ${
                        col.align === 'right'
                          ? 'text-right tabular-nums'
                          : col.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                      } ${col.className || ''}`}
                    >
                      {col.render ? col.render(row) : defaultRender(col.accessor(row))}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div className="px-4 py-3 border-t border-gray-100 text-center">
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => setVisible((v) => v + pageSize)}
          >
            Ver más ({sorted.length - visible} restantes)
          </button>
        </div>
      )}
    </div>
  );
}

function defaultRender(value: any): ReactNode {
  if (value === null || value === undefined) return '—';
  if (value instanceof Date) return formatDateForCSV(value);
  return String(value);
}

function formatDateForCSV(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function compare(a: any, b: any): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'es');
}
