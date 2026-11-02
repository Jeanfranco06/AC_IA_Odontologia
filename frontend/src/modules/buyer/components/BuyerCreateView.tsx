import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  Loader2,
  Save,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { buyerSchema, type BuyerFormValues } from '../schemas/buyerSchema';
import { useCreateBuyer } from '../hooks/useBuyerQueries';
import { buyerService } from '../services/buyer.service';
import { QUERY_KEYS } from '@/shared/constants';
import { useToast } from '@/shared/hooks/use-toast';

const DEFAULT_SEDES = [
  { id_sede: 1, nombre: 'Sede California', sub: 'Urb. California · Trujillo' },
  { id_sede: 2, nombre: 'Sede El Golf', sub: 'Urb. El Golf · Trujillo' },
  { id_sede: 3, nombre: 'Sede Centro Historico', sub: 'Centro Histórico · Trujillo' },
];

const DEFAULT_SERVICIOS = [
  { id_servicio: 1, nombre: 'Evaluación General' },
  { id_servicio: 2, nombre: 'Ortodoncia Inicial' },
  { id_servicio: 3, nombre: 'Blanqueamiento Dental' },
  { id_servicio: 4, nombre: 'Implante Dental' },
  { id_servicio: 5, nombre: 'Diseño de Sonrisa 3D' },
  { id_servicio: 6, nombre: 'Endodoncia / Dolor Agudo' },
];

const DEFAULT_HORARIOS = [
  { id: '1', label: 'Mañana', range: '08:00 – 13:00' },
  { id: '2', label: 'Tarde', range: '13:00 – 18:00' },
  { id: '3', label: 'Noche', range: '18:00 – 21:00' },
];

const DEFAULT_CANALES = [
  { id_canal: 1, nombre: 'Presencial (Recepción en Sede)' },
  { id_canal: 2, nombre: 'Llamada Telefónica' },
  { id_canal: 3, nombre: 'WhatsApp Directo' },
  { id_canal: 4, nombre: 'Página Web / Portal Online' },
  { id_canal: 5, nombre: 'Redes Sociales (Instagram / FB / TikTok)' },
  { id_canal: 6, nombre: 'Recomendación / Referido' },
];

const DEFAULT_FUENTES = [
  { id_fuente: 1, nombre: 'Visita Espontánea / Walk-in' },
  { id_fuente: 2, nombre: 'Meta Ads (Instagram / FB)' },
  { id_fuente: 3, nombre: 'Google Ads / Búsqueda' },
  { id_fuente: 4, nombre: 'Búsqueda Orgánica Web' },
  { id_fuente: 5, nombre: 'Recomendación de Paciente' },
];

export function BuyerCreateView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createBuyer = useCreateBuyer();

  const [catalogs, setCatalogs] = useState<{
    canales: any[];
    fuentes: any[];
    servicios: any[];
    sedes: any[];
  }>({
    canales: DEFAULT_CANALES,
    fuentes: DEFAULT_FUENTES,
    servicios: DEFAULT_SERVICIOS,
    sedes: DEFAULT_SEDES,
  });

  useEffect(() => {
    buyerService
      .getCatalogs()
      .then((data) => {
        setCatalogs({
          canales: data?.canales?.length ? data.canales : DEFAULT_CANALES,
          fuentes: data?.fuentes?.length ? data.fuentes : DEFAULT_FUENTES,
          servicios: data?.servicios?.length ? data.servicios : DEFAULT_SERVICIOS,
          sedes: data?.sedes?.length ? data.sedes : DEFAULT_SEDES,
        });
      })
      .catch(() => {
        // Mantiene catálogos por defecto si el endpoint no responde
      });
  }, []);

  const form = useForm<BuyerFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(buyerSchema) as any,
    mode: 'onChange',
    defaultValues: {
      firstName: '',
      lastName: '',
      documentType: 'DNI',
      documentNumber: '',
      phone: '',
      email: '',
      serviceOfInterestId: '1',
      pref_sede_preferida: 'Sede California',
      pref_id_horario: '1',
      channel: '3',
      attractionSource: '2',
      concreteRequest: 'Solicita evaluación odontológica y presupuesto detallado.',
      contactAuthorization: true,
    },
  });

  const watchedPhone = form.watch('phone');
  const watchedEmail = form.watch('email');
  const watchedSede = form.watch('pref_sede_preferida');
  const watchedServicio = form.watch('serviceOfInterestId');
  const watchedHorario = form.watch('pref_id_horario');
  const watchedChannel = form.watch('channel');
  const watchedSource = form.watch('attractionSource');
  const watchedConsent = form.watch('contactAuthorization');

  const [duplicateInfo, setDuplicateInfo] = useState<{
    isDuplicate: boolean;
    matchesCount?: number;
    matchedBy?: string;
  } | null>(null);

  useEffect(() => {
    const rawDigits = (watchedPhone || '').replace(/\D/g, '');
    const cleanEmail = (watchedEmail || '').trim();

    if (rawDigits.length >= 9 || (cleanEmail.includes('@') && cleanEmail.includes('.'))) {
      const timer = setTimeout(async () => {
        try {
          const res = await buyerService.checkDuplicate({
            phone: rawDigits.length >= 9 ? rawDigits : undefined,
            email: cleanEmail.includes('@') ? cleanEmail : undefined,
          });
          if (res?.isDuplicate) {
            setDuplicateInfo(res);
          } else {
            setDuplicateInfo({ isDuplicate: false });
          }
        } catch {
          setDuplicateInfo(null);
        }
      }, 280);
      return () => clearTimeout(timer);
    } else {
      setDuplicateInfo(null);
    }
  }, [watchedPhone, watchedEmail]);

  const onSubmit = (data: BuyerFormValues) => {
    createBuyer.mutate(data, {
      onSuccess: (res: any) => {
        const isDup =
          res?.isDuplicate ||
          res?.qualityStatus === 'Duplicado' ||
          res?.estado_calidad === 'Duplicado';

        if (isDup) {
          toast({
            title: 'Prospecto registrado con marca de duplicidad',
            description:
              'El contacto ya existía en el sistema y fue etiquetado con estado Duplicado para auditoría.',
          });
        } else {
          toast({
            title: 'Prospecto registrado correctamente',
            description: `${data.firstName} ${data.lastName} fue incorporado a la bandeja BUYER.`,
          });
        }
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS] });
        navigate('/buyer');
      },
      onError: (err) => {
        toast({
          title: 'Error al registrar prospecto',
          description: err.message,
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <div className="w-full max-w-none pb-8">
      {/* Cabecera de Página */}
      <div className="mb-6 space-y-1">
        <Link
          to="/buyer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span>Volver a Prospectos</span>
        </Link>

        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Registrar Nuevo Prospecto (BUYER)
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Formulario interno de captación comercial, preferencias clínicas y atribución de origen.
            </p>
          </div>
          <span className="font-mono text-[11px] font-medium text-slate-400">
            Etapa 01 · Admisión Inicial
          </span>
        </div>
      </div>

      {/* Contenedor Único Estructurado Full-Width con Secciones Separadas por Divisores de 1px */}
      <form
        id="buyer-create-enterprise-form"
        onSubmit={form.handleSubmit(onSubmit)}
        className="w-full max-w-none divide-y divide-slate-200/80 dark:divide-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs"
      >
        {/* SECCIÓN 1: Datos Personales & Contacto (Grid de 2 Columnas) */}
        <section className="p-6 sm:p-7 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              1. Datos Personales & Contacto
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Identificación del interesado y canales directos de comunicación clínica.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Nombres <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ej. Valeria"
                {...form.register('firstName')}
                className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#0f766e] focus:outline-none focus:ring-2 focus:ring-teal-600/15"
              />
              {form.formState.errors.firstName && (
                <p className="mt-1 text-[11px] text-rose-600">
                  {form.formState.errors.firstName.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Apellidos <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ej. Sánchez Paredes"
                {...form.register('lastName')}
                className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#0f766e] focus:outline-none focus:ring-2 focus:ring-teal-600/15"
              />
              {form.formState.errors.lastName && (
                <p className="mt-1 text-[11px] text-rose-600">
                  {form.formState.errors.lastName.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Teléfono / WhatsApp <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs font-medium text-slate-400">
                  +51
                </span>
                <input
                  type="tel"
                  maxLength={9}
                  placeholder="987654321"
                  value={watchedPhone}
                  onChange={(e) =>
                    form.setValue('phone', e.target.value.replace(/\D/g, ''), {
                      shouldValidate: true,
                    })
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-11 pr-3 font-mono text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#0f766e] focus:outline-none focus:ring-2 focus:ring-teal-600/15 tabular-nums"
                />
              </div>
              {form.formState.errors.phone && (
                <p className="mt-1 text-[11px] text-rose-600">
                  {form.formState.errors.phone.message}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Correo Electrónico
                </label>
                <span className="text-[11px] text-slate-400">Opcional</span>
              </div>
              <input
                type="email"
                placeholder="valeria.sanchez@empresa.pe"
                {...form.register('email')}
                className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#0f766e] focus:outline-none focus:ring-2 focus:ring-teal-600/15"
              />
              {form.formState.errors.email && (
                <p className="mt-1 text-[11px] text-rose-600">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Documento de Identidad (DNI / CE)
                </label>
                <span className="text-[11px] text-slate-400">Opcional</span>
              </div>
              <input
                type="text"
                maxLength={12}
                placeholder="Ej. 74859612"
                {...form.register('documentNumber')}
                className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 font-mono text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#0f766e] focus:outline-none focus:ring-2 focus:ring-teal-600/15 tabular-nums"
              />
            </div>

            {/* Indicador sobrio de Unicidad con acento de 2px en el borde */}
            <div className="flex items-end">
              {duplicateInfo?.isDuplicate ? (
                <div className="w-full border-l-2 border-slate-700 dark:border-slate-300 bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-slate-700 dark:text-slate-300" />
                  <span>
                    Coincidencia detectada ({duplicateInfo.matchesCount || 1} registro existente). Se guardará con trazabilidad de duplicado.
                  </span>
                </div>
              ) : (
                <div className="w-full border-l-2 border-[#0f766e] bg-slate-50/70 dark:bg-slate-800/40 px-3.5 py-2 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-[#0f766e]" />
                  <span>
                    {watchedPhone && watchedPhone.length >= 9
                      ? 'Contacto verificado como único en el padrón clínico.'
                      : 'Verificación automática de duplicidad en tiempo real activa.'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* SECCIÓN 2: Interés Clínico y Preferencias (Mediante Chips Sobrios) */}
        <section className="p-6 sm:p-7 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              2. Interés Clínico y Preferencias
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Selecciona la sede física, especialidad odontológica y disponibilidad horaria mediante chips rápidos.
            </p>
          </div>

          {/* Chips de Sede Física */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Sede Clínica de Preferencia
            </label>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {catalogs.sedes.map((sede: any) => {
                const selected = watchedSede === sede.nombre;
                return (
                  <button
                    key={sede.id_sede || sede.nombre}
                    type="button"
                    onClick={() =>
                      form.setValue('pref_sede_preferida', sede.nombre, {
                        shouldValidate: true,
                      })
                    }
                    className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-left text-xs transition-all cursor-pointer ${
                      selected
                        ? 'border-[#0f766e] bg-teal-50/50 dark:bg-teal-950/40 font-semibold text-slate-900 dark:text-white'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="truncate">{sede.nombre}</p>
                      <p className="truncate text-[11px] font-normal text-slate-400">
                        {sede.direccion || sede.sub || 'Trujillo'}
                      </p>
                    </div>
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        selected
                          ? 'border-[#0f766e] bg-[#0f766e] text-white'
                          : 'border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {selected && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chips de Tratamiento de Interés */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Tratamiento o Especialidad Solicitada
            </label>
            <div className="flex flex-wrap gap-2">
              {catalogs.servicios.map((srv: any) => {
                const srvId = String(srv.id_servicio);
                const selected = watchedServicio === srvId;
                return (
                  <button
                    key={srvId}
                    type="button"
                    onClick={() =>
                      form.setValue('serviceOfInterestId', srvId, { shouldValidate: true })
                    }
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors cursor-pointer ${
                      selected
                        ? 'border-[#0f766e] bg-teal-50/60 dark:bg-teal-950/50 font-semibold text-[#0f766e] dark:text-teal-300'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {selected && <Check className="h-3 w-3 text-[#0f766e]" strokeWidth={2.5} />}
                    <span>{srv.nombre}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chips de Horario de Preferencia */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Franja Horaria de Preferencia
            </label>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {DEFAULT_HORARIOS.map((slot) => {
                const selected = watchedHorario === slot.id;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() =>
                      form.setValue('pref_id_horario', slot.id, { shouldValidate: true })
                    }
                    className={`flex items-center justify-between rounded-lg border px-3.5 py-2 text-xs transition-colors cursor-pointer ${
                      selected
                        ? 'border-[#0f766e] bg-teal-50/50 dark:bg-teal-950/40 font-semibold text-slate-900 dark:text-white'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{slot.label}</span>
                    <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                      {slot.range}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* SECCIÓN 3: Origen y Trazabilidad */}
        <section className="p-6 sm:p-7 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              3. Origen y Trazabilidad
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Canal de captura, campaña de atribución y notas clínicas iniciales.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Canal de Captura <span className="text-rose-500">*</span>
              </label>
              <select
                value={watchedChannel}
                onChange={(e) =>
                  form.setValue('channel', e.target.value, { shouldValidate: true })
                }
                className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white focus:border-[#0f766e] focus:outline-none"
              >
                {catalogs.canales.map((c: any) => (
                  <option key={c.id_canal} value={String(c.id_canal)}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Fuente de Atracción <span className="text-rose-500">*</span>
              </label>
              <select
                value={watchedSource}
                onChange={(e) =>
                  form.setValue('attractionSource', e.target.value, { shouldValidate: true })
                }
                className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white focus:border-[#0f766e] focus:outline-none"
              >
                {catalogs.fuentes.map((f: any) => (
                  <option key={f.id_fuente} value={String(f.id_fuente)}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Notas Internas / Motivo Concreto de Consulta <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Describe el requerimiento específico del paciente, síntoma o consulta de presupuesto..."
                {...form.register('concreteRequest')}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#0f766e] focus:outline-none focus:ring-2 focus:ring-teal-600/15"
              />
              {form.formState.errors.concreteRequest && (
                <p className="mt-1 text-[11px] text-rose-600">
                  {form.formState.errors.concreteRequest.message}
                </p>
              )}
            </div>
          </div>

          {/* Consentimiento Normativo en contenedor neutro sobrio */}
          <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 p-3.5">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={watchedConsent}
                onChange={(e) =>
                  form.setValue('contactAuthorization', e.target.checked, {
                    shouldValidate: true,
                  })
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0f766e] focus:ring-[#0f766e]"
              />
              <span className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                <strong className="font-semibold text-slate-900 dark:text-white">
                  Autorización de Contacto y Tratamiento de Datos (Ley N° 29733):
                </strong>{' '}
                El prospecto brinda consentimiento para el envío de presupuestos odontológicos, confirmación de citas y seguimiento clínico por WhatsApp o correo electrónico.
              </span>
            </label>
            {form.formState.errors.contactAuthorization && (
              <p className="mt-1.5 pl-7 text-[11px] text-rose-600">
                {form.formState.errors.contactAuthorization.message}
              </p>
            )}
          </div>
        </section>
      </form>

      {/* Barra de Acciones Inferior Fija (Sticky Bottom Bar Full-Width) */}
      <div className="sticky bottom-0 z-20 mt-6 -mx-3 sm:-mx-6 lg:-mx-8 border-t border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 sm:px-6 lg:px-8 py-3.5 shadow-sm">
        <div className="flex w-full max-w-none items-center justify-between gap-4">
          <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400">
            Los campos marcados con <span className="text-rose-500">*</span> son obligatorios para la auditoría del embudo.
          </p>

          <div className="flex w-full sm:w-auto items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/buyer')}
              disabled={createBuyer.isPending}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              form="buyer-create-enterprise-form"
              disabled={createBuyer.isPending}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#0f766e] px-5 text-xs font-semibold text-white shadow-2xs transition-all hover:bg-teal-800 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              {createBuyer.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" strokeWidth={2} />
                  <span>Guardar Prospecto</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
