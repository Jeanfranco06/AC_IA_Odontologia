import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NewRequestFormValues } from '../schemas/turnedSchema';
import { newRequestSchema } from '../schemas/turnedSchema';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { UserPlus } from 'lucide-react';

interface NewRequestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: NewRequestFormValues) => void;
  isLoading: boolean;
}

export function NewRequestDialog({ isOpen, onClose, onSubmit, isLoading }: NewRequestDialogProps) {
  const form = useForm<NewRequestFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(newRequestSchema) as any,
    mode: 'onTouched',
    defaultValues: { serviceOfInterestId: '', channel: 'Teléfono', contactAuthorization: true, concreteRequest: '' },
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Fixed Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 ring-4 ring-teal-50/70 dark:ring-teal-950/40 border border-teal-200/60 dark:border-teal-800/60">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Registrar Nueva Solicitud (Reactivación)
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Crea un nuevo ciclo comercial (BUYER) conservando el historial previo.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Scrollable Body without scrollbar */}
        <div className="p-5 sm:p-6 overflow-y-auto no-scrollbar flex-1">
          <Form {...form}>
            <form id="new-request-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="serviceOfInterestId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nuevo Servicio de Interés</FormLabel>
                    <FormControl><Input placeholder="Ej: Implante dental, Ortodoncia..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="channel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Canal de Contacto</FormLabel>
                    <FormControl><Input placeholder="WhatsApp, Teléfono, Presencial..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="concreteRequest"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observación / Motivo</FormLabel>
                    <FormControl><Input placeholder="Motivo o requerimiento del paciente" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactAuthorization"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-3.5">
                    <FormControl>
                      <input type="checkbox" checked={field.value} onChange={field.onChange} className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500" />
                    </FormControl>
                    <div className="space-y-0.5 leading-none">
                      <FormLabel className="text-xs font-semibold cursor-pointer">Autoriza contacto posterior para promociones y citas</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>

        {/* Fixed Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80 shrink-0 flex items-center justify-end gap-3 rounded-b-2xl">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onClose}
            className="rounded-xl border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs h-9 px-4"
          >
            Cancelar
          </Button>
          <Button 
            form="new-request-form"
            type="submit" 
            disabled={isLoading}
            className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold h-9 px-4 shadow-sm"
          >
            {isLoading ? 'Creando...' : 'Crear Reactivación'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
