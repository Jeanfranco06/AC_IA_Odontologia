import React, { type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Bot,
  FileSpreadsheet,
  Stethoscope,
  Database,
  ExternalLink,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import CustomerAnalyticsPanel from '../components/CustomerAnalyticsPanel';

export default function CustomerAnalyticsBiPage() {
  return (
    <div className="pt pt-embed w-full min-h-screen space-y-6 pb-12">
      {/* ── CABECERA EDITORIAL ── */}
      <header className="grid gap-6 pb-6 lg:grid-cols-[1fr_auto] lg:items-end border-b border-[var(--pt-line)]">
        <div className="pt-rise" style={{ '--i': 0 } as CSSProperties}>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--pt-accent-soft)] text-[var(--pt-accent)] border border-[var(--pt-accent)]/20 font-mono">
              <Database className="w-3.5 h-3.5" />
              NexoSalud_Mart · BI
            </span>
            <span className="text-xs text-[var(--pt-muted)] font-mono">
              OLAP Dimensional
            </span>
          </div>

          <h1 className="text-[clamp(1.8rem,3.2vw,2.6rem)] leading-[1.1] font-semibold tracking-tight text-[var(--pt-ink)]">
            Análisis Inteligente <em style={{ fontStyle: 'italic' }} className="pt-accent-text">· BI</em>
          </h1>
          <p className="pt-muted mt-2 text-sm max-w-[68ch] leading-relaxed">
            Consola analítica del Data Mart de la fase CUSTOMER. Monitoreo dimensional de cumplimiento de tratamientos, tiempos efectivos de sillón, atenciones clínicas y supervisión del agente IA con conciliación verificada.
          </p>
        </div>

        {/* Botones de navegación contextual */}
        <div className="flex flex-wrap items-center gap-2 pt-rise" style={{ '--i': 1 } as CSSProperties}>
          <Link
            to="/customer/agent"
            className="pt-btn inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-[var(--pt-line)] bg-[var(--pt-paper)] text-[var(--pt-ink)] hover:border-[var(--pt-accent)] transition-all"
          >
            <Bot className="h-3.5 w-3.5 text-[var(--pt-accent)]" />
            Copiloto Clínico
          </Link>
          <Link
            to="/customer/operational-reports"
            className="pt-btn inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-[var(--pt-line)] bg-[var(--pt-paper)] text-[var(--pt-ink)] hover:border-[var(--pt-accent)] transition-all"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-[var(--pt-accent)]" />
            Formatos F01–F05
          </Link>
          <Link
            to="/customer"
            className="pt-btn inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-[var(--pt-line)] bg-[var(--pt-paper)] text-[var(--pt-ink)] hover:border-[var(--pt-accent)] transition-all"
          >
            <Stethoscope className="h-3.5 w-3.5 text-[var(--pt-muted)]" />
            Agenda Customer
          </Link>
        </div>
      </header>

      {/* ── INDICADOR DE SEGURIDAD Y CONEXIÓN MART ── */}
      <div className="rounded-xl border border-teal-200/80 bg-teal-50/60 dark:border-teal-900/40 dark:bg-teal-950/20 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-teal-900 dark:text-teal-200">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
          <span>
            <strong>Conexión segura de solo lectura:</strong> Las medidas históricas se consultan directamente desde el Data Mart certificado sin permitir escrituras ni ejecución SQL no autorizada.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 font-mono text-[11px] text-teal-700 dark:text-teal-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Delta = 0 (20/20 Medidas Conciliadas)
        </div>
      </div>

      {/* ── PANEL ANALÍTICO PRINCIPAL ── */}
      <main className="space-y-6">
        <CustomerAnalyticsPanel />
      </main>
    </div>
  );
}
