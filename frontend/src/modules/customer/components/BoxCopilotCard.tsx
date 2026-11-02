import { useState, useEffect } from 'react';
import { 
  Bot, 
  Sparkles, 
  ChevronDown, 
  Clock, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  Zap, 
  Copy, 
  Check, 
  MessageSquare, 
  Activity, 
  Stethoscope, 
  Layers,
  HeartPulse,
  Flame,
  Timer
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { 
  BoxCopilotService, 
  CLINICAL_TEMPLATES, 
  type ClinicalTemplate, 
  type BoxCopilotAnalysis 
} from '../services/boxCopilotService';
import { useToast } from '@/shared/hooks/use-toast';

interface BoxCopilotCardProps {
  customer: any;
  currentFormData: {
    reasonForConsultation?: string;
    evaluation?: string;
    procedure?: string;
    instructions?: string;
  };
  onApplyTemplate: (template: ClinicalTemplate) => void;
  onApplyInstructions: (instructions: string) => void;
}

export function BoxCopilotCard({
  customer,
  currentFormData,
  onApplyTemplate,
  onApplyInstructions,
}: BoxCopilotCardProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedWhatsapp, setCopiedWhatsapp] = useState(false);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('');
  const [liveSeconds, setLiveSeconds] = useState(0);

  // Cronómetro en vivo segundo a segundo cuando la atención está en curso
  useEffect(() => {
    if (customer?.state !== 'IN_ATTENTION' || !customer?.attention?.startTime) return;
    
    const calculateSeconds = () => {
      const start = new Date(customer.attention.startTime).getTime();
      if (!isNaN(start)) {
        setLiveSeconds(Math.max(0, Math.floor((Date.now() - start) / 1000)));
      }
    };

    calculateSeconds();
    const timer = setInterval(calculateSeconds, 1000);
    return () => clearInterval(timer);
  }, [customer?.state, customer?.attention?.startTime]);

  const analysis: BoxCopilotAnalysis = BoxCopilotService.analyzeCustomerContext({
    state: customer?.state || 'SCHEDULED',
    serviceName: customer?.lead?.requestedServiceId || customer?.serviceName,
    standardDurationMinutes: customer?.standardDurationMinutes || 45,
    startTime: customer?.attention?.startTime,
    scheduledTime: customer?.reservation?.time,
    scheduledDate: customer?.reservation?.date,
    saludOdontologica: customer?.saludOdontologica,
    currentFormData,
  });

  const formatLiveStopwatch = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyWhatsapp = () => {
    const patientName = `${customer?.person?.firstName || 'Paciente'} ${customer?.person?.lastName || ''}`.trim();
    const serviceName = customer?.lead?.requestedServiceId || customer?.serviceName || 'Atención Odontológica';
    const text = BoxCopilotService.generateWhatsAppPostopText(
      patientName,
      serviceName,
      currentFormData.instructions || 'Mantener higiene regular y acudir al próximo control.'
    );

    navigator.clipboard.writeText(text);
    setCopiedWhatsapp(true);
    toast({
      title: 'Copiado para WhatsApp',
      description: 'Indicaciones postoperatorias listas para enviar al paciente.',
    });
    setTimeout(() => setCopiedWhatsapp(false), 2500);
  };

  const handleSelectTemplate = (template: ClinicalTemplate) => {
    setSelectedTemplateKey(template.key);
    onApplyTemplate(template);
    toast({
      title: `Plantilla Aplicada: ${template.name}`,
      description: 'Se pre-rellenó el motivo, evaluación, procedimiento e indicaciones.',
    });
  };

  const standardMins = analysis.timeMonitoring.standardDurationMinutes;
  const currentElapsedMins = Math.floor(liveSeconds / 60);
  const progressPercent = Math.min(100, Math.round((currentElapsedMins / standardMins) * 100));

  return (
    <div className="bg-gradient-to-br from-teal-50/90 via-white to-slate-50 dark:from-teal-950/40 dark:via-slate-900 dark:to-slate-950 border border-teal-200/90 dark:border-teal-800/80 rounded-2xl transition-all shadow-sm overflow-hidden">
      
      {/* ── Cabecera Desplegable del Agente Copiloto ── */}
      <div 
        onClick={() => setIsExpanded(prev => !prev)}
        className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none hover:bg-teal-50/60 dark:hover:bg-teal-950/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-md ring-4 ring-teal-50 dark:ring-teal-950/50">
            <Bot className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                Agente Copiloto de Box Odontológico
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-300/60 dark:border-teal-700/60 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                IA Clinical Copilot
              </span>

              {/* Badge de Triaje de Severidad */}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${analysis.triage.badgeColor}`}>
                <HeartPulse className="w-3 h-3" />
                Triaje: {analysis.triage.level}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Protocolos preventivos, cronómetro en sillón, plantillas clínicas y auditoría de ficha
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
          {customer?.state === 'IN_ATTENTION' && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-xs shadow-2xs">
              <Timer className="w-3.5 h-3.5 animate-spin" />
              <span>{formatLiveStopwatch(liveSeconds)} en sillón</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-1.5 rounded-xl transition-all shadow-2xs border border-slate-200 dark:border-slate-700"
          >
            <span>{isExpanded ? 'Ocultar' : 'Desplegar'}</span>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Contenido Desplegable del Copiloto ── */}
      {isExpanded && (
        <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-2 border-t border-teal-100/80 dark:border-teal-900/60 flex flex-col gap-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
          
          {/* 1. Alerta de Tolerancia de Asistencia (Actividad 1 & ALT-C4) */}
          {analysis.attendanceAlert && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold uppercase tracking-wider block">
                  Alerta ALT-C4 · Tolerancia Excedida (&gt;20 min)
                </span>
                <p className="mt-0.5">{analysis.attendanceAlert.message}</p>
                <p className="text-[11px] opacity-90 mt-1 font-semibold">{analysis.attendanceAlert.actionSuggested}</p>
              </div>
            </div>
          )}

          {/* 2. Banner de Triaje Preventivo y Alergias */}
          <div className={`p-3.5 rounded-xl border transition-all ${
            analysis.triage.level === 'CRITICO' ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800'
            : analysis.triage.level === 'ALTO' ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
            : 'bg-teal-50/60 dark:bg-teal-950/30 border-teal-200/80 dark:border-teal-800/60'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className={`w-4 h-4 ${analysis.triage.level === 'CRITICO' ? 'text-rose-600' : analysis.triage.level === 'ALTO' ? 'text-amber-600' : 'text-teal-600'}`} />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Triaje Clínico & Antecedentes Médicos
                </span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${analysis.triage.badgeColor}`}>
                {analysis.triage.level === 'CRITICO' ? 'Riesgo Crítico · Alerta de Anestésicos'
                  : analysis.triage.level === 'ALTO' ? 'Prioridad Alta · Dolor Agudo'
                  : analysis.triage.level === 'MODERADO' ? 'Precaución Moderada'
                  : 'Apto para Protocolo Estándar'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Alertas Detectadas</span>
                <ul className="mt-1 space-y-1">
                  {analysis.triage.alerts.map((al, idx) => (
                    <li key={idx} className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                      <span>{al}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Recomendación Médica de Box</span>
                <ul className="mt-1 space-y-1">
                  {analysis.triage.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* 3. Monitoreo de Tiempo en Sillón & Alerta ALT-C2 */}
          {customer?.state === 'IN_ATTENTION' && (
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                  <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Monitoreo de Tiempo en Sillón</span>
                </div>
                <span className="font-mono text-xs font-black text-slate-900 dark:text-white">
                  {currentElapsedMins} / {standardMins} min ({progressPercent}%)
                </span>
              </div>

              {/* Barra de Progreso */}
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${
                    analysis.timeMonitoring.isOvertime 
                      ? 'bg-rose-500' 
                      : progressPercent > 80 
                      ? 'bg-amber-500' 
                      : 'bg-teal-500'
                  }`}
                  style={{ width: `${Math.min(100, progressPercent)}%` }}
                />
              </div>

              {/* Alerta ALT-C2 si hay sobretiempo */}
              {analysis.timeMonitoring.alertAltC2 && (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs flex items-center gap-2 animate-pulse">
                  <Flame className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="font-semibold">{analysis.timeMonitoring.alertAltC2}</span>
                </div>
              )}
            </div>
          )}

          {/* 4. Plantillas Clínicas Estructuradas con 1 Clic */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Plantillas Clínicas Estructuradas por Servicio
              </span>
              <span className="text-[10px] text-slate-400">1 clic para autocompletar</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {Object.values(CLINICAL_TEMPLATES).map((tmpl) => (
                <button
                  key={tmpl.key}
                  type="button"
                  onClick={() => handleSelectTemplate(tmpl)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                    selectedTemplateKey === tmpl.key
                      ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                  }`}
                >
                  <Stethoscope className="w-3 h-3" />
                  <span>{tmpl.name.split('&')[0].trim()}</span>
                  <span className="text-[10px] opacity-75">({tmpl.standardDuration}m)</span>
                </button>
              ))}
            </div>
          </div>

          {/* 5. Generador de Indicaciones Postoperatorias & WhatsApp */}
          <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Prescripción e Indicaciones Postoperatorias
              </span>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                Redacta recomendaciones claras de autocuidado y formato listo para WhatsApp del paciente.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCopyWhatsapp}
                className="bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-xs h-8 rounded-xl font-semibold gap-1.5"
                title="Copiar texto estructurado con formato para WhatsApp"
              >
                {copiedWhatsapp ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedWhatsapp ? '¡Copiado!' : 'Copiar p/ WhatsApp'}</span>
              </Button>
            </div>
          </div>

          {/* 6. Auditoría de Integridad y Checklist de Calidad */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                Auditoría de Integridad Documental
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                analysis.qualityChecklist.isComplete 
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
              }`}>
                {analysis.qualityChecklist.isComplete ? '✓ Ficha 100% Íntegra' : `Faltan ${analysis.qualityChecklist.missingCount} campos obligatorios`}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className={`p-2 rounded-lg border flex items-center gap-1.5 ${
                analysis.qualityChecklist.hasReason 
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
              }`}>
                {analysis.qualityChecklist.hasReason ? <Check className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-slate-400" />}
                <span className="font-semibold truncate">Motivo Consulta</span>
              </div>

              <div className={`p-2 rounded-lg border flex items-center gap-1.5 ${
                analysis.qualityChecklist.hasEvaluation 
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
              }`}>
                {analysis.qualityChecklist.hasEvaluation ? <Check className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-slate-400" />}
                <span className="font-semibold truncate">Evaluación / Diag.</span>
              </div>

              <div className={`p-2 rounded-lg border flex items-center gap-1.5 ${
                analysis.qualityChecklist.hasProcedure 
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
              }`}>
                {analysis.qualityChecklist.hasProcedure ? <Check className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-slate-400" />}
                <span className="font-semibold truncate">Procedimiento</span>
              </div>

              <div className={`p-2 rounded-lg border flex items-center gap-1.5 ${
                analysis.qualityChecklist.hasInstructions 
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
              }`}>
                {analysis.qualityChecklist.hasInstructions ? <Check className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-slate-400" />}
                <span className="font-semibold truncate">Indicaciones</span>
              </div>
            </div>

            {analysis.qualityChecklist.alertAltC3 && (
              <div className="mt-2.5 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>{analysis.qualityChecklist.alertAltC3}</span>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
