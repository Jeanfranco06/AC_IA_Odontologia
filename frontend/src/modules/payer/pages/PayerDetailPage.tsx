import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/shared/components/data-display/PageHeader';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { StatusBadge } from '@/shared/components/feedback/StatusBadge';
import { ConfirmationDialog } from '@/shared/components/feedback/ConfirmationDialog';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { useToast } from '@/shared/hooks/use-toast';
import { PayerState, normalizePayerState } from '@/domain/enums';
import { 
  usePayer, 
  useRegisterPayment, 
  useValidatePayment, 
  useRejectPayment, 
  useRevertPayment,
  useConvertPayerToCustomer 
} from '../hooks/usePayerQueries';
import { PaymentForm } from '../components/PaymentForm';
import { YapePaymentButton } from '../components/YapePaymentButton';
import { PaymentNoticePdfModal } from '../components/PaymentNoticePdfModal';
import type { PaymentFormValues } from '../schemas/payerSchema';
import { AlertCircle, FileText, Bot, ArrowRight, XCircle } from 'lucide-react';
import type { PayerWithDetails } from '@/application/use-cases/payer';
import { JourneyStepper } from '@/shared/components/data-display/JourneyStepper';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';

export default function PayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const journeys: any[] = [];

  const { data: payer, isLoading, isError } = usePayer(id!);
  const registerPayment = useRegisterPayment();
  const validatePayment = useValidatePayment();
  const rejectPayment = useRejectPayment();
  const revertPayment = useRevertPayment();
  const convertToCustomer = useConvertPayerToCustomer();

  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [revertReason, setRevertReason] = useState('');
  const [isRevertOpen, setIsRevertOpen] = useState(false);

  // Detector de retorno automático desde Yape / Mercado Pago
  useEffect(() => {
    const status = searchParams.get('status');
    const paymentId = searchParams.get('payment_id');

    if (status === 'approved' && payer && normalizePayerState(payer.state) !== PayerState.VALIDADO) {
      validatePayment.mutate(payer.id, {
        onSuccess: () => {
          toast({
            title: '¡Pago de Yape Verificado en Vivo! 🎉',
            description: `Transacción aprobada por Mercado Pago (Ref: ${paymentId || 'YAPE_0.10'}). Estado cambiado a VALIDADO.`,
          });
          setSearchParams({}, { replace: true });
        }
      });
    }
  }, [searchParams, payer]);

  if (isLoading) return <LoadingState />;
  if (isError || !payer) return <ErrorState message="No se encontró el Payer." />;

  const handleRegisterPayment = (data: PaymentFormValues) => {
    registerPayment.mutate({ id: payer.id, data }, {
      onSuccess: () => toast({ title: 'Éxito', description: 'Pago enviado a revisión.' }),
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const handleValidate = () => {
    validatePayment.mutate(payer.id, {
      onSuccess: () => toast({ title: 'Validado', description: 'El pago ha sido validado.' }),
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const handleReject = () => {
    if (rejectReason.length < 10) return;
    rejectPayment.mutate({ id: payer.id, reason: rejectReason }, {
      onSuccess: () => {
        toast({ title: 'Rechazado', description: 'Pago rechazado e incidencia registrada.', variant: 'destructive' });
        setIsRejectOpen(false);
        setRejectReason('');
      },
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const handleRevert = () => {
    if (revertReason.length < 10) return;
    revertPayment.mutate({ id: payer.id, reason: revertReason }, {
      onSuccess: () => {
        toast({ title: 'Revertido', description: 'Pago revertido exitosamente.' });
        setIsRevertOpen(false);
        setRevertReason('');
      },
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const handleConvert = () => {
    convertToCustomer.mutate(payer.id, {
      onSuccess: () => {
        toast({ title: 'Convertido', description: 'Paciente convertido a CUSTOMER. Redirigiendo...' });
        navigate('/customer');
      },
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  // Agent Rules Engine Simulation
  const renderAgentPanel = (p: PayerWithDetails) => {
    let message = '';
    const alerts = [];
    
    const state = normalizePayerState(p.state);
    
    if (state === PayerState.PENDIENTE) {
      message = 'Esperando carga de comprobante o registro de pago. Por favor contacte al Lead si han pasado más de 24 horas.';
      alerts.push('Pago pendiente de registro');
    } else if (state === PayerState.EN_REVISION) {
      message = 'El paciente ha enviado un pago. Debe revisar el comprobante y validarlo o rechazarlo si hay problemas.';
      if (!p.payment?.receiptMetadata) {
        alerts.push('Comprobante sin validar (no se adjuntó archivo)');
      } else {
        alerts.push(`Archivo adjunto: ${p.payment.receiptMetadata.name}`);
      }
    } else if (state === PayerState.VALIDADO) {
      message = 'El pago está validado. Ya puede convertir a este Payer en Customer para su atención.';
    } else if (state === PayerState.RECHAZADO) {
      message = 'El pago fue rechazado. Debe comunicarse con el paciente para corregir la incidencia.';
      alerts.push('Pago rechazado - Incidencia Abierta');
    } else if (state === PayerState.REVERTIDO) {
      message = 'El pago validado ha sido revertido manualmente debido a una incidencia.';
      alerts.push('Reversión manual registrada');
    }

    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex gap-4">
        <Bot className="text-blue-500 w-10 h-10 mt-1" />
        <div>
          <h4 className="font-semibold text-blue-900 flex items-center gap-2">
            Agente de Cobranza <StatusBadge status="Simulado" variant="neutral" />
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

  const payerState = normalizePayerState(payer?.state);

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2">
        <PageHeader title="Detalle de Cobro" description={`Payer ID: ${payer.id}`} />
        <div className="flex items-center gap-3 mt-4 md:mt-0 flex-wrap">
          <StatusBadge status={payer.state} />
          <Button
            variant="outline"
            onClick={() => setIsPdfModalOpen(true)}
            className="gap-2 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/50 text-xs font-semibold rounded-xl h-9"
          >
            <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            Ver Comprobante Oficial
          </Button>
          {payerState === PayerState.VALIDADO && (
            <Button onClick={() => setIsConvertOpen(true)} className="gap-2 text-xs font-semibold rounded-xl h-9">
              Pasar a CUSTOMER <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {journeys.find(j => j.payerId === payer.id) && (
        <JourneyStepper journey={journeys.find(j => j.payerId === payer.id)!} />
      )}

      {renderAgentPanel(payer)}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Datos de Origen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-semibold text-muted-foreground">Persona</p>
                <p>{payer.person?.firstName} {payer.person?.lastName}</p>
                <p>{payer.person?.phone || '-'} | {payer.person?.email || '-'}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">Reserva</p>
                <p>Fecha: {payer.reservation?.date || '-'} {payer.reservation?.time ? `- ${payer.reservation.time}` : ''}</p>
                <p>Sede: {payer.reservation?.branchId || '-'}</p>
                <p>Doctor: {payer.reservation?.professionalId || '-'}</p>
              </div>
              <div className="pt-4 border-t">
                <p className="font-semibold text-muted-foreground">Monto a Pagar</p>
                <p className="text-2xl font-bold text-foreground">S/ {payer.amountToPay.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>

          {payer.incidents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-destructive flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" /> Incidencias
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {payer.incidents.map(inc => (
                  <div key={inc.id} className="text-sm border-b pb-2 last:border-0">
                    <p className="font-medium">{new Date(inc.createdAt).toLocaleDateString()}</p>
                    <p className="text-muted-foreground">{inc.reason}</p>
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded mt-1 inline-block">
                      {inc.status}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          {(payerState === PayerState.PENDIENTE || payerState === PayerState.RECHAZADO || payerState === PayerState.EN_REVISION) && (
            <YapePaymentButton
              payerId={payer.id}
              personName={`${payer.person.firstName} ${payer.person.lastName}`}
              email={payer.person.email}
              amount={(payer as any).amountToPay ? Number((payer as any).amountToPay) : (payer.payment?.amount || 1.00)}
              serviceName="Atención Odontológica"
            />
          )}

          {payerState === PayerState.PENDIENTE || payerState === PayerState.RECHAZADO ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Registrar Pago Manual (Voucher / Foto)</CardTitle>
                <CardDescription>
                  También puedes registrar un comprobante manual enviándolo a revisión.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PaymentForm onSubmit={handleRegisterPayment} isLoading={registerPayment.isPending} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Revisión de Pago</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-4 rounded-lg mb-6 text-sm grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-muted-foreground">Canal:</span> 
                    <p className="font-medium">{payer.payment?.channel}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Nº Operación:</span> 
                    <p className="font-medium">{payer.payment?.operationNumber}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Fecha operación:</span> 
                    <p className="font-medium">{payer.payment?.operationDate}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Monto Declarado:</span> 
                    <p className="font-medium text-primary">S/ {payer.payment?.amount.toFixed(2)}</p>
                  </div>
                  {payer.payment?.observations && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Observaciones:</span> 
                      <p>{payer.payment.observations}</p>
                    </div>
                  )}
                  {payer.payment?.receiptMetadata && (
                    <div className="col-span-2 flex items-center gap-2 mt-2 p-2 bg-background border rounded">
                      <FileText className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="font-medium">{payer.payment.receiptMetadata.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(payer.payment.receiptMetadata.size / 1024).toFixed(1)} KB - {payer.payment.receiptMetadata.type}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {payerState === PayerState.EN_REVISION && (
                  <div className="flex gap-4">
                    <Button 
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      disabled={validatePayment.isPending}
                      onClick={handleValidate}
                    >
                      Validar Pago
                    </Button>
                    <Button 
                      className="flex-1"
                      variant="destructive"
                      onClick={() => setIsRejectOpen(true)}
                    >
                      Rechazar Pago
                    </Button>
                  </div>
                )}

                {payerState === PayerState.VALIDADO && (
                  <div className="flex justify-end">
                    <Button 
                      type="button"
                      variant="outline" 
                      className="text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-700/80 bg-rose-50/80 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 font-semibold text-xs rounded-xl h-9 px-4 transition-colors shadow-xs"
                      onClick={() => setIsRevertOpen(true)}
                    >
                      <XCircle className="w-4 h-4 mr-2 text-rose-600 dark:text-rose-400" />
                      Revertir validación
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <ConfirmationDialog
        isOpen={isConvertOpen}
        onClose={() => setIsConvertOpen(false)}
        onConfirm={handleConvert}
        title="Crear CUSTOMER"
        description="El pago está validado. ¿Desea convertir a esta persona en CUSTOMER (paciente oficial) y agendarlo definitivamente?"
        confirmText="Sí, crear Customer"
      />

      <ConfirmationDialog
        isOpen={isRejectOpen}
        onClose={() => setIsRejectOpen(false)}
        onConfirm={handleReject}
        title="Rechazar Pago"
        description="Esta acción marcará el pago como inválido y registrará una incidencia. El paciente deberá enviar otro pago."
        confirmText="Rechazar"
      >
        <div className="pt-4">
          <Input 
            placeholder="Motivo del rechazo (mín. 10 caracteres)" 
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        </div>
      </ConfirmationDialog>

      <ConfirmationDialog
        isOpen={isRevertOpen}
        onClose={() => setIsRevertOpen(false)}
        onConfirm={handleRevert}
        title="Revertir Pago Validado"
        description="Advertencia: Revertirá una validación ya hecha. Esto abrirá una incidencia crítica."
        confirmText="Revertir Pago"
      >
        <div className="pt-4">
          <Input 
            placeholder="Motivo de la reversión (mín. 10 caracteres)" 
            value={revertReason}
            onChange={(e) => setRevertReason(e.target.value)}
          />
        </div>
      </ConfirmationDialog>

      <PaymentNoticePdfModal
        payer={payer}
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
      />
    </div>
  );
}
