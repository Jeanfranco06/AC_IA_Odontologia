import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { StatusBadge } from '@/shared/components/feedback/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card';
import { useToast } from '@/shared/hooks/use-toast';
import { TurnedState } from '@/domain/enums';
import { 
  useTurnedById, 
  useUpdateTurnedDetails,
  useAddFollowUp,
  useCreateNewRequest
} from '../hooks/useTurnedQueries';
import { FollowUpForm } from './FollowUpForm';
import { NewRequestDialog } from './NewRequestDialog';
import { TurnedDetailsForm } from './TurnedDetailsForm';
import type { TurnedDetailsFormValues, FollowUpFormValues, NewRequestFormValues } from '../schemas/turnedSchema';
import { AlertCircle, Bot, History, Plus, Phone, HeartHandshake } from 'lucide-react';
import type { TurnedWithDetails } from '@/application/use-cases/turned';
import { format, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { JourneyStepper } from '@/shared/components/data-display/JourneyStepper';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';


interface TurnedDetailModalProps {
  turnedId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TurnedDetailModal({ turnedId, isOpen, onClose }: TurnedDetailModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const journeys: any[] = [];

  const { data: turned, isLoading, isError } = useTurnedById(turnedId || '');
  const updateDetails = useUpdateTurnedDetails();
  const addFollowUp = useAddFollowUp();
  const createNewRequest = useCreateNewRequest();

  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);

  if (!isOpen || !turnedId) return null;

  const handleUpdateDetails = (data: TurnedDetailsFormValues) => {
    if (!turned) return;
    updateDetails.mutate({ id: turned.id, data }, {
      onSuccess: () => {
        toast({ title: 'Actualizado', description: 'Registro de cierre guardado exitosamente.' });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TURNED] });
      },
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const handleAddFollowUp = (data: FollowUpFormValues) => {
    if (!turned) return;
    addFollowUp.mutate({ id: turned.id, data }, {
      onSuccess: () => {
        toast({ title: 'Interacción Registrada', description: 'Seguimiento añadido correctamente al historial.' });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TURNED] });
      },
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const handleCreateNewRequest = (data: NewRequestFormValues) => {
    if (!turned) return;
    createNewRequest.mutate({ id: turned.id, data }, {
      onSuccess: () => {
        toast({ title: 'Reactivación Creada', description: 'Se ha creado un nuevo ciclo comercial en BUYER para este paciente.' });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TURNED] });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS] });
        setIsNewRequestOpen(false);
        onClose();
      },
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  // Agent Rules Engine Simulation
  const renderAgentPanel = (t: TurnedWithDetails) => {
    let message = '';
    const alerts = [];
    
    if (t.state === TurnedState.FOLLOW_UP_PENDING) {
      message = 'Este paciente terminó su atención recientemente. Debe contactarlo para evaluar su experiencia y nivel de recuperación.';
      alerts.push('Seguimiento inicial pendiente');
    } else if (t.state === TurnedState.IN_FOLLOW_UP) {
      message = 'Seguimiento en curso.';
      if (t.nextContactDate && isBefore(new Date(t.nextContactDate), startOfDay(new Date()))) {
        alerts.push(`Seguimiento vencido (Programado: ${format(new Date(t.nextContactDate), 'dd/MM/yyyy')})`);
      }
      const lastFollowUp = t.followUps[0];
      if (lastFollowUp && lastFollowUp.contactResult.toLowerCase().includes('no respond')) {
        alerts.push('Cliente sin respuesta en último intento');
      }
    } else if (t.state === TurnedState.CLOSED) {
      message = 'El seguimiento ha finalizado con éxito.';
      if (t.satisfaction && t.satisfaction <= 2) {
        alerts.push('Alerta: Satisfacción baja detectada');
      }
    } else if (t.state === TurnedState.NEW_REQUEST) {
      message = 'El paciente ha sido reactivado y ya cuenta con un nuevo recorrido comercial en curso.';
    }

    return (
      <div className="bg-teal-50/60 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/80 rounded-2xl p-4 flex gap-3.5 items-start">
        <Bot className="text-teal-600 dark:text-teal-400 w-8 h-8 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-bold text-xs text-teal-900 dark:text-teal-200 flex items-center gap-2">
            Asistente de Postventa y Fidelización <StatusBadge status="Activo" variant="primary" />
          </h4>
          <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">{message}</p>
          {alerts.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {alerts.map((a, i) => (
                <span key={i} className="text-[10px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {a}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Fixed Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 ring-4 ring-teal-50/70 dark:ring-teal-950/40 border border-teal-200/60 dark:border-teal-800/60">
                  <HeartHandshake className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Postventa y Fidelización (TURNED)
                  </DialogTitle>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    ID: {turned?.id}
                  </p>
                </div>
              </div>

              {turned && (
                <div className="flex items-center gap-2">
                  <StatusBadge status={turned.state} />
                  <Button 
                    disabled={turned.state === TurnedState.NEW_REQUEST || createNewRequest.isPending} 
                    onClick={() => setIsNewRequestOpen(true)}
                    className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-sm text-xs font-semibold px-3 py-2 h-8"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Registrar Nueva Solicitud
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>
        </div>

        {/* Scrollable Body without visible scrollbar */}
        <div className="p-5 sm:p-6 overflow-y-auto no-scrollbar flex-1 space-y-6">
          {isLoading ? (
            <LoadingState />
          ) : isError || !turned ? (
            <ErrorState message="No se encontró la información de postventa." />
          ) : (
            <div className="space-y-6">
              {journeys.find(j => j.turnedId === turned.id) && (
                <div className="py-2">
                  <JourneyStepper journey={journeys.find(j => j.turnedId === turned.id)!} />
                </div>
              )}

              {renderAgentPanel(turned)}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Columna Izquierda: Resumen de Atención */}
                <div className="space-y-4">
                  <Card className="shadow-sm border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 rounded-xl">
                    <CardHeader className="border-b border-slate-200/80 dark:border-slate-700/80 pb-3">
                      <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">Resumen de Atención</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3 text-xs">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Paciente</p>
                        <p className="font-semibold text-slate-900 dark:text-white mt-0.5">{turned.person?.firstName} {turned.person?.lastName}</p>
                        <p className="text-slate-500 dark:text-slate-400">{turned.person?.phone || '-'}</p>
                      </div>
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Tratamiento Realizado</p>
                        <p className="text-slate-700 dark:text-slate-300 mt-0.5">{turned.lead?.requestedServiceId || 'Consulta Odontológica'}</p>
                        <p className="text-slate-500 dark:text-slate-400">{turned.reservation?.professionalId || 'Sin asignar'} ({turned.reservation?.branchId || 'Sin sede'})</p>
                        <p className="text-slate-400 text-[10px] mt-0.5">Fecha fin: {turned.reservation?.date ? format(new Date(turned.reservation.date), 'dd MMM yyyy', { locale: es }) : 'Sin fecha'}</p>
                      </div>
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Procedimiento Clínico</p>
                        <p className="text-slate-700 dark:text-slate-300 mt-0.5">{turned.attention?.procedure || 'No registrado'}</p>
                      </div>
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Indicaciones Dadas</p>
                        <p className="text-slate-700 dark:text-slate-300 mt-0.5">{turned.attention?.instructions || 'No registrado'}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Columna Derecha: Cierre de Seguimiento & Historial */}
                <div className="md:col-span-2 space-y-4">
                  <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-800/70">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">Resultado y Cierre de Seguimiento</CardTitle>
                      <CardDescription className="text-xs dark:text-slate-400">
                        Registre la satisfacción y el estado final del tratamiento del paciente.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <TurnedDetailsForm 
                        formId="turned-details-form"
                        initialValues={turned} 
                        onSubmit={handleUpdateDetails} 
                        isLoading={updateDetails.isPending} 
                        hideSubmitButton={true}
                      />
                    </CardContent>
                  </Card>

                  {/* Formulario de Nuevo Contacto */}
                  <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-800/70">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <History className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Historial de Postventa e Interacciones
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {turned.state !== TurnedState.CLOSED && turned.state !== TurnedState.NEW_REQUEST && (
                        <div className="p-3.5 border border-slate-200/80 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/60">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mb-3">
                            <Phone className="w-3.5 h-3.5 text-teal-600" /> Registrar Nuevo Contacto
                          </h4>
                          <FollowUpForm onSubmit={handleAddFollowUp} isLoading={addFollowUp.isPending} />
                        </div>
                      )}
                      
                      {turned.followUps.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-3">
                          No hay interacciones de postventa registradas aún.
                        </p>
                      ) : (
                        <div className="space-y-3 pt-2">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {turned.followUps.map((f: any) => (
                            <div key={f.id} className="text-xs border-l-2 border-teal-500 pl-3 py-1 relative">
                              <div className="absolute w-2 h-2 bg-teal-500 rounded-full -left-[5px] top-2" />
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {format(new Date(f.date), 'dd MMM yyyy, HH:mm')} - <span className="text-teal-600 dark:text-teal-400 font-normal">{f.channel}</span>
                              </p>
                              <p className="text-slate-600 dark:text-slate-300 mt-0.5">Resultado: <span className="font-medium text-slate-800 dark:text-slate-200">{f.contactResult}</span></p>
                              <p className="mt-1 bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300">{f.observations}</p>
                              {f.nextFollowUpDate && (
                                <p className="text-[11px] text-slate-400 mt-1">
                                  Próximo contacto: {format(new Date(f.nextFollowUpDate), 'dd MMM yyyy')}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80 shrink-0 flex items-center justify-between gap-3 rounded-b-2xl">
          <div>
            {turned && turned.state !== TurnedState.NEW_REQUEST && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsNewRequestOpen(true)}
                disabled={createNewRequest.isPending}
                className="text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800 hover:bg-teal-50 dark:hover:bg-teal-950 text-xs rounded-xl h-9"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Nueva Solicitud
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs h-9 px-4"
            >
              Cerrar
            </Button>
            <Button
              form="turned-details-form"
              type="submit"
              disabled={updateDetails.isPending}
              className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold h-9 px-4 shadow-sm"
            >
              {updateDetails.isPending ? 'Guardando...' : 'Guardar Cierre (CLOSED)'}
            </Button>
          </div>
        </div>

        <NewRequestDialog
          isOpen={isNewRequestOpen}
          onClose={() => setIsNewRequestOpen(false)}
          onSubmit={handleCreateNewRequest}
          isLoading={createNewRequest.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
