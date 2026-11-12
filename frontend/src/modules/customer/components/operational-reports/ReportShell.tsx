import React from 'react';
import { ShieldCheck, Printer, Copy, Check, FileText } from 'lucide-react';

interface ReportShellProps {
  formatCode: string;
  formatName: string;
  documentId: string;
  issueDate: string;
  status: string;
  scope?: string;
  children: React.ReactNode;
  onPrint?: () => void;
}

export const ReportShell: React.FC<ReportShellProps> = ({
  formatCode,
  formatName,
  documentId,
  issueDate,
  status,
  scope = 'Fase CUSTOMER · Trazabilidad Asistencial',
  children,
  onPrint,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(documentId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedDate = React.useMemo(() => {
    try {
      const d = new Date(issueDate);
      return isNaN(d.getTime())
        ? issueDate
        : d.toLocaleDateString('es-PE', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
    } catch {
      return issueDate;
    }
  }, [issueDate]);

  return (
    <article
      className="report-document-sheet bg-[var(--pt-surface)] border border-[var(--pt-line)] rounded-2xl shadow-sm p-6 sm:p-8 space-y-6 max-w-5xl mx-auto transition-colors"
      style={{
        boxShadow: '0 4px 20px -2px rgba(28, 36, 32, 0.06)',
      }}
    >
      {/* ── ENCABEZADO DEL DOCUMENTO ── */}
      <header className="border-b border-[var(--pt-line)] pb-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center font-mono font-bold text-xs bg-[var(--pt-accent)] text-[var(--pt-accent-ink)] px-2.5 py-1 rounded-md tracking-wider">
                {formatCode}
              </span>
              <span className="text-xs font-semibold tracking-wider uppercase text-[var(--pt-muted)] font-mono">
                {scope}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-[var(--pt-ink)] font-serif tracking-tight leading-snug">
              {formatName}
            </h1>
            <p className="text-xs text-[var(--pt-muted)]">
              NEXOSALUD Odontología Integral · Sistema de Registro Operacional y Conciliación Dimensional
            </p>
          </div>

          <div className="flex flex-col sm:items-end gap-2 shrink-0">
            <div className="inline-flex items-center gap-2 bg-[var(--pt-sunken)] border border-[var(--pt-line)] px-3 py-1.5 rounded-lg text-xs font-mono">
              <span className="text-[var(--pt-muted)]">Folio:</span>
              <strong className="text-[var(--pt-ink)]">{documentId}</strong>
              <button
                type="button"
                onClick={handleCopyId}
                title="Copiar código de documento"
                className="text-[var(--pt-muted)] hover:text-[var(--pt-ink)] transition-colors p-0.5 ml-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-[var(--pt-accent-soft)] text-[var(--pt-accent)] border-[var(--pt-line-strong)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--pt-accent)]" />
                {status}
              </span>
              {onPrint && (
                <button
                  type="button"
                  onClick={onPrint}
                  className="no-print inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border border-[var(--pt-line-strong)] hover:bg-[var(--pt-sunken)] text-[var(--pt-ink)] transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir / PDF
                </button>
              )}
            </div>

            <span className="text-[11px] text-[var(--pt-muted)] font-mono">
              Emisión: {formattedDate}
            </span>
          </div>
        </div>
      </header>

      {/* ── CUERPO DOCUMENTAL ── */}
      <div className="space-y-6">{children}</div>
    </article>
  );
};
