import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { AlternativeFormValues } from '../schemas/leadSchema';
import { alternativeSchema } from '../schemas/leadSchema';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form';

interface AlternativeFormProps {
  onSubmit: (data: AlternativeFormValues) => void;
  isLoading: boolean;
}

export function AlternativeForm({ onSubmit, isLoading }: AlternativeFormProps) {
  const form = useForm<AlternativeFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(alternativeSchema) as any,
    mode: 'onTouched',
    defaultValues: {
      service: '',
      professional: '',
      branch: '',
      date: '',
      time: '',
      price: 0,
      conditions: '',
      observations: '',
    },
  });

  const handleSubmit = (data: AlternativeFormValues) => {
    onSubmit(data);
    form.reset();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="service"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Servicio</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="professional"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Profesional</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="branch"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sede</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hora</FormLabel>
                <FormControl><Input type="time" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Precio (PEN)</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="conditions"
            render={({ field }) => (
              <FormItem className="lg:col-span-2">
                <FormLabel>Condiciones (Opcional)</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="observations"
            render={({ field }) => (
              <FormItem className="lg:col-span-3">
                <FormLabel>Observaciones (Opcional)</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={isLoading}>
            Agregar Alternativa
          </Button>
        </div>
      </form>
    </Form>
  );
}
