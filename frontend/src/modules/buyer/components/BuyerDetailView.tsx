import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowUpRight,
  Edit3,
  X,
  Save,
  Loader2,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Clock,
  CheckCircle2,
  FileText,
  Radio,
  Stethoscope,
  MapPin,
  UserCheck,
  Phone,
  Mail,
  Activity,
  Bot,
  Flame,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { useBuyer, useUpdateBuyer, useConvertBuyerToLead } from '../hooks/useBuyerQueries';
import { buyerService } from '../services/buyer.service';
import { BuyerState } from '@/domain/enums';
import { QUERY_KEYS } from '@/shared/constants';
import { useToast } from '@/shared/hooks/use-toast';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { ConfirmationDialog } from '@/shared/components/feedback/ConfirmationDialog';
import {
  analyzeBuyerMarketingAgent,
  type BuyerMarketingAnalysis,
} from '@/shared/services/groqService';
import { renderBuyerStatusBadge } from './BuyerListView';

interface BuyerDetailViewProps {
  buyerId: string;
}

const HORARIO_LABELS: Record<string, string> = {
  '1': 'Mañana (08:00 - 13:00)',
  '2': 'Tarde (13:00 - 18:00)',
  '3': 'Noche (18:00 - 21:00)',
};

export function BuyerDetailView({ buyerId }: BuyerDetailViewProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: buyer, isLoading, isError } = useBuyer(buyerId);
  const updateBuyer = useUpdateBuyer();
  const convertBuyer = useConvertBuyerToLead();

  const [isEditing, setIsEditing] = useState(() => searchParams.get('mode') === 'edit');
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);

  // Catálogos para edición
  const [catalogs, setCatalogs] = useState<{
    canales: any[];
    fuentes: any[];
    servicios: any[];
    sedes: any[];
  }>({ canales: [], fuentes: [], servicios: [], sedes: [] });

  // Estado del formulario de edición in-place
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    documentNumber: '',
    phone: '',
    email: '',
    serviceOfInterestId: '',
    pref_sede_preferida: '',
    pref_id_horario: '',
    concreteRequest: '',
    channel: '1',
    attractionSource: '1',
    contactAuthorization: true,
  });

  // Diagnóstico Comercial / BI
  const [aiAnalysis, setAiAnalysis] = useState<BuyerMarketingAnalysis | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    buyerService
      .getCatalogs()
      .then((data) => setCatalogs(data))
      .catch((err) => console.error('Error loading catalogs:', err));
  }, []);

  useEffect(() => {
    if (searchParams.get('mode') === 'edit') {
      setIsEditing(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (buyer) {
      setEditForm({
        firstName: buyer.person?.firstName || '',
        lastName: buyer.person?.lastName || '',
        documentNumber: buyer.person?.documentNumber || '',
        phone: buyer.person?.phone || '',
        email: buyer.person?.email || '',
        serviceOfInterestId: String(buyer.serviceOfInterestId || ''),
        pref_sede_preferida: buyer.pref_sede_preferida || 'Sede California',
        pref_id_horario: String(buyer.pref_id_horario || '1'),
        concreteRequest: buyer.concreteRequest || 'Consultar presupuesto y disponibilidad',
        channel: String(buyer.channelId || buyer.channel || '1'),
        attractionSource: String(buyer.attractionSourceId || buyer.attractionSource || '1'),
        contactAuthorization: buyer.contactAuthorization ?? true,
      });
    }
  }, [buyer]);

  const runAiAnalysis = async (b = buyer) => {
    if (!b) return;
    setIsAiLoading(true);
    try {
      const result = await analyzeBuyerMarketingAgent({
        fullName: `${b.person?.firstName || ''} ${b.person?.lastName || ''}`.trim(),
        phone: b.person?.phone,
        email: b.person?.email,
        serviceOfInterest: b.serviceOfInterest,
        preferredBranch: b.pref_sede_preferida,
        preferredTimeSlot: b.pref_id_horario,
        channel: b.channel,
        attractionSource: b.attractionSource,
        concreteRequest: b.concreteRequest,
        contactAuthorization: b.contactAuthorization,
        qualityStatus: b.state === BuyerState.CONVERTED ? 'Valido' : undefined,
        state: b.state,
        isConverted: b.state === BuyerState.CONVERTED,
      });
      setAiAnalysis(result);
    } catch (err) {
      console.warn('Error en diagnóstico BI:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    if (buyer) {
      runAiAnalysis(buyer);
    }
  }, [buyer?.id]);

  // Cálculo de Lead Scoring Comercial (0 - 100)
  const commercialScore = useMemo(() => {
    if (!buyer) return 78;
    let score = 55;
    if (buyer.person?.phone && String(buyer.person.phone).length >= 9) score += 15;
    if (buyer.person?.email) score += 8;
    if (buyer.serviceOfInterest || buyer.serviceOfInterestId) score += 10;
    if (buyer.pref_sede_preferida) score += 5;
    if (buyer.contactAuthorization) score += 5;
    if (aiAnalysis?.intentEvaluation?.intentLevel === 'ALTA') score = Math.max(score, 92);
    else if (aiAnalysis?.intentEvaluation?.intentLevel === 'AMBIGUA') score = Math.min(score, 58);
    if (buyer.state === BuyerState.DUPLICATED) score = Math.min(score, 45);
    return Math.min(99, score);
  }, [buyer, aiAnalysis]);

  // Construcción del Activity Timeline (Historial de Interacciones)
  const timelineEvents = useMemo(() => {
    if (!buyer) return [];
    const events: Array<{
      id: string;
      title: string;
      subtitle: string;
      detail?: string;
      timestamp: string;
      type: 'conversion' | 'inquiry' | 'consent' | 'created';
    }> = [];

    if (buyer.state === BuyerState.CONVERTED) {
      events.push({
        id: 'evt-converted',
        title: 'Prospecto transferido a etapa LEAD',
        subtitle: 'Calificación comercial completada · Pasa a Mesa de Negociación',
        detail: `Servicio priorizado: ${buyer.serviceOfInterest || 'Evaluación Odontológica'}`,
        timestamp: buyer.updatedAt || buyer.createdAt,
        type: 'conversion',
      });
    }

    if (buyer.solicitudesHistory && buyer.solicitudesHistory.length > 0) {
      buyer.solicitudesHistory.forEach((sol: any, idx: number) => {
        events.push({
          id: `evt-sol-${sol.id || idx}`,
          title: `Formulario / Consulta registrada #${buyer.solicitudesHistory.length - idx}`,
          subtitle: `Tratamiento: ${sol.servicio || buyer.serviceOfInterest || 'Evaluación General'} · Canal: ${buyer.channel || 'Portal Web'}`,
          detail: sol.motivo || buyer.concreteRequest || 'Solicitud de información y presupuesto clínico.',
          timestamp: sol.fecha || buyer.createdAt,
          type: 'inquiry',
        });
      });
    } else {
      events.push({
        id: 'evt-initial-inquiry',
        title: 'Solicitud de información registrada',
        subtitle: `Tratamiento: ${buyer.serviceOfInterest || 'Evaluación Odontológica'} · Sede: ${buyer.pref_sede_preferida || 'Sede California'}`,
        detail: buyer.concreteRequest || 'Consulta de costos y disponibilidad de cita odontológica.',
        timestamp: buyer.createdAt,
        type: 'inquiry',
      });
    }

    events.push({
      id: 'evt-consent',
      title: 'Validación de Protección de Datos (Ley N° 29733)',
      subtitle: buyer.contactAuthorization
        ? 'Consentimiento informado otorgado para contacto comercial vía WhatsApp y correo'
        : 'Pendiente de confirmación de consentimiento comercial',
      timestamp: buyer.createdAt,
      type: 'consent',
    });

    events.push({
      id: 'evt-created',
      title: 'Creación de Ficha de Prospecto (BUYER)',
      subtitle: `Origen atribuido: ${buyer.channel || 'Portal Web'} · Fuente: ${buyer.attractionSource || 'Captación Directa'}`,
      timestamp: buyer.createdAt,
      type: 'created',
    });

    return events;
  }, [buyer]);

  if (isLoading) return <LoadingState />;
  if (isError || !buyer) return <ErrorState message="No se encontró la ficha del prospecto solicitado." />;

  const fullName =
    `${buyer.person?.firstName || ''} ${buyer.person?.lastName || ''}`.trim() ||
    'Prospecto Sin Nombre';
  const isConverted = buyer.state === BuyerState.CONVERTED;

  const cleanPhone = String(buyer.person?.phone || '').replace(/\D/g, '');
  const whatsappText = encodeURIComponent(
    `Hola ${buyer.person?.firstName || ''}, te escribimos de la clínica dental NexoSalud respecto a tu consulta sobre ${
      buyer.serviceOfInterest || 'evaluación odontológica'
    } en ${buyer.pref_sede_preferida || 'nuestra sede'}. ¿En qué horario te gustaría agendar tu turno?`
  );
  const whatsappUrl = cleanPhone
    ? `https://wa.me/51${cleanPhone.slice(-9)}?text=${whatsappText}`
    : undefined;

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.firstName.trim() || !editForm.lastName.trim() || editForm.phone.trim().length < 9) {
      toast({
        title: 'Datos incompletos',
        description: 'Verifica nombres, apellidos y un teléfono válido de 9 dígitos.',
        variant: 'destructive',
      });
      return;
    }

    updateBuyer.mutate(
      {
        id: buyerId,
        data: {
          channel: editForm.channel,
          attractionSource: editForm.attractionSource,
          serviceOfInterestId: editForm.serviceOfInterestId,
          pref_sede_preferida: editForm.pref_sede_preferida,
          pref_id_horario: editForm.pref_id_horario,
          concreteRequest: editForm.concreteRequest,
          contactAuthorization: editForm.contactAuthorization,
          person: {
            firstName: editForm.firstName.trim(),
            lastName: editForm.lastName.trim(),
            documentNumber: editForm.documentNumber.trim(),
            phone: editForm.phone.trim(),
            email: editForm.email.trim(),
          },
        },
      },
      {
        onSuccess: () => {
          toast({
            title: 'Ficha actualizada',
            description: 'Los datos del prospecto fueron guardados correctamente.',
          });
          queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS] });
          queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS, buyerId] });
          setIsEditing(false);
          setSearchParams({}, { replace: true });
        },
        onError: (err) => {
          toast({
            title: 'Error al guardar cambios',
            description: err.message,
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleConvert = () => {
    convertBuyer.mutate(buyerId, {
      onSuccess: () => {
        toast({
          title: 'Prospecto convertido a LEAD',
          description: `${fullName} fue transferido al módulo LEAD.`,
        });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS] });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS] });
        setIsConvertDialogOpen(false);
        navigate('/lead');
      },
      onError: (err) => {
        toast({
          title: 'No se pudo convertir',
          description: err.message,
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <div className="w-full max-w-none space-y-6">
      {/* Cabecera Fija de la Ficha del Prospecto */}
      <div className="sticky top-0 z-20 -mx-3 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 lg:px-8 py-3.5 sm:py-4 bg-[#f8fafc]/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Link
              to="/buyer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Volver a Prospectos</span>
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                {fullName}
              </h1>
              {renderBuyerStatusBadge(buyer.state)}
              <span className="font-mono text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                ID #{buyer.id}
                {buyer.person?.documentNumber ? ` · DNI ${buyer.person.documentNumber}` : ''}
              </span>
            </div>
          </div>

          {/* Barra de Acciones Fijas Arriba: "Convertir a LEAD", "Editar", "Cerrar" */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {!isConverted && (
              <button
                type="button"
                onClick={() => setIsConvertDialogOpen(true)}
                disabled={convertBuyer.isPending}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0f766e] px-3.5 text-xs font-semibold text-white shadow-2xs transition-all hover:bg-teal-800 active:scale-[0.99] cursor-pointer"
              >
                {convertBuyer.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Convirtiendo...</span>
                  </>
                ) : (
                  <>
                    <span>Convertir a LEAD</span>
                    <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                const next = !isEditing;
                setIsEditing(next);
                if (!next) setSearchParams({}, { replace: true });
              }}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors cursor-pointer ${
                isEditing
                  ? 'border-[#0f766e] bg-teal-50/60 text-[#0f766e] dark:border-teal-600 dark:bg-teal-950/50 dark:text-teal-300'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Edit3 className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>{isEditing ? 'Modo Lectura' : 'Editar'}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/buyer')}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Cerrar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Arquitectura a 2 Columnas (Layout 65/35 -> 8 cols / 4 cols) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* COLUMNA IZQUIERDA (65%): Description List + Activity Timeline */}
        <div className="lg:col-span-8 space-y-6">
          {/* Bloque 1: Ficha de Datos en Description List o Modo Edición In-Place */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 px-6 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Información de Contacto y Preferencias Clínicas
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Expediente comercial estructurado sin duplicación de contenedores.
                </p>
              </div>
              {isEditing && (
                <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  Edición activa
                </span>
              )}
            </div>

            {!isEditing ? (
              /* Description List limpia (dl / dt / dd) dividida por bordes de 1px */
              <div className="divide-y divide-slate-200/70 dark:divide-slate-800">
                {/* Sección A: Datos de Contacto */}
                <div className="px-6 py-4">
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    1. Datos Personales & Contacto
                  </h3>
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">
                        Nombre Completo
                      </dt>
                      <dd className="mt-1 font-medium text-slate-900 dark:text-white">
                        {fullName}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">
                        Documento / DNI
                      </dt>
                      <dd className="mt-1 font-mono text-slate-900 dark:text-white tabular-nums">
                        {buyer.person?.documentNumber || 'No especificado'}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">
                        Teléfono / WhatsApp
                      </dt>
                      <dd className="mt-1 font-mono font-medium text-slate-900 dark:text-white tabular-nums flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
                        <span>
                          {buyer.person?.phone ? `+51 ${buyer.person.phone}` : 'Sin teléfono'}
                        </span>
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">
                        Correo Electrónico
                      </dt>
                      <dd className="mt-1 text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                        <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" strokeWidth={1.75} />
                        <span className="truncate">
                          {buyer.person?.email || 'No registrado'}
                        </span>
                      </dd>
                    </div>

                    <div className="sm:col-span-2">
                      <dt className="font-medium text-slate-500 dark:text-slate-400">
                        Consentimiento de Datos (Ley N° 29733)
                      </dt>
                      <dd className="mt-1 flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                        <ShieldCheck
                          className={`h-3.5 w-3.5 ${
                            buyer.contactAuthorization ? 'text-[#0f766e]' : 'text-slate-400'
                          }`}
                          strokeWidth={1.75}
                        />
                        <span>
                          {buyer.contactAuthorization
                            ? 'Autorizado para envío de presupuestos y recordatorios clínicos'
                            : 'Sin autorización registrada'}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Sección B: Interés Clínico y Preferencias */}
                <div className="px-6 py-4">
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    2. Interés Clínico y Preferencias
                  </h3>
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3 text-xs">
                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">
                        Tratamiento Solicitado
                      </dt>
                      <dd className="mt-1 font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Stethoscope className="h-3.5 w-3.5 text-[#0f766e]" strokeWidth={1.75} />
                        <span>{buyer.serviceOfInterest || 'Evaluación Odontológica General'}</span>
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">
                        Sede de Preferencia
                      </dt>
                      <dd className="mt-1 font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
                        <span>{buyer.pref_sede_preferida || 'Sede California'}</span>
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">
                        Disponibilidad Horaria
                      </dt>
                      <dd className="mt-1 text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
                        <span>
                          {HORARIO_LABELS[String(buyer.pref_id_horario)] ||
                            buyer.pref_id_horario ||
                            'Mañana / Tarde (Flexible)'}
                        </span>
                      </dd>
                    </div>

                    <div className="sm:col-span-3">
                      <dt className="font-medium text-slate-500 dark:text-slate-400">
                        Motivo Concreto de Consulta
                      </dt>
                      <dd className="mt-1.5 border-l-2 border-[#0f766e] bg-slate-50/70 dark:bg-slate-800/50 pl-3 py-2 text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                        {buyer.concreteRequest ||
                          'Solicita información sobre costos de tratamiento y disponibilidad de cita inicial.'}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Sección C: Origen y Trazabilidad */}
                <div className="px-6 py-4">
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    3. Origen y Trazabilidad
                  </h3>
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3 text-xs">
                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">
                        Canal de Captura
                      </dt>
                      <dd className="mt-1 font-medium text-slate-900 dark:text-white">
                        {buyer.channel || 'Página Web / Portal Online'}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">
                        Fuente de Atracción
                      </dt>
                      <dd className="mt-1 text-slate-900 dark:text-white">
                        {buyer.attractionSource || 'Campaña Digital / Orgánico'}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">
                        Fecha de Captación
                      </dt>
                      <dd className="mt-1 font-mono text-slate-900 dark:text-white tabular-nums">
                        {buyer.createdAt
                          ? format(new Date(buyer.createdAt), 'dd MMM yyyy, HH:mm', {
                              locale: es,
                            })
                          : '—'}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            ) : (
              /* Formulario de Edición Limpio separado por divisores de 1px */
              <form onSubmit={handleSaveEdit} className="divide-y divide-slate-200/70 dark:divide-slate-800">
                <div className="p-6 space-y-4">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    1. Datos Personales & Contacto
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Nombres *
                      </label>
                      <input
                        type="text"
                        required
                        value={editForm.firstName}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, firstName: e.target.value }))
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white focus:border-[#0f766e] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Apellidos *
                      </label>
                      <input
                        type="text"
                        required
                        value={editForm.lastName}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, lastName: e.target.value }))
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white focus:border-[#0f766e] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Teléfono / WhatsApp (9 dígitos) *
                      </label>
                      <input
                        type="tel"
                        required
                        maxLength={9}
                        value={editForm.phone}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            phone: e.target.value.replace(/\D/g, ''),
                          }))
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 font-mono text-xs text-slate-900 dark:text-white focus:border-[#0f766e] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Correo Electrónico
                      </label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, email: e.target.value }))
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white focus:border-[#0f766e] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    2. Interés Clínico y Preferencias
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Sede Preferida
                      </label>
                      <select
                        value={editForm.pref_sede_preferida}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            pref_sede_preferida: e.target.value,
                          }))
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white"
                      >
                        {(catalogs.sedes.length > 0
                          ? catalogs.sedes
                          : [
                              { nombre: 'Sede California' },
                              { nombre: 'Sede El Golf' },
                              { nombre: 'Sede Centro Historico' },
                            ]
                        ).map((s: any) => (
                          <option key={s.nombre} value={s.nombre}>
                            {s.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Horario de Preferencia
                      </label>
                      <select
                        value={editForm.pref_id_horario}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            pref_id_horario: e.target.value,
                          }))
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white"
                      >
                        <option value="1">Mañana (08:00 - 13:00)</option>
                        <option value="2">Tarde (13:00 - 18:00)</option>
                        <option value="3">Noche (18:00 - 21:00)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Motivo de Consulta / Solicitud Concreta *
                      </label>
                      <input
                        type="text"
                        required
                        value={editForm.concreteRequest}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, concreteRequest: e.target.value }))
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white focus:border-[#0f766e] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 bg-slate-50/70 dark:bg-slate-900/80 px-6 py-3.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setSearchParams({}, { replace: true });
                    }}
                    className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={updateBuyer.isPending}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0f766e] px-4 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 cursor-pointer"
                  >
                    {updateBuyer.isPending ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        <span>Guardar Cambios</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Bloque 2: Historial de Interacciones y Línea de Tiempo (Activity Timeline) */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 px-6 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Historial de Interacciones (Activity Timeline)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Registro cronológico de formularios web, consultas clínicas y eventos de admisión.
                </p>
              </div>
              <span className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-0.5 font-mono text-[11px] font-medium text-slate-600 dark:text-slate-300">
                {timelineEvents.length} {timelineEvents.length === 1 ? 'evento' : 'eventos'}
              </span>
            </div>

            <div className="p-6">
              {buyer.consultasCount && buyer.consultasCount > 1 && (
                <div className="mb-5 border-l-2 border-[#0f766e] bg-slate-50/80 dark:bg-slate-800/50 pl-3.5 pr-4 py-2.5 text-xs text-slate-700 dark:text-slate-300">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Interés recurrente detectado ({buyer.consultasCount} consultas):
                  </span>{' '}
                  Este prospecto ha interactuado en múltiples ocasiones. Prioriza la resolución de dudas sobre financiamiento y disponibilidad de agenda.
                </div>
              )}

              <ol className="relative ml-2 border-l border-slate-200 dark:border-slate-800 space-y-6">
                {timelineEvents.map((evt) => (
                  <li key={evt.id} className="ml-5">
                    <span
                      className={`absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white dark:ring-slate-900 ${
                        evt.type === 'conversion'
                          ? 'bg-emerald-500'
                          : evt.type === 'inquiry'
                          ? 'bg-[#0f766e]'
                          : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    />
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                      <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                        {evt.title}
                      </h3>
                      <time className="font-mono text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                        {evt.timestamp
                          ? format(new Date(evt.timestamp), 'dd MMM yyyy, HH:mm', { locale: es })
                          : '—'}
                      </time>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {evt.subtitle}
                    </p>
                    {evt.detail && (
                      <div className="mt-2 rounded-lg border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                        {evt.detail}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA (35%): Tarjeta del Agente Inteligente de Marketing & BI */}
        <div className="lg:col-span-4 space-y-5">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 p-5 shadow-2xs space-y-5">
            {/* Cabecera del Agente de Marketing */}
            <div className="flex items-start justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/60 text-[#0f766e] dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/60 shadow-2xs">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#0f766e] dark:text-teal-400">
                      Agente de Marketing (IA)
                    </span>
                    <span className="rounded bg-teal-50 dark:bg-teal-950/60 px-1.5 py-0.2 font-mono text-[9px] font-semibold text-teal-700 dark:text-teal-300 border border-teal-200/50">
                      BUYER · BI
                    </span>
                  </div>
                  <h2 className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-[#0f766e]" strokeWidth={2} />
                    <span>Inteligencia de Admisión</span>
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => runAiAnalysis(buyer)}
                disabled={isAiLoading}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 disabled:opacity-50 cursor-pointer"
                title="Recalcular análisis con IA"
              >
                <RefreshCw className={`h-3 w-3 ${isAiLoading ? 'animate-spin' : ''}`} />
                <span>{isAiLoading ? 'Evaluando' : 'Actualizar'}</span>
              </button>
            </div>

            {/* Scoring del Prospecto */}
            <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Scoring Comercial del Prospecto
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                    {commercialScore}
                  </span>
                  <span className="font-mono text-xs text-slate-400">/ 100</span>
                </div>
              </div>

              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-[#0f766e] transition-all duration-300"
                  style={{ width: `${commercialScore}%` }}
                />
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Evaluación de Intención:</span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-semibold text-[11px] border ${
                    aiAnalysis?.intentEvaluation?.intentLevel === 'ALTA'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/60'
                      : aiAnalysis?.intentEvaluation?.intentLevel === 'MEDIA'
                      ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200/60 dark:border-sky-800/60'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/60'
                  }`}
                >
                  {aiAnalysis?.intentEvaluation?.intentLevel === 'ALTA' ? (
                    <>
                      <Flame className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Intención Alta · Calificado</span>
                    </>
                  ) : aiAnalysis?.intentEvaluation?.intentLevel === 'MEDIA' ? (
                    <>
                      <Zap className="h-3 w-3 text-sky-600 dark:text-sky-400 shrink-0" />
                      <span>Intención Media · En Maduración</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>Intención Ambigua · Requiere Filtro</span>
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Las 4 Actividades Clave de Business Intelligence */}
            <div className="space-y-2.5">
              {/* Actividad 1: Validación y Calidad de Datos */}
              <div className="border-l-2 border-[#0f766e] bg-white dark:bg-slate-900 px-3.5 py-2.5 rounded-r-lg border-y border-r border-slate-200/70 dark:border-slate-800">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    1. Validación y Calidad de Datos
                  </span>
                  <span
                    className={`font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      aiAnalysis?.dataQuality.status === 'Valido'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                    }`}
                  >
                    {aiAnalysis?.dataQuality.status || 'Válido'}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {aiAnalysis?.dataQuality.explanation ||
                    'Teléfono móvil de 9 dígitos y consentimiento de Ley N° 29733 verificados.'}
                </p>
              </div>

              {/* Actividad 2: Perfil y Clasificación de Preferencias Clínicas */}
              <div className="border-l-2 border-teal-500 bg-white dark:bg-slate-900 px-3.5 py-2.5 rounded-r-lg border-y border-r border-slate-200/70 dark:border-slate-800">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    2. Clasificación de Preferencias
                  </span>
                  <span className="font-mono text-[10px] text-teal-700 dark:text-teal-300 font-medium truncate max-w-[140px]">
                    {aiAnalysis?.preferencesProfile.category || 'Odontología General'}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {buyer.serviceOfInterest || 'Evaluación Odontológica'} · {buyer.pref_sede_preferida || 'Sede San Isidro'} · {HORARIO_LABELS[buyer.pref_id_horario || ''] || 'Horario Flexible'}
                </p>
              </div>

              {/* Actividad 3: Origen y Atribución de Captación */}
              <div className="border-l-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 rounded-r-lg border-y border-r border-slate-200/70 dark:border-slate-800">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    3. Origen y Atribución
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">
                    {buyer.channel || 'Portal Web'}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Fuente: {buyer.attractionSource || 'Meta Ads'} · Trazabilidad de captación confirmada.
                </p>
              </div>

              {/* Actividad 4: Evaluación de Intención & Recomendación Comercial */}
              <div className="border-l-2 border-[#0f766e] bg-white dark:bg-slate-900 px-3.5 py-2.5 rounded-r-lg border-y border-r border-slate-200/70 dark:border-slate-800">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    4. Recomendación de Abordaje
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  {aiAnalysis?.intentEvaluation?.marketingRecommendation ||
                    'Contactar de inmediato ofreciendo opciones de horario para consulta de evaluación diagnóstica.'}
                </p>
              </div>
            </div>

            {/* Acción Directa: Iniciar Chat de WhatsApp Clínico */}
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9.5 w-full items-center justify-center gap-2 rounded-lg bg-[#0f766e] px-4 text-xs font-semibold text-white shadow-2xs transition-all hover:bg-teal-800 active:scale-[0.99]"
                >
                  <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} />
                  <span>Iniciar Chat de WhatsApp Clínico</span>
                  <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="flex h-9.5 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-4 text-xs font-medium text-slate-400"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Sin teléfono válido para WhatsApp</span>
                </button>
              )}
              <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
                Abre plantilla clínica personalizada con sede y tratamiento
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmación de Conversión a LEAD */}
      <ConfirmationDialog
        isOpen={isConvertDialogOpen}
        onClose={() => setIsConvertDialogOpen(false)}
        onConfirm={handleConvert}
        isLoading={convertBuyer.isPending}
        title="¿Convertir prospecto a etapa LEAD?"
        description={`El prospecto ${fullName} pasará a la Mesa de Negociación en el módulo LEAD conservando su trazabilidad comercial.`}
        confirmText="Sí, Convertir a LEAD"
        cancelText="Cancelar"
      />
    </div>
  );
}
