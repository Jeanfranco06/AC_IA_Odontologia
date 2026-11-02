import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/shared/components/data-display/PageHeader';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { StatusBadge } from '@/shared/components/feedback/StatusBadge';
import type { FollowUp } from '@/domain/entities';
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
import { FollowUpForm } from '../components/FollowUpForm';
import { NewRequestDialog } from '../components/NewRequestDialog';
import { TurnedDetailsForm } from '../components/TurnedDetailsForm';
import type { TurnedDetailsFormValues, FollowUpFormValues, NewRequestFormValues } from '../schemas/turnedSchema';
import { AlertCircle, Bot, History, Plus, Phone } from 'lucide-react';
import type { TurnedWithDetails } from '@/application/use-cases/turned';
import { format, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { JourneyStepper } from '@/shared/components/data-display/JourneyStepper';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';


export default function TurnedDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const journeys: any[] = [];

  const { data: turned, isLoading, isError } = useTurnedById(id!);
  const updateDetails = useUpdateTurnedDetails();
  const addFollowUp = useAddFollowUp();
  const createNewRequest = useCreateNewRequest();

  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (isError || !turned) return <ErrorState message="No se encontró el registro TURNED." />;

  const handleUpdateDetails = (data: TurnedDetailsFormValues) => {
    updateDetails.mutate({ id: turned.id, data }, {
      onSuccess: () => toast({ title: 'Actualizado', description: 'Registro de cierre guardado.' }),
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const handleAddFollowUp = (data: FollowUpFormValues) => {
    addFollowUp.mutate({ id: turned.id, data }, {
      onSuccess: () => toast({ title: 'Interacción Registrada', description: 'Seguimiento añadido correctamente.' }),
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const handleCreateNewRequest = (data: NewRequestFormValues) => {
    createNewRequest.mutate({ id: turned.id, data }, {
      onSuccess: () => {
        toast({ title: 'Reactivación Creada', description: 'Se ha creado un nuevo BUYER para este paciente.' });
        navigate('/buyer');
      },
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  // Agent Rules Engine Simulation
  const renderAgentPanel = (t: TurnedWithDetails) => {
    let message = '';
    const alerts = [];
    
    if (t.state === TurnedState.FOLLOW_UP_PENDING) {
      message = 'Este paciente terminó su atención recientemente. Debe contactarlo para medir su satisfacción.';
      alerts.push('Seguimiento inicial pendiente');
    } else if (t.state === TurnedState.IN_FOLLOW_UP) {
      message = 'Seguimiento en curso.';
      if (t.nextContactDate && isBefore(new Date(t.nextContactDate), startOfDay(new Date()))) {
        alerts.push(`Seguimiento vencido (Programado para: ${format(new Date(t.nextContactDate), 'dd/MM/yyyy')})`);
      }
      const lastFollowUp = t.followUps[0];
      if (lastFollowUp && lastFollowUp.contactResult.toLowerCase().includes('no respond')) {
        alerts.push('Cliente sin respuesta en último intento');
      }
    } else if (t.state === TurnedState.CLOSED) {
      message = 'El seguimiento ha finalizado.';
      if (t.satisfaction && t.satisfaction <= 2) {
        alerts.push('Alerta: Satisfacción baja detectada');
      }
    } else if (t.state === TurnedState.NEW_REQUEST) {
      message = 'El paciente ha sido reactivado y ya cuenta con un nuevo recorrido comercial en curso.';
    }

    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex gap-4">
        <Bot className="text-blue-500 w-10 h-10 mt-1" />
        <div>
          <h4 className="font-semibold text-blue-900 flex items-center gap-2">
            Agente de Postventa <StatusBadge status="Simulado" variant="neutral" />
          </h4>
          <p className="text-sm text-blue-800 mt-1">{message}</p>
          {alerts.length > 0 && (
            <ul className="mt-2 space-y-1">
              {alerts.map((a, i) => (
                <li key={i} className="text-xs font-medium text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {a}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2">
        <PageHeader title="Postventa y Seguimiento" description={`Turned ID: ${turned.id}`} />
        <div className="flex flex-col items-end gap-2 mt-4 md:mt-0">
          <div className="flex items-center gap-4">
            <StatusBadge status={turned.state} />
            <Button 
              variant="outline"
              disabled={turned.state === TurnedState.NEW_REQUEST} 
              onClick={() => setIsNewRequestOpen(true)}
              className="gap-2 text-primary"
            >
              <Plus className="w-4 h-4" /> Registrar Nueva Solicitud
            </Button>
          </div>
        </div>
      </div>

      {journeys.find(j => j.turnedId === turned.id) && (
        <JourneyStepper journey={journeys.find(j => j.turnedId === turned.id)!} />
      )}

      {renderAgentPanel(turned)}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resumen de Atención</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-semibold text-muted-foreground">Paciente</p>
                <p>{turned.person?.firstName} {turned.person?.lastName}</p>
                <p>{turned.person?.phone || '-'}</p>
              </div>
              <div className="pt-2 border-t">
                <p className="font-semibold text-muted-foreground">Servicio y Profesional</p>
                <p>{turned.lead?.requestedServiceId || 'Consulta Odontológica'}</p>
                <p>{turned.reservation?.professionalId || 'Sin asignar'} ({turned.reservation?.branchId || 'Sin sede'})</p>
                <p>Fecha finalización: {turned.reservation?.date ? format(new Date(turned.reservation.date), 'dd MMM yyyy', { locale: es }) : 'Sin fecha'}</p>
              </div>
              <div className="pt-2 border-t">
                <p className="font-semibold text-muted-foreground">Procedimiento Realizado</p>
                <p className="text-xs mt-1">{turned.attention?.procedure || 'No registrado'}</p>
              </div>
              <div className="pt-2 border-t">
                <p className="font-semibold text-muted-foreground">Indicaciones Dadas</p>
                <p className="text-xs mt-1">{turned.attention?.instructions || 'No registrado'}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resultado y Cierre de Seguimiento</CardTitle>
              <CardDescription>Registre la satisfacción final para cerrar el recorrido.</CardDescription>
            </CardHeader>
            <CardContent>
              <TurnedDetailsForm 
                initialValues={turned} 
                onSubmit={handleUpdateDetails} 
                isLoading={updateDetails.isPending} 
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="w-5 h-5" /> Historial de Postventa
              </CardTitle>
            </CardHeader>
            <CardContent>
              {turned.state !== TurnedState.CLOSED && turned.state !== TurnedState.NEW_REQUEST && (
                <div className="mb-6 p-4 border rounded-lg bg-muted">
                  <h4 className="font-medium flex items-center gap-2 mb-4">
                    <Phone className="w-4 h-4" /> Nuevo Contacto
                  </h4>
                  <FollowUpForm onSubmit={handleAddFollowUp} isLoading={addFollowUp.isPending} />
                </div>
              )}
              
              {turned.followUps.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 border-t">
                  No hay interacciones de postventa registradas.
                </p>
              ) : (
                <div className="space-y-4">
                  {turned.followUps.map((f: FollowUp) => (
                    <div key={f.id} className="text-sm border-l-2 border-primary pl-4 pb-4 last:pb-0 relative">
                      <div className="absolute w-2 h-2 bg-primary rounded-full -left-[5px] top-1.5" />
                      <p className="font-semibold">
                        {format(new Date(f.date), 'dd MMM yyyy, HH:mm')} - {f.channel}
                      </p>
                      <p className="text-muted-foreground mt-1">Resultado: <span className="text-foreground">{f.contactResult}</span></p>
                      <p className="mt-2 bg-muted p-2 rounded">{f.observations}</p>
                      {f.nextFollowUpDate && (
                        <p className="text-xs text-muted-foreground mt-2">
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

      <NewRequestDialog
        isOpen={isNewRequestOpen}
        onClose={() => setIsNewRequestOpen(false)}
        onSubmit={handleCreateNewRequest}
        isLoading={createNewRequest.isPending}
      />
    </div>
  );
}
