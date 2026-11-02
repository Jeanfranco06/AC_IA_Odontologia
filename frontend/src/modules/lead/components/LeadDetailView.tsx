import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, addDays, startOfDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  X,
  Plus,
  Edit3,
  Trash2,
  Loader2,
  MessageSquare,
  Mail,
  Phone,
  Copy,
  CheckCheck,
  RefreshCw,
  Stethoscope,
  MapPin,
  Clock,
  Activity,
  Download,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  HeartPulse,
  GraduationCap,
  Briefcase,
  Target,
  CreditCard,
  ShieldAlert,
  Layers,
  AlertTriangle,
  Flame,
  Zap,
  Building2,
  User,
  SlidersHorizontal,
  ChevronRight,
  Eye,
  BadgePercent,
  DollarSign,
} from 'lucide-react';
import { leadService } from '../services/lead.service';
import { configService } from '@/modules/config/services/config.service';
import { LeadState } from '@/domain/enums';
import { QUERY_KEYS } from '@/shared/constants';
import { useToast } from '@/shared/hooks/use-toast';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { ConfirmationDialog } from '@/shared/components/feedback/ConfirmationDialog';
import {
  predictLeadNegotiationStrategy,
  type LeadNegotiationStrategy,
} from '@/shared/services/groqService';
import { renderLeadStatusBadge } from './LeadListView';
import { LeadProfileEditModal } from './LeadProfileEditModal';

interface LeadDetailViewProps {
  leadId: string;
}

const DEFAULT_SEDES = [
  { id_sede: 1, nombre: 'Sede California', direccion: 'Av. Larco 820, Urb. California, Trujillo' },
  { id_sede: 2, nombre: 'Sede El Golf', direccion: 'Av. El Golf 540, Urb. El Golf, Trujillo' },
  {
    id_sede: 3,
    nombre: 'Sede Centro Historico',
    direccion: 'Jr. Pizarro 456, Centro Histórico, Trujillo',
  },
];

const DEFAULT_SERVICIOS = [
  { id_servicio: 1, nombre: 'Evaluación General', Tarifas: [{ precio: 120 }] },
  { id_servicio: 2, nombre: 'Ortodoncia Inicial', Tarifas: [{ precio: 350 }] },
  { id_servicio: 3, nombre: 'Blanqueamiento Dental', Tarifas: [{ precio: 420 }] },
  { id_servicio: 4, nombre: 'Implante Dental', Tarifas: [{ precio: 1850 }] },
];

const DEFAULT_PROFESIONALES = [
  { id_profesional: 1, nombres: 'Carlos', apellidos: 'Mendoza Ríos' },
  { id_profesional: 2, nombres: 'Lucía', apellidos: 'Vargas Paredes' },
  { id_profesional: 3, nombres: 'Andrés', apellidos: 'Salazar Luna' },
];

function parseCompanyHours(companyHorario: string) {
  if (!companyHorario) return { openTime: '08:00 AM', closeTime: '08:00 PM' };
  const match = companyHorario.match(
    /(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)\s*[-–—a]\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/i
  );
  let open = '08:00 AM';
  let close = '08:00 PM';
  if (match) {
    open = match[1].trim().toUpperCase();
    close = match[2].trim().toUpperCase();
    if (!open.includes('AM') && !open.includes('PM')) open += ' AM';
    if (!close.includes('AM') && !close.includes('PM')) close += ' PM';
  }
  return { openTime: open, closeTime: close };
}

export function LeadDetailView({ leadId }: LeadDetailViewProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [lead, setLead] = useState<any>(null);
  const [options, setOptions] = useState<any>({
    profesionales: DEFAULT_PROFESIONALES,
    sedes: DEFAULT_SEDES,
    servicios: DEFAULT_SERVICIOS,
    disponibilidades: [],
  });
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);
  const [addingAlternative, setAddingAlternative] = useState(false);
  const [selectedOpcion, setSelectedOpcion] = useState<number | string | null>(null);

  // Configuración de nueva propuesta comercial
  const [selectedServicioId, setSelectedServicioId] = useState('1');
  const [selectedProfesionalId, setSelectedProfesionalId] = useState('ALL_PROFESSIONALS');
  const [selectedSedeId, setSelectedSedeId] = useState('ALL_SEDES');
  const [selectedVigencia, setSelectedVigencia] = useState<
    '24h' | '48h' | '72h' | '7d' | 'custom'
  >('48h');
  const [selectedVigenciaCustom, setSelectedVigenciaCustom] = useState('');
  const [selectedFranja, setSelectedFranja] = useState('Turno Mañana (08:00 AM – 01:00 PM)');
  const [companyHorario, setCompanyHorario] = useState('');

  const { openTime, closeTime } = useMemo(
    () => parseCompanyHours(companyHorario),
    [companyHorario]
  );

  const [precioOfrecido, setPrecioOfrecido] = useState('150.00');
  const [condiciones, setCondiciones] = useState('');
  const [offerErrors, setOfferErrors] = useState<Record<string, string>>({});

  // Edición rápida de tarifa en las opciones del tablero
  const [editingOptionId, setEditingOptionId] = useState<number | string | null>(null);
  const [editingPrice, setEditingPrice] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingOptionTarget, setDeletingOptionTarget] = useState<any | null>(null);
  const [isDeletingOption, setIsDeletingOption] = useState(false);

  // Objeciones, WhatsApp, Canva y Estrategia IA
  const [objectionCategory, setObjectionCategory] = useState<'PRECIO' | 'HORARIO' | 'SEDE'>(
    'PRECIO'
  );
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [copiedPitch, setCopiedPitch] = useState(false);
  const [generatingCanva, setGeneratingCanva] = useState(false);
  const [canvaResult, setCanvaResult] = useState<any>(null);
  const [aiStrategy, setAiStrategy] = useState<LeadNegotiationStrategy | null>(null);
  const [loadingStrategy, setLoadingStrategy] = useState(false);

  // Estados para Organización del Perfil de Negociación
  const [profileTab, setProfileTab] = useState<'VARIABLES' | 'CLINICA' | 'CONVENIOS' | 'CONTACTO'>('VARIABLES');
  const [profileViewMode, setProfileViewMode] = useState<'TABS' | 'ALL'>('TABS');
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);

  const handleProfileUpdated = (updatedLead: any) => {
    if (updatedLead) {
      setLead(updatedLead);
      runNegotiationStrategy(updatedLead);
    } else {
      fetchLeadData();
    }
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS] });
  };

  const fetchLeadData = () => {
    setLoading(true);
    Promise.all([
      leadService.getLeadDetails(leadId),
      leadService.getAvailabilityOptions(),
      configService.getEmpresa().catch(() => null),
    ])
      .then(([leadData, optionsData, empData]) => {
        setLead(leadData);
        setOptions({
          profesionales: optionsData?.profesionales?.length
            ? optionsData.profesionales
            : DEFAULT_PROFESIONALES,
          sedes: optionsData?.sedes?.length ? optionsData.sedes : DEFAULT_SEDES,
          servicios: optionsData?.servicios?.length ? optionsData.servicios : DEFAULT_SERVICIOS,
          disponibilidades: optionsData?.disponibilidades || [],
        });
        if (empData?.horarioAtencion) {
          setCompanyHorario(empData.horarioAtencion);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (leadId) {
      fetchLeadData();
    }
  }, [leadId]);

  // Pre-carga inteligente al obtener datos
  useEffect(() => {
    if (!lead || !options?.servicios?.length) return;

    const reqServicio = lead.Solicitudes?.[0]?.Servicio;
    const reqServicioId = lead.Solicitudes?.[0]?.id_servicio;
    let initialServicioId = selectedServicioId;

    if (reqServicioId) {
      initialServicioId = String(reqServicioId);
    } else if (reqServicio?.id_servicio) {
      initialServicioId = String(reqServicio.id_servicio);
    } else if (reqServicio?.nombre) {
      const found = options.servicios.find((s: any) =>
        s.nombre.toLowerCase().includes(reqServicio.nombre.toLowerCase())
      );
      if (found) initialServicioId = String(found.id_servicio);
    }

    if (initialServicioId) {
      setSelectedServicioId(initialServicioId);
      const activeServicio = options.servicios.find(
        (s: any) => String(s.id_servicio) === initialServicioId
      );
      const officialPrice = Number(activeServicio?.Tarifas?.[0]?.precio || 180);
      setPrecioOfrecido(officialPrice.toFixed(2));
    }

    const prefSede = lead.Preferencias?.[0]?.sede_preferida;
    if (prefSede) {
      const matchSede = options.sedes?.find(
        (s: any) =>
          s.nombre.toLowerCase().includes(prefSede.toLowerCase()) ||
          prefSede.toLowerCase().includes(s.nombre.toLowerCase())
      );
      if (matchSede) setSelectedSedeId(String(matchSede.id_sede));
    }

    const existingOpciones = lead.Solicitudes?.[lead.Solicitudes.length - 1]?.Opciones || [];
    if (existingOpciones.length > 0 && selectedOpcion === null) {
      const preselected =
        existingOpciones.find((o: any) => o.seleccionada) || existingOpciones[0];
      setSelectedOpcion(preselected.id_opcion);
    }
  }, [lead, options]);

  // Diagnóstico Predictivo de Negociación (IA / BI)
  const runNegotiationStrategy = async (l = lead) => {
    if (!l) return;
    setLoadingStrategy(true);
    try {
      const strategy = await predictLeadNegotiationStrategy({
        lead: l,
        catalogs: options,
      });
      setAiStrategy(strategy);
    } catch (err) {
      console.warn('Error calculando estrategia de negociación:', err);
    } finally {
      setLoadingStrategy(false);
    }
  };

  useEffect(() => {
    if (lead) {
      runNegotiationStrategy(lead);
    }
  }, [lead?.id_persona]);

  // Vigencia calculada
  const calculatedExpiry = useMemo(() => {
    const today = startOfDay(new Date());
    if (selectedVigencia === '24h') return addDays(today, 1);
    if (selectedVigencia === '48h') return addDays(today, 2);
    if (selectedVigencia === '72h') return addDays(today, 3);
    if (selectedVigencia === '7d') return addDays(today, 7);
    if (selectedVigencia === 'custom' && selectedVigenciaCustom) {
      try {
        return parseISO(selectedVigenciaCustom);
      } catch {
        return addDays(today, 2);
      }
    }
    return addDays(today, 2);
  }, [selectedVigencia, selectedVigenciaCustom]);

  const getVigenciaLabel = (vig: string, customVal: string) => {
    if (vig === '24h') return '24 horas (Flash)';
    if (vig === '48h') return '48 horas (Recomendado)';
    if (vig === '72h') return '72 horas (3 días)';
    if (vig === '7d') return '7 días (Semanal)';
    return `Hasta ${customVal || 'Personalizado'}`;
  };

  const currentOfficialPrice = useMemo(() => {
    const s = options.servicios?.find(
      (item: any) => String(item.id_servicio) === selectedServicioId
    );
    return Number(s?.Tarifas?.[0]?.precio || 180);
  }, [options.servicios, selectedServicioId]);

  const numericOfferPrice = useMemo(() => {
    const val = parseFloat(precioOfrecido);
    return isNaN(val) ? 0 : val;
  }, [precioOfrecido]);

  const discountMetrics = useMemo(() => {
    const saving = Math.max(0, currentOfficialPrice - numericOfferPrice);
    const pct =
      currentOfficialPrice > 0 ? Math.round((saving / currentOfficialPrice) * 100) : 0;
    return { saving, pct };
  }, [currentOfficialPrice, numericOfferPrice]);

  const applyQuickDiscount = (pct: number, type?: 'CAMPANA' | 'REGULAR') => {
    const discounted = currentOfficialPrice * (1 - pct / 100);
    setPrecioOfrecido(discounted.toFixed(2));
    if (type === 'CAMPANA') {
      setCondiciones(`Tarifa promocional autorizada (-${pct}%) con reserva anticipada`);
    } else if (type === 'REGULAR') {
      setCondiciones('');
    }
    if (offerErrors.precio) setOfferErrors((p) => ({ ...p, precio: '' }));
  };

  const handleAddAlternative = async () => {
    const errors: Record<string, string> = {};
    if (!selectedServicioId) errors.servicio = 'Selecciona un servicio odontológico.';
    if (!precioOfrecido || isNaN(Number(precioOfrecido)) || Number(precioOfrecido) <= 0) {
      errors.precio = 'Ingresa una tarifa mayor a 0.';
    }
    if (Object.keys(errors).length > 0) {
      setOfferErrors(errors);
      return;
    }

    setOfferErrors({});
    setAddingAlternative(true);
    const ultimaSolicitud = lead.Solicitudes?.[lead.Solicitudes.length - 1];
    const expiryStr = format(calculatedExpiry, 'yyyy-MM-dd');
    const fullCondiciones = `[Vigencia: ${getVigenciaLabel(
      selectedVigencia,
      selectedVigenciaCustom
    )} · Vence: ${format(calculatedExpiry, 'dd/MM/yyyy')}] [${selectedFranja}] ${
      condiciones ? `| ${condiciones}` : ''
    }`.trim();

    try {
      await leadService.addAlternative(leadId, {
        id_solicitud: ultimaSolicitud?.id_solicitud,
        fecha: expiryStr,
        hora_inicio: selectedFranja.includes('Tarde') ? '14:00' : '09:00',
        hora_fin: selectedFranja.includes('Tarde') ? '19:00' : '13:00',
        id_profesional:
          selectedProfesionalId && selectedProfesionalId !== 'ALL_PROFESSIONALS'
            ? selectedProfesionalId
            : undefined,
        id_sede:
          selectedSedeId && selectedSedeId !== 'ALL_SEDES' ? selectedSedeId : undefined,
        precio_ofrecido: precioOfrecido,
        condiciones: fullCondiciones,
        // Campos adicionales para modo mock/fallback
        service:
          options.servicios?.find((s: any) => String(s.id_servicio) === selectedServicioId)
            ?.nombre || 'Evaluación General',
        professional:
          options.profesionales?.find(
            (p: any) => String(p.id_profesional) === selectedProfesionalId
          )?.apellidos || 'Staff Colegiado',
        branch:
          options.sedes?.find((s: any) => String(s.id_sede) === selectedSedeId)?.nombre ||
          'Sede California',
        date: expiryStr,
        time: '09:00',
        price: Number(precioOfrecido),
        conditions: fullCondiciones,
      });
      fetchLeadData();
      setCondiciones('');
      toast({
        title: 'Propuesta comercial añadida',
        description: 'La oferta fue incorporada a la mesa de negociación.',
      });
    } catch {
      toast({
        title: 'Error al registrar propuesta',
        description: 'No se pudo guardar la alternativa comercial.',
        variant: 'destructive',
      });
    } finally {
      setAddingAlternative(false);
    }
  };

  const handleSaveEdit = async (e: React.MouseEvent, id_opcion: number | string) => {
    e.stopPropagation();
    if (!editingPrice || isNaN(Number(editingPrice)) || Number(editingPrice) <= 0) {
      toast({
        title: 'Tarifa inválida',
        description: 'Ingresa un monto válido mayor a 0.',
        variant: 'destructive',
      });
      return;
    }
    setSavingEdit(true);
    try {
      await leadService.updateAlternative(id_opcion, { precio_ofrecido: editingPrice });
      setEditingOptionId(null);
      fetchLeadData();
      toast({
        title: 'Tarifa actualizada',
        description: `Nuevo monto: S/ ${Number(editingPrice).toFixed(2)}`,
      });
    } catch {
      toast({
        title: 'Error al actualizar tarifa',
        description: 'No se pudo modificar la propuesta.',
        variant: 'destructive',
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDeleteOption = async () => {
    if (!deletingOptionTarget) return;
    setIsDeletingOption(true);
    try {
      await leadService.deleteAlternative(deletingOptionTarget.id_opcion);
      if (selectedOpcion === deletingOptionTarget.id_opcion) {
        setSelectedOpcion(null);
      }
      fetchLeadData();
      toast({
        title: 'Propuesta removida',
        description: 'La oferta comercial fue retirada del tablero.',
      });
    } catch {
      toast({
        title: 'Error al eliminar propuesta',
        description: 'No se pudo remover la alternativa.',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingOption(false);
      setDeletingOptionTarget(null);
    }
  };

  const handleReserveAndConvert = async () => {
    if (!selectedOpcion) {
      toast({
        title: 'Selecciona una propuesta comercial',
        description: 'Elige una de las ofertas activas en la mesa antes de cerrar el trato.',
        variant: 'destructive',
      });
      return;
    }

    const ultimaSolicitud = lead.Solicitudes?.[lead.Solicitudes.length - 1];
    setReserving(true);
    try {
      await leadService.reserve(leadId, {
        id_solicitud: ultimaSolicitud?.id_solicitud || 1,
        id_opcion: selectedOpcion,
      });
      await queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS] });
      await queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });
      toast({
        title: 'Trato cerrado · Transferido a PAYER',
        description: 'La orden de cobro ha sido generada en el módulo PAYER.',
      });
      navigate('/payer');
    } catch {
      toast({
        title: 'Error al confirmar el cierre',
        description: 'No se pudo procesar el pase a la etapa PAYER.',
        variant: 'destructive',
      });
    } finally {
      setReserving(false);
    }
  };

  if (loading) return <LoadingState />;
  if (!lead) return <ErrorState message="No se encontró el expediente de negociación LEAD." />;

  const fullName =
    `${lead.nombres || ''} ${lead.apellidos || ''}`.trim() || 'Paciente en Negociación';
  const pref = lead.Preferencias?.[0];
  const salud = lead.SaludOdontologica?.[0] || lead.saludOdontologica || {};
  const academico = lead.DatosAcademicos?.[0] || lead.datosAcademicos || {};
  const laboral = lead.DatosLaborales?.[0] || lead.datosLaborales || {};
  const ultimaSolicitud = lead.Solicitudes?.[lead.Solicitudes.length - 1];
  const opciones: any[] = ultimaSolicitud?.Opciones || [];
  const selectedOptData = opciones.find((o: any) => o.id_opcion === selectedOpcion);

  const hasUrgentPain =
    salud.nivel_dolor === 'Moderado' ||
    salud.nivel_dolor === 'Severo' ||
    aiStrategy?.urgencyLevel === 'CRÍTICA_DOLOR';

  const isStudent = Boolean(
    academico.estudianteAplica ||
    academico.universidad ||
    academico.carrera
  );

  const isWorker = Boolean(
    laboral.laboralAplica ||
    laboral.ocupacion ||
    laboral.empresa
  );

  const convenioTexto = isStudent
    ? `Convenio Estudiantil (${academico.universidad || 'Universidad'}) · 15% OFF`
    : isWorker && laboral.empresa
    ? `Convenio Corporativo (${laboral.empresa})`
    : 'Tarifa Particular Regular';

  // Matching Comercial & Estrategia Recomendada (Figura 15 del Informe NexoSalud)
  const matchingData = (() => {
    // 1. Sede Sugerida (Matching territorial y disponibilidad en Trujillo)
    let suggestedSedeName = 'Sede California';
    let suggestedSedeReason = '';
    const zona = lead?.zona ? String(lead.zona).trim() : '';
    const prefSede = pref?.sede_preferida ? String(pref.sede_preferida).trim() : '';

    if (prefSede) {
      suggestedSedeName = prefSede;
      suggestedSedeReason = `Recomendada según preferencia declarada por el paciente en la prospección.`;
    } else if (zona) {
      const z = zona.toLowerCase();
      if (z.includes('huanchaco') || z.includes('centro') || z.includes('moche') || z.includes('esperanza') || z.includes('florencia')) {
        suggestedSedeName = 'Sede Centro Historico';
        suggestedSedeReason = `Sede Centro Histórico recomendada por proximidad geográfica a ${zona}.`;
      } else if (z.includes('golf')) {
        suggestedSedeName = 'Sede El Golf';
        suggestedSedeReason = `Sede El Golf recomendada por cercanía a zona residencial (${zona}).`;
      } else {
        suggestedSedeName = 'Sede California';
        suggestedSedeReason = `Sede California recomendada por accesibilidad desde ${zona}.`;
      }
    } else {
      suggestedSedeName = 'Sede California';
      suggestedSedeReason = `Sede California recomendada por alta disponibilidad de especialistas de guardia.`;
    }

    // 2. Tratamiento Solicitado (Matching Clínico)
    const serviceName = ultimaSolicitud?.Servicio?.nombre || 'Odontología preventiva o diagnóstica';
    let treatmentDetail = '';
    if (salud?.nivel_dolor && salud.nivel_dolor !== 'Ninguno') {
      treatmentDetail = `Dolor ${salud.nivel_dolor}. Priorizar turno cercano para alivio inmediato (Alta urgencia clínica).`;
    } else if (salud?.motivo_consulta) {
      treatmentDetail = `${salud.motivo_consulta}. Alta probabilidad de cierre ágil.`;
    } else {
      treatmentDetail = `Odontología preventiva o diagnóstica. Alta probabilidad de cierre ágil.`;
    }

    // 3. Margen de Cierre (LEAD) (SLA de dos semanas y gatillador económico)
    let closingTarget = 'Meta de conversión a PAYER en ≤ 14 días';
    let closingRationale = 'Tarifa promocional activa con seguimiento omnicanal oportuno.';

    if (hasUrgentPain) {
      closingTarget = 'Meta de conversión urgente en ≤ 48 horas';
      closingRationale = 'Turno de alivio prioritario para asegurar la atención médica antes de abandono.';
    } else if (isStudent) {
      closingTarget = 'Meta de conversión a PAYER en ≤ 14 días';
      closingRationale = `Convenio Estudiantil (${academico.universidad ? String(academico.universidad).split(' ')[0] : 'Universidad'} -15% OFF) activo como gatillador clave.`;
    } else if (isWorker && laboral.empresa) {
      closingTarget = 'Meta de conversión a PAYER en ≤ 14 días';
      closingRationale = `Convenio Corporativo (${laboral.empresa}) disponible para cierre preferencial.`;
    } else if (aiStrategy?.leadScore && aiStrategy.leadScore >= 80) {
      closingTarget = `Meta de conversión alta (${aiStrategy.leadScore}%)`;
      closingRationale = 'Lead con alto score de intención; aplicar propuesta flash.';
    }

    return {
      sede: suggestedSedeName,
      sedeReason: suggestedSedeReason,
      treatmentName: serviceName,
      treatmentDetail: treatmentDetail,
      closingTarget: closingTarget,
      closingRationale: closingRationale,
    };
  })();

  const generateWhatsAppMessage = () => {
    const patientFirstName = lead?.nombres || 'Paciente';
    const reqServicio = ultimaSolicitud?.Servicio?.nombre || 'Evaluación Odontológica';

    if (selectedOptData) {
      const precio = Number(selectedOptData.precio_ofrecido).toFixed(2);
      const matchedSede = selectedOptData.Disponibilidad?.Sede;
      const sede = matchedSede
        ? `${matchedSede.nombre}${matchedSede.direccion ? ` (${matchedSede.direccion})` : ''}`
        : 'Sede California';
      const doctor = selectedOptData.Disponibilidad?.Profesional?.apellidos
        ? `Esp. ${selectedOptData.Disponibilidad.Profesional.apellidos}`
        : 'Staff Odontológico Colegiado';
      const fechaVigencia = selectedOptData.Disponibilidad?.fecha?.split('T')[0] || 'Vigente';

      return (
        `Hola ${patientFirstName}, te saludamos de NexoSalud Dental.\n\n` +
        `Hemos preparado tu propuesta comercial para ${reqServicio}:\n` +
        `• Tarifa Preferencial: S/ ${precio}\n` +
        `• Vigencia: Hasta el ${fechaVigencia}\n` +
        `• Sede: ${sede}\n` +
        `• Especialista: ${doctor}\n\n` +
        `Puedes confirmar tu pre-reserva en línea aquí:\n` +
        `https://nexosalud.pe/pre-reserva/${leadId}\n\n` +
        `Quedamos atentos para asegurar tu turno.`
      );
    }

    return (
      `Hola ${patientFirstName}, te escribimos de NexoSalud Dental respecto a tu solicitud de ${reqServicio}. ` +
      `Contamos con disponibilidad preferencial en ${pref?.sede_preferida || 'nuestras sedes'} para esta semana. ` +
      `¿En qué turno te gustaría agendar tu cita?`
    );
  };

  const handleSendWhatsApp = () => {
    const rawPhone = String(lead?.numero || '').replace(/\D/g, '');
    const cleanPhone = rawPhone.length === 9 ? `51${rawPhone}` : rawPhone;
    const message = generateWhatsAppMessage();
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleSendEmail = () => {
    const patientFirstName = lead?.nombres || 'Paciente';
    const email = lead?.email || '';
    const subject = encodeURIComponent(
      `Propuesta Comercial Odontológica — NexoSalud (${patientFirstName})`
    );
    const body = encodeURIComponent(generateWhatsAppMessage());
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
  };

  const handleCopyWhatsApp = () => {
    navigator.clipboard.writeText(generateWhatsAppMessage());
    setCopiedWhatsApp(true);
    toast({
      title: 'Propuesta copiada',
      description: 'El mensaje fue copiado al portapapeles.',
    });
    setTimeout(() => setCopiedWhatsApp(false), 2000);
  };

  const handleGenerateCanva = async () => {
    setGeneratingCanva(true);
    try {
      const reqServicio = ultimaSolicitud?.Servicio?.nombre || 'Consulta Odontológica';
      const precio = selectedOptData
        ? Number(selectedOptData.precio_ofrecido).toFixed(2)
        : numericOfferPrice.toFixed(2);
      const matchedSedeObj =
        selectedOptData?.Disponibilidad?.Sede ||
        options.sedes?.find((s: any) => String(s.id_sede) === selectedSedeId) ||
        options.sedes?.[0];
      const sede = matchedSedeObj ? matchedSedeObj.nombre : 'Sede California';
      const doctor = selectedOptData?.Disponibilidad?.Profesional?.apellidos
        ? `Esp. ${selectedOptData.Disponibilidad.Profesional.apellidos}`
        : 'Staff Colegiado';
      const rawExpDate =
        selectedOptData?.Disponibilidad?.fecha?.split('T')[0] ||
        format(calculatedExpiry, 'yyyy-MM-dd');

      const resData = await leadService.generateCanvaFlyer(leadId, {
        serviceName: reqServicio,
        sedeName: sede,
        doctorName: doctor,
        offeredPrice: Number(precio),
        originalPrice: currentOfficialPrice || 180,
        discountPct: discountMetrics?.pct || 15,
        expirationDate: rawExpDate,
        fechaLimite: rawExpDate,
        diasFaltantes: 2,
        horarioTexto: selectedFranja,
        conditions: condiciones || `Atención clínica en ${sede}`,
        sendEmail: false,
        leadEmail: lead?.email,
        leadPhone: lead?.numero,
      });

      const canva = resData.canva;
      setCanvaResult({
        success: true,
        designUrl: canva?.designUrl,
        previewUrl: canva?.previewUrl,
        downloadPngUrl: canva?.downloadPngUrl || canva?.previewUrl,
      });

      toast({
        title: 'Flyer generado con Canva Connect',
        description: 'La pieza gráfica está lista para previsualizar o descargar.',
      });
    } catch {
      toast({
        title: 'Sesión de Canva requerida',
        description: 'Haz clic en "Conectar Canva" en la cabecera para vincular tu cuenta.',
        variant: 'destructive',
      });
    } finally {
      setGeneratingCanva(false);
    }
  };

  const closeProbability = aiStrategy?.leadScore ?? (opciones.length > 0 ? 84 : 68);

  return (
    <div className="w-full max-w-none space-y-6 overflow-x-hidden">
      {/* Cabecera Fija de la Mesa de Negociación */}
      <div className="sticky top-0 z-20 py-3.5 sm:py-4 bg-[#f8fafc]/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Link
              to="/lead"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Volver a Oportunidades (LEAD)</span>
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                {fullName}
              </h1>
              {renderLeadStatusBadge(
                selectedOpcion ? LeadState.ALTERNATIVE_SELECTED : LeadState.IN_NEGOTIATION
              )}
              <span className="font-mono text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                LEAD #{lead.id_persona || leadId}
                {lead.dni ? ` · DNI ${lead.dni}` : ''}
              </span>
            </div>
          </div>

          {/* Barra de Acciones Fijas Arriba */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleReserveAndConvert}
              disabled={reserving || !selectedOpcion}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0f766e] px-3.5 text-xs font-semibold text-white shadow-2xs transition-all hover:bg-teal-800 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              {reserving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <span>Cerrar Trato (Pasar a PAYER)</span>
                  <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
                </>
              )}
            </button>

            <Link
              to={`/pre-reserva/${leadId}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
              <span>Pre-Reserva</span>
            </Link>

            <button
              type="button"
              onClick={() => navigate('/lead')}
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
        {/* COLUMNA IZQUIERDA (65%): Description List + Mesa de Negociación */}
        <div className="lg:col-span-8 space-y-6">
          {/* Bloque 1: Perfil de Negociación Comercial & Expediente Integral del LEAD */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
            {/* Cabecera del Perfil con Selector de Vista */}
            <div className="flex flex-col gap-3 border-b border-slate-200/80 dark:border-slate-800 px-6 py-4 sm:flex-row sm:items-center sm:justify-between bg-slate-50/50 dark:bg-slate-950/40">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/60 text-[#0f766e] dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/60 shadow-2xs">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Perfil de Negociación Comercial & Expediente
                    </h2>
                    <span className="rounded bg-teal-50 dark:bg-teal-950/60 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-teal-700 dark:text-teal-300 border border-teal-200/50">
                      LEAD · CIERRE
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Variables clave de decisión, gatilladores clínicos y convenios institucionales para cerrar el trato.
                  </p>
                </div>
              </div>

              {/* Acciones de Cabecera: Completar Perfil Asesor & Selector de Modo */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => setIsEditProfileModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900/80 text-[#0f766e] dark:text-teal-300 border border-teal-200/80 dark:border-teal-800/80 px-3 py-1.5 text-xs font-semibold shadow-2xs transition-all cursor-pointer hover:shadow-xs"
                >
                  <Edit3 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Completar / Editar Perfil</span>
                </button>

                <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 text-xs font-medium self-start sm:self-auto shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setProfileViewMode('TABS')}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                      profileViewMode === 'TABS'
                        ? 'bg-[#0f766e] text-white font-semibold'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    <SlidersHorizontal className="h-3 w-3" />
                    <span>Pestañas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileViewMode('ALL')}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                      profileViewMode === 'ALL'
                        ? 'bg-[#0f766e] text-white font-semibold'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    <Eye className="h-3 w-3" />
                    <span>Ver Todo</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Cinta Superior de Métricas Clave de Negociación (KPIs de Cierre) */}
            <div className="grid grid-cols-2 gap-3 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:grid-cols-4 text-xs">
              <div className="border-l-2 border-[#0f766e] pl-3 py-0.5">
                <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                  Lead Score & Cierre
                </span>
                <div className="mt-0.5 flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                  <Flame className="h-3.5 w-3.5 text-amber-500" />
                  <span>{closeProbability}% · {aiStrategy?.scoreLevel || 'HOT'}</span>
                </div>
              </div>

              <div className={`border-l-2 pl-3 py-0.5 ${hasUrgentPain ? 'border-rose-500' : 'border-emerald-500'}`}>
                <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                  Gatillador Clínico
                </span>
                <div className="mt-0.5 flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white truncate">
                  <HeartPulse className={`h-3.5 w-3.5 ${hasUrgentPain ? 'text-rose-500' : 'text-emerald-500'}`} />
                  <span className="truncate">{salud.nivel_dolor ? `Dolor: ${salud.nivel_dolor}` : (hasUrgentPain ? 'Dolor Urgente' : 'Evaluación Electiva')}</span>
                </div>
              </div>

              <div className="border-l-2 border-teal-500 pl-3 py-0.5">
                <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                  Sensibilidad al Precio
                </span>
                <div className="mt-0.5 flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                  <BadgePercent className="h-3.5 w-3.5 text-teal-600" />
                  <span>{aiStrategy?.priceSensitivity || 'MODERADA'}</span>
                </div>
              </div>

              <div className={`border-l-2 pl-3 py-0.5 ${isStudent ? 'border-sky-500' : 'border-slate-300 dark:border-slate-700'}`}>
                <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                  Convenio / Tarifa
                </span>
                <div className="mt-0.5 flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white truncate">
                  <GraduationCap className={`h-3.5 w-3.5 ${isStudent ? 'text-sky-600' : 'text-slate-400'}`} />
                  <span className="truncate">{isStudent ? 'Convenio Estudiantil' : (isWorker && laboral.empresa ? 'Corporativo' : 'Particular')}</span>
                </div>
              </div>
            </div>

            {/* Pestañas de Navegación Segmentada (Segmented Control Responsive sin Scroll Horizontal) */}
            {profileViewMode === 'TABS' && (
              <div className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-2 sm:p-2.5">
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {[
                    { id: 'VARIABLES', label: 'Variables de Cierre', sub: 'IA & Scoring', icon: Target },
                    { id: 'CLINICA', label: 'Salud Odontológica', sub: 'Gatilladores', icon: HeartPulse },
                    { id: 'CONVENIOS', label: 'Ocupación & Convenio', sub: 'Estudio / Trabajo', icon: GraduationCap },
                    { id: 'CONTACTO', label: 'Datos de Contacto', sub: 'Canal & Registro', icon: User },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const active = profileTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setProfileTab(tab.id as any)}
                        className={`flex items-center justify-center sm:justify-start gap-1.5 rounded-lg px-2.5 py-2 text-xs transition-all cursor-pointer ${
                          active
                            ? 'bg-white dark:bg-slate-900 text-[#0f766e] dark:text-teal-400 font-semibold shadow-xs ring-1 ring-slate-200/80 dark:ring-slate-700/80'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-900/50'
                        }`}
                      >
                        <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-[#0f766e] dark:text-teal-400' : 'text-slate-400'}`} />
                        <span className="truncate">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Contenido Modular de las Secciones */}
            <div className="divide-y divide-slate-200/70 dark:divide-slate-800">
              {/* SECCIÓN A: Variables de Negociación Comercial & Factores de Cierre */}
              {(profileViewMode === 'ALL' || profileTab === 'VARIABLES') && (
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5 text-[#0f766e]" />
                      <span>Factores Determinantes para la Negociación Comercial</span>
                    </h3>
                    <span className="font-mono text-[10px] text-teal-700 dark:text-teal-300 font-semibold bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded border border-teal-200/50">
                      Inferencia Analítica NexoSalud
                    </span>
                  </div>

                  <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                    <div className="rounded-lg border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-3">
                      <dt className="font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <BadgePercent className="h-3.5 w-3.5 text-teal-600" />
                        <span>Sensibilidad al Precio</span>
                      </dt>
                      <dd className="mt-1.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                          aiStrategy?.priceSensitivity === 'ALTA'
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                            : aiStrategy?.priceSensitivity === 'MODERADA'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                        }`}>
                          {aiStrategy?.priceSensitivity || 'MODERADA'}
                        </span>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          {aiStrategy?.priceSensitivity === 'ALTA'
                            ? 'Altamente sensible. Prioriza promociones de campaña (-15% a -20%) y facilidades de pago.'
                            : aiStrategy?.priceSensitivity === 'MODERADA'
                            ? 'Sensibilidad media. Receptivo a tarifa promocional con vigencia activa o cuotas.'
                            : 'Sensibilidad baja. Valora principalmente prestigio, garantía y rapidez de atención.'}
                        </p>
                      </dd>
                    </div>

                    <div className="rounded-lg border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-3">
                      <dt className="font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-amber-600" />
                        <span>Modalidad de Pago Idónea</span>
                      </dt>
                      <dd className="mt-1.5 font-medium text-slate-900 dark:text-white">
                        {aiStrategy?.paymentPreference || 'Pago al contado (Yape/Efectivo) con descuento sugerido'}
                      </dd>
                    </div>

                    <div className="rounded-lg border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-3">
                      <dt className="font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Target className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Factor Clave de Decisión (Driver)</span>
                      </dt>
                      <dd className="mt-1.5 font-medium text-slate-900 dark:text-white">
                        {aiStrategy?.decisionDriver || 'Calidad médica, alivio del dolor y precio transparente'}
                      </dd>
                    </div>

                    <div className="rounded-lg border border-rose-200/70 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 p-3">
                      <dt className="font-medium text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                        <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />
                        <span>Freno / Objeción Principal Prevista</span>
                      </dt>
                      <dd className="mt-1.5 text-slate-700 dark:text-slate-300">
                        {aiStrategy?.primaryBarrier || 'Comparación de presupuestos y dudas sobre tiempo total de tratamiento'}
                      </dd>
                    </div>

                    <div className="rounded-lg border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-3">
                      <dt className="font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-teal-600" />
                        <span>Disposición a Venta Cruzada (Cross-Selling)</span>
                      </dt>
                      <dd className="mt-1.5 text-slate-700 dark:text-slate-300">
                        {aiStrategy?.crossSellingOpenness || 'Receptivo a profilaxis previa o radiografía panorámica de diagnóstico'}
                      </dd>
                    </div>

                    <div className="rounded-lg border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-3">
                      <dt className="font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-500" />
                        <span>Flexibilidad de Agenda</span>
                      </dt>
                      <dd className="mt-1.5 text-slate-700 dark:text-slate-300">
                        {aiStrategy?.agendaFlexibility || (pref?.Horario ? `Turno asignado: ${pref.Horario.hora_inicio || 'Vespertino'}` : 'Horario flexible a convenir')}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}

              {/* SECCIÓN B: Gatilladores Clínicos (Salud Odontológica) */}
              {(profileViewMode === 'ALL' || profileTab === 'CLINICA') && (
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <HeartPulse className="h-3.5 w-3.5 text-rose-500" />
                      <span>Salud Odontológica & Gatilladores de Cierre Clínico</span>
                    </h3>
                    {hasUrgentPain && (
                      <span className="flex items-center gap-1 font-mono text-[10px] text-rose-700 dark:text-rose-300 font-bold bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-200/60">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Atención Prioritaria por Dolor</span>
                      </span>
                    )}
                  </div>

                  <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">Nivel de Dolor Reportado</dt>
                      <dd className="mt-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                          salud.nivel_dolor === 'Severo'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200'
                            : salud.nivel_dolor === 'Moderado'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {salud.nivel_dolor || 'Ninguno / Sin dolor declarado'}
                        </span>
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">Sensibilidad Dental</dt>
                      <dd className="mt-1 font-medium text-slate-900 dark:text-white">
                        {salud.presenta_sensibilidad || 'No reportada'}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">Sangrado / Inflamación</dt>
                      <dd className="mt-1 font-medium text-slate-900 dark:text-white">
                        {salud.sangrado_o_inflamacion || 'No reportado'}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">Última Visita Odontológica</dt>
                      <dd className="mt-1 font-medium text-slate-900 dark:text-white">
                        {salud.ultima_visita_odontologica || 'No registrada'}
                      </dd>
                    </div>

                    <div className="sm:col-span-2">
                      <dt className="font-medium text-slate-500 dark:text-slate-400">Condición Especial de Atención</dt>
                      <dd className="mt-1 text-slate-900 dark:text-white">
                        {salud.condicion_atencion_especial ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded border border-purple-200/60">
                            {salud.condicion_atencion_especial}
                          </span>
                        ) : (
                          'Ninguna (Atención clínica convencional sin fobia reportada)'
                        )}
                      </dd>
                    </div>

                    <div className="sm:col-span-2">
                      <dt className="font-medium text-slate-500 dark:text-slate-400">Uso de Aparatos o Prótesis</dt>
                      <dd className="mt-1 text-slate-900 dark:text-white">
                        {salud.usa_aparato_o_protesis || 'No usa prótesis ni aparatos actualmente'}
                      </dd>
                    </div>

                    {ultimaSolicitud?.motivo && (
                      <div className="sm:col-span-4 border-l-2 border-[#0f766e] bg-slate-50/70 dark:bg-slate-800/50 pl-3.5 pr-4 py-2.5 rounded-r-lg">
                        <dt className="text-[10px] font-semibold uppercase text-[#0f766e] dark:text-teal-400 tracking-wider">
                          Motivo Concreto Declarado por el Paciente
                        </dt>
                        <dd className="mt-1 text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                          "${ultimaSolicitud.motivo}"
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              {/* SECCIÓN C: Perfil Ocupacional, Agenda & Convenios Institucionales */}
              {(profileViewMode === 'ALL' || profileTab === 'CONVENIOS') && (
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <GraduationCap className="h-3.5 w-3.5 text-sky-600" />
                      <span>Contexto Ocupacional, Flexibilidad & Convenios Institucionales</span>
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    {/* Tarjeta Perfil Académico & Convenio */}
                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <GraduationCap className="h-4 w-4 text-sky-600" />
                          <span>Perfil Académico (Estudiante)</span>
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          isStudent
                            ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                        }`}>
                          {isStudent ? 'Aplica Convenio' : 'No Estudiante'}
                        </span>
                      </div>

                      <dl className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Universidad / Instituto:</dt>
                          <dd className="font-semibold text-slate-900 dark:text-white">
                            {academico.universidad || 'No registrada'}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Carrera & Ciclo:</dt>
                          <dd className="font-medium text-slate-800 dark:text-slate-200">
                            {academico.carrera ? `${academico.carrera} (${academico.ciclo || 'Ciclo N/E'})` : '—'}
                          </dd>
                        </div>
                      </dl>

                      {isStudent && (
                        <div className="mt-2 rounded-lg border border-sky-200/80 bg-sky-50 dark:border-sky-900/60 dark:bg-sky-950/30 p-2.5 text-[11px] text-sky-900 dark:text-sky-200">
                          ✨ <strong>Convenio Universitario Activo:</strong> Paciente califica para <strong>15% OFF</strong> en evaluación y tratamientos de ortodoncia/profilaxis.
                        </div>
                      )}
                    </div>

                    {/* Tarjeta Perfil Laboral & Disponibilidad de Agenda */}
                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Briefcase className="h-4 w-4 text-slate-600" />
                          <span>Perfil Laboral & Flexibilidad</span>
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500 font-mono">
                          {laboral.modalidadLaboral || 'Modalidad N/E'}
                        </span>
                      </div>

                      <dl className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Ocupación:</dt>
                          <dd className="font-semibold text-slate-900 dark:text-white">
                            {laboral.ocupacion || 'No registrada'}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Empresa / Centro:</dt>
                          <dd className="font-medium text-slate-800 dark:text-slate-200">
                            {laboral.empresa || 'Particular'}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Disponibilidad de Horario:</dt>
                          <dd className="font-medium text-slate-800 dark:text-slate-200">
                            {laboral.disponibilidadLaboral || (pref?.Horario ? 'Horario vespertino coordinado' : 'Flexible previa coordinación')}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>
              )}

              {/* SECCIÓN D: Datos de Contacto & Solicitud de Captación */}
              {(profileViewMode === 'ALL' || profileTab === 'CONTACTO') && (
                <div className="p-6 space-y-4">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-slate-500" />
                    <span>Datos de Contacto & Trazabilidad de Captación</span>
                  </h3>

                  <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">Paciente</dt>
                      <dd className="mt-1 font-semibold text-slate-900 dark:text-white">
                        {fullName}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">Documento / DNI</dt>
                      <dd className="mt-1 font-mono font-medium text-slate-900 dark:text-white tabular-nums">
                        {lead.dni || 'No registrado'}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">Teléfono / WhatsApp</dt>
                      <dd className="mt-1 font-mono font-medium text-slate-900 dark:text-white tabular-nums flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
                        <span>{lead.numero ? `+51 ${lead.numero}` : 'No registrado'}</span>
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">Correo Electrónico</dt>
                      <dd className="mt-1 text-slate-900 dark:text-white truncate">
                        {lead.email || 'No registrado'}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">Canal de Captación</dt>
                      <dd className="mt-1 font-medium text-slate-900 dark:text-white">
                        {lead.Interacciones?.[0]?.Canal?.nombre || lead.CanalOrigen?.nombre || 'Portal Web'}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">Tratamiento Solicitado</dt>
                      <dd className="mt-1 font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Stethoscope className="h-3.5 w-3.5 text-[#0f766e]" strokeWidth={1.75} />
                        <span>{ultimaSolicitud?.Servicio?.nombre || 'Evaluación Odontológica'}</span>
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">Sede Preferida</dt>
                      <dd className="mt-1 font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
                        <span>{pref?.sede_preferida || 'Sede California'}</span>
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">Frecuencia de Consulta</dt>
                      <dd className="mt-1 font-mono text-slate-900 dark:text-white tabular-nums">
                        {(lead.Solicitudes?.length || 1) > 1
                          ? `${lead.Solicitudes.length} consultas registradas`
                          : '1ª solicitud activa'}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>
          </div>

          {/* Bloque 1.5: Estrategia Comercial Recomendada & Matching (Figura 15 del Informe NexoSalud) */}
          <div className="rounded-xl border border-teal-200/90 dark:border-teal-800/80 bg-gradient-to-br from-teal-50/70 via-white to-slate-50 dark:from-teal-950/30 dark:via-slate-900 dark:to-slate-950 p-4 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-100 dark:border-teal-900/60 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300 border border-teal-200 dark:border-teal-400/30 shadow-2xs">
                  <Zap className="h-4 w-4 text-teal-600 dark:text-teal-300" />
                </span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-teal-950 dark:text-teal-200">
                  Estrategia Comercial Recomendada & Matching
                </h3>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide bg-teal-100/80 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-300/60 dark:border-teal-800/80 shadow-2xs select-none">
                <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-300" />
                <span>Inteligencia BUYER → LEAD</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {/* Tratamiento Solicitado */}
              <div className="rounded-xl border border-slate-200/90 dark:border-teal-800/50 bg-white/95 dark:bg-slate-900/95 p-3.5 space-y-1 shadow-2xs">
                <div className="flex items-center gap-1.5 text-teal-800 dark:text-teal-300 font-bold text-xs">
                  <Stethoscope className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span>Tratamiento Solicitado</span>
                </div>
                <div className="font-semibold text-slate-900 dark:text-white text-xs pt-0.5 truncate">
                  {matchingData.treatmentName}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                  {matchingData.treatmentDetail}
                </p>
              </div>

              {/* Sede Sugerida */}
              <div className="rounded-xl border border-slate-200/90 dark:border-teal-800/50 bg-white/95 dark:bg-slate-900/95 p-3.5 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-teal-800 dark:text-teal-300 font-bold text-xs">
                    <MapPin className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
                    <span>Sede Sugerida</span>
                  </div>
                  {options.sedes?.some((s: any) => s.nombre.toLowerCase().includes(matchingData.sede.toLowerCase())) && (
                    <button
                      type="button"
                      onClick={() => {
                        const found = options.sedes.find((s: any) => s.nombre.toLowerCase().includes(matchingData.sede.toLowerCase()));
                        if (found) setSelectedSedeId(String(found.id_sede));
                      }}
                      className="text-[10px] text-teal-700 dark:text-teal-400 hover:underline font-semibold cursor-pointer"
                      title="Aplicar esta sede a la propuesta"
                    >
                      Aplicar Sede
                    </button>
                  )}
                </div>
                <div className="font-semibold text-slate-900 dark:text-white text-xs pt-0.5 truncate">
                  {matchingData.sede}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                  {matchingData.sedeReason}
                </p>
              </div>

              {/* Margen de Cierre (LEAD) */}
              <div className="rounded-xl border border-slate-200/90 dark:border-teal-800/50 bg-white/95 dark:bg-slate-900/95 p-3.5 space-y-1 shadow-2xs">
                <div className="flex items-center gap-1.5 text-teal-800 dark:text-teal-300 font-bold text-xs">
                  <Clock className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span>Margen de Cierre (LEAD)</span>
                </div>
                <div className="font-semibold text-slate-900 dark:text-white text-xs pt-0.5 truncate">
                  {matchingData.closingTarget}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                  {matchingData.closingRationale}
                </p>
              </div>
            </div>
          </div>

          {/* Bloque 2: Configuración de Oferta Comercial y Tablero de Propuestas */}
          <div className="divide-y divide-slate-200/80 dark:divide-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
            {/* Sección 1: Configurar Nueva Propuesta Comercial */}
            <section className="p-6 space-y-5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    1. Configurar Propuesta Comercial
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Define servicio, sede, turno y tarifa preferencial con vigencia controlada.
                  </p>
                </div>
                <span className="font-mono text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                  Vigencia hasta: {format(calculatedExpiry, 'dd/MM/yyyy')}
                </span>
              </div>

              {/* Chips de Vigencia */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Margen de Vigencia de la Propuesta
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: '24h', label: '24 Horas (Flash)' },
                    { id: '48h', label: '48 Horas (Recomendado)' },
                    { id: '72h', label: '72 Horas (3 Días)' },
                    { id: '7d', label: '7 Días (Semanal)' },
                    { id: 'custom', label: 'Personalizado' },
                  ].map((v) => {
                    const active = selectedVigencia === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVigencia(v.id as any)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                          active
                            ? 'border-[#0f766e] bg-teal-50/60 dark:bg-teal-950/50 font-semibold text-[#0f766e] dark:text-teal-300'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {v.label}
                      </button>
                    );
                  })}
                </div>
                {selectedVigencia === 'custom' && (
                  <div className="pt-2">
                    <input
                      type="date"
                      value={selectedVigenciaCustom}
                      onChange={(e) => setSelectedVigenciaCustom(e.target.value)}
                      className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 font-mono text-xs text-slate-800 dark:text-slate-200"
                    />
                  </div>
                )}
              </div>

              {/* Grid de Servicio, Sede y Especialista */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Servicio Ofertado
                  </label>
                  <select
                    value={selectedServicioId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedServicioId(val);
                      const serv = options.servicios?.find(
                        (s: any) => String(s.id_servicio) === val
                      );
                      const baseP = Number(serv?.Tarifas?.[0]?.precio || 180);
                      setPrecioOfrecido(baseP.toFixed(2));
                    }}
                    className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white focus:border-[#0f766e] focus:outline-none"
                  >
                    {options.servicios?.map((s: any) => (
                      <option key={s.id_servicio} value={String(s.id_servicio)}>
                        {s.nombre}{' '}
                        {s.Tarifas?.[0]?.precio
                          ? `(S/ ${Number(s.Tarifas[0].precio).toFixed(2)})`
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Sede Clínica
                  </label>
                  <select
                    value={selectedSedeId}
                    onChange={(e) => setSelectedSedeId(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white focus:border-[#0f766e] focus:outline-none"
                  >
                    <option value="ALL_SEDES">Todas las sedes (A elección)</option>
                    {options.sedes?.map((s: any) => (
                      <option key={s.id_sede} value={String(s.id_sede)}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Especialista Sugerido
                  </label>
                  <select
                    value={selectedProfesionalId}
                    onChange={(e) => setSelectedProfesionalId(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white focus:border-[#0f766e] focus:outline-none"
                  >
                    <option value="ALL_PROFESSIONALS">Staff Colegiado Disponible</option>
                    {options.profesionales?.map((p: any) => (
                      <option key={p.id_profesional} value={String(p.id_profesional)}>
                        Esp. {p.nombres} {p.apellidos}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Chips de Franja Horaria */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Franja Horaria de Atención
                </label>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {[
                    {
                      label: 'Turno Mañana',
                      range: `${openTime} – 01:00 PM`,
                      full: `Turno Mañana (${openTime} – 01:00 PM)`,
                    },
                    {
                      label: 'Turno Tarde',
                      range: '01:00 PM – 06:00 PM',
                      full: 'Turno Tarde (01:00 PM – 06:00 PM)',
                    },
                    {
                      label: 'Turno Noche',
                      range: `06:00 PM – ${closeTime}`,
                      full: `Turno Noche (06:00 PM – ${closeTime})`,
                    },
                  ].map((slot) => {
                    const active = selectedFranja === slot.full;
                    return (
                      <button
                        key={slot.label}
                        type="button"
                        onClick={() => setSelectedFranja(slot.full)}
                        className={`flex items-center justify-between rounded-lg border px-3.5 py-2 text-xs transition-colors cursor-pointer ${
                          active
                            ? 'border-[#0f766e] bg-teal-50/50 dark:bg-teal-950/40 font-semibold text-slate-900 dark:text-white'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
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

              {/* Comparador Financiero Sobrio y Descuentos Rápidos */}
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 p-4 space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Esquema Tarifario y Descuentos Autorizados
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyQuickDiscount(15, 'CAMPANA')}
                      className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:border-[#0f766e] hover:text-[#0f766e] cursor-pointer"
                    >
                      Promoción (-15%)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyQuickDiscount(20, 'CAMPANA')}
                      className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:border-[#0f766e] hover:text-[#0f766e] cursor-pointer"
                    >
                      Campaña (-20%)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyQuickDiscount(0, 'REGULAR')}
                      className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 cursor-pointer"
                    >
                      Tarifa Regular
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5">
                    <span className="block text-[11px] text-slate-500">Precio de Lista</span>
                    <span className="font-mono text-sm font-semibold text-slate-500 line-through tabular-nums">
                      S/ {currentOfficialPrice.toFixed(2)}
                    </span>
                  </div>

                  <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5">
                    <span className="block text-[11px] text-slate-500">Tarifa Ofertada</span>
                    <span className="font-mono text-base font-bold text-slate-900 dark:text-white tabular-nums">
                      S/ {numericOfferPrice.toFixed(2)}
                    </span>
                  </div>

                  <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5">
                    <span className="block text-[11px] text-slate-500">Beneficio / Ahorro</span>
                    <span className="font-mono text-sm font-semibold text-[#0f766e] dark:text-teal-400 tabular-nums">
                      S/ {discountMetrics.saving.toFixed(2)} ({discountMetrics.pct}% OFF)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Monto Final a Proponer (S/)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={precioOfrecido}
                      onChange={(e) => setPrecioOfrecido(e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 font-mono text-xs font-semibold text-slate-900 dark:text-white tabular-nums focus:border-[#0f766e] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Condición o Beneficio Adicional
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Incluye radiografía panorámica o facilidades de pago"
                      value={condiciones}
                      onChange={(e) => setCondiciones(e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#0f766e] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddAlternative}
                    disabled={addingAlternative}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0f766e] px-4 text-xs font-semibold text-white shadow-2xs transition-all hover:bg-teal-800 disabled:opacity-50 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                    <span>
                      {addingAlternative
                        ? 'Añadiendo propuesta...'
                        : 'Añadir Propuesta a la Mesa'}
                    </span>
                  </button>
                </div>
              </div>
            </section>

            {/* Sección 2: Propuestas Comerciales sobre la Mesa */}
            <section className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    2. Propuestas Comerciales Activas ({opciones.length})
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Selecciona la propuesta aceptada por el paciente para generar la orden de cobro en PAYER.
                  </p>
                </div>
              </div>

              {opciones.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 py-8 text-center">
                  <p className="text-xs text-slate-500">
                    Aún no hay propuestas registradas. Configura y añade una opción en el panel superior.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {opciones.map((opt: any) => {
                    const isSelected = selectedOpcion === opt.id_opcion;
                    return (
                      <div
                        key={opt.id_opcion}
                        onClick={() => setSelectedOpcion(opt.id_opcion)}
                        className={`flex flex-col justify-between gap-3 rounded-xl border p-4 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#0f766e] bg-teal-50/40 dark:bg-teal-950/30 ring-1 ring-[#0f766e]'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium text-slate-600 dark:text-slate-300">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            <span>
                              Vence: {opt.Disponibilidad?.fecha?.split('T')[0] || 'Vigente'}
                            </span>
                          </span>

                          {editingOptionId === opt.id_opcion ? (
                            <div
                              className="flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="number"
                                value={editingPrice}
                                onChange={(e) => setEditingPrice(e.target.value)}
                                className="h-7 w-20 rounded border border-[#0f766e] bg-white dark:bg-slate-900 px-2 font-mono text-xs font-bold text-slate-900 dark:text-white"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={(e) => handleSaveEdit(e, opt.id_opcion)}
                                disabled={savingEdit}
                                className="inline-flex h-7 w-7 items-center justify-center rounded bg-[#0f766e] text-white"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingOptionId(null);
                                }}
                                className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                                S/ {Number(opt.precio_ofrecido).toFixed(2)}
                              </span>
                              <div
                                className="flex items-center gap-0.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  title="Editar tarifa"
                                  onClick={() => {
                                    setEditingOptionId(opt.id_opcion);
                                    setEditingPrice(String(opt.precio_ofrecido || ''));
                                  }}
                                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  title="Eliminar propuesta"
                                  onClick={() => setDeletingOptionTarget(opt)}
                                  className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                          <p>
                            <span className="font-medium text-slate-500">Sede:</span>{' '}
                            {opt.Disponibilidad?.Sede?.nombre || 'Todas las sedes'}
                          </p>
                          <p>
                            <span className="font-medium text-slate-500">Especialista:</span>{' '}
                            {opt.Disponibilidad?.Profesional?.apellidos
                              ? `Esp. ${opt.Disponibilidad.Profesional.apellidos}`
                              : 'Staff Colegiado'}
                          </p>
                          {opt.condiciones && (
                            <p className="pt-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                              {opt.condiciones}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                          <span
                            className={`font-medium ${
                              isSelected ? 'text-[#0f766e] font-semibold' : 'text-slate-400'
                            }`}
                          >
                            {isSelected ? 'Propuesta seleccionada para cierre' : 'Clic para elegir'}
                          </span>
                          {isSelected && (
                            <CheckCircle2 className="h-4 w-4 text-[#0f766e]" strokeWidth={2} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Sección 3: Despacho Omnicanal y Generación de Pieza Gráfica (Canva) */}
            <section className="p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    3. Despacho de Propuesta Comercial & Canva Connect
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Envía el resumen de la propuesta por WhatsApp, correo electrónico o adjunta un flyer personalizado.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCopyWhatsApp}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                >
                  {copiedWhatsApp ? (
                    <CheckCheck className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span>{copiedWhatsApp ? 'Copiado' : 'Copiar texto'}</span>
                </button>
              </div>

              <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3.5 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                {generateWhatsAppMessage()}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0f766e] px-4 text-xs font-semibold text-white hover:bg-teal-800 transition-colors cursor-pointer"
                >
                  <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} />
                  <span>Enviar por WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={handleSendEmail}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Mail className="h-3.5 w-3.5 text-slate-500" strokeWidth={1.75} />
                  <span>Enviar por Correo</span>
                </button>

                <button
                  type="button"
                  onClick={handleGenerateCanva}
                  disabled={generatingCanva}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {generatingCanva ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0f766e]" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-[#0f766e]" strokeWidth={1.75} />
                  )}
                  <span>
                    {generatingCanva ? 'Generando Flyer...' : 'Generar Flyer Canva'}
                  </span>
                </button>
              </div>

              {canvaResult?.previewUrl && (
                <div className="mt-3 flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={canvaResult.previewUrl}
                      alt="Flyer promocional generado"
                      className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                    />
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">
                        Flyer Promocional Generado
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Personalizado con tarifa y sede para {fullName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={canvaResult.downloadPngUrl || canvaResult.previewUrl}
                      download={`Propuesta_NexoSalud_${lead.nombres || 'Lead'}.png`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Descargar PNG</span>
                    </a>
                    {canvaResult.designUrl && (
                      <a
                        href={canvaResult.designUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0f766e] px-3 text-xs font-semibold text-white hover:bg-teal-800"
                      >
                        <span>Abrir en Canva</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>

        {/* COLUMNA DERECHA (35%): Tarjeta de "Diagnóstico Comercial / BI" */}
        <div className="lg:col-span-4 space-y-5">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 p-5 shadow-2xs space-y-5">
            {/* Cabecera */}
            <div className="flex items-start justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Inteligencia de Cierre
                </span>
                <h2 className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-[#0f766e]" strokeWidth={1.75} />
                  <span>Diagnóstico de Negociación / BI</span>
                </h2>
              </div>

              <button
                type="button"
                onClick={() => runNegotiationStrategy(lead)}
                disabled={loadingStrategy}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`h-3 w-3 ${loadingStrategy ? 'animate-spin' : ''}`} />
                <span>{loadingStrategy ? 'Calculando' : 'Actualizar'}</span>
              </button>
            </div>

            {/* Probabilidad de Cierre */}
            <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Probabilidad Estimada de Cierre
                </span>
                <span className="font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                  {closeProbability}%
                </span>
              </div>

              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-[#0f766e] transition-all duration-300"
                  style={{ width: `${closeProbability}%` }}
                />
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px]">
                <span className="text-slate-500">Descuento óptimo sugerido:</span>
                <span className="font-mono font-semibold text-[#0f766e] dark:text-teal-400">
                  {aiStrategy?.suggestedDiscountPct ?? 15}% OFF
                </span>
              </div>
            </div>

            {/* Dictamen Comercial con Borde Lateral de 2px */}
            <div className="space-y-2.5">
              <div className="border-l-2 border-[#0f766e] bg-white dark:bg-slate-900 px-3.5 py-2.5 rounded-r-lg border-y border-r border-slate-200/70 dark:border-slate-800">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Argumento de Cierre Sugerido
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const pitch =
                        aiStrategy?.persuasiveSalesPitch ||
                        'Ofrecer reserva prioritaria con evaluación digital 3D incluida y tarifa congelada por 48 horas.';
                      navigator.clipboard.writeText(pitch);
                      setCopiedPitch(true);
                      setTimeout(() => setCopiedPitch(false), 1800);
                    }}
                    className="text-[10px] font-medium text-[#0f766e] hover:underline cursor-pointer"
                  >
                    {copiedPitch ? 'Copiado' : 'Copiar pitch'}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  {aiStrategy?.strategyReason ||
                    aiStrategy?.persuasiveSalesPitch ||
                    'Destaca la evaluación diagnóstica integral en la sede seleccionada y congela la tarifa promocional por 48 horas.'}
                </p>
              </div>

              {/* Copiloto de Apoyo ante Objeciones (Figura 19 del Informe NexoSalud - Asistente en Vivo) */}
              <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0f766e] text-white text-[10px] font-bold">
                      4
                    </span>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      Copiloto ante Objeciones
                    </h3>
                  </div>
                  <span className="text-[10px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/80 px-2 py-0.5 rounded-full border border-teal-200/80 dark:border-teal-800/80">
                    Asistente en Vivo
                  </span>
                </div>

                {/* Selector de Objeciones (Pills Responsivas) */}
                <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setObjectionCategory('PRECIO')}
                    className={`rounded-md py-1 px-1.5 text-center transition-all cursor-pointer truncate ${
                      objectionCategory === 'PRECIO'
                        ? 'bg-[#0f766e] text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    "Está caro"
                  </button>
                  <button
                    type="button"
                    onClick={() => setObjectionCategory('HORARIO')}
                    className={`rounded-md py-1 px-1.5 text-center transition-all cursor-pointer truncate ${
                      objectionCategory === 'HORARIO'
                        ? 'bg-[#0f766e] text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    "Mala hora"
                  </button>
                  <button
                    type="button"
                    onClick={() => setObjectionCategory('SEDE')}
                    className={`rounded-md py-1 px-1.5 text-center transition-all cursor-pointer truncate ${
                      objectionCategory === 'SEDE'
                        ? 'bg-[#0f766e] text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    "Queda lejos"
                  </button>
                </div>

                {/* Objeción: PRECIO (Dinámica según perfil real del paciente) */}
                {objectionCategory === 'PRECIO' && (
                  <div className="p-3 bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 rounded-lg space-y-2 text-xs">
                    <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 text-[11px]">
                      <Sparkles className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <span>Solución Comercial Dinámica</span>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                      Sensibilidad al precio: <strong className="text-teal-700 dark:text-teal-300">{aiStrategy?.priceSensitivity || 'MODERADA'}</strong>. 
                      {aiStrategy?.persuasiveSalesPitch
                        ? ` Argumento sugerido: "${aiStrategy.persuasiveSalesPitch.substring(0, 110)}..."`
                        : ' Argumenta la esterilización instrumental y especialista colegiado de NexoSalud.'}
                    </p>

                    <div className="space-y-1.5 pt-1">
                      {isStudent && (
                        <button
                          type="button"
                          onClick={() => applyQuickDiscount(15, 'CAMPANA')}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-semibold py-1.5 px-2 flex items-center justify-between shadow-2xs transition-all cursor-pointer"
                        >
                          <span className="flex items-center gap-1">
                            <GraduationCap className="w-3.5 h-3.5" />
                            <span>Convenio Estudiantil (-15%)</span>
                          </span>
                          <span className="text-[10px] opacity-80 truncate max-w-[100px]">
                            {academico.universidad ? String(academico.universidad).split(' ')[0] : 'Universidad'}
                          </span>
                        </button>
                      )}

                      {isWorker && laboral.empresa && (
                        <button
                          type="button"
                          onClick={() => applyQuickDiscount(15, 'CAMPANA')}
                          className="w-full bg-sky-600 hover:bg-sky-700 text-white rounded-md text-[11px] font-semibold py-1.5 px-2 flex items-center justify-between shadow-2xs transition-all cursor-pointer"
                        >
                          <span className="flex items-center gap-1">
                            <Briefcase className="w-3.5 h-3.5" />
                            <span>Convenio Corporativo (-15%)</span>
                          </span>
                          <span className="text-[10px] opacity-80 truncate max-w-[100px]">
                            {String(laboral.empresa).split(' ')[0]}
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          applyQuickDiscount(20, 'CAMPANA');
                          setSelectedVigencia('24h');
                        }}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[11px] font-semibold py-1.5 px-2 flex items-center justify-between shadow-2xs transition-all cursor-pointer"
                      >
                        <span className="flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5" />
                          <span>Tarifa Flash de Campaña (-20%)</span>
                        </span>
                        <span className="text-[10px] opacity-90 font-mono">
                          24 horas
                        </span>
                      </button>
                    </div>

                    <p className="text-[10px] text-slate-400 dark:text-slate-500 italic pt-0.5">
                      Recuerda pulsar "Añadir Propuesta" para reflejar el valor en la mesa.
                    </p>
                  </div>
                )}

                {/* Objeción: HORARIO (Basada en disponibilidad y turno del lead) */}
                {objectionCategory === 'HORARIO' && (
                  <div className="p-3 bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 rounded-lg space-y-2 text-xs">
                    <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Flexibilidad Horaria Dinámica</span>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                      {laboral.disponibilidad
                        ? `Disponibilidad declarada por el paciente: "${laboral.disponibilidad}".`
                        : 'El paciente no cuenta con franja horaria fija. Habilita turno flexible.'}
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedFranja(
                          'Horario Flexible (A elección del paciente al validar en PAYER)'
                        )
                      }
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[11px] font-semibold py-1.5 px-2 flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Pactar Horario Flexible sin Penalidad</span>
                    </button>
                  </div>
                )}

                {/* Objeción: SEDE (Basada en zona geográfica de Trujillo) */}
                {objectionCategory === 'SEDE' && (
                  <div className="p-3 bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 rounded-lg space-y-2 text-xs">
                    <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 text-[11px]">
                      <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>Red de Sedes en Trujillo</span>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                      Zona del paciente: <strong className="text-indigo-700 dark:text-indigo-300">{lead.zona || 'Trujillo'}</strong>. 
                      Permite que la tarifa sea transferible entre California, El Golf y Centro Histórico.
                    </p>

                    <button
                      type="button"
                      onClick={() => setSelectedSedeId('ALL_SEDES')}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[11px] font-semibold py-1.5 px-2 flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Habilitar Multisede Trujillo</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Acción Directa: Iniciar Chat de WhatsApp Clínico */}
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="flex h-9.5 w-full items-center justify-center gap-2 rounded-lg bg-[#0f766e] px-4 text-xs font-semibold text-white shadow-2xs transition-all hover:bg-teal-800 active:scale-[0.99] cursor-pointer"
              >
                <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} />
                <span>Contactar Paciente por WhatsApp</span>
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
                Incluye enlace de pre-reserva y condiciones vigentes
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmación de Eliminación de Propuesta */}
      <ConfirmationDialog
        isOpen={!!deletingOptionTarget}
        onClose={() => setDeletingOptionTarget(null)}
        onConfirm={handleConfirmDeleteOption}
        isLoading={isDeletingOption}
        title="¿Remover propuesta comercial de la mesa?"
        description={`Se eliminará la oferta seleccionada (S/ ${Number(
          deletingOptionTarget?.precio_ofrecido || 0
        ).toFixed(2)}).`}
        confirmText="Eliminar Propuesta"
        cancelText="Cancelar"
        variant="destructive"
      />

      {/* Modal para que el Asesor Comercial complete / edite el Perfil de Negociación */}
      <LeadProfileEditModal
        isOpen={isEditProfileModalOpen}
        onClose={() => setIsEditProfileModalOpen(false)}
        lead={lead}
        leadId={leadId}
        options={options}
        onProfileUpdated={handleProfileUpdated}
      />
    </div>
  );
}
