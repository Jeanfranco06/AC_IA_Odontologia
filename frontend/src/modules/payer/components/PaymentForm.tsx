import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { PaymentFormValues } from '../schemas/payerSchema';
import { paymentSchema } from '../schemas/payerSchema';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form';
import { Upload } from 'lucide-react';

interface PaymentFormProps {
  onSubmit: (data: PaymentFormValues) => void;
  isLoading: boolean;
}

export function PaymentForm({ onSubmit, isLoading }: PaymentFormProps) {
  const [fileError, setFileError] = useState('');
  
  const form = useForm<PaymentFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(paymentSchema) as any,
    mode: 'onTouched',
    defaultValues: {
      channel: 'Transferencia con comprobante',
      operationNumber: '',
      operationDate: new Date().toISOString().split('T')[0],
      observations: '',
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('');
    const file = e.target.files?.[0];
    if (!file) {
      form.setValue('receiptMetadata', undefined);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFileError('El archivo no debe pesar más de 5MB');
      return;
    }

    if (!/^(image\/(jpeg|png)|application\/pdf)$/.test(file.type)) {
      setFileError('Solo se permiten archivos JPG, PNG o PDF');
      return;
    }

    form.setValue('receiptMetadata', {
      name: file.name,
      size: file.size,
      type: file.type
    });
  };

  const channelValue = useWatch({
    control: form.control,
    name: 'channel'
  });
  
  const receiptMetadataValue = useWatch({
    control: form.control,
    name: 'receiptMetadata'
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="channel"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300">Canal de Pago</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs h-9">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs">
                    <SelectItem value="Efectivo en clínica">Efectivo en clínica</SelectItem>
                    <SelectItem value="Yape / Plin">Yape / Plin</SelectItem>
                    <SelectItem value="Tarjeta de Crédito / Débito">Tarjeta de Crédito / Débito</SelectItem>
                    <SelectItem value="Transferencia con comprobante">Transferencia con comprobante</SelectItem>
                    <SelectItem value="Enlace de pago">Enlace de pago</SelectItem>
                    <SelectItem value="Web">Interfaz web</SelectItem>
                    <SelectItem value="Asistencia por voz">Asistencia por voz (Prototipo)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="operationDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300">Fecha y Hora</FormLabel>
                <FormControl>
                  <Input 
                    type="datetime-local" 
                    {...field} 
                    className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs h-9"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="operationNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nº de Operación</FormLabel>
                <FormControl>
                  <Input 
                    {...field} 
                    placeholder="Ej. 123456" 
                    className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs h-9"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="observations"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300">Observaciones</FormLabel>
                <FormControl>
                  <Input 
                    {...field} 
                    placeholder="Opcional" 
                    className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs h-9"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {channelValue === 'Transferencia con comprobante' && (
          <div className="border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-4 rounded-xl flex flex-col items-center justify-center gap-2">
            <Upload className="h-6 w-6 text-slate-400" />
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Subir comprobante simulado</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
              JPG, PNG o PDF. Max 5MB.<br/>(Solo se guardarán los metadatos)
            </span>
            <Input 
              type="file" 
              accept=".jpg,.jpeg,.png,.pdf" 
              className="max-w-xs cursor-pointer text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl"
              onChange={handleFileChange} 
            />
            {fileError && <span className="text-xs text-rose-600 dark:text-rose-400">{fileError}</span>}
            {receiptMetadataValue && (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Archivo listo: {receiptMetadataValue.name}
              </span>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button 
            type="submit" 
            disabled={isLoading}
            className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold h-9 px-4 shadow-sm"
          >
            {isLoading ? 'Registrando...' : 'Registrar Pago (Enviar a revisión)'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
