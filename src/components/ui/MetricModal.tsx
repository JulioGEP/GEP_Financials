import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Download, X } from 'lucide-react';
import { downloadAsExcelXlsx } from '../../lib/exportExcel';

interface MetricModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function MetricModal({ open, onClose, title, subtitle, children }: MetricModalProps) {
  const onDownload = () => {
    const modalPanel = document.querySelector('[data-metric-modal-body]');
    if (!modalPanel) return;
    const table = modalPanel.querySelector('table');
    if (!table) return;

    const headers = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent?.trim() || '');
    const rows = Array.from(table.querySelectorAll('tbody tr')).map((tr) =>
      Array.from(tr.querySelectorAll('td')).map((td) => td.textContent?.trim() || '')
    );
    downloadAsExcelXlsx(title.toLowerCase().replace(/\s+/g, '-'), headers, rows);
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-5xl max-h-[88vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gep-dark">{title}</h2>
            {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
          <button
            onClick={onDownload}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gep-dark border border-gray-200 hover:bg-gray-50 transition-colors inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar Excel
          </button>
          <button
            onClick={onClose}
            className="ml-4 mt-0.5 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div data-metric-modal-body className="overflow-y-auto flex-1 px-6 py-5">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
