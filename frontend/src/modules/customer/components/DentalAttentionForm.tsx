import { useEffect, forwardRef, useImperativeHandle } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { DentalAttentionFormValues } from '../schemas/customerSchema';
import { dentalAttentionSchema } from '../schemas/customerSchema';
import { Button } from '@/shared/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form';
import { Textarea } from '@/shared/components/ui/textarea';
import { Input } from '@/shared/components/ui/input';
import { useToast } from '@/shared/hooks/use-toast';
import { 
  FileText, 
  Activity, 
  AlertCircle, 
  Stethoscope, 
  ClipboardCheck, 
  Pill, 
  FileEdit,
  Sparkles
} from 'lucide-react';

export interface DentalAttentionFormRef {
  submit: () => void;
  applyTemplate: (template: { reasonForConsultation?: string; evaluation?: string; procedure?: string; instructions?: string }) => void;
  applyInstructions: (instructions: string) => void;
  getValues: () => DentalAttentionFormValues;
}

interface DentalAttentionFormProps {
  initialValues?: Partial<DentalAttentionFormValues>;
  onSubmit: (data: DentalAttentionFormValues) => void;
  onValuesChange?: (values: DentalAttentionFormValues) => void;
  isLoading: boolean;
  disabled?: boolean;
  formId?: string;
  hideSubmitButton?: boolean;
}

export const DentalAttentionForm = forwardRef<DentalAttentionFormRef, DentalAttentionFormProps>(function DentalAttentionForm(
  { initialValues, onSubmit, onValuesChange, isLoading, disabled, formId, hideSubmitButton },
  ref
) {
  const { toast } = useToast();
  const form = useForm<DentalAttentionFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(dentalAttentionSchema) as any,
    mode: 'onTouched',
    defaultValues: {
      reasonForConsultation: initialValues?.reasonForConsultation || '',
      relevantBackground: initialValues?.relevantBackground || '',
      allergies: initialValues?.allergies || '',
      evaluation: initialValues?.evaluation || '',
      procedure: initialValues?.procedure || '',
      instructions: initialValues?.instructions || '',
      observations: initialValues?.observations || '',
    },
  });

  useEffect(() => {
    const subscription = form.watch((values) => {
      onValuesChange?.(values as DentalAttentionFormValues);
    });
    return () => subscription.unsubscribe();
  }, [form, onValuesChange]);

  useImperativeHandle(ref, () => ({
    submit: () => {
      form.handleSubmit(
        (data) => {
          onSubmit(data);
        },
        (errors) => {
          console.warn('Dental form errors:', errors);
          const firstErr = Object.values(errors)[0]?.message as string;
          toast({
            title: 'Verifique los datos de la ficha',
            description: firstErr || 'Revise que los campos estén ingresados correctamente.',
            variant: 'destructive',
          });
        }
      )();
    },
    applyTemplate: (tmpl) => {
      if (tmpl.reasonForConsultation) form.setValue('reasonForConsultation', tmpl.reasonForConsultation, { shouldDirty: true });
      if (tmpl.evaluation) form.setValue('evaluation', tmpl.evaluation, { shouldDirty: true });
      if (tmpl.procedure) form.setValue('procedure', tmpl.procedure, { shouldDirty: true });
      if (tmpl.instructions) form.setValue('instructions', tmpl.instructions, { shouldDirty: true });
      onValuesChange?.(form.getValues());
    },
    applyInstructions: (instr) => {
      form.setValue('instructions', instr, { shouldDirty: true });
      onValuesChange?.(form.getValues());
    },
    getValues: () => form.getValues(),
  }));

  useEffect(() => {
    if (initialValues) {
      form.reset({
        reasonForConsultation: initialValues.reasonForConsultation || '',
        relevantBackground: initialValues.relevantBackground || '',
        allergies: initialValues.allergies || '',
        evaluation: initialValues.evaluation || '',
        procedure: initialValues.procedure || '',
        instructions: initialValues.instructions || '',
        observations: initialValues.observations || '',
      });
    }
  }, [initialValues, form]);

  const inputStyle = "bg-slate-50/90 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl text-xs focus-visible:ring-2 focus-visible:ring-teal-500/40 dark:focus-visible:ring-teal-400/40 disabled:opacity-90 disabled:bg-slate-100/80 dark:disabled:bg-slate-950/70 dark:disabled:text-slate-200 dark:disabled:border-slate-700/80 shadow-sm transition-all";

  return (
    <Form {...form}>
      <form id={formId} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        
        {/* Bloque 1: Anamnesis y Antecedentes */}
        <div className="bg-slate-50/60 dark:bg-slate-900/50 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3.5">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-200/60 dark:border-slate-800">
            <Activity className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              1. Anamnesis & Antecedentes del Paciente
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <FormField
              control={form.control}
              name="reasonForConsultation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    Motivo de Consulta
                  </FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      disabled={disabled}
                      placeholder="Ej. Dolor al masticar en molar superior, molestia térmica..."
                      className={inputStyle}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="relevantBackground"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <ClipboardCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Antecedentes Relevantes
                  </FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      disabled={disabled}
                      placeholder="Ej. Hipertensión controlada, tratamiento previo de endodoncia..."
                      className={inputStyle}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="allergies"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                    Alergias Médicas / Contraindicaciones
                  </FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      disabled={disabled}
                      placeholder="Ej. Alergia a Penicilina, AINEs, Látex (Escribir 'Ninguna' si no registra)..."
                      className={inputStyle}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Bloque 2: Evaluación Clínica y Procedimiento Realizado */}
        <div className="bg-slate-50/60 dark:bg-slate-900/50 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3.5">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-200/60 dark:border-slate-800">
            <Stethoscope className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              2. Diagnóstico & Procedimiento Clínico
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <FormField
              control={form.control}
              name="evaluation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    Evaluación Básica / Diagnóstico
                  </FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      disabled={disabled}
                      rows={2}
                      placeholder="Ej. Caries oclusal profunda en pieza 46, inflamación gingival..."
                      className={inputStyle}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="procedure"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                    Procedimiento Realizado <span className="text-rose-500 font-bold">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      disabled={disabled}
                      rows={2}
                      placeholder="Ej. Limpieza ultrasónica profiláctica y restauración estética con resina 3M..."
                      className={inputStyle}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Bloque 3: Indicaciones Post-Tratamiento y Observaciones */}
        <div className="bg-slate-50/60 dark:bg-slate-900/50 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3.5">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-200/60 dark:border-slate-800">
            <Pill className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              3. Indicaciones & Observaciones de Seguimiento
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <FormField
              control={form.control}
              name="instructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Pill className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Indicaciones / Receta
                  </FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      disabled={disabled}
                      rows={2}
                      placeholder="Ej. Paracetamol 500mg cada 8h en caso de dolor. Evitar alimentos duros por 24h..."
                      className={inputStyle}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <FileEdit className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    Observaciones y Próximo Control
                  </FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      disabled={disabled}
                      rows={2}
                      placeholder="Ej. Paciente colaborador. Se programa control de profilaxis en 6 meses..."
                      className={inputStyle}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
          </div>
        </div>

        {!disabled && !hideSubmitButton && (
          <div className="flex justify-end pt-2">
            <Button 
              type="submit" 
              disabled={isLoading}
              className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold px-4 h-9 shadow-sm"
            >
              Guardar Ficha Clínica
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
});
