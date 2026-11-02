import React, { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { BuyerForm, type BuyerFormRef } from './BuyerForm';
import { useCreateBuyer } from '../hooks/useBuyerQueries';
import { useToast } from '@/shared/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';
import type { BuyerFormValues } from '../schemas/buyerSchema';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { UserPlus, Sparkles, ArrowRight, Loader2 } from 'lucide-react';

interface BuyerCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BuyerCreateModal({ isOpen, onClose }: BuyerCreateModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createBuyer = useCreateBuyer();
  const buyerFormRef = useRef<BuyerFormRef>(null);

  const handleSubmit = (data: BuyerFormValues) => {
    createBuyer.mutate(data, {
      onSuccess: (res: any) => {
        const isDup = res?.isDuplicate || res?.qualityStatus === 'Duplicado' || res?.estado_calidad === 'Duplicado';
        if (isDup) {
          toast({ 
            title: '⚠️ Registro Duplicado Detectado', 
            description: 'El prospecto ya figuraba en la base de datos. Se registró con estado DUPLICATED para auditoría.',
            variant: 'destructive',
          });
        } else {
          toast({ title: '¡Éxito!', description: 'Prospecto (BUYER) registrado correctamente.' });
        }
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS] });
        queryClient.refetchQueries({ queryKey: [QUERY_KEYS.BUYERS] });
        onClose();
      },
      onError: (err) => {
        toast({ title: 'Error al registrar', description: err.message, variant: 'destructive' });
      },
    });
  };

  const handleRegisterClick = () => {
    if (buyerFormRef.current) {
      buyerFormRef.current.submit();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88vh] sm:max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header Fijo */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 ring-4 ring-teal-50/70 dark:ring-teal-950/40 border border-teal-200/60 dark:border-teal-800/60">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    Registrar Nuevo BUYER
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                    Captura y organiza los datos de contacto, canales y necesidades del prospecto.
                  </DialogDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-teal-50/80 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200/80 dark:border-teal-800 text-[11px] px-2.5 py-1 rounded-lg font-medium flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-teal-600 dark:text-teal-400" />
                  Fase 1 · Atracción
                </Badge>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Cuerpo Scrolleable sin Scrollbar */}
        <div className="p-5 sm:p-6 overflow-y-auto no-scrollbar flex-1 space-y-6 bg-slate-50/30 dark:bg-slate-950/30">
          <BuyerForm 
            ref={buyerFormRef}
            formId="buyer-create-form" 
            hideSubmitButton 
            onSubmit={handleSubmit} 
            isLoading={createBuyer.isPending} 
          />
        </div>

        {/* Footer Fijo con Botones de Alta Visibilidad */}
        <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80 shrink-0 flex items-center justify-between gap-3 rounded-b-2xl">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={createBuyer.isPending}
            className="rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold px-4 py-2 h-9.5 transition-colors"
          >
            Cancelar
          </Button>

          <Button
            type="button"
            onClick={handleRegisterClick}
            disabled={createBuyer.isPending}
            className="bg-teal-600 hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-xl text-xs font-semibold px-5 py-2 h-9.5 shadow-sm transition-all flex items-center gap-1.5"
          >
            {createBuyer.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Registrando...</span>
              </>
            ) : (
              <>
                <span>Registrar Prospecto (BUYER)</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
