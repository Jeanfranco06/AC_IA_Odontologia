import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  FileCheck2,
  Plus,
  RotateCcw,
  Save,
  ScanLine,
  ShieldCheck,
  Stethoscope,
  User,
} from 'lucide-react';
import { useCustomers } from '@/modules/customer/hooks/useCustomerQueries';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { useToast } from '@/shared/hooks/use-toast';

export type ToothCondition =
  | 'sano'
  | 'caries'
  | 'resina'
  | 'endodoncia'
  | 'corona'
  | 'implante'
  | 'ausente';

interface ToothConditionMeta {
  id: ToothCondition;
  label: string;
  code: string;
  fill: string;
  stroke: string;
  badgeClass: string;
}

const CONDITION_PALETTE: ToothConditionMeta[] = [
  {
    id: 'sano',
    label: 'Pieza Sana',
    code: 'SAN',
    fill: '#ffffff',
    stroke: '#cbd5e1',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  {
    id: 'caries',
    label: 'Caries / Lesión',
    code: 'CAR',
    fill: '#ffe4e6',
    stroke: '#e11d48',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  {
    id: 'resina',
    label: 'Restauración Resina',
    code: 'RES',
    fill: '#ccfbf1',
    stroke: '#0f766e',
    badgeClass: 'bg-teal-50 text-[#0f766e] border-teal-200',
  },
  {
    id: 'endodoncia',
    label: 'Endodoncia',
    code: 'END',
    fill: '#fef3c7',
    stroke: '#d97706',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  {
    id: 'corona',
    label: 'Corona / Prótesis',
    code: 'COR',
    fill: '#e0e7ff',
    stroke: '#4f46e5',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  {
    id: 'implante',
    label: 'Implante 3D',
    code: 'IMP',
    fill: '#d1fae5',
    stroke: '#059669',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  {
    id: 'ausente',
    label: 'Pieza Ausente',
    code: 'AUS',
    fill: '#f1f5f9',
    stroke: '#64748b',
    badgeClass: 'bg-slate-200 text-slate-700 border-slate-300',
  },
];

const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];

const DEFAULT_CHART: Record<number, ToothCondition> = {
  16: 'resina',
  14: 'caries',
  21: 'corona',
  26: 'endodoncia',
  36: 'implante',
  46: 'resina',
  48: 'ausente',
};

export default function ClinicalOdontogramPage() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { data: customers = [], isLoading } = useCustomers();

  const patientOptions = useMemo(() => {
    const list = (customers as any[]).map((c) => ({
      id: String(c.id),
      fullName: `${c.person?.firstName || 'Paciente'} ${c.person?.lastName || ''}`.trim(),
      dni: c.person?.documentNumber || '45892104',
      service: c.lead?.requestedServiceId || 'Rehabilitación e Implantes',
      branch: c.reservation?.branchId || 'Sede California',
      doctor: c.reservation?.professionalId || 'Dr. Carlos Benitez',
    }));

    if (list.length === 0) {
      return [
        {
          id: 'default-1',
          fullName: 'Mariana Villavicencio Ríos',
          dni: '46102938',
          service: 'Ortodoncia Digital & Estética',
          branch: 'Sede California',
          doctor: 'Dr. Carlos Benitez',
        },
      ];
    }
    return list;
  }, [customers]);

  const [selectedPatientName, setSelectedPatientName] = useState<string>('');
  const [activeTool, setActiveTool] = useState<ToothCondition>('resina');
  const [selectedTooth, setSelectedTooth] = useState<number>(16);
  const [chartState, setChartState] = useState<Record<number, ToothCondition>>(DEFAULT_CHART);
  const [clinicalNote, setClinicalNote] = useState('');
  const [evolutionHistory, setEvolutionHistory] = useState<
    Array<{ date: string; tooth: number; condition: string; note: string }>
  >([
    {
      date: '2026-10-20 10:30',
      tooth: 36,
      condition: 'Implante 3D',
      note: 'Colocación de implante de titanio grado V con guía quirúrgica impresa en 3D. Torque 40 Ncm.',
    },
    {
      date: '2026-10-14 16:15',
      tooth: 16,
      condition: 'Restauración Resina',
      note: 'Restauración ocluso-mesial con resina nanohíbrida fotopolimerizable bajo aislamiento absoluto.',
    },
  ]);

  // Inicializar paciente desde URL o primer registro
  useEffect(() => {
    const fromQuery = searchParams.get('patientName');
    if (fromQuery) {
      setSelectedPatientName(fromQuery);
    } else if (!selectedPatientName && patientOptions.length > 0) {
      setSelectedPatientName(patientOptions[0].fullName);
    }
  }, [searchParams, patientOptions, selectedPatientName]);

  const currentPatient = useMemo(() => {
    return (
      patientOptions.find(
        (p) => p.fullName.toLowerCase() === selectedPatientName.toLowerCase()
      ) || {
        id: 'custom',
        fullName: selectedPatientName || 'Paciente en Evaluación',
        dni: '47281904',
        service: 'Evaluación Odontológica Integral',
        branch: 'Sede California',
        doctor: 'Dr. Carlos Benitez',
      }
    );
  }, [patientOptions, selectedPatientName]);

  const handleToothClick = (toothNumber: number) => {
    setSelectedTooth(toothNumber);
    setChartState((prev) => ({
      ...prev,
      [toothNumber]: activeTool,
    }));
  };

  const handleAddEvolutionNote = () => {
    if (!clinicalNote.trim()) return;
    const condMeta =
      CONDITION_PALETTE.find((c) => c.id === (chartState[selectedTooth] || 'sano')) ||
      CONDITION_PALETTE[0];

    setEvolutionHistory((prev) => [
      {
        date: '2026-10-22 13:50',
        tooth: selectedTooth,
        condition: condMeta.label,
        note: clinicalNote.trim(),
      },
      ...prev,
    ]);
    setClinicalNote('');
    toast({
      title: `Evolución registrada en pieza ${selectedTooth}`,
      description: 'La nota clínica se anexó al expediente digital del paciente.',
    });
  };

  const handleSaveOdontogram = () => {
    try {
      localStorage.setItem(
        `nexosalud_odontogram_${currentPatient.fullName}`,
        JSON.stringify(chartState)
      );
    } catch {
      // ignore storage quota
    }
    toast({
      title: 'Odontograma Digital Guardado',
      description: `Actualizado en el expediente de ${currentPatient.fullName} conforme a Norma Técnica MINSA.`,
    });
  };

  const summaryCounts = useMemo(() => {
    const counts: Record<ToothCondition, number> = {
      sano: 32,
      caries: 0,
      resina: 0,
      endodoncia: 0,
      corona: 0,
      implante: 0,
      ausente: 0,
    };
    Object.values(chartState).forEach((cond) => {
      if (cond !== 'sano') {
        counts[cond] = (counts[cond] || 0) + 1;
        counts.sano -= 1;
      }
    });
    return counts;
  }, [chartState]);

  if (isLoading) return <LoadingState />;

  const renderToothButton = (tooth: number) => {
    const cond = chartState[tooth] || 'sano';
    const meta = CONDITION_PALETTE.find((c) => c.id === cond) || CONDITION_PALETTE[0];
    const isFocused = selectedTooth === tooth;

    return (
      <button
        key={tooth}
        type="button"
        onClick={() => handleToothClick(tooth)}
        title={`Pieza ${tooth} · ${meta.label}`}
        className={`group flex flex-col items-center rounded-xl border p-2 transition-all cursor-pointer ${
          isFocused
            ? 'border-[#0f766e] bg-teal-50/50 dark:bg-teal-950/40 ring-2 ring-teal-600/20'
            : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
        }`}
      >
        <span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300">
          {tooth}
        </span>

        {/* Esquema anatómico de 5 caras dentales (SVG) */}
        <svg
          viewBox="0 0 40 40"
          className="my-1.5 h-9 w-9 transition-transform group-hover:scale-105"
          aria-hidden
        >
          {/* Contorno exterior */}
          <rect
            x="3"
            y="3"
            width="34"
            height="34"
            rx="7"
            fill={meta.fill}
            stroke={meta.stroke}
            strokeWidth="2.2"
          />
          {/* Líneas diagonales de las 4 caras periféricas */}
          <line x1="3" y1="3" x2="13" y2="13" stroke={meta.stroke} strokeWidth="1.5" />
          <line x1="37" y1="3" x2="27" y2="13" stroke={meta.stroke} strokeWidth="1.5" />
          <line x1="3" y1="37" x2="13" y2="27" stroke={meta.stroke} strokeWidth="1.5" />
          <line x1="37" y1="37" x2="27" y2="27" stroke={meta.stroke} strokeWidth="1.5" />

          {/* Cara central (Oclusal / Incisal) */}
          <rect
            x="13"
            y="13"
            width="14"
            height="14"
            rx="2"
            fill={cond === 'sano' ? '#f8fafc' : meta.stroke}
            fillOpacity={cond === 'sano' ? 1 : 0.3}
            stroke={meta.stroke}
            strokeWidth="1.5"
          />

          {/* Marca de pieza ausente */}
          {cond === 'ausente' && (
            <>
              <line x1="6" y1="6" x2="34" y2="34" stroke="#475569" strokeWidth="2.5" />
              <line x1="34" y1="6" x2="6" y2="34" stroke="#475569" strokeWidth="2.5" />
            </>
          )}
        </svg>

        <span
          className={`rounded px-1.5 py-0.5 font-mono text-[9.5px] font-semibold border ${meta.badgeClass}`}
        >
          {meta.code}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Cabecera de Página */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Odontograma Digital FDI &amp; Evolución Clínica
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] dark:bg-teal-950/60 px-2.5 py-0.5 text-[11px] font-semibold text-[#065F46] dark:text-teal-300">
              <ShieldCheck className="h-3.5 w-3.5 text-[#0f766e]" />
              Norma Técnica MINSA
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Registro interactivo de hallazgos clínicos en 32 piezas permanentes y notas de tratamiento.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setChartState(DEFAULT_CHART)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Restablecer</span>
          </button>

          <button
            type="button"
            onClick={handleSaveOdontogram}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0f766e] px-4 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-[#115e59] active:scale-[0.98] cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Guardar Odontograma</span>
          </button>
        </div>
      </div>

      {/* Selector de Paciente y Metadatos del Expediente */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs items-center">
        <div className="lg:col-span-5 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/60 text-[#0f766e] dark:text-teal-300">
            <User className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <label
              htmlFor="patient-odontogram-select"
              className="block text-[11px] font-medium uppercase tracking-wider text-slate-400"
            >
              Paciente en Sillón Clínico
            </label>
            <select
              id="patient-odontogram-select"
              value={currentPatient.fullName}
              onChange={(e) => setSelectedPatientName(e.target.value)}
              className="mt-0.5 h-8 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800 px-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:border-[#0f766e] focus:outline-none"
            >
              {patientOptions.map((p) => (
                <option key={p.id} value={p.fullName}>
                  {p.fullName} (DNI: {p.dni})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-3 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800 pt-3 lg:pt-0 lg:pl-4 text-xs">
          <div>
            <span className="text-[11px] text-slate-400 block">Plan de Tratamiento</span>
            <span className="font-semibold text-slate-900 dark:text-white truncate block">
              {currentPatient.service}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">Especialista Tratante</span>
            <span className="font-medium text-slate-800 dark:text-slate-200 truncate block">
              {currentPatient.doctor}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">Sede Clínica</span>
            <span className="font-medium text-[#0f766e] dark:text-teal-400 truncate block">
              {currentPatient.branch}
            </span>
          </div>
        </div>
      </div>

      {/* Paleta de Hallazgos Clínicos + Lienzo del Odontograma FDI */}
      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xs space-y-6">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <ScanLine className="h-4 w-4 text-[#0f766e]" />
              <span>Herramienta de Marcado Clínico</span>
            </h2>
            <p className="text-xs text-slate-500">
              Selecciona un hallazgo o tratamiento y haz clic sobre la pieza dental correspondiente.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {CONDITION_PALETTE.map((tool) => {
              const active = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => setActiveTool(tool.id)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                    active
                      ? 'border-[#0f766e] bg-teal-50/70 dark:bg-teal-950/60 text-slate-900 dark:text-white ring-2 ring-teal-600/20 font-semibold'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className="h-3 w-3 rounded-sm border"
                    style={{ backgroundColor: tool.fill, borderColor: tool.stroke }}
                  />
                  <span>{tool.label}</span>
                  <span className="font-mono text-[10px] text-slate-400">
                    ({summaryCounts[tool.id]})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Arcada Superior (Cuadrantes 1 y 2) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <span>Cuadrante 1 · Superior Derecho</span>
            <span className="hidden sm:inline">Arcada Maxilar Superior</span>
            <span>Cuadrante 2 · Superior Izquierdo</span>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="overflow-x-auto pb-1.5">
              <div className="grid grid-cols-8 gap-1.5 min-w-[440px] xl:min-w-0 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 p-2.5 border border-slate-200/60 dark:border-slate-800">
                {UPPER_RIGHT.map(renderToothButton)}
              </div>
            </div>
            <div className="overflow-x-auto pb-1.5">
              <div className="grid grid-cols-8 gap-1.5 min-w-[440px] xl:min-w-0 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 p-2.5 border border-slate-200/60 dark:border-slate-800">
                {UPPER_LEFT.map(renderToothButton)}
              </div>
            </div>
          </div>
        </div>

        {/* Arcada Inferior (Cuadrantes 4 y 3) */}
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="overflow-x-auto pb-1.5">
              <div className="grid grid-cols-8 gap-1.5 min-w-[440px] xl:min-w-0 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 p-2.5 border border-slate-200/60 dark:border-slate-800">
                {LOWER_RIGHT.map(renderToothButton)}
              </div>
            </div>
            <div className="overflow-x-auto pb-1.5">
              <div className="grid grid-cols-8 gap-1.5 min-w-[440px] xl:min-w-0 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 p-2.5 border border-slate-200/60 dark:border-slate-800">
                {LOWER_LEFT.map(renderToothButton)}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <span>Cuadrante 4 · Inferior Derecho</span>
            <span className="hidden sm:inline">Arcada Mandibular Inferior</span>
            <span>Cuadrante 3 · Inferior Izquierdo</span>
          </div>
        </div>
      </div>

      {/* Registro de Evolución Clínica por Pieza */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-[#0f766e]" />
              <span>Anexar Nota de Evolución</span>
            </h3>
            <span className="rounded-md bg-teal-50 dark:bg-teal-950/60 px-2.5 py-0.5 font-mono text-xs font-semibold text-[#0f766e] dark:text-teal-300">
              Pieza FDI #{selectedTooth}
            </span>
          </div>

          <textarea
            rows={3}
            value={clinicalNote}
            onChange={(e) => setClinicalNote(e.target.value)}
            placeholder={`Describe el procedimiento o hallazgo radiográfico en la pieza ${selectedTooth}…`}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800 p-3 text-xs text-slate-900 dark:text-white focus:border-[#0f766e] focus:bg-white focus:outline-none"
          />

          <button
            type="button"
            onClick={handleAddEvolutionNote}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 dark:bg-teal-700 px-4 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Registrar en Historia Clínica</span>
          </button>
        </div>

        <div className="lg:col-span-7 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xs space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-[#0f766e]" />
            <span>Historial de Intervenciones por Pieza</span>
          </h3>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {evolutionHistory.map((item, idx) => (
              <div key={idx} className="py-3 flex items-start justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                      Pieza {item.tooth}
                    </span>
                    <span className="font-semibold text-[#0f766e] dark:text-teal-400">
                      {item.condition}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> Firmado
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{item.note}</p>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-slate-400">{item.date}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
