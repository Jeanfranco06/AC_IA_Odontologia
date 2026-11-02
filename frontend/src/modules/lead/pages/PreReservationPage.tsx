import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { useToast } from '@/shared/hooks/use-toast';
import { Toaster } from '@/shared/components/ui/toaster';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { chatWithNegotiatorAgent, type NegotiatorChatContext } from '@/shared/services/groqService';
import { leadService } from '../services/lead.service';
import jsPDF from 'jspdf';
import { createPaymentDocumentPdf } from '@/shared/pdf/paymentDocument';
import logoDataUrl from '@/shared/pdf/Logo_NexoSalud.png?inline';
import {
  Sparkles,
  Bot,
  User,
  Phone,
  Mail,
  Calendar,
  CalendarDays,
  Clock,
  MapPin,
  CheckCircle2,
  ShieldCheck,
  CreditCard,
  Send,
  Loader2,
  AlertCircle,
  Stethoscope,
  ArrowRight,
  ArrowLeft,
  MessageSquare,
  Copy,
  Download,
  Users,
  Smile,
  Tag,
  Clock3,
  X,
  Banknote,
  QrCode,
  Check,
  FileText,
  Zap,
  Search,
  Building2,
  Award,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
}

const formatDateIso = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getRecommendedOffset = (dolor: string): number => {
  const d = (dolor || '').toLowerCase();
  if (d.includes('intenso') || d.includes('agudo')) return 0; // Hoy o Mañana
  if (d.includes('moderado')) return 1; // 24-48 horas
  return 3; // Leve o Ninguno: 3 días después para holgura de pago
};

interface PaymentOrderPdfData {
  nombres: string;
  apellidos: string;
  dni: string;
  phone: string;
  email: string;
  sede: string;
  doctor: string;
  fechaCita: string;
  horaCita: string;
  canalPago: string;
  serviceName: string;
  originalPrice: number;
  offeredPrice: number;
  discountPct: number;
  codigoReserva: string;
  nombreFamiliar?: string;
  parentesco?: string;
}

function generatePaymentOrderPdf(data: PaymentOrderPdfData): jsPDF {
  return createPaymentDocumentPdf({
    type: 'ORDER',
    code: data.codigoReserva,
    patientName: `${data.nombres} ${data.apellidos}`,
    documentNumber: data.dni,
    phone: data.phone,
    email: data.email,
    branch: data.sede,
    professional: data.doctor,
    appointmentDate: data.fechaCita,
    appointmentTime: data.horaCita,
    serviceName: data.serviceName,
    amount: data.offeredPrice,
    originalPrice: data.originalPrice,
    discountPercent: data.discountPct,
    paymentChannel: data.canalPago,
    familyPatient: data.nombreFamiliar
      ? `${data.nombreFamiliar} (${data.parentesco || 'Familiar'})`
      : undefined,
  }, logoDataUrl);
}

export default function PreReservationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [offerData, setOfferData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [selectedServiceKey, setSelectedServiceKey] = useState<string>('main');
  const [showCalendarInput, setShowCalendarInput] = useState(false);
  const [customCatalogService, setCustomCatalogService] = useState<any>(null);
  const [showCatalogSelector, setShowCatalogSelector] = useState(false);
  const [dni, setDni] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [esParaFamiliar, setEsParaFamiliar] = useState(false);
  const [nombreFamiliar, setNombreFamiliar] = useState('');
  const [parentesco, setParentesco] = useState('Hijo/a');
  const [selectedSedeId, setSelectedSedeId] = useState<number | string>('');
  const [fechaCita, setFechaCita] = useState('');
  const [horaCita, setHoraCita] = useState('09:00 - 13:00 (Mañana)');
  const [nivelDolor, setNivelDolor] = useState('Ninguno (Preventivo)');
  const [alergias, setAlergias] = useState('');
  const [canalPago, setCanalPago] = useState('Efectivo en clínica');
  const [comentarios, setComentarios] = useState('');
  const [consentimiento, setConsentimiento] = useState(true);

  // Submitting state
  const [submitting, setSubmitting] = useState(false);
  const [preReserveSuccess, setPreReserveSuccess] = useState<any>(null);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState(false);

  // Floating Chatbot states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Próximos 7 días interactivos
  const upcomingDays = React.useMemo(() => {
    const days = [];
    const today = new Date();
    const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];

    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(today.getDate() + i);
      const iso = formatDateIso(d);
      days.push({
        offset: i,
        iso,
        dayName: i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : daysOfWeek[d.getDay()],
        dayNum: d.getDate(),
        month: months[d.getMonth()],
      });
    }
    return days;
  }, []);

  // Lista consolidada de servicios: Cotizado principal + Cruzados relacionados
  const availableServices = React.useMemo(() => {
    if (!offerData) return [];
    const list: any[] = [
      {
        key: 'main',
        id_servicio: offerData.id_servicio || 1,
        name: offerData.serviceName,
        description: offerData.serviceDescription || 'Tratamiento odontológico principal cotizado.',
        originalPrice: Number(offerData.originalPrice || 0),
        offeredPrice: Number(offerData.offeredPrice || 0),
        discountPct: offerData.discountPct || 0,
        isMain: true,
        tag: 'Cotizado Principal',
      },
    ];

    if (offerData.relatedServices && Array.isArray(offerData.relatedServices)) {
      offerData.relatedServices.forEach((rel: any, idx: number) => {
        list.push({
          key: `related-${idx}`,
          id_servicio: rel.id_servicio,
          name: rel.name,
          description: rel.description || 'Tratamiento complementario con tarifa preferencial.',
          originalPrice: Number(rel.originalPrice || 0),
          offeredPrice: Number(rel.offeredPrice || 0),
          discountPct: rel.discountPct || offerData.discountPct,
          isMain: false,
          tag: 'Tarifa Especial',
        });
      });
    }

    if (customCatalogService) {
      const alreadyInList = list.some((s) => s.id_servicio === customCatalogService.id_servicio);
      if (!alreadyInList) {
        list.push(customCatalogService);
      }
    }

    return list;
  }, [offerData, customCatalogService]);

  const handleSelectCatalogService = (servicioIdStr: string) => {
    if (!offerData?.catalogServices) return;
    const found = offerData.catalogServices.find((s: any) => String(s.id_servicio) === String(servicioIdStr));
    if (found) {
      const custom = {
        key: `catalog-${found.id_servicio}`,
        id_servicio: found.id_servicio,
        name: found.nombre,
        description: found.descripcion || 'Tratamiento seleccionado del catálogo clínico NexoSalud.',
        originalPrice: Number(found.originalPrice),
        offeredPrice: Number(found.offeredPrice),
        discountPct: found.discountPct,
        isMain: false,
        tag: 'Catálogo NexoSalud',
      };
      setCustomCatalogService(custom);
      setSelectedServiceKey(custom.key);
      setShowCatalogSelector(false);
      toast({
        title: 'Tratamiento Seleccionado',
        description: `Has seleccionado: ${found.nombre}. Tarifa promocional aplicada.`,
      });
    }
  };

  // Servicio activo seleccionado
  const activeService = React.useMemo(() => {
    return availableServices.find((s) => s.key === selectedServiceKey) || availableServices[0] || {
      id_servicio: 1,
      name: offerData?.serviceName || '',
      description: offerData?.serviceDescription || '',
      originalPrice: Number(offerData?.originalPrice || 0),
      offeredPrice: Number(offerData?.offeredPrice || 0),
      discountPct: offerData?.discountPct || 0,
      isMain: true,
    };
  }, [availableServices, selectedServiceKey, offerData]);

  // Cambio inteligente de dolor y ajuste reactivo de fecha recomendada
  const handleSelectNivelDolor = (nuevoNivel: string) => {
    setNivelDolor(nuevoNivel);
    const offset = getRecommendedOffset(nuevoNivel);
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + offset);
    setFechaCita(formatDateIso(targetDate));
  };

  // Cargar datos de la oferta pública
  useEffect(() => {
    if (!id) return;
    const fetchOffer = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await leadService.getPublicOffer(id);
        setOfferData(data);
        setNombres(data.firstName || data.patientName || '');
        setApellidos(data.lastName || '');
        setPhone(data.phone || '');
        setEmail(data.email || '');
        setDni(data.dni || '');
        setSelectedSedeId(data.sedeId || (data.sedes?.[0]?.id_sede || 1));

        // Inicializar nivel de dolor y sugerir fecha según molestia (por defecto 3 días si leve/ninguno)
        const initialDolor = data.nivelDolor || 'Ninguno (Preventivo)';
        setNivelDolor(initialDolor);
        const offset = getRecommendedOffset(initialDolor);
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + offset);
        setFechaCita(formatDateIso(targetDate));

        // Mensaje de bienvenida inicial del Asistente NexoSalud
        const patientGreeting = data.firstName ? `¡Hola ${data.firstName}!` : '¡Hola!';
        setChatMessages([
          {
            id: 'welcome',
            sender: 'agent',
            text: `${patientGreeting} Soy tu Asistente de NexoSalud. Estoy aquí para acompañarte en tu reserva del tratamiento de ${data.serviceName || 'odontología'}. ¿Tienes alguna consulta sobre la cobertura, las sedes o las formas de pago?`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } catch (err: any) {
        console.error('Error loading public offer:', err);
        setError('No pudimos cargar la oferta médica. El enlace puede haber vencido o ser inválido.');
      } finally {
        setLoading(false);
      }
    };
    fetchOffer();
  }, [id]);

  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isAiTyping, isChatOpen]);

  useEffect(() => {
    if (!pdfModalOpen || !preReserveSuccess || !offerData) {
      setPdfBlobUrl(null);
      return;
    }

    let currentUrl: string | null = null;
    setPdfError(false);
    try {
      const selectedSede = offerData.sedes?.find((s: any) => String(s.id_sede) === String(selectedSedeId));
      const doc = generatePaymentOrderPdf({
        nombres,
        apellidos,
        dni,
        phone,
        email,
        sede: selectedSede?.nombre || offerData.sede || 'Sede Principal',
        doctor: offerData.doctor || 'Por asignar',
        fechaCita,
        horaCita,
        canalPago,
        serviceName: activeService.name,
        originalPrice: Number(activeService.originalPrice),
        offeredPrice: Number(activeService.offeredPrice),
        discountPct: Number(activeService.discountPct) || 0,
        codigoReserva: preReserveSuccess.codigoReserva || 'NEXO-PROMO',
        nombreFamiliar: esParaFamiliar ? nombreFamiliar : undefined,
        parentesco: esParaFamiliar ? parentesco : undefined,
      });
      currentUrl = URL.createObjectURL(doc.output('blob'));
      setPdfBlobUrl(currentUrl);
    } catch (err) {
      console.error('Error generando PDF:', err);
      setPdfError(true);
      setPdfBlobUrl(null);
    }
    return () => { if (currentUrl) URL.revokeObjectURL(currentUrl); };
  }, [pdfModalOpen, preReserveSuccess, offerData, selectedSedeId, nombres, apellidos, dni, phone, email, fechaCita, horaCita, canalPago, activeService, esParaFamiliar, nombreFamiliar, parentesco]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || userInput).trim();
    if (!text || isAiTyping || !offerData) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setUserInput('');
    setIsAiTyping(true);

    try {
      const chatContext: NegotiatorChatContext = {
        patientName: nombres || offerData.firstName || offerData.patientName,
        serviceName: activeService.name,
        offeredPrice: Number(activeService.offeredPrice),
        originalPrice: Number(activeService.originalPrice),
        discountPct: activeService.discountPct,
        doctor: offerData.doctor,
        sede: offerData.sede,
        expirationDate: offerData.expirationDate,
      };

      const history = chatMessages.map((m) => ({
        role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.text,
      }));

      const aiReply = await chatWithNegotiatorAgent(text, history, chatContext);

      const agentMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text: aiReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, agentMsg]);
    } catch (err) {
      console.error('Error communicating with AI negotiator:', err);
      const fallbackMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text: 'Nuestra tarifa promocional incluye diagnóstico completo y esterilización garantizada. Puedes completar el formulario para congelar tu precio ahora.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsAiTyping(false);
    }
  };

  const handlePreReserveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerData || !id) return;

    if (!dni || dni.trim().length < 8) {
      toast({
        title: 'DNI Requerido',
        description: 'Por favor ingresa un DNI o documento válido de al menos 8 dígitos.',
        variant: 'destructive',
      });
      return;
    }

    if (!consentimiento) {
      toast({
        title: 'Consentimiento Requerido',
        description: 'Debes autorizar el contacto clínico para formalizar la reserva.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        dni: dni.trim(),
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        numero: phone.trim(),
        email: email.trim(),
        esParaFamiliar,
        nombreFamiliar: esParaFamiliar ? nombreFamiliar.trim() : undefined,
        parentesco: esParaFamiliar ? parentesco : undefined,
        id_opcion: offerData.id_opcion,
        id_solicitud: offerData.id_solicitud,
        id_sede: Number(selectedSedeId) || offerData.sedeId,
        fecha: fechaCita,
        hora: horaCita,
        nivelDolor,
        alergias,
        canal_pago: canalPago,
        dudaOComentario: comentarios.trim(),
        id_servicio_seleccionado: activeService.id_servicio,
        selectedServiceName: activeService.name,
        selectedServicePrice: activeService.offeredPrice,
      };

      const result = await leadService.submitPublicPreReserve(id, payload);
      setPreReserveSuccess(result.data);
      setPdfModalOpen(true);
      toast({
        title: '¡Pre-Reserva Confirmada! 🎉',
        description: `Código: ${result.data?.codigoReserva || 'NEXO-CONFIRMADO'}. Hemos bloqueado tu tarifa por 48 horas.`,
      });
    } catch (err: any) {
      console.error('Error in pre-reserve submit:', err);
      toast({
        title: 'Error al procesar reserva',
        description: err.message || 'Ocurrió un inconveniente. Intenta nuevamente o contáctanos por WhatsApp.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const copyCodeToClipboard = () => {
    if (preReserveSuccess?.codigoReserva) {
      navigator.clipboard.writeText(preReserveSuccess.codigoReserva);
      toast({ title: '¡Código Copiado!', description: 'Se copió el código de reserva al portapapeles.' });
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  if (error || !offerData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-red-200 shadow-lg bg-white">
          <CardHeader className="text-center pb-2">
            <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2 border border-red-100">
              <AlertCircle className="w-7 h-7" />
            </div>
            <CardTitle className="text-xl font-bold text-slate-800">Oferta no disponible</CardTitle>
            <CardDescription className="text-slate-500 text-xs">
              {error || 'El enlace que seguiste no es válido o ha expirado.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
              Si recibiste esta oferta por correo o WhatsApp, puedes solicitar que nuestro equipo comercial te envíe una propuesta actualizada.
            </p>
            <Button
              onClick={() => window.open('https://wa.me/51970292710?text=Hola,%20deseo%20consultar%20por%20una%20oferta%20odontológica', '_blank')}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-11 rounded-xl gap-2 shadow"
            >
              <MessageSquare className="w-4 h-4" /> Contactar por WhatsApp
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen h-auto lg:h-screen lg:max-h-screen w-full overflow-y-auto lg:overflow-hidden relative flex flex-col justify-between selection:bg-teal-500/30 selection:text-teal-900 font-sans antialiased text-slate-900">
      <Toaster />

      {/* ========================================================================= */}
      {/* CAPA DE FONDO DIVIDIDO 50% / 50% (MITAD IZQ BLANCA, MITAD DER FOTO)       */}
      {/* ========================================================================= */}
      <div className="fixed inset-0 lg:absolute grid grid-cols-1 lg:grid-cols-2 pointer-events-none -z-10">
        {/* Mitad Izquierda (50%): Blanco puro plano */}
        <div className="bg-slate-50/90 lg:bg-white w-full h-full" />

        {/* Mitad Derecha (50%): Foto Fondo_NexoSalud_2.jpg con overlay clínico */}
        <div className="hidden lg:block relative bg-slate-950 w-full h-full overflow-hidden border-l border-slate-200">
          <img
            src="/Fondo_NexoSalud_2.jpg"
            alt="Atención Odontológica Especializada NexoSalud"
            className="absolute inset-0 w-full h-full object-cover object-center opacity-80 scale-100"
          />
          {/* Overlay suave para mantener excelente legibilidad en textos */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/60 to-slate-950/80" />
        </div>
      </div>

      {/* Línea Central con Desvanecimiento Suave (Fading Divider en 50%) */}
      <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-[1.5px] bg-gradient-to-b from-transparent via-slate-300 via-50% to-transparent pointer-events-none z-10" />

      {/* ========================================================================= */}
      {/* HEADER SUPERIOR (EN PANTALLA COMPLETA 50% / 50%)                         */}
      {/* ========================================================================= */}
      <header className="w-full grid grid-cols-1 lg:grid-cols-2 z-20 shrink-0">
        {/* Mitad Izquierda (En móvil muestra el logo, en desktop queda libre) */}
        <div className="flex lg:hidden items-center justify-between py-3 px-4 bg-white/95 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center p-1 overflow-hidden">
              <img src="/Logo_NexoSalud.png" alt="NexoSalud" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-slate-900 block leading-tight">
                NexoSalud <span className="text-teal-600 font-bold">Dental</span>
              </span>
              <span className="text-[10px] text-slate-500 font-medium block leading-tight">
                Portal Oficial de Pre-Reserva
              </span>
            </div>
          </div>
        </div>

        {/* Mitad Izquierda en Desktop (vacía para mantener limpio el lado del formulario) */}
        <div className="hidden lg:block" />

        {/* Mitad Derecha en Desktop: Branding NexoSalud en el LADO DERECHO */}
        <div className="hidden lg:flex items-center justify-end pt-4 pb-1 px-6 xl:px-12">
          <div className="flex items-center justify-end gap-3">
            <div className="w-10 h-10 rounded-xl bg-white shadow-md flex items-center justify-center p-1.5 overflow-hidden border border-slate-100">
              <img src="/Logo_NexoSalud.png" alt="NexoSalud" className="w-full h-full object-contain" />
            </div>
            <div className="text-left">
              <span className="font-extrabold text-base tracking-tight text-white block leading-tight">
                NexoSalud <span className="text-teal-400 font-bold">Dental</span>
              </span>
              <span className="text-[11px] text-slate-300 font-medium block leading-tight">
                Portal Oficial de Pre-Reserva
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* CONTENIDO PRINCIPAL: 50% / 50% (IZQUIERDA: FORM, DERECHA: FOTO & OFERTA) */}
      {/* ========================================================================= */}
      <main className="relative w-full flex-1 grid grid-cols-1 lg:grid-cols-2 min-h-0 z-20 pb-20 lg:pb-0">
        
        {/* ======================================================================= */}
        {/* COLUMNA IZQUIERDA (50%): FORMULARIO PLANO SIN SHADOW Y BOTÓN FIJO       */}
        {/* ======================================================================= */}
        <div className="w-full h-full flex justify-center items-center min-h-0 animate-in fade-in slide-in-from-left duration-300 p-4 sm:p-6 lg:p-8 xl:p-12">
          
          {preReserveSuccess ? (
            /* Vista de Éxito / Pre-reserva registrada */
            <div className="w-full max-w-xl bg-white rounded-3xl border border-slate-200 shadow-none overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 px-5 py-4 text-white text-center">
                {/* Check con animación moderna igual al formulario del cliente */}
                <div className="relative flex items-center justify-center mb-2">
                  <div className="absolute w-16 h-16 rounded-full bg-teal-300/30 animate-checkmark-ripple" />
                  <div className="relative w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-teal-900/30 ring-4 ring-white/20 animate-checkmark-pop">
                    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" className="animate-checkmark-draw" />
                    </svg>
                  </div>
                </div>

                <Badge className="bg-emerald-400 text-slate-950 font-black px-3 py-0.5 mb-1 hover:bg-emerald-400 shadow-xs text-[10.5px] uppercase tracking-wider">
                  Pre-Reserva Registrada Exitosamente
                </Badge>
                <h2 className="text-lg sm:text-xl font-black tracking-tight mt-0.5">¡Felicitaciones, {nombres}!</h2>
                <p className="text-teal-100 text-xs mt-0.5 max-w-md mx-auto">
                  Tu cupo y tarifa para <span className="font-bold text-white underline">{activeService.name}</span> han quedado congelados por 48 horas en nuestra central clínica.
                </p>
              </div>

              <div className="p-4 sm:p-5 space-y-3">
                {/* Código de Pre-Reserva */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-2.5 text-center sm:text-left">
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Código Único de Atención</span>
                    <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-wider font-mono">
                      {preReserveSuccess.codigoReserva || 'NEXO-PROMO'}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyCodeToClipboard}
                    className="bg-white border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 gap-1.5 shadow-2xs h-8 text-xs"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copiar Código
                  </Button>
                </div>

                {/* Resumen de la pre-reserva */}
                <div className="space-y-1.5 text-xs bg-white p-3 rounded-xl border border-slate-200">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Paciente Titular:</span>
                    <span className="font-bold text-slate-900">
                      {nombres} {apellidos} {dni ? `(DNI: ${dni})` : ''}
                    </span>
                  </div>
                  {esParaFamiliar && nombreFamiliar && (
                    <div className="flex justify-between py-1 border-b border-slate-100 bg-teal-50/60 px-2 rounded-lg">
                      <span className="text-teal-800 font-semibold">Atención para familiar:</span>
                      <span className="font-bold text-teal-950">{nombreFamiliar} ({parentesco})</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Tratamiento Asignado:</span>
                    <span className="font-bold text-teal-700">{activeService.name}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Sede Odontológica:</span>
                    <span className="font-semibold text-slate-800 text-right">
                      {(() => {
                        const match = offerData.sedes?.find((s: any) => String(s.id_sede) === String(selectedSedeId));
                        return match ? `${match.nombre} - ${match.direccion || ''}`.trim() : offerData.sede;
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Fecha y Turno:</span>
                    <span className="font-semibold text-slate-800">
                      {fechaCita} — {horaCita}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Modalidad de Pago:</span>
                    <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-300 font-semibold text-[11px]">
                      {canalPago}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-xs font-bold text-slate-800">Total Promocional a abonar:</span>
                    <div className="text-right">
                      <span className="text-xl font-black text-emerald-600 font-mono">S/ {Number(activeService.offeredPrice).toFixed(2)}</span>
                      <span className="block text-[10px] text-slate-400 line-through">S/ {Number(activeService.originalPrice).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Botones de acción final */}
                <div className="space-y-2 pt-1">
                  <Button
                    onClick={() => {
                      const text = encodeURIComponent(
                        `¡Hola NexoSalud! Confirmé mi pre-reserva online.\n\n` +
                        `📋 *Código:* ${preReserveSuccess.codigoReserva}\n` +
                        `👤 *Paciente:* ${nombres} ${apellidos}\n` +
                        `🦷 *Tratamiento:* ${activeService.name}\n` +
                        `💰 *Monto Promocional:* S/ ${Number(activeService.offeredPrice).toFixed(2)}\n` +
                        `💳 *Pago:* ${canalPago}\n` +
                        `📍 *Sede:* ${(() => {
                          const match = offerData.sedes?.find((s: any) => String(s.id_sede) === String(selectedSedeId));
                          return match ? `${match.nombre} - ${match.direccion || ''}`.trim() : offerData.sede;
                        })()}`
                      );
                      window.open(`https://wa.me/51970292710?text=${text}`, '_blank');
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 rounded-xl text-xs shadow-md gap-2 cursor-pointer transition-all"
                  >
                    <MessageSquare className="w-4 h-4" /> Enviar Voucher a WhatsApp de la Clínica
                  </Button>
                  <Button
                    onClick={() => setPdfModalOpen(true)}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs h-10 gap-2 cursor-pointer shadow-sm transition-all rounded-xl border border-slate-800"
                  >
                    <FileText className="w-4 h-4 text-teal-400" /> Ver Orden de Pago PDF
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Tarjeta del Formulario: SIN SHADOW (shadow-none) + BOTÓN FIJO ABAJO */
            <div className="w-full max-w-xl bg-white rounded-3xl overflow-hidden flex flex-col h-auto lg:h-[calc(100vh-5.5rem)] shadow-none border border-slate-200/80 relative">
              
              {/* Header Fijo de la Tarjeta */}
              <div className="px-5 py-3.5 bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-700 text-white shrink-0 relative overflow-hidden">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-white">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h2 className="text-sm sm:text-base font-black text-white tracking-tight leading-tight">
                        Formulario de Pre-Reserva
                      </h2>
                      <p className="text-teal-100 text-[10.5px] font-normal leading-tight">
                        Completa tus datos para emitir tu orden clínica y congelar la tarifa.
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-amber-400 text-slate-950 font-black hover:bg-amber-400 px-2 py-0.5 shadow-xs text-[10px] shrink-0">
                    ¡{activeService.discountPct}% DSCTO!
                  </Badge>
                </div>
              </div>

              {/* Cuerpo del Formulario Plano con Scroll Interno Invisible */}
              <div className="flex-1 lg:overflow-y-auto px-5 py-4 space-y-4 bg-white lg:[&::-webkit-scrollbar]:hidden lg:[-ms-overflow-style:none] lg:[scrollbar-width:none]">
                <form id="preReserveForm" onSubmit={handlePreReserveSubmit} className="space-y-4">

                  {/* Resumen Compacto de la Oferta en Pantallas Móviles */}
                  <div className="lg:hidden p-3 bg-teal-50/70 border border-teal-100 rounded-2xl space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-teal-900">{activeService.name}</span>
                      <span className="text-sm font-black text-teal-900">S/ {Number(activeService.offeredPrice).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10.5px] text-slate-500">
                      <span>Precio regular: S/ {Number(activeService.originalPrice).toFixed(2)}</span>
                      <span className="text-emerald-700 font-bold">Ahorras S/ {(Number(activeService.originalPrice) - Number(activeService.offeredPrice)).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* 1. Tratamiento Odontológico Solicitado */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                        <span>1. Tratamiento Odontológico</span>
                      </div>
                      {availableServices.length > 1 && (
                        <span className="text-[10px] text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                          {availableServices.length} opciones disponibles
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {availableServices.map((srv) => {
                        const isSelected = selectedServiceKey === srv.key;
                        return (
                          <div
                            key={srv.key}
                            onClick={() => setSelectedServiceKey(srv.key)}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-left ${
                              isSelected
                                ? '!bg-teal-50/80 !border-2 !border-teal-600 shadow-xs ring-1 ring-teal-500'
                                : '!bg-white !border-slate-200 hover:!border-teal-400 hover:!bg-teal-50/30'
                            }`}
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div
                                className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                                  isSelected
                                    ? '!bg-teal-600 !border-teal-600 text-white'
                                    : '!bg-white !border-slate-300'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-xs font-bold leading-tight ${isSelected ? 'text-teal-950' : 'text-slate-800'}`}>
                                    {srv.name}
                                  </span>
                                  {srv.isMain ? (
                                    <span className="text-[9.5px] font-bold bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded-md">
                                      Cotizado Principal
                                    </span>
                                  ) : (
                                    <span className="text-[9.5px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded-md">
                                      Tarifa Preferente
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10.5px] text-slate-500 line-clamp-1 mt-0.5">
                                  {srv.description}
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="block text-xs sm:text-sm font-black text-teal-700 font-mono">
                                S/ {Number(srv.offeredPrice).toFixed(2)}
                              </span>
                              {srv.originalPrice > srv.offeredPrice && (
                                <span className="block text-[10px] text-slate-400 line-through">
                                  S/ {Number(srv.originalPrice).toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Opción para explorar y elegir otro tratamiento del catálogo clínico */}
                    {offerData.catalogServices && offerData.catalogServices.length > 0 && (
                      <div className="pt-1 space-y-2">
                        {!showCatalogSelector && !customCatalogService ? (
                          <button
                            type="button"
                            onClick={() => setShowCatalogSelector(true)}
                            className="w-full py-2 px-3 rounded-xl border border-dashed border-teal-300 bg-teal-50/40 hover:bg-teal-50 text-teal-800 text-[11px] font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
                          >
                            <Search className="w-3.5 h-3.5 text-teal-600" />
                            <span>¿Buscas otro tratamiento? Elige del catálogo general de la clínica</span>
                          </button>
                        ) : (
                          <div className="p-3 rounded-2xl border border-teal-200 bg-teal-50/40 space-y-2 animate-in fade-in-50 duration-200 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-teal-950 flex items-center gap-1.5">
                                <Search className="w-3.5 h-3.5 text-teal-600" />
                                Catálogo General de Tratamientos ({offerData.catalogServices.length} opciones)
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowCatalogSelector(!showCatalogSelector)}
                                className="text-[10.5px] text-teal-700 hover:text-teal-950 font-bold underline cursor-pointer"
                              >
                                {customCatalogService ? (showCatalogSelector ? 'Ocultar lista' : 'Cambiar por otro') : 'Cerrar'}
                              </button>
                            </div>
                            {(showCatalogSelector || !customCatalogService) && (
                              <Select
                                value={customCatalogService ? String(customCatalogService.id_servicio) : ''}
                                onValueChange={handleSelectCatalogService}
                              >
                                <SelectTrigger className="!bg-white !text-slate-900 !border-teal-300 text-xs h-9 rounded-xl font-medium shadow-2xs focus:border-teal-500 focus:ring-1 focus:ring-teal-500">
                                  <SelectValue placeholder="Selecciona un tratamiento de la clínica..." />
                                </SelectTrigger>
                                <SelectContent className="!bg-white !border-slate-200 text-slate-900 shadow-xl max-h-60">
                                  {offerData.catalogServices.map((cs: any) => (
                                    <SelectItem key={cs.id_servicio} value={String(cs.id_servicio)}>
                                      <div className="flex justify-between items-center w-full gap-4">
                                        <span className="font-semibold text-slate-900 text-xs">{cs.nombre}</span>
                                        <span className="text-teal-700 font-bold font-mono text-[11px]">S/ {Number(cs.offeredPrice).toFixed(2)}</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 2. Datos del Paciente Titular */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      <User className="w-3.5 h-3.5 text-teal-600" />
                      <span>2. Datos del Paciente Titular</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-700">Nombres *</Label>
                        <Input
                          required
                          value={nombres}
                          onChange={(e) => setNombres(e.target.value)}
                          placeholder="Tus nombres"
                          className="!bg-white !text-slate-900 placeholder:!text-slate-400 !border-slate-200 focus:!border-teal-500 focus:!ring-1 focus:!ring-teal-500 text-xs h-9 rounded-xl shadow-2xs font-medium"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-700">Apellidos *</Label>
                        <Input
                          required
                          value={apellidos}
                          onChange={(e) => setApellidos(e.target.value)}
                          placeholder="Tus apellidos"
                          className="!bg-white !text-slate-900 placeholder:!text-slate-400 !border-slate-200 focus:!border-teal-500 focus:!ring-1 focus:!ring-teal-500 text-xs h-9 rounded-xl shadow-2xs font-medium"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <Label className="text-[11px] font-semibold text-slate-700">DNI / Carné Extranjería *</Label>
                          <span className="text-[9px] text-teal-700 font-bold bg-teal-50 px-1.5 py-0.5 rounded-full border border-teal-100">Requerido</span>
                        </div>
                        <Input
                          required
                          maxLength={12}
                          value={dni}
                          onChange={(e) => setDni(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))}
                          placeholder="Número de DNI"
                          className="!bg-white !text-slate-900 placeholder:!text-slate-400 !border-slate-200 focus:!border-teal-500 focus:!ring-1 focus:!ring-teal-500 text-xs h-9 rounded-xl shadow-2xs font-medium"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-700">WhatsApp de Confirmación *</Label>
                        <Input
                          required
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="999 888 777"
                          className="!bg-white !text-slate-900 placeholder:!text-slate-400 !border-slate-200 focus:!border-teal-500 focus:!ring-1 focus:!ring-teal-500 text-xs h-9 rounded-xl shadow-2xs font-medium"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-slate-700">Correo Electrónico (Para comprobante digital)</Label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu-correo@ejemplo.com"
                        className="!bg-white !text-slate-900 placeholder:!text-slate-400 !border-slate-200 focus:!border-teal-500 focus:!ring-1 focus:!ring-teal-500 text-xs h-9 rounded-xl shadow-2xs font-medium"
                      />
                    </div>

                    {/* Checkbox para familiar con fondo blanco y hover teal */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="familiar"
                          checked={esParaFamiliar}
                          onCheckedChange={(checked) => setEsParaFamiliar(Boolean(checked))}
                          className={!esParaFamiliar ? '!bg-white !border-slate-300 hover:!border-teal-500' : '!bg-teal-600 !border-teal-600 text-white'}
                        />
                        <Label htmlFor="familiar" className="text-xs font-semibold text-slate-800 cursor-pointer select-none">
                          ¿La atención odontológica es para un familiar / hijo / cónyuge?
                        </Label>
                      </div>

                      {esParaFamiliar && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1.5 animate-in fade-in-50 duration-200">
                          <div>
                            <Label className="text-[10.5px] font-semibold text-slate-700">Nombre del Familiar *</Label>
                            <Input
                              required={esParaFamiliar}
                              value={nombreFamiliar}
                              onChange={(e) => setNombreFamiliar(e.target.value)}
                              placeholder="Ej: Mateo Castillo"
                              className="!bg-white !text-slate-900 placeholder:!text-slate-400 !border-slate-200 focus:!border-teal-500 focus:!ring-1 focus:!ring-teal-500 text-xs h-8.5 mt-0.5 rounded-xl font-medium"
                            />
                          </div>
                          <div>
                            <Label className="text-[10.5px] font-semibold text-slate-700">Parentesco</Label>
                            <Select value={parentesco} onValueChange={setParentesco}>
                              <SelectTrigger className="!bg-white !text-slate-900 !border-slate-200 text-xs h-8.5 mt-0.5 rounded-xl font-medium shadow-2xs focus:border-teal-500 focus:ring-1 focus:ring-teal-500">
                                <SelectValue placeholder="Selecciona parentesco" />
                              </SelectTrigger>
                              <SelectContent className="!bg-white !border-slate-200 text-slate-900 shadow-xl">
                                <SelectItem value="Hijo/a">Hijo/a</SelectItem>
                                <SelectItem value="Cónyuge / Pareja">Cónyuge / Pareja</SelectItem>
                                <SelectItem value="Padre / Madre">Padre / Madre</SelectItem>
                                <SelectItem value="Hermano/a">Hermano/a</SelectItem>
                                <SelectItem value="Otro">Otro familiar</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. Coordinación de Cita & Sede */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                      <Calendar className="w-3.5 h-3.5 text-teal-600" />
                      <span>3. Coordinación de Cita & Sede</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-700">Sede Preferencial</Label>
                        <Select
                          value={String(selectedSedeId)}
                          onValueChange={(val) => setSelectedSedeId(val)}
                        >
                          <SelectTrigger className="!bg-white !text-slate-900 !border-slate-200 text-xs h-9 rounded-xl font-medium shadow-2xs focus:border-teal-500 focus:ring-1 focus:ring-teal-500">
                            <SelectValue placeholder="Selecciona sede" />
                          </SelectTrigger>
                          <SelectContent className="!bg-white !border-slate-200 text-slate-900 shadow-xl">
                            {offerData.sedes && offerData.sedes.length > 0 ? (
                              offerData.sedes.map((s: any) => (
                                <SelectItem key={s.id_sede} value={String(s.id_sede)}>
                                  {s.nombre} - {s.direccion || ''}
                                </SelectItem>
                              ))
                            ) : (
                              <>
                                <SelectItem value="1">Sede California - Av. Larco 820, Urb. California, Trujillo</SelectItem>
                                <SelectItem value="2">Sede Primavera - Av. Teodoro Valcárcel 345, Urb. Primavera, Trujillo</SelectItem>
                                <SelectItem value="3">Sede Centro Histórico - Jr. Pizarro 456, Centro Histórico, Trujillo</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-700">Turno Preferido de Atención</Label>
                        <Select value={horaCita} onValueChange={setHoraCita}>
                          <SelectTrigger className="!bg-white !text-slate-900 !border-slate-200 text-xs h-9 rounded-xl font-medium shadow-2xs focus:border-teal-500 focus:ring-1 focus:ring-teal-500">
                            <SelectValue placeholder="Selecciona turno preferido" />
                          </SelectTrigger>
                          <SelectContent className="!bg-white !border-slate-200 text-slate-900 shadow-xl">
                            <SelectItem value="09:00 - 13:00 (Mañana)">Mañana (09:00 AM - 01:00 PM)</SelectItem>
                            <SelectItem value="14:00 - 18:00 (Tarde)">Tarde (02:00 PM - 06:00 PM)</SelectItem>
                            <SelectItem value="18:00 - 21:00 (Noche)">Noche (06:00 PM - 09:00 PM)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Nivel de dolor con opciones blancas y hover Teal */}
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold text-slate-700 block">
                        ¿Presentas dolor o molestia dental actualmente?
                      </Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        {[
                          'Ninguno (Preventivo)',
                          'Leve (Sensibilidad)',
                          'Moderado',
                          'Intenso (Agudo)',
                        ].map((nivel) => {
                          const isSelected = nivelDolor === nivel;
                          return (
                            <button
                              key={nivel}
                              type="button"
                              onClick={() => handleSelectNivelDolor(nivel)}
                              className={`py-2 px-1.5 rounded-xl border text-[10.5px] font-semibold transition-all cursor-pointer text-center ${
                                isSelected
                                  ? '!bg-teal-600 !border-teal-600 text-white shadow-xs ring-1 ring-teal-500'
                                  : '!bg-white !border-slate-200 text-slate-700 hover:!bg-teal-50/50 hover:!border-teal-400 hover:!text-teal-950 shadow-2xs'
                              }`}
                            >
                              {nivel}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Banner clínico reactivo según dolor */}
                    <div className={`p-2.5 rounded-xl border text-[11px] flex items-center gap-2 ${
                      nivelDolor.includes('Intenso') || nivelDolor.includes('Agudo')
                        ? 'bg-red-50 border-red-200 text-red-900'
                        : nivelDolor.includes('Moderado')
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-teal-50/80 border-teal-200 text-teal-900'
                    }`}>
                      <AlertCircle className={`w-4 h-4 shrink-0 ${
                        nivelDolor.includes('Intenso') || nivelDolor.includes('Agudo')
                          ? 'text-red-600'
                          : nivelDolor.includes('Moderado')
                          ? 'text-amber-600'
                          : 'text-teal-600'
                      }`} />
                      <div className="leading-tight">
                        {nivelDolor.includes('Intenso') || nivelDolor.includes('Agudo') ? (
                          <span><strong>Atención Urgente Recomendada:</strong> Al presentar molestia intensa, preseleccionamos fecha prioritaria (Hoy o Mañana).</span>
                        ) : nivelDolor.includes('Moderado') ? (
                          <span><strong>Atención Pronta:</strong> Te sugerimos coordinar tu cita en las próximas 24 a 48 horas.</span>
                        ) : (
                          <span><strong>Fecha Sugerida (3 días después):</strong> Te damos 3 días de margen para coordinar tu pago y cita con total comodidad.</span>
                        )}
                      </div>
                    </div>

                    {/* Selector Interactivo de Fecha (Próximos 7 días) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] font-semibold text-slate-700">
                          Selecciona el día de tu cita
                        </Label>
                        <span className="text-[10px] text-slate-500 font-medium">
                          Elegido: <strong className="text-teal-700">{fechaCita}</strong>
                        </span>
                      </div>

                      <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                        {upcomingDays.map((day) => {
                          const isSelected = fechaCita === day.iso;
                          const recommendedOffset = getRecommendedOffset(nivelDolor);
                          const isRecommended =
                            (recommendedOffset === 0 && (day.offset === 0 || day.offset === 1)) ||
                            (recommendedOffset === 1 && (day.offset === 1 || day.offset === 2)) ||
                            (recommendedOffset === 3 && day.offset === 3);

                          return (
                            <button
                              key={day.iso}
                              type="button"
                              onClick={() => {
                                setFechaCita(day.iso);
                                setShowCalendarInput(false);
                              }}
                              className={`py-2 px-1 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer relative ${
                                isSelected
                                  ? '!bg-teal-600 !border-teal-600 text-white shadow-xs ring-1 ring-teal-500'
                                  : '!bg-white !border-slate-200 text-slate-700 hover:!bg-teal-50/50 hover:!border-teal-400 hover:!text-teal-950 shadow-2xs'
                              }`}
                            >
                              {isRecommended && (
                                <span className={`absolute -top-1.5 text-[7.5px] font-black px-1 rounded-full uppercase tracking-tighter ${
                                  isSelected
                                    ? 'bg-amber-400 text-slate-950'
                                    : 'bg-teal-100 text-teal-800'
                                }`}>
                                  {day.offset === 0 ? 'Hoy' : day.offset === 3 ? 'Ideal' : 'Sugerido'}
                                </span>
                              )}
                              <span className={`text-[10px] font-bold ${isSelected ? 'text-teal-100' : 'text-slate-500'}`}>
                                {day.dayName}
                              </span>
                              <span className="text-sm font-black tracking-tight leading-tight">
                                {day.dayNum}
                              </span>
                              <span className={`text-[9px] uppercase font-semibold ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
                                {day.month}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Botón para alternar a fecha personalizada */}
                      <div className="pt-1 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setShowCalendarInput(!showCalendarInput)}
                          className="text-[10.5px] font-semibold text-teal-700 hover:text-teal-800 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <CalendarDays className="w-3.5 h-3.5" />
                          <span>{showCalendarInput ? 'Ocultar calendario' : '¿Deseas elegir otra fecha más adelante?'}</span>
                        </button>
                      </div>

                      {showCalendarInput && (
                        <div className="pt-1 animate-in fade-in-50 duration-200">
                          <Input
                            type="date"
                            value={fechaCita}
                            min={formatDateIso(new Date())}
                            onChange={(e) => setFechaCita(e.target.value)}
                            className="!bg-white !text-slate-900 !border-slate-200 text-xs h-9 rounded-xl shadow-2xs font-medium focus:!border-teal-500 focus:!ring-1 focus:!ring-teal-500"
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-slate-700">Alergias o Condiciones Especiales (Opcional)</Label>
                      <Input
                        value={alergias}
                        onChange={(e) => setAlergias(e.target.value)}
                        placeholder="Ej: Penicilina, látex, hipertensión, ninguna..."
                        className="!bg-white !text-slate-900 placeholder:!text-slate-400 !border-slate-200 text-xs h-9 rounded-xl shadow-2xs font-medium focus:!border-teal-500 focus:!ring-1 focus:!ring-teal-500"
                      />
                    </div>
                  </div>

                  {/* 4. Modalidad de Pago Preferida */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                      <CreditCard className="w-3.5 h-3.5 text-teal-600" />
                      <span>4. Modalidad de Pago Preferida</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setCanalPago('Efectivo en clínica')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          canalPago === 'Efectivo en clínica'
                            ? '!bg-teal-50/90 !border-2 !border-teal-600 text-teal-950 ring-1 ring-teal-500 shadow-xs'
                            : '!bg-white !border-slate-200 text-slate-700 hover:!border-teal-400 hover:!bg-teal-50/40 hover:!text-teal-950 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Banknote className="w-4 h-4 text-teal-600" />
                          {canalPago === 'Efectivo en clínica' && <Check className="w-3.5 h-3.5 text-teal-600" />}
                        </div>
                        <div>
                          <span className="block font-bold text-slate-900 text-xs">En Clínica</span>
                          <span className="text-[10px] text-slate-500 font-normal">Pagas el día de tu cita</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCanalPago('Yape / Plin')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          canalPago === 'Yape / Plin'
                            ? '!bg-teal-50/90 !border-2 !border-teal-600 text-teal-950 ring-1 ring-teal-500 shadow-xs'
                            : '!bg-white !border-slate-200 text-slate-700 hover:!border-teal-400 hover:!bg-teal-50/40 hover:!text-teal-950 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <QrCode className="w-4 h-4 text-teal-600" />
                          {canalPago === 'Yape / Plin' && <Check className="w-3.5 h-3.5 text-teal-600" />}
                        </div>
                        <div>
                          <span className="block font-bold text-slate-900 text-xs">Yape / Plin</span>
                          <span className="text-[10px] text-slate-500 font-normal">Coordinado al llegar</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCanalPago('Tarjeta')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          canalPago === 'Tarjeta'
                            ? '!bg-teal-50/90 !border-2 !border-teal-600 text-teal-950 ring-1 ring-teal-500 shadow-xs'
                            : '!bg-white !border-slate-200 text-slate-700 hover:!border-teal-400 hover:!bg-teal-50/40 hover:!text-teal-950 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <CreditCard className="w-4 h-4 text-teal-600" />
                          {canalPago === 'Tarjeta' && <Check className="w-3.5 h-3.5 text-teal-600" />}
                        </div>
                        <div>
                          <span className="block font-bold text-slate-900 text-xs">Tarjeta Déb/Cré</span>
                          <span className="text-[10px] text-slate-500 font-normal">POS sin recargo</span>
                        </div>
                      </button>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-slate-700">Duda o Comentario para el Odontólogo (Opcional)</Label>
                      <Input
                        value={comentarios}
                        onChange={(e) => setComentarios(e.target.value)}
                        placeholder="Ej: Deseo consultar también por ortodoncia o blanqueamiento..."
                        className="!bg-white !text-slate-900 placeholder:!text-slate-400 !border-slate-200 text-xs h-9 rounded-xl shadow-2xs font-medium focus:!border-teal-500 focus:!ring-1 focus:!ring-teal-500"
                      />
                    </div>

                    {/* Checkbox de consentimiento con fondo blanco */}
                    <div className="flex items-start gap-2 pt-1">
                      <Checkbox
                        id="consent"
                        checked={consentimiento}
                        onCheckedChange={(c) => setConsentimiento(Boolean(c))}
                        className={!consentimiento ? '!bg-white !border-slate-300 hover:!border-teal-500 mt-0.5' : '!bg-teal-600 !border-teal-600 text-white mt-0.5'}
                      />
                      <Label htmlFor="consent" className="text-xs text-slate-700 leading-snug cursor-pointer select-none">
                        Autorizo a Clínica NexoSalud a contactarme por WhatsApp/Email para coordinar mi cita y confirmo que deseo congelar mi tarifa promocional.
                      </Label>
                    </div>
                  </div>
                </form>
              </div>

              {/* ======================================================= */}
              {/* FOOTER FIJO (ESTÁTICO) CON EL BOTÓN DE ENVIAR FORMULARIO */}
              {/* ======================================================= */}
              <div className="px-5 py-3.5 bg-slate-50/95 shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 font-medium">
                  <ShieldCheck className="h-4 w-4 text-teal-600 shrink-0" />
                  <span>Datos 100% protegidos por Ley N° 29733</span>
                </div>

                <Button
                  type="submit"
                  form="preReserveForm"
                  disabled={submitting}
                  className="w-full sm:w-auto sm:min-w-[270px] h-10 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold rounded-xl shadow-md shadow-teal-700/20 text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Formalizando Reserva...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmar Pre-Reserva (S/ {Number(activeService.offeredPrice).toFixed(2)})</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ======================================================================= */}
        {/* COLUMNA DERECHA (50%): FOTO Fondo_NexoSalud_2.jpg + RESUMEN CLÍNICO     */}
        {/* ======================================================================= */}
        <div className="hidden lg:flex flex-col justify-center items-center h-full text-white p-4 sm:p-6 lg:p-8 xl:p-12">
          <div className="w-full max-w-lg space-y-4 flex flex-col items-center justify-center animate-in fade-in slide-in-from-right duration-300">
            
            {/* Header de la Oferta Visual (Centrado en su fila) */}
            <div className="w-full space-y-2 text-center flex flex-col items-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-semibold backdrop-blur-md">
                <Sparkles className="w-3.5 h-3.5 text-teal-300" />
                <span>Propuesta Comercial Exclusiva</span>
              </div>

              <h1 className="text-2xl xl:text-3xl font-black text-white tracking-tight leading-tight">
                {activeService.name}
              </h1>

              <p className="text-slate-300 text-xs leading-relaxed max-w-md font-normal text-center">
                {activeService.description || offerData.serviceDescription || 'Tratamiento odontológico integral con equipos de última tecnología, garantía NexoSalud y atención personalizada.'}
              </p>
            </div>

            {/* Tarjeta Visual de Precios & Ahorro */}
            <div className="w-full bg-slate-900/80 border border-slate-700/80 backdrop-blur-md p-4 rounded-2xl space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    ¡{activeService.discountPct}% de Descuento!
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-teal-200 bg-teal-500/20 px-2 py-0.5 rounded-full border border-teal-500/30">
                  <Clock3 className="w-3 h-3" />
                  <span>Vigencia 48h</span>
                </div>
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <span className="text-[11px] text-slate-400 block">Tarifa regular:</span>
                  <span className="text-sm line-through text-slate-500 font-bold">
                    S/ {Number(activeService.originalPrice).toFixed(2)}
                  </span>
                  <div className="text-xs font-bold text-emerald-400 mt-0.5">
                    Ahorras: S/ {(Number(activeService.originalPrice) - Number(activeService.offeredPrice)).toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-teal-300 tracking-wider block">Tarifa Especial</span>
                  <span className="text-3xl font-black text-white tracking-tight">
                    S/ {Number(activeService.offeredPrice).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Grid de Credenciales Médicas */}
            <div className="w-full grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm space-y-1">
                <div className="w-7 h-7 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-300">
                  <Stethoscope className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] text-slate-400 block font-medium">Especialista</span>
                <p className="text-xs font-bold text-white truncate">{offerData.doctor}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm space-y-1">
                <div className="w-7 h-7 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-300">
                  <MapPin className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] text-slate-400 block font-medium">Sede Principal</span>
                <p className="text-xs font-bold text-white truncate">{offerData.sede}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm space-y-1">
                <div className="w-7 h-7 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-300">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] text-slate-400 block font-medium">Tecnología</span>
                <p className="text-xs font-bold text-white truncate">Diagnóstico 3D & Bioseguridad</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm space-y-1">
                <div className="w-7 h-7 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-300">
                  <Award className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] text-slate-400 block font-medium">Garantía</span>
                <p className="text-xs font-bold text-white truncate">Clínica Certificada</p>
              </div>
            </div>

            {/* Nota de Tranquilidad al Paciente */}
            <div className="w-full p-3 rounded-xl bg-teal-950/50 border border-teal-800/60 backdrop-blur-sm text-[11px] text-teal-200/90 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
              <span>Al confirmar tu pre-reserva, congelas tu tarifa por 48 horas sin compromiso de pago inmediato. Nuestro equipo coordinará tu llegada.</span>
            </div>

          </div>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* WIDGET FLOTANTE: ASISTENTE NEXOSALUD (Chat IA Flotante)                   */}
      {/* ========================================================================= */}
      <div className="fixed bottom-6 right-6 z-50 pointer-events-none">
        {/* Ventana de Chat Flotante: en la esquina inferior derecha */}
        {isChatOpen && (
          <div
            className="w-[calc(100vw-2rem)] sm:w-[385px] h-[525px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden pointer-events-auto animate-in fade-in zoom-in-95 slide-in-from-bottom-6 duration-200"
          >
            {/* Header del Chat con botón de cerrar */}
            <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 px-4 py-3.5 text-white flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-white p-1 flex items-center justify-center shrink-0 shadow-xs">
                  <img src="/Logo_NexoSalud.png" alt="NexoSalud" className="w-full h-full object-contain" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-sm leading-tight text-white">
                    Asistente NexoSalud
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  </div>
                  <div className="text-[11px] text-teal-100 font-medium leading-tight">
                    En línea para responder tus dudas
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChatOpen(false)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Cerrar chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mensajes del Chat */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/60 text-xs">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.sender === 'agent' && (
                    <div className="w-6 h-6 rounded-full bg-white border border-slate-200 p-0.5 flex items-center justify-center shrink-0 shadow-2xs">
                      <img src="/Logo_NexoSalud.png" alt="NexoSalud" className="w-full h-full object-contain" />
                    </div>
                  )}
                  <div
                    className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 shadow-2xs ${
                      msg.sender === 'user'
                        ? 'bg-teal-600 text-white rounded-br-xs font-medium'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs leading-relaxed font-normal'
                    }`}
                  >
                    <p className="whitespace-pre-line text-xs">{msg.text}</p>
                    <span
                      className={`block text-[9px] mt-1 text-right ${
                        msg.sender === 'user' ? 'text-teal-200' : 'text-slate-400'
                      }`}
                    >
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              ))}

              {isAiTyping && (
                <div className="flex gap-2 items-center">
                  <div className="w-6 h-6 rounded-full bg-white border border-slate-200 p-0.5 flex items-center justify-center shrink-0 shadow-2xs">
                    <img src="/Logo_NexoSalud.png" alt="NexoSalud" className="w-full h-full object-contain" />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl px-3.5 py-2 text-slate-500 text-xs flex items-center gap-1.5 shadow-2xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                    <span>Asistente NexoSalud está escribiendo...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Sugerencias Rápidas */}
            <div className="px-3 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11px]">
              <button
                type="button"
                onClick={() => handleSendMessage('¿Qué incluye exactamente este precio?')}
                className="shrink-0 bg-slate-50 hover:bg-teal-50 hover:text-teal-950 hover:border-teal-300 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 transition-colors font-medium"
              >
                ¿Qué incluye?
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage('¿Cuáles son los medios de pago aceptados?')}
                className="shrink-0 bg-slate-50 hover:bg-teal-50 hover:text-teal-950 hover:border-teal-300 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 transition-colors font-medium"
              >
                Formas de pago
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage('¿Puedo transferir esta promoción a un familiar?')}
                className="shrink-0 bg-slate-50 hover:bg-teal-50 hover:text-teal-950 hover:border-teal-300 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 transition-colors font-medium"
              >
                Para familiar
              </button>
            </div>

            {/* Input del Chat */}
            <div className="p-3 bg-white border-t border-slate-100">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <Input
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Pregúntale al Asistente..."
                  disabled={isAiTyping}
                  className="!bg-white !text-slate-900 placeholder:!text-slate-400 !border-slate-300 text-xs h-9 rounded-xl focus:!border-teal-500 focus:!ring-teal-500/20"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={isAiTyping || !userInput.trim()}
                  className="bg-teal-600 hover:bg-teal-700 text-white h-9 px-3 rounded-xl shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* Botón Flotante Circular (FAB) - Desaparece completamente cuando el chat está abierto */}
        {!isChatOpen && (
          <button
            type="button"
            onClick={() => setIsChatOpen(true)}
            className="w-14 h-14 rounded-full bg-white border-2 border-teal-600 shadow-2xl flex items-center justify-center p-2.5 transition-all duration-300 hover:scale-110 active:scale-95 group ring-4 ring-teal-500/10 cursor-pointer relative focus:outline-none pointer-events-auto animate-in zoom-in-75 duration-200"
            aria-label="Abrir Asistente NexoSalud"
            title="Asistente NexoSalud"
          >
            {/* Indicador en línea (punto verde) */}
            <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-xs"></span>

            <img
              src="/Logo_NexoSalud.png"
              alt="Asistente NexoSalud"
              className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-110"
            />
          </button>
        )}
      </div>
      {/* Modal de Previsualización y Descarga de la Orden de Pago */}
      <Dialog open={pdfModalOpen} onOpenChange={setPdfModalOpen}>
        <DialogContent className="flex h-[100dvh] w-[100vw] max-w-[100vw] flex-col gap-0 overflow-hidden rounded-none border border-slate-200 bg-white p-0 shadow-2xl sm:h-[92vh] sm:w-[96vw] sm:max-w-[96vw] sm:rounded-2xl [&>button]:text-white [&>button:hover]:text-white">
          {/* Header del Modal */}
          <div className="flex shrink-0 items-center justify-between bg-slate-900 px-6 py-4 pr-14 text-white">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 p-1 flex items-center justify-center">
                <img src="/Logo_NexoSalud.png" alt="NexoSalud" className="w-full h-full object-contain" />
              </div>
              <div>
                <DialogTitle className="text-sm font-extrabold text-white tracking-tight leading-tight">
                  Vista Previa de la Orden de Pago
                </DialogTitle>
                <DialogDescription className="text-[11px] text-teal-200/90 leading-tight">
                  Se genera al completar la pre-reserva. No acredita un pago realizado.
                </DialogDescription>
              </div>
            </div>
            <Badge className="bg-emerald-500 text-slate-950 font-black text-[10px] px-2.5 py-0.5">
              PENDIENTE DE PAGO
            </Badge>
          </div>

          {/* Visor de PDF real */}
          <div className="flex min-h-0 w-full flex-1 items-center justify-center bg-slate-800">
            {pdfBlobUrl ? (
              <iframe
                src={pdfBlobUrl}
                className="h-full w-full border-0"
                title="Orden de Pago PDF"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-slate-400">
                {pdfError ? (
                  <span className="text-sm">No se pudo generar el PDF. Cierra y vuelve a abrir esta vista.</span>
                ) : (
                  <><Loader2 className="w-8 h-8 animate-spin" /><span className="text-sm">Generando documento PDF...</span></>
                )}
              </div>
            )}
          </div>
          {/* Footer de Acciones del Modal */}
          <div className="flex shrink-0 flex-col items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setPdfModalOpen(false)}
              className="w-full sm:w-auto text-xs font-semibold text-slate-700 border-slate-300"
            >
              Cerrar Vista Previa
            </Button>

            <Button
              onClick={() => {
                if (!pdfBlobUrl) return;
                const link = document.createElement('a');
                link.href = pdfBlobUrl;
                link.download = `Orden-de-Pago-${preReserveSuccess?.codigoReserva || 'NexoSalud'}.pdf`;
                link.click();
              }}
              disabled={!pdfBlobUrl}
              className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs gap-2"
            >
              <Download className="w-4 h-4" /> Descargar PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
