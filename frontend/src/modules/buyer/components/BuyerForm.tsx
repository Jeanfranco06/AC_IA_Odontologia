import React, { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { BuyerFormValues } from '../schemas/buyerSchema';
import { buyerSchema } from '../schemas/buyerSchema';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/shared/components/ui/form';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { buyerService } from '../services/buyer.service';
import { useToast } from '@/shared/hooks/use-toast';
import { 
  User, 
  Mail, 
  Phone, 
  Clock, 
  MapPin, 
  Stethoscope, 
  ShieldCheck, 
  FileText,
  Radio,
  Tag,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Users
} from 'lucide-react';

export interface BuyerFormRef {
  submit: () => void;
}

export interface BuyerFormProps {
  initialValues?: Partial<BuyerFormValues>;
  onSubmit: (data: BuyerFormValues) => void;
  isLoading: boolean;
  isEdit?: boolean;
  formId?: string;
  hideSubmitButton?: boolean;
  excludeId?: string | number;
}

export const BuyerForm = forwardRef<BuyerFormRef, BuyerFormProps>(({
  initialValues,
  onSubmit,
  isLoading,
  isEdit,
  formId = 'buyer-form',
  hideSubmitButton = false,
  excludeId,
}, ref) => {
  const { toast } = useToast();
  const [catalogs, setCatalogs] = useState<{
    canales: any[];
    fuentes: any[];
    servicios: any[];
    sedes: any[];
    horarios?: any[];
  }>({ canales: [], fuentes: [], servicios: [], sedes: [], horarios: [] });

  useEffect(() => {
    buyerService.getCatalogs()
      .then((data) => {
        setCatalogs(data);
      })
      .catch((err) => console.error('Error loading buyer catalogs:', err));
  }, []);

  const form = useForm<BuyerFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(buyerSchema) as any,
    mode: 'onChange',
    defaultValues: {
      firstName: initialValues?.firstName || '',
      lastName: initialValues?.lastName || '',
      email: initialValues?.email || '',
      phone: initialValues?.phone || '',
      channel: initialValues?.channel || '1',
      attractionSource: initialValues?.attractionSource || '1',
      serviceOfInterestId: initialValues?.serviceOfInterestId || '',
      pref_sede_preferida: initialValues?.pref_sede_preferida || '',
      pref_id_horario: initialValues?.pref_id_horario || '',
      concreteRequest: initialValues?.concreteRequest || 'Consultar precio y disponibilidad',
      contactAuthorization: initialValues?.contactAuthorization ?? true,
    },
  });

  const [duplicateWarning, setDuplicateWarning] = useState<{
    isDuplicate: boolean;
    person?: { id?: number | string; firstName: string; lastName: string; etapa: string; phone?: string; email?: string; documentNumber?: string; matchedByType?: string; matchedFieldsText?: string };
    matchedBy?: string;
    matchesCount?: number;
    matches?: Array<{
      id: number | string;
      firstName: string;
      lastName: string;
      fullName: string;
      phone?: string;
      email?: string;
      documentNumber?: string;
      etapa: string;
      estadoCalidad: string;
      matchedByType: string;
      matchedFieldsText: string;
    }>;
  } | null>(null);

  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

  const watchedPhone = form.watch('phone');
  const watchedEmail = form.watch('email');

  useEffect(() => {
    const rawDigits = (watchedPhone || '').replace(/\D/g, '');
    const cleanEmail = (watchedEmail || '').trim();

    if (rawDigits.length >= 9 || (cleanEmail.includes('@') && cleanEmail.includes('.'))) {
      const timer = setTimeout(async () => {
        try {
          const effectiveExcludeId = excludeId || (initialValues as any)?.id || (initialValues as any)?.personId;
          const res = await buyerService.checkDuplicate({
            phone: rawDigits.length >= 9 ? rawDigits : undefined,
            email: cleanEmail.includes('@') ? cleanEmail : undefined,
            excludeId: effectiveExcludeId,
          });

          // Si el ID del duplicado encontrado es el mismo que se está editando, no es un duplicado
          const isSamePerson = Boolean(
            effectiveExcludeId && res?.person?.id && String(res.person.id) === String(effectiveExcludeId)
          );

          if (res?.isDuplicate && !isSamePerson) {
            setDuplicateWarning(res);
          } else {
            setDuplicateWarning(null);
          }
        } catch (err) {
          console.warn('Error checking duplicate in BuyerForm:', err);
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setDuplicateWarning(null);
    }
  }, [watchedPhone, watchedEmail, excludeId, initialValues]);

  useImperativeHandle(ref, () => ({
    submit: () => {
      form.handleSubmit(
        (data) => {
          onSubmit(data);
        },
        (errors) => {
          console.warn('Errores de validación en BuyerForm:', errors);
          const firstErrorMsg = Object.values(errors)[0]?.message as string;
          toast({
            title: 'Campos requeridos incompletos',
            description: firstErrorMsg || 'Por favor completa todos los campos obligatorios.',
            variant: 'destructive',
          });
        }
      )();
    }
  }));

  const handleFormSubmit = (data: BuyerFormValues) => {
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form id={formId} onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        
        {/* Bloque 1: Identificación y Contacto */}
        <Card className="border border-slate-200/90 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/60">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Identificación y Contacto</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Datos esenciales para el primer contacto comercial y respuesta rápida.</p>
            </div>
          </div>

          <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    Nombres <span className="text-rose-500 font-bold">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej: Lucía" 
                      className="rounded-lg h-9.5 text-xs bg-slate-50/40 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    Apellidos <span className="text-rose-500 font-bold">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej: Mendoza Rojas" 
                      className="rounded-lg h-9.5 text-xs bg-slate-50/40 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 inline" />
                    Teléfono / WhatsApp <span className="text-rose-500 font-bold">*</span>
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400 dark:text-slate-500">
                        +51
                      </span>
                      <Input 
                        type="tel"
                        placeholder="987654321" 
                        maxLength={9}
                        className="pl-11 rounded-lg h-9.5 text-xs font-mono bg-slate-50/40 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900" 
                        {...field}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          field.onChange(val);
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormDescription className="text-[10px] text-slate-400">9 dígitos exactos (Perú)</FormDescription>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5 text-slate-400 inline" /> Correo Electrónico
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Opcional</span>
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="lucia.mendoza@ejemplo.com" 
                      className="rounded-lg h-9.5 text-xs bg-slate-50/40 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            {/* Sección Permanente: Validación de Contacto y Duplicidad */}
            <div className="md:col-span-2 transition-all duration-300">
              {!duplicateWarning?.isDuplicate ? (
                // Estado 1: Contacto Único / Sin Duplicados
                <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/50 text-emerald-950 dark:text-emerald-100 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 shrink-0 mt-0.5">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                          Validación de Contacto y Unicidad
                        </h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700">
                          ÚNICO / DISPONIBLE
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300/90 leading-relaxed">
                        {watchedPhone || watchedEmail ? (
                          'No se registran coincidencias de teléfono ni correo en la base de datos. El registro se calificará como prospecto válido.'
                        ) : (
                          'Ingresa el teléfono o correo para verificar unicidad y evitar duplicados en tiempo real.'
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                // Estado 2: Duplicado Detectado con Mensaje Específico y Detalle Desplegable "Ver Detalles"
                <div className="p-3.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/60 text-amber-950 dark:text-amber-100 space-y-3 shadow-xs animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
                        <AlertCircle className="h-4 w-4" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-bold text-amber-950 dark:text-amber-100">
                            {duplicateWarning.matchedBy === 'email'
                              ? 'Este correo ya está registrado'
                              : duplicateWarning.matchedBy === 'phone'
                              ? 'Este teléfono ya está registrado'
                              : duplicateWarning.matchedBy === 'both'
                              ? 'El teléfono y el correo electrónico ya están registrados'
                              : 'Este DNI ya está registrado'}
                          </h4>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-200/90 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                            DUPLICADO DETECTADO ({duplicateWarning.matchesCount || duplicateWarning.matches?.length || 1})
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-800 dark:text-amber-300/90 leading-relaxed">
                          {isEdit ? (
                            <>
                              Los datos ingresados coinciden con pacientes ya registrados en el sistema. Verifica que no estés duplicando información.
                            </>
                          ) : (
                            <>
                              Se detectó coincidencia con {duplicateWarning.matchesCount || duplicateWarning.matches?.length || 1} paciente(s) existente(s). Al guardar, se mantendrá con estado <strong className="font-mono bg-amber-200/80 dark:bg-amber-900/60 px-1 py-0.5 rounded">DUPLICATED</strong>.
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Botón Ver Detalles (Modal) */}
                    <div className="shrink-0 flex sm:self-center">
                      <Button
                        type="button"
                        onClick={() => setIsDuplicateModalOpen(true)}
                        className="h-8.5 px-3.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-xs border border-amber-600 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5 text-white" />
                        <span className="text-white">Ver Detalles</span>
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal de Detalle de Pacientes Coincidentes */}
            <Dialog open={isDuplicateModalOpen} onOpenChange={setIsDuplicateModalOpen}>
              <DialogContent className="max-w-2xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
                <DialogHeader className="space-y-1.5 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                        Pacientes Coincidentes Detectados
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                          {duplicateWarning?.matchesCount || duplicateWarning?.matches?.length || 1} coincidencia(s)
                        </span>
                      </DialogTitle>
                      <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                        Registros existentes en la base de datos que comparten número telefónico, correo electrónico o documento.
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                {/* Scrollable list of matched patients */}
                <div className="max-h-[55vh] overflow-y-auto space-y-2.5 pr-1.5">
                  {(duplicateWarning?.matches && duplicateWarning.matches.length > 0
                    ? duplicateWarning.matches
                    : [duplicateWarning?.person || { firstName: 'Paciente', lastName: 'Registrado', etapa: 'BUYER' }]
                  ).map((m: any, idx: number) => {
                    const fullName = m.fullName || `${m.firstName || ''} ${m.lastName || ''}`.trim() || 'Paciente sin nombre';
                    const stage = (m.etapa || 'BUYER').toUpperCase();
                    const matchedTag = m.matchedFieldsText || (m.matchedByType === 'both' ? 'Teléfono y Correo' : m.matchedByType === 'email' ? 'Correo' : m.matchedByType === 'dni' ? 'DNI' : 'Teléfono');

                    let stageBadgeClass = 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200';
                    if (stage === 'TURNED') stageBadgeClass = 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-800';
                    else if (stage === 'LEAD') stageBadgeClass = 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800';
                    else if (stage === 'PAYER') stageBadgeClass = 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800';
                    else if (stage === 'CUSTOMER') stageBadgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800';
                    else if (stage === 'BUYER') stageBadgeClass = 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/80 dark:text-teal-300 dark:border-teal-800';

                    return (
                      <div
                        key={m.id || idx}
                        className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:border-amber-300 dark:hover:border-amber-700 transition-colors"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">
                              {fullName}
                            </span>
                            {m.id && (
                              <span className="text-[10.5px] font-mono text-slate-400 bg-slate-200/60 dark:bg-slate-700/60 px-1.5 py-0.5 rounded">
                                ID: #{m.id}
                              </span>
                            )}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${stageBadgeClass}`}>
                              Etapa: {stage}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 flex-wrap">
                            {m.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                                <span className="font-mono">{m.phone}</span>
                              </span>
                            )}
                            {m.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                                <span>{m.email}</span>
                              </span>
                            )}
                            {m.documentNumber && (
                              <span className="flex items-center gap-1 font-mono text-[11px] text-slate-500">
                                <User className="h-3.5 w-3.5 text-slate-400" />
                                DNI: {m.documentNumber}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2 self-start sm:self-center">
                          <span className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">Coincidencia:</span>
                          <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800">
                            {matchedTag}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDuplicateModalOpen(false)}
                    className="rounded-xl text-xs font-semibold px-4 h-9 cursor-pointer"
                  >
                    Entendido / Cerrar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Bloque 2: Interés Clínico y Preferencias */}
        <Card className="border border-slate-200/90 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/60">
              <Stethoscope className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Interés Odontológico y Preferencias</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Servicio solicitado, motivo y condiciones preferidas de atención.</p>
            </div>
          </div>

          <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="serviceOfInterestId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1">Servicio de Interés</span>
                    <span className="text-[10px] text-slate-400 font-normal">Opcional</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger className="rounded-lg h-9.5 text-xs bg-slate-50/40 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800">
                        <SelectValue placeholder="Selecciona el servicio inicial" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {catalogs.servicios.map((s) => (
                        <SelectItem key={s.id_servicio} value={s.id_servicio.toString()} className="text-xs">
                          {s.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pref_sede_preferida"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 inline" />
                      Sede de Interés
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Opcional</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger className="rounded-lg h-9.5 text-xs bg-slate-50/40 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800">
                        <SelectValue placeholder="Selecciona la sede" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {catalogs.sedes && catalogs.sedes.length > 0 ? (
                        catalogs.sedes.map((sede) => (
                          <SelectItem key={sede.id_sede || sede.nombre} value={sede.nombre} className="text-xs">
                            {sede.nombre} {sede.direccion ? `- ${sede.direccion}` : ''}
                          </SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="Sede California" className="text-xs">Sede California - Av. Larco 820, Urb. California, Trujillo</SelectItem>
                          <SelectItem value="Sede Primavera" className="text-xs">Sede Primavera - Av. Teodoro Valcárcel 345, Urb. Primavera, Trujillo</SelectItem>
                          <SelectItem value="Sede Centro Histórico" className="text-xs">Sede Centro Histórico - Jr. Pizarro 456, Centro Histórico, Trujillo</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pref_id_horario"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400 inline" /> Franja Horaria Preferida
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Opcional</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger className="rounded-lg h-9.5 text-xs bg-slate-50/40 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800">
                        <SelectValue placeholder="Cualquier horario / Sin preferencia" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1" className="text-xs">Mañana (08:00 - 13:00)</SelectItem>
                      <SelectItem value="2" className="text-xs">Tarde (13:00 - 18:00)</SelectItem>
                      <SelectItem value="3" className="text-xs">Noche (18:00 - 21:00)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="concreteRequest"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 inline" />
                    Motivo de Consulta / Necesidad <span className="text-rose-500 font-bold">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej: Consultar precio y disponibilidad de cita" 
                      className="rounded-lg h-9.5 text-xs bg-slate-50/40 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Bloque 3: Trazabilidad & Consentimiento Legal */}
        <Card className="border border-slate-200/90 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/60">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Trazabilidad Comercial y Consentimiento</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Atribución de captación y consentimiento regulatorio.</p>
            </div>
          </div>

          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="channel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Radio className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 inline" />
                      Canal de Origen
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-lg h-9.5 text-xs bg-slate-50/40 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800">
                          <SelectValue placeholder="Selecciona el canal" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {catalogs.canales && catalogs.canales.length > 0 ? (
                          catalogs.canales.map((c) => (
                            <SelectItem key={c.id_canal} value={c.id_canal.toString()} className="text-xs">
                              {c.nombre}
                            </SelectItem>
                          ))
                        ) : (
                          <>
                            <SelectItem value="Presencial (Recepción en Sede)" className="text-xs">Presencial (Recepción en Sede)</SelectItem>
                            <SelectItem value="Llamada Telefónica" className="text-xs">Llamada Telefónica</SelectItem>
                            <SelectItem value="WhatsApp Directo" className="text-xs">WhatsApp Directo</SelectItem>
                            <SelectItem value="Página Web / Portal Online" className="text-xs">Página Web / Portal Online</SelectItem>
                            <SelectItem value="Redes Sociales (Instagram / FB / TikTok)" className="text-xs">Redes Sociales (Instagram / FB / TikTok)</SelectItem>
                            <SelectItem value="Recomendación / Referido" className="text-xs">Recomendación / Referido</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="attractionSource"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Tag className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 inline" />
                      Fuente de Atracción
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-lg h-9.5 text-xs bg-slate-50/40 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800">
                          <SelectValue placeholder="Selecciona la fuente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {catalogs.fuentes && catalogs.fuentes.length > 0 ? (
                          catalogs.fuentes.map((f) => (
                            <SelectItem key={f.id_fuente} value={f.id_fuente.toString()} className="text-xs">
                              {f.nombre}
                            </SelectItem>
                          ))
                        ) : (
                          <>
                            <SelectItem value="Visita Espontánea / Walk-in" className="text-xs">Visita Espontánea / Walk-in</SelectItem>
                            <SelectItem value="Meta Ads (Instagram / FB)" className="text-xs">Meta Ads (Instagram / FB)</SelectItem>
                            <SelectItem value="Google Ads / Búsqueda" className="text-xs">Google Ads / Búsqueda</SelectItem>
                            <SelectItem value="Búsqueda Orgánica Web" className="text-xs">Búsqueda Orgánica Web</SelectItem>
                            <SelectItem value="Recomendación de Paciente" className="text-xs">Recomendación de Paciente</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <FormField
                control={form.control}
                name="contactAuthorization"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-xl border border-teal-200/60 dark:border-teal-800/60 bg-teal-50/40 dark:bg-teal-950/20 p-3.5">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="mt-0.5"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-xs font-bold text-slate-900 dark:text-white cursor-pointer">
                        Autorización de Contacto y Tratamiento de Datos <span className="text-rose-500">*</span>
                      </FormLabel>
                      <FormDescription className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        El prospecto autoriza expresamente el envío de presupuestos, recordatorios y ofertas comerciales por WhatsApp y Correo (Ley N° 29733).
                      </FormDescription>
                      <FormMessage className="text-[11px] text-rose-500" />
                    </div>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {!hideSubmitButton && (
          <div className="flex justify-end pt-2">
            <Button 
              type="submit" 
              disabled={isLoading}
              className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold px-6 py-2.5 shadow-sm"
            >
              {isLoading ? 'Registrando...' : 'Registrar Prospecto (BUYER)'}
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
});

BuyerForm.displayName = 'BuyerForm';
