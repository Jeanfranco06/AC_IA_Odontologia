import React from 'react';
import { ShieldCheck, Database, CheckCircle2 } from 'lucide-react';

interface ReportTraceabilityStampProps {
  originDatabase?: string;
  martFactReference?: string;
  documentHash: string;
  verifiedBy?: string;
  validationTimestamp?: string;
  certificationTitle?: string;
  secondaryVerification?: React.ReactNode;
}

export const ReportTraceabilityStamp: React.FC<ReportTraceabilityStampProps> = ({
  originDatabase = 'NexoSaludDB (OLTP)',
  martFactReference,
  documentHash,
  verifiedBy = 'Dirección Médica y Auditoría Clínica',
  validationTimestamp,
  certificationTitle = 'Certificación Documental y Trazabilidad Criptográfica',
  secondaryVerification,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopyHash = () => {
    navigator.clipboard.writeText(documentHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedTimestamp = React.useMemo(() => {
    if (!validationTimestamp) return 'No especificado';
    try {
      const d = new Date(validationTimestamp);
      return isNaN(d.getTime()) ? validationTimestamp : d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    } catch {
      return validationTimestamp;
    }
  }, [validationTimestamp]);

  return (
    <footer className="report-traceability-block border-t border-[var(--pt-line)] pt-5 mt-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--pt-line)]/60 pb-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[var(--pt-accent)]" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--pt-ink)] font-mono">
            {certificationTitle}
          </h2>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[var(--pt-muted)] font-mono">
          <Database className="w-3.5 h-3.5 text-[var(--pt-muted)]" />
          <span>Origen: <strong className="text-[var(--pt-ink)]">{originDatabase}</strong></span>
          {martFactReference && (
            <span>· Mart: <code className="text-[var(--pt-accent)]">{martFactReference}</code></span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Sello de Validación */}
        <div className="rounded-xl border border-[var(--pt-line)] bg-[var(--pt-paper)] p-3.5 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--pt-ok-soft)] flex items-center justify-center shrink-0 text-[var(--pt-ok)] mt-0.5">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--pt-muted)] font-mono block">
              Validación y Responsabilidad Profesional
            </span>
            <p className="font-semibold text-[var(--pt-ink)] text-sm">
              {verifiedBy}
            </p>
            <p className="text-[11px] text-[var(--pt-muted)]">
              Registro auditado y validado conforme a la Ley General de Salud N° 26842 y directivas odontológicas institucionales.
            </p>
          </div>
        </div>

        {/* Huella Criptográfica */}
        <div className="rounded-xl border border-[var(--pt-line)] bg-[var(--pt-sunken)] p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--pt-muted)] font-mono">
              Huella Criptográfica SHA-256
            </span>
            <button
              type="button"
              onClick={handleCopyHash}
              className="no-print inline-flex items-center gap-1 text-[11px] font-mono text-[var(--pt-accent)] hover:underline"
            >
              {copied ? '¡Copiado!' : 'Copiar hash'}
            </button>
          </div>

          <div className="p-2 rounded-lg bg-[var(--pt-surface)] border border-[var(--pt-line)] font-mono text-[10px] text-[var(--pt-muted)] break-all select-all">
            {documentHash}
          </div>

          <div className="flex items-center justify-between text-[10px] text-[var(--pt-muted)] font-mono">
            <span>Algoritmo: SHA-256 / 256-bit</span>
            <span>Fecha Auditoría: {formattedTimestamp}</span>
          </div>
        </div>
      </div>

      {secondaryVerification && (
        <div className="pt-2">{secondaryVerification}</div>
      )}
    </footer>
  );
};
