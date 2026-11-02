import { Phase } from '@/domain/enums';
import type { CustomerJourney } from '@/domain/entities';
import { Link } from 'react-router-dom';
import { Check, Activity } from 'lucide-react';

interface JourneyStepperProps {
  journey: CustomerJourney;
}

const PHASES = [
  { id: Phase.BUYER, label: 'BUYER', step: '01', desc: 'Atracción', getLinkId: (j: CustomerJourney) => j.buyerId, route: '/buyer' },
  { id: Phase.LEAD, label: 'LEAD', step: '02', desc: 'Negociación', getLinkId: (j: CustomerJourney) => j.leadId, route: '/lead' },
  { id: Phase.PAYER, label: 'PAYER', step: '03', desc: 'Recaudación', getLinkId: (j: CustomerJourney) => j.payerId, route: '/payer' },
  { id: Phase.CUSTOMER, label: 'CUSTOMER', step: '04', desc: 'Atención', getLinkId: (j: CustomerJourney) => j.customerId, route: '/customer' },
  { id: Phase.TURNED, label: 'TURNED', step: '05', desc: 'Fidelización', getLinkId: (j: CustomerJourney) => j.turnedId, route: '/turned' },
];

export function JourneyStepper({ journey }: JourneyStepperProps) {
  const currentIndex = PHASES.findIndex(p => p.id === journey.currentPhase);

  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 mb-8 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="h-4 w-4 text-teal-600" />
            Trazabilidad del Recorrido Clínico (Patient Journey)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Flujo end-to-end de conversión y retención del paciente en el ciclo de salud.
          </p>
        </div>
        <span className="font-mono text-xs px-2.5 py-1 bg-slate-100 text-slate-700 font-semibold rounded-lg border border-slate-200 self-start sm:self-auto">
          Etapa Actual: <span className="text-teal-700 font-bold">{journey.currentPhase}</span>
        </span>
      </div>

      {/* Funnel Stepper Flow */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 relative">
        {PHASES.map((phase, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const recordId = phase.getLinkId(journey);

          let containerStyle = "bg-slate-50 border-slate-200/80 text-slate-500 opacity-60";
          let badgeStyle = "bg-slate-200 text-slate-600";

          if (isCompleted || (recordId && !isCurrent)) {
            containerStyle = "bg-teal-50/50 border-teal-200 text-teal-900 hover:border-teal-400 shadow-sm";
            badgeStyle = "bg-teal-600 text-white";
          } else if (isCurrent) {
            containerStyle = "bg-slate-900 border-slate-900 text-white shadow-md ring-2 ring-teal-500/30";
            badgeStyle = "bg-teal-400 text-slate-950 font-bold";
          }

          const cardContent = (
            <div className={`h-full p-3.5 rounded-xl border transition-all duration-200 flex flex-col justify-between gap-2 relative overflow-hidden ${containerStyle}`}>
              {isCurrent && (
                <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-bl from-teal-500/30 to-transparent pointer-events-none" />
              )}
              
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${badgeStyle}`}>
                  {isCompleted ? <Check className="w-3 h-3" /> : phase.step}
                </span>
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${isCurrent ? 'text-teal-300' : 'text-slate-400'}`}>
                  {phase.desc}
                </span>
              </div>

              <div>
                <p className={`text-xs font-bold tracking-tight ${isCurrent ? 'text-white' : 'text-slate-900'}`}>
                  {phase.label}
                </p>
                {recordId && (
                  <p className={`text-[10px] font-mono truncate mt-0.5 ${isCurrent ? 'text-slate-300' : 'text-slate-500'}`}>
                    ID: {recordId.substring(0, 8)}...
                  </p>
                )}
              </div>
            </div>
          );

          if (recordId) {
            return (
              <Link key={phase.id} to={`${phase.route}/${recordId}`} className="block group transition-transform active:scale-[0.98]">
                {cardContent}
              </Link>
            );
          }

          return (
            <div key={phase.id}>
              {cardContent}
            </div>
          );
        })}
      </div>
    </div>
  );
}
