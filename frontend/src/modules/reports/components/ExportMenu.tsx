import { useState, type ReactNode } from 'react';
import { ChevronDown, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { toast } from '@/shared/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { downloadCsv, downloadPdf, type ExportSection } from '../lib/export';
import type { DisplayMode } from '../lib/matrix';

interface ExportMenuProps {
  /** Se resuelve al abrir el menú para usar siempre los datos vigentes. */
  getSections: () => ExportSection[];
  mode?: DisplayMode;
  label?: string;
  scopeLabel: string;
  triggerClassName: string;
  icon: ReactNode;
  disabled?: boolean;
}

export function ExportMenu({
  getSections,
  mode = 'absolute',
  label = 'Exportar',
  scopeLabel,
  triggerClassName,
  icon,
  disabled,
}: ExportMenuProps) {
  const [busy, setBusy] = useState<'csv' | 'pdf' | null>(null);

  const run = async (kind: 'csv' | 'pdf') => {
    const sections = getSections();
    if (sections.length === 0) return;
    try {
      setBusy(kind);
      if (kind === 'csv') downloadCsv(sections, mode);
      else await downloadPdf(sections, mode);
      toast({
        variant: 'success',
        title: kind === 'csv' ? 'CSV descargado' : 'PDF ejecutivo generado',
        description: `${scopeLabel} · ${sections[0].report.period}`,
      });
    } catch (err) {
      console.error('Error exportando reporte:', err);
      toast({
        variant: 'destructive',
        title: 'No se pudo exportar',
        description: 'Inténtalo nuevamente en unos segundos.',
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={triggerClassName} disabled={disabled || busy !== null}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
        <span>{busy ? 'Generando…' : label}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuLabel>{scopeLabel}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => run('pdf')}>
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <span className="flex flex-col">
            <span className="font-medium">PDF ejecutivo</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Documento listo para dirección</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run('csv')}>
          <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <span className="flex flex-col">
            <span className="font-medium">CSV</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Datos tabulares para Excel o BI</span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
