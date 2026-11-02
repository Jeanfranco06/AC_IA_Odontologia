import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { FollowUpFormValues } from '../schemas/turnedSchema';
import { followUpSchema } from '../schemas/turnedSchema';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form';

export function FollowUpForm({ onSubmit, isLoading }: { onSubmit: (d: FollowUpFormValues) => void, isLoading: boolean }) {
  const form = useForm<FollowUpFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(followUpSchema) as any,
    mode: 'onTouched',
    defaultValues: { channel: '', contactResult: '', observations: '', nextFollowUpDate: '' },
  });

  const handleSubmit = (data: FollowUpFormValues) => {
    onSubmit(data);
    form.reset();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="channel"
            render={({ field }) => (
              <FormItem><FormLabel>Canal</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="contactResult"
            render={({ field }) => (
              <FormItem><FormLabel>Resultado</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="observations"
            render={({ field }) => (
              <FormItem className="md:col-span-2"><FormLabel>Observaciones</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="nextFollowUpDate"
            render={({ field }) => (
              <FormItem><FormLabel>Próximo Seguimiento</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
            )}
          />
        </div>
        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isLoading}>Registrar Interacción</Button>
        </div>
      </form>
    </Form>
  );
}
