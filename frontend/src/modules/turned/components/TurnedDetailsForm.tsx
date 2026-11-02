import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { TurnedDetailsFormValues } from '../schemas/turnedSchema';
import { turnedDetailsSchema } from '../schemas/turnedSchema';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form';

interface TurnedDetailsFormProps {
  initialValues: Partial<TurnedDetailsFormValues>;
  onSubmit: (d: TurnedDetailsFormValues) => void;
  isLoading: boolean;
  formId?: string;
  hideSubmitButton?: boolean;
}

export function TurnedDetailsForm({ initialValues, onSubmit, isLoading, formId, hideSubmitButton }: TurnedDetailsFormProps) {
  const form = useForm<TurnedDetailsFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(turnedDetailsSchema) as any,
    mode: 'onTouched',
    defaultValues: { 
      finalResult: initialValues.finalResult || '', 
      satisfaction: initialValues.satisfaction || 0,
      customerComment: initialValues.customerComment || '' 
    },
  });

  useEffect(() => {
    form.reset({
      finalResult: initialValues.finalResult || '', 
      satisfaction: initialValues.satisfaction || 0,
      customerComment: initialValues.customerComment || '' 
    });
  }, [initialValues, form]);

  return (
    <Form {...form}>
      <form id={formId} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="finalResult"
            render={({ field }) => (
              <FormItem><FormLabel>Resultado Final del Servicio</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="satisfaction"
            render={({ field }) => (
              <FormItem><FormLabel>Satisfacción (1 a 5)</FormLabel><FormControl><Input type="number" min="1" max="5" {...field} /></FormControl><FormMessage /></FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="customerComment"
            render={({ field }) => (
              <FormItem className="md:col-span-2"><FormLabel>Comentario del Cliente</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )}
          />
        </div>
        {!hideSubmitButton && (
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isLoading}>Guardar Cierre (Marcar CLOSED)</Button>
          </div>
        )}
      </form>
    </Form>
  );
}
