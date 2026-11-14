import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { StatusBadge } from '@/shared/components/feedback/StatusBadge';
import { ConfirmationDialog } from '@/shared/components/feedback/ConfirmationDialog';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { useToast } from '@/shared/hooks/use-toast';
import { CustomerState } from '@/domain/enums';
import { 
  useCustomer, 
  useChangeCustomerState, 
  useStartAttention, 
  useFinishAttention, 
  useRegisterAttentionDetails,
  useRegisterCustomerIncident,
  useConvertCustomerToTurned,
  useSaveSessionAttention,
  useCloseSession
} from '../hooks/useCustomerQueries';
import { DentalAttentionForm, type DentalAttentionFormRef } from './DentalAttentionForm';
import type { DentalAttentionFormValues } from '../schemas/customerSchema';
import { 
  Play, 
  CheckSquare, 
  XCircle, 
  UserX, 
  ArrowRight, 
  AlertTriangle, 
  Stethoscope, 
  User, 
  Calendar, 
  Clock, 
  MapPin, 
  ShieldAlert,
  Save,
  CheckCircle2,
  Phone,
  Mail,
  FileCheck,
  Lock,
  FileEdit,
  UserCheck,
  Award,
  Sparkles,
  FileText,
  Printer,
  ChevronRight,
  Layers,
  HeartPulse,
  Info,
  Send,
  MessageSquare
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';
import { useSendImmediateReminder } from '../hooks/useCustomerQueries';

interface CustomerDetailModalProps {
  customerId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const formatAppointmentDate = (dateStr?: string, timeStr?: string) => {
  if (!dateStr || dateStr === '-') return '-';
  try {
    const cleanDate = dateStr.split('T')[0];
    const [year, month, day] = cleanDate.split('-').map(Number);
    if (!year || !month || !day) return dateStr;
    const formatted = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    return timeStr ? `${formatted} · ${timeStr}` : formatted;
  } catch {
    return dateStr;
  }
};

const formatPeruTime = (isoString?: string) => {
  if (!isoString || isoString === '-') return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  } catch {
    return isoString;
  }
};

export function CustomerDetailModal({ customerId, isOpen, onClose }: CustomerDetailModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: customer, isLoading, isError } = useCustomer(customerId || '');
  const changeState = useChangeCustomerState();
  const startAttention = useStartAttention();
  const finishAttention = useFinishAttention();
  const registerDetails = useRegisterAttentionDetails();
  const registerIncident = useRegisterCustomerIncident();
  const convertTurned = useConvertCustomerToTurned();
  const saveSessionAttention = useSaveSessionAttention();
  const closeSession = useCloseSession();
  const sendImmediateReminder = useSendImmediateReminder();

  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [incidentReason, setIncidentReason] = useState('');
  const [incidentError, setIncidentError] = useState('');
  const [isIncidentOpen, setIsIncidentOpen] = useState(false);
  const dentalFormRef = useRef<DentalAttentionFormRef>(null);

  // Sesión actualmente seleccionada en el timeline
  const [selectedSessionIdx, setSelectedSessionIdx] = useState<number>(0);

  const treatment = customer?.treatment;
  const sessions = useMemo(() => treatment?.sessions || [], [treatment]);

  // Al cargar el cliente, seleccionar por defecto la primera sesión pendiente o en curso
  useEffect(() => {
    if (sessions.length > 0) {
      const pendingIdx = sessions.findIndex((s: any) => s.statusClosure !== 'Cerrada');
      setSelectedSessionIdx(pendingIdx >= 0 ? pendingIdx : sessions.length - 1);
    }
  }, [sessions.length]);

  const activeSession = sessions[selectedSessionIdx] || null;

  // Valores iniciales limpios según la sesión seleccionada:
  // Si la sesión aún no ha sido atendida, los campos de procedimiento y notas inician TOTALMENTE VACÍOS
  const sessionInitialValues = useMemo<Partial<DentalAttentionFormValues>>(() => {
    if (activeSession?.attention) {
      return {
        reasonForConsultation: activeSession.attention.diagnosis || '',
        evaluation: activeSession.attention.evaluation || '',
        procedure: activeSession.attention.procedure || '',
        instructions: activeSession.attention.instructions || '',
        observations: activeSession.attention.observations || '',
        relevantBackground: customer?.attention?.relevantBackground || '',
        allergies: customer?.attention?.allergies || 'Ninguna alergia medicamentosa documentada',
      };
    }
    return {
      reasonForConsultation: '',
      evaluation: '',
      procedure: '',
      instructions: '',
      observations: '',
      relevantBackground: customer?.attention?.relevantBackground || '',
      allergies: customer?.attention?.allergies || 'Ninguna alergia medicamentosa documentada',
    };
  }, [activeSession?.id, activeSession?.attention, customer?.attention?.relevantBackground, customer?.attention?.allergies]);

  if (!isOpen || !customerId) return null;

  const isTurned = customer?.currentPhase === 'TURNED' || customer?.isTurned;
  const isSessionClosed = activeSession?.statusClosure === 'Cerrada';
  const isPlanCompleted = treatment?.isReadyForTurned;

  const handleStateChange = (state: CustomerState, successMsg: string) => {
    if (!customer) return;
    changeState.mutate({ id: customer.id, state }, {
      onSuccess: () => {
        toast({ title: 'Estado Actualizado', description: successMsg });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
        queryClient.refetchQueries({ queryKey: [QUERY_KEYS.CUSTOMERS, customer.id] });
      },
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const handleStartAttention = () => {
    if (!customer) return;
    const time = new Date().toLocaleTimeString();
    startAttention.mutate({ id: customer.id, time }, {
      onSuccess: () => {
        toast({ title: 'Atención Iniciada', description: 'La consulta odontológica ha comenzado en consultorio.' });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
        queryClient.refetchQueries({ queryKey: [QUERY_KEYS.CUSTOMERS, customer.id] });
      },
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const handleSendWhatsAppReminder = () => {
    if (!customer) return;
    const personId = Number(customer.person?.id || customer.id);
    const sessionId = activeSession?.id && activeSession.id > 0 ? activeSession.id : undefined;

    sendImmediateReminder.mutate({ personId, sessionId }, {
      onSuccess: (res: any) => {
        toast({
          title: 'Recordatorio Enviado por WhatsApp',
          description: res.message || 'El mensaje interactivo con botones de confirmación fue despachado al paciente.',
        });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
        queryClient.refetchQueries({ queryKey: [QUERY_KEYS.CUSTOMERS, customer.id] });
      },
      onError: (err: any) => {
        toast({
          title: 'Error al Enviar WhatsApp',
          description: err.message || 'No se pudo enviar el recordatorio interactivo.',
          variant: 'destructive',
        });
      }
    });
  };

  // Guardar datos clínicos de la sesión activa
  const handleSaveSessionDetails = (formData: DentalAttentionFormValues) => {
    if (!customer) return;
    if (activeSession && activeSession.id > 0) {
      saveSessionAttention.mutate({
        id: customer.id,
        sessionId: activeSession.id,
        data: formData
      }, {
        onSuccess: () => {
          toast({ title: 'Evolución Guardada', description: `Detalles de la sesión #${activeSession.sessionNumber} actualizados en base de datos.` });
          queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
          queryClient.refetchQueries({ queryKey: [QUERY_KEYS.CUSTOMERS, customer.id] });
        },
        onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
      });
    } else {
      registerDetails.mutate({ id: customer.id, data: formData }, {
        onSuccess: () => {
          toast({ title: 'Ficha Guardada', description: 'Registros clínicos actualizados en la base de datos.' });
          queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
          queryClient.refetchQueries({ queryKey: [QUERY_KEYS.CUSTOMERS, customer.id] });
        },
        onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
      });
    }
  };

  // Cerrar la sesión clínica actual
  const handleCloseActiveSession = () => {
    if (!customer || !activeSession) return;
    const liveVals = dentalFormRef.current?.getValues() || sessionInitialValues;
    if (!liveVals.procedure?.trim()) {
      toast({
        title: 'Procedimiento Requerido',
        description: 'Debe ingresar el procedimiento clínico ejecutado antes de cerrar la sesión.',
        variant: 'destructive',
      });
      return;
    }

    if (activeSession.id > 0) {
      closeSession.mutate({
        id: customer.id,
        sessionId: activeSession.id,
        data: liveVals
      }, {
        onSuccess: () => {
          toast({
            title: `Sesión #${activeSession.sessionNumber} Cerrada`,
            description: 'Sesión concluida formalmente con registro documental completo.',
          });
          queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
          queryClient.refetchQueries({ queryKey: [QUERY_KEYS.CUSTOMERS, customer.id] });
        },
        onError: (err) => toast({ title: 'Error al cerrar sesión', description: err.message, variant: 'destructive' })
      });
    } else {
      finishAttention.mutate({ id: customer.id, time: new Date().toLocaleTimeString() }, {
        onSuccess: () => {
          toast({ title: 'Atención Finalizada', description: 'La consulta clínica ha sido cerrada.' });
          queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
          queryClient.refetchQueries({ queryKey: [QUERY_KEYS.CUSTOMERS, customer.id] });
        },
        onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
      });
    }
  };

  // Alta Médica y Transferencia a TURNED
  const handleConfirmDischargeTurned = () => {
    if (!customer) return;
    const liveVals = dentalFormRef.current?.getValues() || sessionInitialValues;
    convertTurned.mutate({ id: customer.id, data: liveVals }, {
      onSuccess: () => {
        toast({ 
          title: 'Alta Médica Concedida y Transferido a TURNED', 
          description: 'El paciente ha culminado su tratamiento satisfactoriamente. Se ha enviado el correo de activación del portal.' 
        });
        setIsConvertOpen(false);
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TURNED] });
        onClose();
      },
      onError: (err) => {
        toast({ title: 'Bloqueo de Transición (R11/R12)', description: err.message, variant: 'destructive' });
        setIsConvertOpen(false);
      }
    });
  };

  const handleRegisterIncident = () => {
    if (!customer) return;
    if (incidentReason.trim().length < 10) {
      setIncidentError('El motivo de la incidencia debe contener al menos 10 caracteres');
      return;
    }
    setIncidentError('');
    registerIncident.mutate({ id: customer.id, reason: incidentReason }, {
      onSuccess: () => {
        toast({ title: 'Incidencia Registrada', description: 'Se guardó el reporte de soporte correctamente.' });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
        setIsIncidentOpen(false);
        setIncidentReason('');
      },
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const canEditActiveSession = !isTurned && !isSessionClosed;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto bg-[#fbf9f3] dark:bg-[#151c19] text-[#1c2420] dark:text-[#e9e7df] border border-[#d9d2c2] dark:border-[#26312c] p-0 rounded-2xl shadow-2xl">
        
        {/* Cabecera Editorial NexoSalud */}
        <div className="border-b border-[#d9d2c2] dark:border-[#26312c] bg-[#f3efe6] dark:bg-[#101714] p-6 pb-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--pt-accent)] bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                  Ficha Clínica & Tratamiento
                </span>
                <span className="text-xs text-[color:var(--pt-muted)] font-mono">
                  EXP-N° {customer?.id || customerId}
                </span>
              </div>
              <h2 className="text-2xl font-serif font-bold text-[color:var(--pt-ink)] mt-1.5">
                {customer?.person?.firstName} {customer?.person?.lastName}
              </h2>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-[color:var(--pt-muted)]">
                <span className="font-semibold text-[color:var(--pt-ink-2)]">DNI: {customer?.person?.documentNumber || 'No reg.'}</span>
                <span>·</span>
                <span>{treatment?.serviceName || customer?.lead?.requestedServiceId || 'Consulta Odontológica'}</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Stethoscope className="w-3.5 h-3.5 text-[color:var(--pt-accent)]" />
                  {treatment?.professional || customer?.reservation?.professionalId || 'Especialista'}
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  {treatment?.branch || customer?.reservation?.branchId || 'Sede California'}
                </span>
              </div>
            </div>

            {/* Badge de Etapa y Estado de Alta / Confirmación */}
            <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
              {activeSession?.patientConfirmation === 'Confirmada' && !isSessionClosed && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/70 border border-teal-300 dark:border-teal-700 text-teal-800 dark:text-teal-200 text-xs font-bold shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>Asistencia Confirmada vía WhatsApp</span>
                </div>
              )}
              {isTurned ? (
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-teal-50 dark:bg-teal-950/80 border border-teal-300 dark:border-teal-700 text-teal-900 dark:text-teal-200 text-xs font-bold">
                  <Award className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>Alta Médica Concedida (TURNED)</span>
                </div>
              ) : isPlanCompleted ? (
                <Button
                  onClick={() => setIsConvertOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs h-10 px-4 gap-2 shadow-sm animate-pulse"
                >
                  <Award className="w-4 h-4" />
                  Otorgar Alta Médica y Transferir a TURNED
                </Button>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                  <Clock className="w-4 h-4" />
                  <span>Tratamiento en Curso (CUSTOMER)</span>
                </div>
              )}
            </div>
          </div>

          {/* Barra de Progreso del Tratamiento Multisesión */}
          {treatment && (
            <div className="mt-5 pt-4 border-t border-[color:var(--pt-line)]">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-[color:var(--pt-ink-2)] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[color:var(--pt-accent)]" />
                  Avance del Plan Clínico:
                  <strong className="text-[color:var(--pt-ink)]">
                    {treatment.completedSessions} de {treatment.totalSessions} sesiones concluidas
                  </strong>
                </span>
                <span className="font-mono font-bold text-[color:var(--pt-accent)]">
                  {treatment.progressPercent}%
                </span>
              </div>
              <div className="w-full bg-[var(--pt-line)] h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-[var(--pt-accent)] h-full transition-all duration-500 rounded-full"
                  style={{ width: `${treatment.progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Cuerpo Principal del Modal */}
        <div className="p-6 space-y-6">
          {isLoading ? (
            <LoadingState />
          ) : isError || !customer ? (
            <ErrorState message="No se pudo cargar la información del paciente." />
          ) : (
            <>
              {/* Cronograma Interactivo de Sesiones (Selector de Timeline) */}
              <div className="bg-[var(--pt-surface)] p-4 rounded-2xl border border-[color:var(--pt-line)]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[color:var(--pt-ink-2)] flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[color:var(--pt-accent)]" />
                    Cronograma de Sesiones Planificadas
                  </span>
                  <span className="text-[11px] text-[color:var(--pt-muted)]">
                    Seleccione una sesión para consultar su historial o registrar su evolución clínica
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {sessions.map((ses: any, idx: number) => {
                    const isSelected = idx === selectedSessionIdx;
                    const isClosed = ses.statusClosure === 'Cerrada';
                    const isRealizada = ses.statusAssist === 'Realizada';

                    return (
                      <button
                        key={ses.id || idx}
                        type="button"
                        onClick={() => setSelectedSessionIdx(idx)}
                        className={`text-left p-3 rounded-xl border transition-all relative ${
                          isSelected
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-[color:var(--pt-accent)] shadow-sm ring-1 ring-[color:var(--pt-accent)]'
                            : 'bg-[var(--pt-paper)] border-[color:var(--pt-line)] hover:border-[color:var(--pt-line-strong)]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs text-[color:var(--pt-ink)]">
                            Sesión {ses.sessionNumber}
                          </span>
                          {isClosed ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded">
                              <CheckCircle2 className="w-3 h-3" /> Cerrada
                            </span>
                          ) : ses.patientConfirmation === 'Confirmada' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-300/80 dark:border-teal-700 px-1.5 py-0.5 rounded">
                              <CheckCircle2 className="w-3 h-3 text-teal-600 dark:text-teal-400" /> Confirmada WhatsApp
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                              <Clock className="w-3 h-3" /> {ses.statusProg || 'Programada'}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[color:var(--pt-muted)]">
                          {formatAppointmentDate(ses.scheduledDate)}
                        </p>
                        <div className="mt-2 text-[10px] text-[color:var(--pt-ink-2)] truncate">
                          {ses.patientConfirmation === 'Confirmada' ? (
                            <span className="text-teal-700 dark:text-teal-300 font-semibold flex items-center gap-1">
                              <CheckSquare className="w-3 h-3" /> Asistencia confirmada
                            </span>
                          ) : ses.attention?.procedure ? (
                            <span className="italic truncate block">{ses.attention.procedure}</span>
                          ) : (
                            <span className="text-[color:var(--pt-muted)]">Pendiente de atención</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Banner de Estado de la Sesión Seleccionada */}
              {activeSession && (
                <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
                  isSessionClosed 
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200' 
                    : activeSession.patientConfirmation === 'Confirmada'
                      ? 'bg-teal-50/90 dark:bg-teal-950/40 border-teal-300 dark:border-teal-700/80 text-teal-950 dark:text-teal-100 shadow-xs'
                      : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
                }`}>
                  <div className="flex items-center gap-2.5">
                    {isSessionClosed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : activeSession.patientConfirmation === 'Confirmada' ? (
                      <CheckCircle2 className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0" />
                    ) : (
                      <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                    )}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm">
                          Sesión #{activeSession.sessionNumber}: {isSessionClosed ? 'Atención Concluida y Cerrada' : 'Sesión Activa / En Proceso'}
                        </h4>
                        {activeSession.patientConfirmation === 'Confirmada' && !isSessionClosed && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-800 dark:text-teal-200 bg-teal-100 dark:bg-teal-900 px-2.5 py-0.5 rounded-full border border-teal-300 dark:border-teal-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" /> Asistencia Confirmada vía WhatsApp
                          </span>
                        )}
                      </div>
                      <p className="text-xs opacity-90 mt-0.5">
                        {isSessionClosed 
                          ? 'Esta sesión ha completado su ejecución clínica y cuenta con registro documental validado en historia clínica.' 
                          : activeSession.patientConfirmation === 'Confirmada'
                            ? `El paciente ${customer?.person?.firstName || 'Daniel'} confirmó su cita por WhatsApp${activeSession.confirmationDate ? ` (${formatPeruTime(activeSession.confirmationDate)})` : ''}. El sillón y materiales están preparados.`
                            : 'Sesión en curso. Inicie la atención en consultorio o complete la ficha para cerrar la sesión.'}
                      </p>
                    </div>
                  </div>

                  {/* Acciones para Sesión Abierta */}
                  {!isSessionClosed && !isTurned && (
                    <div className="flex flex-wrap items-center gap-2 self-end md:self-auto">
                      <Button
                        size="sm"
                        type="button"
                        onClick={handleSendWhatsAppReminder}
                        disabled={sendImmediateReminder.isPending}
                        className="bg-emerald-600/90 hover:bg-emerald-600 text-white font-semibold text-xs h-8 rounded-lg shadow-2xs gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {sendImmediateReminder.isPending ? 'Enviando WhatsApp...' : 'Enviar Recordatorio WhatsApp'}
                      </Button>

                      {customer.state === CustomerState.SCHEDULED && (
                        <Button 
                          size="sm"
                          onClick={() => handleStateChange(CustomerState.ATTENDANCE_CONFIRMED, 'Asistencia del paciente confirmada')}
                          className="bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs h-8 rounded-lg"
                        >
                          <CheckSquare className="w-3.5 h-3.5 mr-1.5" /> Confirmar Asistencia
                        </Button>
                      )}

                      {customer.state === CustomerState.ATTENDANCE_CONFIRMED && (
                        <Button 
                          size="sm"
                          onClick={handleStartAttention}
                          className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs h-8 rounded-lg"
                        >
                          <Play className="w-3.5 h-3.5 mr-1.5" /> Iniciar en Box
                        </Button>
                      )}

                      <Button 
                        size="sm"
                        onClick={handleCloseActiveSession}
                        disabled={closeSession.isPending}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-8 rounded-lg shadow-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                        {closeSession.isPending ? 'Cerrando...' : 'Cerrar Sesión Clínica'}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Layout Dividido: Columna Izquierda (Ficha y Copiloto) | Columna Derecha (Historial, Indicaciones, Antecedentes) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* Columna Izquierda (2 cols): Evolución & Copiloto */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Si la sesión está cerrada, mostrar ficha en modo visual editorial completo */}
                  {isSessionClosed ? (
                    <Card className="rounded-2xl border-[color:var(--pt-line)] bg-[var(--pt-surface)] shadow-sm overflow-hidden">
                      <CardHeader className="p-4 pb-3 border-b border-[color:var(--pt-line)] bg-[var(--pt-paper)]">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-xs font-bold uppercase tracking-wider text-[color:var(--pt-ink-2)] flex items-center gap-2">
                            <FileCheck className="w-4 h-4 text-emerald-600" />
                            Registro Clínico de la Sesión #{activeSession.sessionNumber}
                          </CardTitle>
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Solo Lectura · Documentado
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="p-5 space-y-4 text-xs">
                        <div>
                          <span className="font-bold text-[color:var(--pt-muted)] uppercase tracking-wider text-[10px] block mb-0.5">
                            Motivo de Consulta & Diagnóstico
                          </span>
                          <p className="text-sm font-medium text-[color:var(--pt-ink)] bg-[var(--pt-paper)] p-3 rounded-xl border border-[color:var(--pt-line)]">
                            {activeSession.attention?.diagnosis || 'Evaluación diagnóstica regular.'}
                          </p>
                        </div>

                        <div>
                          <span className="font-bold text-[color:var(--pt-muted)] uppercase tracking-wider text-[10px] block mb-0.5">
                            Procedimiento Clínico Ejecutado
                          </span>
                          <p className="text-sm font-medium text-[color:var(--pt-ink)] bg-[var(--pt-paper)] p-3 rounded-xl border border-[color:var(--pt-line)]">
                            {activeSession.attention?.procedure || 'Procedimiento completado según plan.'}
                          </p>
                        </div>

                        {activeSession.attention?.evaluation && (
                          <div>
                            <span className="font-bold text-[color:var(--pt-muted)] uppercase tracking-wider text-[10px] block mb-0.5">
                              Evaluación & Hallazgos
                            </span>
                            <p className="text-xs text-[color:var(--pt-ink-2)] bg-[var(--pt-paper)] p-3 rounded-xl border border-[color:var(--pt-line)]">
                              {activeSession.attention.evaluation}
                            </p>
                          </div>
                        )}

                        {activeSession.attention?.observations && (
                          <div>
                            <span className="font-bold text-[color:var(--pt-muted)] uppercase tracking-wider text-[10px] block mb-0.5">
                              Observaciones Odontológicas
                            </span>
                            <p className="text-xs text-[color:var(--pt-ink-2)] bg-[var(--pt-paper)] p-3 rounded-xl border border-[color:var(--pt-line)]">
                              {activeSession.attention.observations}
                            </p>
                          </div>
                        )}

                        {/* Indicaciones emitidas para esta sesión */}
                        {activeSession.attention?.aftercareList && activeSession.attention.aftercareList.length > 0 && (
                          <div className="pt-2">
                            <span className="font-bold text-[color:var(--pt-accent)] uppercase tracking-wider text-[10px] flex items-center gap-1.5 mb-2">
                              <FileText className="w-3.5 h-3.5" />
                              Indicaciones Postoperatorias Oficiales Emitidas
                            </span>
                            <div className="space-y-2">
                              {activeSession.attention.aftercareList.map((ind: any) => (
                                <div key={ind.id} className="p-3.5 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 text-xs">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-teal-800 dark:text-teal-200 font-mono">
                                      {ind.code} · {ind.status}
                                    </span>
                                    <span className="text-[10px] text-teal-600 dark:text-teal-400">
                                      {formatPeruTime(ind.issuedAt)}
                                    </span>
                                  </div>
                                  <p className="text-[color:var(--pt-ink)] whitespace-pre-line leading-relaxed font-sans text-[11px]">
                                    {ind.content}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      {/* Formulario Clínico Editable */}
                      <Card className="shadow-sm border-[color:var(--pt-line)] bg-[var(--pt-surface)] rounded-2xl overflow-hidden">
                        <CardHeader className="border-b border-[color:var(--pt-line)] p-4 bg-[var(--pt-paper)]">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-[color:var(--pt-ink-2)] flex items-center gap-2">
                              <FileEdit className="w-4 h-4 text-[color:var(--pt-accent)]" />
                              Ficha de Evolución · Sesión #{activeSession ? activeSession.sessionNumber : 1}
                            </CardTitle>
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                              <FileEdit className="w-3.5 h-3.5" />
                              Modo Registro Activo
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <DentalAttentionForm 
                            key={activeSession ? `ses-${activeSession.id}-${activeSession.sessionNumber}` : `cust-${customer?.id}`}
                            ref={dentalFormRef}
                            formId="customer-dental-form"
                            initialValues={sessionInitialValues} 
                            onSubmit={handleSaveSessionDetails}
                            isLoading={saveSessionAttention.isPending || registerDetails.isPending}
                            disabled={!canEditActiveSession}
                            hideSubmitButton={false}
                          />
                        </CardContent>
                      </Card>
                    </>
                  )}
                </div>

                {/* Columna Derecha (1 col): Datos del Paciente, Salud Odontológica Inicial e Incidencias */}
                <div className="space-y-4">
                  
                  {/* Tarjeta de Datos de Contacto & Tratamiento */}
                  <Card className="shadow-sm border-[color:var(--pt-line)] bg-[var(--pt-surface)] rounded-2xl overflow-hidden">
                    <CardHeader className="border-b border-[color:var(--pt-line)] p-4 bg-[var(--pt-paper)]">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-[color:var(--pt-ink-2)] flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-[color:var(--pt-accent)]" />
                        Expediente & Cita
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-[color:var(--pt-muted)] uppercase tracking-wider block">
                          Paciente
                        </span>
                        <p className="font-bold text-[color:var(--pt-ink)] text-sm mt-0.5">
                          {customer.person?.firstName} {customer.person?.lastName}
                        </p>
                        <div className="flex flex-col gap-0.5 mt-1 text-[11px] text-[color:var(--pt-muted)]">
                          <span>DNI: {customer.person?.documentNumber || 'No registrado'}</span>
                          {customer.person?.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {customer.person.phone}
                            </span>
                          )}
                          {customer.person?.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" /> {customer.person.email}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-[color:var(--pt-line)]">
                        <span className="text-[10px] font-bold text-[color:var(--pt-muted)] uppercase tracking-wider block">
                          Especialidad & Tratamiento
                        </span>
                        <p className="font-semibold text-[color:var(--pt-accent)] mt-0.5">
                          {treatment?.serviceName || customer.lead?.requestedServiceId || 'Consulta Odontológica'}
                        </p>
                        <p className="text-[color:var(--pt-muted)] mt-0.5 text-[11px]">
                          Responsable: {treatment?.professional || customer.reservation?.professionalId || 'Especialista'}
                        </p>
                      </div>

                      {/* Salud Odontológica Inicial (Cuestionario / Triaje) */}
                      {customer.saludOdontologica && (
                        <div className="pt-2.5 border-t border-[color:var(--pt-line)] space-y-1.5">
                          <span className="text-[10px] font-bold text-[color:var(--pt-muted)] uppercase tracking-wider block">
                            Triaje Odontológico Inicial
                          </span>
                          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                            <div className="bg-[var(--pt-paper)] p-2 rounded-lg border border-[color:var(--pt-line)]">
                              <span className="text-[color:var(--pt-muted)] block text-[10px]">Dolor:</span>
                              <strong className="text-[color:var(--pt-ink)]">{customer.saludOdontologica.nivelDolor || 'Ninguno'}</strong>
                            </div>
                            <div className="bg-[var(--pt-paper)] p-2 rounded-lg border border-[color:var(--pt-line)]">
                              <span className="text-[color:var(--pt-muted)] block text-[10px]">Sensibilidad:</span>
                              <strong className="text-[color:var(--pt-ink)]">{customer.saludOdontologica.sensibilidad || 'No'}</strong>
                            </div>
                          </div>
                          {customer.saludOdontologica.motivoConsulta && (
                            <p className="text-[11px] text-[color:var(--pt-muted)] italic pt-1">
                              &ldquo;{customer.saludOdontologica.motivoConsulta}&rdquo;
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Tarjeta de Incidencias de Soporte */}
                  <Card className="rounded-2xl border-[color:var(--pt-line)] bg-[var(--pt-surface)] shadow-sm overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between p-4 pb-2.5 border-b border-[color:var(--pt-line)]">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-[color:var(--pt-ink-2)] flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                        Incidencias ({customer.incidents?.length || 0})
                      </CardTitle>
                      <Button 
                        type="button"
                        variant="outline" 
                        size="sm" 
                        className="h-7 px-2.5 text-xs font-semibold rounded-lg"
                        onClick={() => setIsIncidentOpen(true)}
                      >
                        + Reportar
                      </Button>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2">
                      {customer.incidents?.length === 0 ? (
                        <p className="text-xs text-[color:var(--pt-muted)] italic">
                          Sin incidencias reportadas.
                        </p>
                      ) : (
                        customer.incidents?.map((inc: any) => (
                          <div key={inc.id} className="p-2.5 rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-paper)] text-xs">
                            <div className="flex items-center justify-between text-[10px] text-[color:var(--pt-muted)] mb-1">
                              <span className="font-bold">{inc.status}</span>
                              <span>{formatPeruTime(inc.createdAt)}</span>
                            </div>
                            <p className="text-[color:var(--pt-ink)]">{inc.reason}</p>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  {/* Banner de Alta Médica Final */}
                  <div className={`p-4 rounded-2xl border text-xs ${
                    isPlanCompleted 
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200' 
                      : 'bg-[var(--pt-surface)] border-[color:var(--pt-line)] text-[color:var(--pt-muted)]'
                  }`}>
                    <div className="flex items-start gap-2">
                      <Award className={`w-4 h-4 shrink-0 mt-0.5 ${isPlanCompleted ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <div className="space-y-1">
                        <p className="font-bold text-xs">
                          {isPlanCompleted ? 'Criterio Clínico Cumplido (R11)' : 'Criterio de Alta Médica (R11/R12)'}
                        </p>
                        <p className="text-[11px] leading-relaxed">
                          {isPlanCompleted 
                            ? 'Todas las sesiones planificadas han sido completadas. Puede emitir el alta formal y transferir a fidelización.' 
                            : `Plan multisesión en curso (${treatment?.completedSessions || 0} de ${treatment?.totalSessions || 1} completadas). El alta se habilita al concluir el 100% de las sesiones.`}
                        </p>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            </>
          )}
        </div>

        {/* Modal de Confirmación de Alta Médica y Transferencia a TURNED */}
        <ConfirmationDialog
          isOpen={isConvertOpen}
          onClose={() => setIsConvertOpen(false)}
          onConfirm={handleConfirmDischargeTurned}
          title="¿Otorgar Alta Médica y Transferir a TURNED?"
          description={`Se confirmará el fin satisfactorio del tratamiento para ${customer?.person?.firstName} ${customer?.person?.lastName}. El sistema registrará el alta formal en la historia clínica, marcará el tratamiento como COMPLETADO y enviará por correo las indicaciones y la invitación para acceder al Portal del Paciente.`}
          confirmText="Sí, Otorgar Alta Médica"
          cancelText="Continuar en Tratamiento"
          isLoading={convertTurned.isPending}
        />

        {/* Modal para Reportar Incidencia */}
        <Dialog open={isIncidentOpen} onOpenChange={setIsIncidentOpen}>
          <DialogContent className="sm:max-w-md bg-[var(--pt-paper)] text-[color:var(--pt-ink)] border border-[color:var(--pt-line)]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                Registrar Incidencia de Soporte
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-xs text-[color:var(--pt-muted)]">
                Detalle cualquier inconveniente clínico, asistencial o administrativo presentado durante la cita.
              </p>
              <div className="space-y-2">
                <Input
                  value={incidentReason}
                  onChange={(e) => {
                    setIncidentReason(e.target.value);
                    if (e.target.value.trim().length >= 10) setIncidentError('');
                  }}
                  placeholder="Descripción detallada del incidente (mínimo 10 caracteres)..."
                  className="text-xs"
                />
                {incidentError && (
                  <p className="text-xs text-rose-500 font-medium">{incidentError}</p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setIsIncidentOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleRegisterIncident}
                  disabled={registerIncident.isPending}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {registerIncident.isPending ? 'Guardando...' : 'Guardar Reporte'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </DialogContent>
    </Dialog>
  );
}
