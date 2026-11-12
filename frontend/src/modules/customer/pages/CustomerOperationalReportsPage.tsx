import React, { useEffect, useState } from 'react';
import { staffAuthService } from '@/shared/services/staffAuthService';
import { F01TreatmentFollowupView } from '../components/operational-reports/F01TreatmentFollowupView';
import { F02SessionScheduleView } from '../components/operational-reports/F02SessionScheduleView';
import { F03ClinicalAttentionView } from '../components/operational-reports/F03ClinicalAttentionView';
import { F04AiAuditLogView } from '../components/operational-reports/F04AiAuditLogView';
import { F05TreatmentClosureView } from '../components/operational-reports/F05TreatmentClosureView';
import {
  FileText,
  CalendarCheck,
  ClipboardList,
  Bot,
  Award,
  Printer,
  RefreshCw,
  Search,
  Maximize2,
  ChevronDown,
} from 'lucide-react';

export default function CustomerOperationalReportsPage() {
  const [activeTab, setActiveTab] = useState<'F01' | 'F02' | 'F03' | 'F04' | 'F05'>('F01');
  const [catalog, setCatalog] = useState<{
    treatments: Array<{ id: number; patientName: string; dni: string | null; serviceName: string; status: string; totalSessions: number; completedSessions: number }>;
    sessions: Array<{ id: number; treatmentId: number; sessionNumber: number; patientName: string; serviceName: string; professional: string; date: string; statusProg: string; statusAssist: string }>;
    attentions: Array<{ id: number; treatmentId: number | null; sessionId: number | null; patientName: string; serviceName: string; professional: string; date: string; proceduresCount: number }>;
  } | null>(null);

  const [selectedTreatmentId, setSelectedTreatmentId] = useState<number | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [selectedAttentionId, setSelectedAttentionId] = useState<number | null>(null);

  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const endpoint = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api') + '/customer/operational-reports';

  // Cargar catálogo inicial
  const loadCatalog = async () => {
    setCatalogLoading(true);
    setError(null);
    try {
      const res = await fetch(`${endpoint}/catalog`, {
        headers: {
          Authorization: `Bearer ${staffAuthService.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) throw new Error('No fue posible cargar el catálogo de registros operacionales.');
      const data = await res.json();
      setCatalog(data);

      if (data.treatments?.length > 0 && !selectedTreatmentId) {
        setSelectedTreatmentId(data.treatments[0].id);
      }
      if (data.sessions?.length > 0 && !selectedSessionId) {
        setSelectedSessionId(data.sessions[0].id);
      }
      if (data.attentions?.length > 0 && !selectedAttentionId) {
        setSelectedAttentionId(data.attentions[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido al cargar registros.');
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  // Cargar formato activo
  const loadReport = async () => {
    setLoading(true);
    setError(null);
    setReportData(null);
    try {
      let url = '';
      if (activeTab === 'F01' && selectedTreatmentId) {
        url = `${endpoint}/f01/${selectedTreatmentId}`;
      } else if (activeTab === 'F02' && selectedSessionId) {
        url = `${endpoint}/f02/${selectedSessionId}`;
      } else if (activeTab === 'F03' && selectedAttentionId) {
        url = `${endpoint}/f03/${selectedAttentionId}`;
      } else if (activeTab === 'F04') {
        const queryParams = new URLSearchParams();
        if (selectedTreatmentId) queryParams.set('treatmentId', String(selectedTreatmentId));
        url = `${endpoint}/f04/audit?${queryParams.toString()}`;
      } else if (activeTab === 'F05' && selectedTreatmentId) {
        url = `${endpoint}/f05/${selectedTreatmentId}`;
      }

      if (!url) {
        setLoading(false);
        return;
      }

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${staffAuthService.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'No fue posible obtener el formato operacional solicitado.');
      }

      const data = await res.json();
      setReportData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al obtener reporte operacional.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (catalog) {
      loadReport();
    }
  }, [activeTab, selectedTreatmentId, selectedSessionId, selectedAttentionId, catalog]);

  const handlePrint = () => {
    window.print();
  };

  const tabs = [
    { id: 'F01', label: 'F01 · Alta y Seguimiento', icon: FileText, desc: 'Tratamiento y cronograma general' },
    { id: 'F02', label: 'F02 · Sesión Programada', icon: CalendarCheck, desc: 'Agenda, confirmación y eventos de sesión' },
    { id: 'F03', label: 'F03 · Ficha de Atención', icon: ClipboardList, desc: 'Procedimientos clínicos y validaciones' },
    { id: 'F04', label: 'F04 · Bitácora Copiloto IA', icon: Bot, desc: 'Supervisión y trazabilidad de IA' },
    { id: 'F05', label: 'F05 · Acta de Cierre', icon: Award, desc: 'Auditoría final y continuidad TURNED' },
  ] as const;

  return (
    <div className="operational-reports-page min-h-screen bg-[var(--pt-bg)] p-4 sm:p-6 lg:p-8 space-y-6">
      <style>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print,
          nav,
          header,
          aside,
          button,
          .operational-reports-controls {
            display: none !important;
          }
          .operational-reports-page {
            padding: 0 !important;
            background: transparent !important;
          }
          .report-document-sheet {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }
          @page {
            size: A4 portrait;
            margin: 1.5cm;
          }
        }
      `}</style>

      {/* ── BARRA SUPERIOR DE NAVEGACIÓN Y ACCIONES ── */}
      <div className="no-print rounded-2xl border border-[var(--pt-line)] bg-[var(--pt-surface)] p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--pt-accent)] bg-[var(--pt-accent-soft)] px-2.5 py-0.5 rounded-full">
                Inteligencia de Negocios · Fase CUSTOMER
              </span>
              <span className="text-xs text-[var(--pt-muted)] font-mono">
                Modelado Dimensional F01–F05
              </span>
            </div>
            <h1 className="text-2xl font-bold font-serif text-[var(--pt-ink)]">
              Formatos Operacionales de Origen de Medidas
            </h1>
            <p className="text-xs text-[var(--pt-muted)] max-w-3xl">
              Documentos visuales estructurados y certificados que originan los indicadores dimensionales del Data Mart (NexoSalud_Mart).
              Disponibles para revisión asistencial, auditoría médica y captura académica.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={loadCatalog}
              disabled={catalogLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-[var(--pt-line)] hover:bg-[var(--pt-sunken)] transition-colors text-[var(--pt-ink)]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${catalogLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading || !reportData}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--pt-accent)] text-[var(--pt-accent-ink)] hover:bg-[var(--pt-accent-hover)] transition-all shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir / Exportar PDF
            </button>
          </div>
        </div>

        {/* ── PESTAÑAS DE FORMATOS F01–F05 ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 border-t border-[var(--pt-line)] pt-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (activeTab !== tab.id) {
                    setActiveTab(tab.id as any);
                    setReportData(null);
                    setError(null);
                  }
                }}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                  isActive
                    ? 'bg-[var(--pt-accent-soft)] border-[var(--pt-accent)] shadow-xs'
                    : 'bg-[var(--pt-paper)] border-[var(--pt-line)] hover:border-[var(--pt-line-strong)]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[var(--pt-accent)]' : 'text-[var(--pt-muted)]'}`} />
                  <span className={`text-xs font-bold font-mono ${isActive ? 'text-[var(--pt-accent)]' : 'text-[var(--pt-ink)]'}`}>
                    {tab.label}
                  </span>
                </div>
                <span className="text-[11px] text-[var(--pt-muted)] line-clamp-1">
                  {tab.desc}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── SELECTOR DE REGISTROS REALES (SEGÚN FORMATO ACTIVO) ── */}
        <div className="operational-reports-controls rounded-xl bg-[var(--pt-sunken)]/60 border border-[var(--pt-line)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--pt-muted)] font-mono block">
              {activeTab === 'F01' || activeTab === 'F05'
                ? 'Seleccionar Tratamiento Clínico Contratado'
                : activeTab === 'F02'
                ? 'Seleccionar Sesión de Tratamiento Agendada'
                : activeTab === 'F03'
                ? 'Seleccionar Atención Odontológica Documentada'
                : 'Filtro por Tratamiento (Opcional para Bitácora General de IA)'}
            </label>

            {catalogLoading ? (
              <p className="text-xs text-[var(--pt-muted)] font-mono">Cargando registros disponibles de NexoSaludDB…</p>
            ) : activeTab === 'F01' || activeTab === 'F05' || activeTab === 'F04' ? (
              <div className="relative">
                <select
                  value={selectedTreatmentId ?? ''}
                  onChange={(e) => setSelectedTreatmentId(Number(e.target.value) || null)}
                  className="w-full text-xs font-medium bg-[var(--pt-surface)] border border-[var(--pt-line)] rounded-lg px-3 py-2 text-[var(--pt-ink)] appearance-none pr-8 cursor-pointer focus:ring-1 focus:ring-[var(--pt-accent)]"
                >
                  {activeTab === 'F04' && <option value="">Bitácora General de Copiloto IA (Todas las atenciones)</option>}
                  {catalog?.treatments.map((t) => (
                    <option key={t.id} value={t.id}>
                      Tratamiento #{t.id} — {t.patientName} (DNI: {t.dni || '—'}) · {t.serviceName} [{t.status} - {t.completedSessions}/{t.totalSessions} ses]
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-[var(--pt-muted)] absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            ) : activeTab === 'F02' ? (
              <div className="relative">
                <select
                  value={selectedSessionId ?? ''}
                  onChange={(e) => setSelectedSessionId(Number(e.target.value))}
                  className="w-full text-xs font-medium bg-[var(--pt-surface)] border border-[var(--pt-line)] rounded-lg px-3 py-2 text-[var(--pt-ink)] appearance-none pr-8 cursor-pointer focus:ring-1 focus:ring-[var(--pt-accent)]"
                >
                  {catalog?.sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      Sesión #{s.sessionNumber} (ID: {s.id}) — {s.patientName} · {s.serviceName} [{s.statusAssist} / {s.statusProg}] · {new Date(s.date).toLocaleDateString('es-PE')}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-[var(--pt-muted)] absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedAttentionId ?? ''}
                  onChange={(e) => setSelectedAttentionId(Number(e.target.value))}
                  className="w-full text-xs font-medium bg-[var(--pt-surface)] border border-[var(--pt-line)] rounded-lg px-3 py-2 text-[var(--pt-ink)] appearance-none pr-8 cursor-pointer focus:ring-1 focus:ring-[var(--pt-accent)]"
                >
                  {catalog?.attentions.map((a) => (
                    <option key={a.id} value={a.id}>
                      Atención #{a.id} — {a.patientName} · {a.serviceName} ({a.proceduresCount} procedimientos) · {a.professional} · {new Date(a.date).toLocaleDateString('es-PE')}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-[var(--pt-muted)] absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono text-[var(--pt-muted)] bg-[var(--pt-paper)] border border-[var(--pt-line)] px-2.5 py-1.5 rounded-lg">
              BD: <strong>NexoSaludDB</strong>
            </span>
          </div>
        </div>
      </div>

      {/* ── ESTADOS DE CARGA Y ERROR ── */}
      {loading && (
        <div className="rounded-2xl border border-[var(--pt-line)] bg-[var(--pt-surface)] p-12 text-center space-y-3">
          <RefreshCw className="w-6 h-6 text-[var(--pt-accent)] animate-spin mx-auto" />
          <p className="text-sm font-medium text-[var(--pt-ink)]">
            Generando formato operacional {activeTab} desde SQL Server...
          </p>
          <p className="text-xs text-[var(--pt-muted)] font-mono">
            Consultando tablas de hechos y dimensiones operacionales autorizadas
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-[var(--pt-danger)] bg-[var(--pt-danger-soft)] p-6 text-center space-y-2">
          <p className="text-sm font-bold text-[var(--pt-danger)]">
            Error al consultar el formato operacional
          </p>
          <p className="text-xs text-[var(--pt-ink)]">{error}</p>
          <button
            type="button"
            onClick={loadReport}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--pt-surface)] border border-[var(--pt-danger)] text-[var(--pt-danger)]"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ── RENDERIZADO DEL FORMATO DOCUMENTAL ACTIVO ── */}
      {!loading && !error && reportData && reportData.header?.formatCode === activeTab && (
        <div className="report-display-container">
          {activeTab === 'F01' && <F01TreatmentFollowupView data={reportData} onPrint={handlePrint} />}
          {activeTab === 'F02' && <F02SessionScheduleView data={reportData} onPrint={handlePrint} />}
          {activeTab === 'F03' && <F03ClinicalAttentionView data={reportData} onPrint={handlePrint} />}
          {activeTab === 'F04' && <F04AiAuditLogView data={reportData} onPrint={handlePrint} />}
          {activeTab === 'F05' && <F05TreatmentClosureView data={reportData} onPrint={handlePrint} />}
        </div>
      )}
    </div>
  );
}
