import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Download, Send, RefreshCw } from 'lucide-react';
import type { PayerWithDetails } from '@/application/use-cases/payer';
import { useToast } from '@/shared/hooks/use-toast';
import jsPDF from 'jspdf';
import { createPaymentDocumentPdf } from '@/shared/pdf/paymentDocument';
import logoDataUrl from '@/shared/pdf/Logo_NexoSalud.png?inline';

import { PayerState, normalizePayerState } from '@/domain/enums';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface PaymentNoticePdfModalProps {
  payer: PayerWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
  customMessage?: string;
  emailSubject?: string;
  emailBody?: string;
}

type PaymentDocumentType = 'ORDER' | 'RECEIPT';

function getPayerDocumentCode(payer: PayerWithDetails, documentType: PaymentDocumentType): string {
  const isReceipt = documentType === 'RECEIPT';
  const payment = payer.payment as (typeof payer.payment & { validationDate?: string; preReservationCode?: string }) | undefined;
  const issueDate = isReceipt ? payment?.validationDate || payment?.operationDate : payer.createdAt;
  const year = issueDate?.slice(0, 4) || String(new Date().getFullYear());
  return isReceipt
    ? `CONST-${String(payer.id).padStart(5, '0')}-${year}`
    : payment?.preReservationCode || `ORD-${String(payer.id).padStart(5, '0')}-${year}`;
}

export function generatePayerDocumentPdf(payer: PayerWithDetails, documentType: PaymentDocumentType): jsPDF {
  const isReceipt = documentType === 'RECEIPT';
  const payment = payer.payment as (typeof payer.payment & { validationDate?: string; preReservationCode?: string }) | undefined;
  const amount = isReceipt ? Number(payment?.amount ?? payer.amountToPay) : payer.amountToPay;
  const originalPrice = Number(payer.originalPrice || 0);
  const hasRecordedDiscount = originalPrice > amount && Math.abs(amount - payer.amountToPay) < 0.01;
  return createPaymentDocumentPdf({
    type: documentType,
    code: getPayerDocumentCode(payer, documentType),
    issuedAt: isReceipt ? payment?.validationDate || payment?.operationDate : payer.createdAt,
    patientName: `${payer.person.firstName} ${payer.person.lastName}`,
    documentNumber: payer.person.documentNumber,
    phone: payer.person.phone,
    email: payer.person.email,
    branch: payer.reservation?.branchId,
    professional: payer.reservation?.professionalId,
    appointmentDate: payer.reservation?.date,
    appointmentTime: payer.reservation?.time,
    serviceName: payer.serviceName || 'Consulta y Tratamiento Odontológico Especializado',
    amount,
    originalPrice: hasRecordedDiscount ? originalPrice : undefined,
    paymentChannel: payment?.channel,
    operationNumber: isReceipt ? payment?.operationNumber : undefined,
  }, logoDataUrl);
}

export function PaymentNoticePdfModal({
  payer,
  isOpen,
  onClose,
  customMessage,
  emailSubject,
  emailBody,
}: PaymentNoticePdfModalProps) {
  const { toast } = useToast();
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [documentType, setDocumentType] = useState<PaymentDocumentType>('ORDER');

  useEffect(() => {
    if (isOpen && payer) {
      setDocumentType(normalizePayerState(payer.state) === PayerState.VALIDADO ? 'RECEIPT' : 'ORDER');
    }
  }, [isOpen, payer?.id, payer?.state]);

  useEffect(() => {
    let currentUrl: string | null = null;
    if (isOpen && payer) {
      setPdfError(false);
      try {
        const doc = generatePayerDocumentPdf(payer, documentType);
        const pdfBlob = doc.output('blob');
        currentUrl = URL.createObjectURL(pdfBlob);
        setPdfBlobUrl(currentUrl);
      } catch (err) {
        console.error('Error generando blob de PDF:', err);
        setPdfBlobUrl(null);
        setPdfError(true);
      }
    } else {
      setPdfBlobUrl(null);
      setPdfError(false);
    }

    return () => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [isOpen, payer?.id, payer?.state, documentType]);

  if (!isOpen || !payer) return null;

  const payerState = normalizePayerState(payer.state);
  const isValidated = payerState === PayerState.VALIDADO;
  const isReceiptDocument = documentType === 'RECEIPT';
  const canEmailDocument = isReceiptDocument
    ? isValidated
    : payerState === PayerState.PENDIENTE || payerState === PayerState.EN_REVISION;

  // Descargar archivo .PDF directamente al computador
  const handleDownloadPdf = () => {
    try {
      const doc = generatePayerDocumentPdf(payer, documentType);
      const prefix = isReceiptDocument ? 'Constancia_Pago' : 'Orden_de_Pago';
      const fileName = `${prefix}_${payer.person.lastName}_${payer.id}.pdf`;
      doc.save(fileName);

      toast({
        title: 'PDF Descargado',
        description: `Se descargó "${fileName}" exitosamente.`,
      });
    } catch (err: any) {
      toast({
        title: 'Error al generar PDF',
        description: err.message || 'No se pudo descargar el PDF.',
        variant: 'destructive',
      });
    }
  };

  // Enviar el correo oficial con el PDF adjunto al buzón del paciente
  const handleSendEmailWithPdf = async () => {
    if (!canEmailDocument) return;
    const targetEmail = payer.person.email;
    if (!targetEmail) {
      toast({
        title: 'Sin correo registrado',
        description: 'El paciente no tiene una dirección de correo configurada.',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingEmail(true);
    try {
      toast({
        title: 'Generando documento...',
        description: isReceiptDocument
          ? 'Adjuntando Constancia oficial de Pago para enviar al correo...'
          : 'Adjuntando Orden de Pago PDF para enviar al correo...',
      });

      const doc = generatePayerDocumentPdf(payer, documentType);
      const pdfBase64 = doc.output('datauristring');
      const filename = isReceiptDocument
        ? `Constancia_Pago_${payer.person.lastName.replace(/\s+/g, '_')}_${payer.id}.pdf`
        : `Orden_de_Pago_${payer.person.lastName.replace(/\s+/g, '_')}_${payer.id}.pdf`;

      const defaultSubject = isReceiptDocument
        ? `Constancia Oficial de Pago y Confirmación de Cita - NexoSalud`
        : `Orden de Pago de su Pre-Reserva - NexoSalud`;

      const defaultBody = isReceiptDocument
        ? `Estimado(a) ${payer.person.firstName}, le confirmamos que su pago ha sido validado exitosamente. Adjuntamos su constancia oficial de pago y reserva de cita.`
        : `Estimado(a) ${payer.person.firstName}, registramos su pre-reserva. Adjuntamos la orden de pago para completar la confirmación de su cita odontológica.`;

      const payload = {
        payerId: payer.id,
        toEmail: targetEmail,
        patientName: `${payer.person.firstName} ${payer.person.lastName}`,
        subject: isReceiptDocument ? defaultSubject : (emailSubject || defaultSubject),
        message: isReceiptDocument ? defaultBody : (emailBody || customMessage || defaultBody),
        amount: isReceiptDocument ? Number(payer.payment?.amount ?? payer.amountToPay) : payer.amountToPay,
        serviceName: 'Consulta y Tratamiento Odontológico Especializado',
        reservationDate: payer.reservation?.date,
        reservationTime: payer.reservation?.time,
        branch: payer.reservation?.branchId,
        professional: payer.reservation?.professionalId,
        filename,
        pdfBase64,
        isValidated: isReceiptDocument,
      };

      const res = await fetch(`${API_URL}/payer/send-notice-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al enviar el correo');
      }

      toast({
        title: '¡Correo y PDF Enviados!',
        description: isReceiptDocument
          ? `La constancia oficial fue enviada exitosamente a ${targetEmail}.`
          : `La orden de pago fue enviada exitosamente a ${targetEmail}.`,
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Error de envío',
        description: err.message || 'No se pudo enviar el correo al paciente.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const docCode = getPayerDocumentCode(payer, documentType);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[100dvh] w-[100vw] max-w-[100vw] flex-col gap-0 overflow-hidden rounded-none border border-slate-800 bg-slate-900 p-0 shadow-2xl sm:h-[92vh] sm:w-[96vw] sm:max-w-[96vw] sm:rounded-2xl [&>button]:text-white [&>button:hover]:text-white">
        {/* Header con Barra de Acciones */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 p-3 pr-12 text-white sm:p-4 sm:pr-12">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
              <img src="/Logo_NexoSalud.png" alt="NexoSalud" className="h-full w-full object-contain" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-white">
                {isReceiptDocument ? 'Constancia de Pago PDF' : 'Orden de Pago PDF'}
              </DialogTitle>
              <p className="text-[11px] text-slate-300">
                {docCode} • Paciente: {payer.person.firstName} {payer.person.lastName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isValidated && (
              <div role="tablist" aria-label="Documentos de la reserva" className="flex items-center gap-1 rounded-xl bg-slate-800 p-1">
                <button type="button" role="tab" aria-selected={!isReceiptDocument} onClick={() => setDocumentType('ORDER')} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${!isReceiptDocument ? 'bg-white text-slate-900' : 'text-slate-200 hover:bg-slate-700'}`}>
                  Orden de Pago
                </button>
                <button type="button" role="tab" aria-selected={isReceiptDocument} onClick={() => setDocumentType('RECEIPT')} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${isReceiptDocument ? 'bg-white text-slate-900' : 'text-slate-200 hover:bg-slate-700'}`}>
                  Constancia de Pago
                </button>
              </div>
            )}
            {/* Botón Enviar por Correo con PDF */}
            {canEmailDocument && <Button
              onClick={handleSendEmailWithPdf}
              disabled={isSendingEmail}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs gap-1.5 shadow-sm font-medium h-8"
              title={`Enviar PDF adjunto a ${payer.person.email || 'correo'}`}
            >
              {isSendingEmail ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Enviando PDF...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  {isReceiptDocument ? 'Enviar Constancia' : 'Enviar Orden de Pago'}
                </>
              )}
            </Button>}

            {/* Botón Descargar PDF */}
            <Button
              onClick={handleDownloadPdf}
              size="sm"
              variant="outline"
              className="border-slate-300 dark:border-slate-700 rounded-xl text-xs gap-1.5 font-medium h-8 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100"
              title="Descargar archivo PDF al dispositivo"
            >
              <Download className="w-3.5 h-3.5 text-teal-600" />
              Descargar PDF
            </Button>
          </div>
        </div>

        {/* Visor Nativo de PDF (Iframe con el motor PDF del Navegador) */}
        <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden bg-slate-900">
          {pdfBlobUrl ? (
            <iframe
              src={pdfBlobUrl}
              className="w-full h-full border-0"
              title={`Visor de PDF - ${docCode}`}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-400 text-xs">
              {pdfError ? (
                <span>No se pudo generar el PDF. Cierra y vuelve a abrir esta vista.</span>
              ) : (
                <><RefreshCw className="w-6 h-6 animate-spin text-teal-500" />Cargando documento PDF...</>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
