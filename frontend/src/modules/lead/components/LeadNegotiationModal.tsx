import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  format,
  addDays,
  startOfDay,
  parseISO,
  differenceInYears,
} from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { leadService } from '../services/lead.service';
import { configService } from '@/modules/config/services/config.service';
import { useToast } from '@/shared/hooks/use-toast';
import { generateFlyerTitleWithAI, predictLeadNegotiationStrategy, type LeadNegotiationStrategy } from '@/shared/services/groqService';
import { ConfirmationDialog } from '@/shared/components/feedback/ConfirmationDialog';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';
import {
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  User,
  Plus,
  ArrowRight,
  Stethoscope,
  Mail,
  Phone,
  MessageSquare,
  Edit2,
  Trash2,
  Check,
  X,
  DollarSign,
  Briefcase,
  GraduationCap,
  HeartPulse,
  Sparkles,
  Zap,
  Tag,
  TrendingDown,
  Award,
  Copy,
  Flame,
  Sun,
  Snowflake,
  CreditCard,
  Target,
  ShieldAlert,
  Layers,
  ChevronDown,
  ChevronRight,
  Building2,
  Activity,
  MessageCircle,
  CheckCheck,
  Timer,
  Settings2,
  Palette,
  ExternalLink,
  Download,
  Image as ImageIcon,
  History,
  RotateCw,
  RotateCcw,
  Loader2,
} from 'lucide-react';

interface LeadNegotiationModalProps {
  leadId: string | number | null;
  isOpen: boolean;
  onClose: () => void;
}

// ── Logo oficial de Canva (Icon-Icons / Simple Icons) ───────────────────────
function CanvaIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Canva"
    >
      <title>Canva</title>
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zM6.962 7.68c.754 0 1.337.549 1.405 1.2.069.583-.171 1.097-.822 1.406-.343.171-.48.172-.549.069-.034-.069 0-.137.069-.206.617-.514.617-.926.548-1.508-.034-.378-.308-.618-.583-.618-1.2 0-2.914 2.674-2.674 4.629.103.754.549 1.646 1.509 1.646.308 0 .65-.103.96-.24.5-.264.799-.47 1.097-.8-.073-.885.704-2.046 1.851-2.046.515 0 .926.205.96.583.068.514-.377.582-.514.582s-.378-.034-.378-.17c-.034-.138.309-.07.275-.378-.035-.206-.24-.274-.446-.274-.72 0-1.131.994-1.029 1.611.035.275.172.549.447.549.205 0 .514-.31.617-.755.068-.308.343-.514.583-.514.102 0 .17.034.205.171v.138c-.034.137-.137.548-.102.651 0 .069.034.171.17.171.092 0 .436-.18.777-.459.117-.59.253-1.298.253-1.357.034-.24.137-.48.617-.48.103 0 .171.034.205.171v.138l-.136.617c.445-.583 1.097-.994 1.508-.994.172 0 .309.102.309.274 0 .103 0 .274-.069.446-.137.377-.309.96-.412 1.474 0 .137.035.274.207.274.171 0 .685-.206 1.096-.754l.007-.004c-.002-.068-.007-.134-.007-.202 0-.411.035-.754.104-.994.068-.274.411-.514.617-.514.103 0 .205.069.205.171 0 .035 0 .103-.034.137-.137.446-.24.857-.24 1.269 0 .24.034.582.102.788 0 .034.035.069.07.069.068 0 .548-.445.89-1.028-.308-.206-.48-.549-.48-.96 0-.72.446-1.097.858-1.097.343 0 .617.24.617.72 0 .308-.103.65-.274.96h.102a.77.77 0 0 0 .584-.24.293.293 0 0 1 .134-.117c.335-.425.83-.74 1.41-.74.48 0 .924.205.959.582.068.515-.378.618-.515.618l-.002-.002c-.138 0-.377-.035-.377-.172 0-.137.309-.068.274-.376-.034-.206-.24-.275-.446-.275-.686 0-1.13.891-1.028 1.611.034.275.171.583.445.583.206 0 .515-.308.652-.754.068-.274.343-.514.583-.514.103 0 .17.034.205.171 0 .069 0 .206-.137.652-.17.308-.171.48-.137.617.034.274.171.48.309.583.034.034.068.102.068.102 0 .069-.034.138-.137.138-.034 0-.068 0-.103-.035-.514-.205-.72-.548-.789-.891-.205.24-.445.377-.72.377-.445 0-.89-.411-.96-.926a1.609 1.609 0 0 1 .075-.649c-.203.13-.422.203-.623.203h-.17c-.447.652-.927 1.098-1.27 1.303a.896.896 0 0 1-.377.104c-.068 0-.171-.035-.205-.104-.095-.152-.156-.392-.193-.667-.481.527-1.145.805-1.453.805-.343 0-.548-.206-.582-.55v-.376c.102-.754.377-1.2.377-1.337a.074.074 0 0 0-.069-.07c-.24 0-1.028.824-1.166 1.373l-.103.445c-.068.309-.377.515-.582.515-.103 0-.172-.035-.206-.172v-.137l.046-.233c-.435.31-.87.508-1.075.508-.308 0-.48-.172-.514-.412-.206.274-.445.412-.754.412-.352 0-.696-.24-.862-.593-.244.275-.523.553-.852.764-.48.309-1.028.549-1.68.549-.582 0-1.097-.309-1.371-.583-.412-.377-.651-.96-.686-1.509-.205-1.68.823-3.84 2.4-4.8.378-.205.755-.343 1.132-.343zm9.77 3.291c-.104 0-.172.172-.172.343 0 .274.137.583.309.755a1.74 1.74 0 0 0 .102-.583c0-.343-.137-.515-.24-.515z" />
    </svg>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function calcAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  try {
    return differenceInYears(new Date(), parseISO(birthDate));
  } catch {
    return null;
  }
}

// ── Formateo de Franja / Horario a formato 12 Horas (AM / PM) ────────────────
function formatConsultaMotivo(motivo: string | null | undefined): string {
  if (!motivo) return '';
  return motivo
    // Reemplazos de franjas numéricas a 12h
    .replace(/Franja:\s*1\b/gi, 'Horario: Turno Mañana (08:00 AM – 01:00 PM)')
    .replace(/Franja:\s*2\b/gi, 'Horario: Turno Tarde (01:00 PM – 06:00 PM)')
    .replace(/Franja:\s*3\b/gi, 'Horario: Turno Noche (06:00 PM – 09:00 PM)')
    // Reemplazos de formatos de 24h a 12h
    .replace(/08:00\s*-\s*13:00/g, '08:00 AM – 01:00 PM')
    .replace(/13:00\s*-\s*18:00/g, '01:00 PM – 06:00 PM')
    .replace(/14:00\s*-\s*18:00/g, '02:00 PM – 06:00 PM')
    .replace(/18:00\s*-\s*21:00/g, '06:00 PM – 09:00 PM')
    .replace(/Franja:\s*Mañana/gi, 'Horario: Turno Mañana (08:00 AM – 01:00 PM)')
    .replace(/Franja:\s*Tarde/gi, 'Horario: Turno Tarde (01:00 PM – 06:00 PM)')
    .replace(/Franja:\s*Noche/gi, 'Horario: Turno Noche (06:00 PM – 09:00 PM)')
    .replace(/Franja:\s*Flexible/gi, 'Horario: Flexible');
}

// ── Opciones de horas estándar para selectores interactivos ───────────────────
const TIME_OPTIONS = [
  '07:00 AM', '07:30 AM',
  '08:00 AM', '08:30 AM',
  '09:00 AM', '09:30 AM',
  '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM',
  '12:00 PM', '12:30 PM',
  '01:00 PM', '01:30 PM',
  '02:00 PM', '02:30 PM',
  '03:00 PM', '03:30 PM',
  '04:00 PM', '04:30 PM',
  '05:00 PM', '05:30 PM',
  '06:00 PM', '06:30 PM',
  '07:00 PM', '07:30 PM',
  '08:00 PM', '08:30 PM',
  '09:00 PM', '09:30 PM',
  '10:00 PM',
];

function parseCompanyHours(companyHorario: string) {
  if (!companyHorario) return { openTime: '08:00 AM', closeTime: '08:00 PM' };
  const match = companyHorario.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)\s*[-–—a]\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/i);
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

// ── Estado de error ──────────────────────────────────────────────────────────
function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2 text-rose-500">
      <p className="text-xs font-medium">{message}</p>
    </div>
  );
}

// ── Fila de dato con icono ───────────────────────────────────────────────────
function DataRow({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="space-y-0.5">
      <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
        {label}
      </span>
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-800 dark:text-slate-200">
        {icon && <span className="text-slate-400 dark:text-slate-500 shrink-0">{icon}</span>}
        <span>{value}</span>
      </div>
    </div>
  );
}

// ── Chip para condiciones booleanas (Sí/No) ──────────────────────────────────
function CondChip({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  const isYes = value.toLowerCase().startsWith('sí') || value.toLowerCase().startsWith('si');
  return (
    <div className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs border ${isYes
      ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200/70 dark:border-rose-800/50 text-rose-700 dark:text-rose-400'
      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700/60 text-slate-600 dark:text-slate-400'
      }`}>
      <span className="font-medium">{label}</span>
      <span className={`font-bold ${isYes ? 'text-rose-600 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`}>{value}</span>
    </div>
  );
}

// ── Sección Acordeón ─────────────────────────────────────────────────────────
function AccordionSection({ title, subtitle, icon, children, defaultOpen = false }: {
  title: string; subtitle: string; icon: React.ReactNode;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="shadow-sm border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full text-left"
      >
        <CardHeader className="pb-3 pt-4 px-4 bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-2">
              <span className="text-slate-500 dark:text-slate-400 mt-0.5 shrink-0">{icon}</span>
              <div>
                <CardTitle className="text-xs font-bold text-slate-800 dark:text-slate-100">{title}</CardTitle>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-normal">{subtitle}</p>
              </div>
            </div>
            <span className="text-slate-400 dark:text-slate-500 shrink-0 ml-2">
              {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </span>
          </div>
        </CardHeader>
      </button>
      {open && (
        <CardContent className="p-4 bg-white dark:bg-slate-900/80 space-y-3 border-t border-slate-200/70 dark:border-slate-700/80 animate-in slide-in-from-top-1 duration-150">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

// ── Sección siempre abierta (Datos Personales) ───────────────────────────────
function StaticSection({ title, subtitle, icon, children }: {
  title: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Card className="shadow-sm border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
      <CardHeader className="pb-3 pt-4 px-4 bg-white dark:bg-slate-800/60 border-b border-slate-200/70 dark:border-slate-700/80">
        <div className="flex items-start gap-2">
          <span className="text-slate-500 dark:text-slate-400 mt-0.5 shrink-0">{icon}</span>
          <div>
            <CardTitle className="text-xs font-bold text-slate-800 dark:text-slate-100">{title}</CardTitle>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-normal">{subtitle}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 bg-white dark:bg-slate-900/80 space-y-3">{children}</CardContent>
    </Card>
  );
}

export function LeadNegotiationModal({ leadId, isOpen, onClose }: LeadNegotiationModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [lead, setLead] = useState<any>(null);
  const [catalogs, setCatalogs] = useState<any>({ profesionales: [], sedes: [], servicios: [], disponibilidades: [] });
  const [loading, setLoading] = useState(true);

  // Form oferta comercial / promoción
  const [altServicioId, setAltServicioId] = useState('');
  const [altProfesionalId, setAltProfesionalId] = useState('');
  const [altSedeId, setAltSedeId] = useState('');
  const [altVigencia, setAltVigencia] = useState<'24h' | '48h' | '72h' | '7d' | 'custom'>('48h');
  const [altVigenciaCustom, setAltVigenciaCustom] = useState('');
  const [altFranja, setAltFranja] = useState('Turno Mañana (08:00 AM – 01:00 PM)');
  const [isCustomHorario, setIsCustomHorario] = useState(false);
  const [customHorarioText, setCustomHorarioText] = useState('');
  const [customStartHour, setCustomStartHour] = useState('08:00 AM');
  const [customEndHour, setCustomEndHour] = useState('06:00 PM');
  const [companyHorario, setCompanyHorario] = useState('');

  const { openTime, closeTime } = useMemo(() => {
    return parseCompanyHours(companyHorario);
  }, [companyHorario]);

  const [altPrecio, setAltPrecio] = useState('150.00');
  const [altCondiciones, setAltCondiciones] = useState('');
  const [addingAlternative, setAddingAlternative] = useState(false);
  const [offerErrors, setOfferErrors] = useState<Record<string, string>>({});

  // Opciones del tablero
  const [selectedOpcion, setSelectedOpcion] = useState<number | null>(null);
  const [reserving, setReserving] = useState(false);
  // Estados para Modal de Edición Completa de Oferta Comercial (Precio, Descuento, Sede, Especialista, Fecha)
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingOpt, setEditingOpt] = useState<any | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editDiscountPct, setEditDiscountPct] = useState<number>(0);
  const [editSedeId, setEditSedeId] = useState<string>('');
  const [editProfesionalId, setEditProfesionalId] = useState<string>('');
  const [editFecha, setEditFecha] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingOptionTarget, setDeletingOptionTarget] = useState<any | null>(null);
  const [isDeletingOption, setIsDeletingOption] = useState(false);

  // Estados para Copiloto de Objeciones y Seguimiento WhatsApp
  const [objectionCategory, setObjectionCategory] = useState<'PRECIO' | 'HORARIO' | 'SEDE'>('PRECIO');
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Estados para Recomendación Predictiva de Oferta (IA)
  const [aiStrategy, setAiStrategy] = useState<LeadNegotiationStrategy | null>(null);
  const [loadingStrategy, setLoadingStrategy] = useState(false);
  const [copiedPitch, setCopiedPitch] = useState(false);
  const [generatingCanva, setGeneratingCanva] = useState(false);
  const [canvaResult, setCanvaResult] = useState<any>(null);
  const [flyerImageLoading, setFlyerImageLoading] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [flyerZoom, setFlyerZoom] = useState<number>(1);
  const flyerContainerRef = useRef<HTMLDivElement>(null);
  const [panPosition, setPanPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialPanX: number; initialPanY: number }>({
    startX: 0,
    startY: 0,
    initialPanX: 0,
    initialPanY: 0,
  });

  const handleResetZoomAndPan = () => {
    setFlyerZoom(1);
    setPanPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: panPosition.x,
      initialPanY: panPosition.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    setPanPosition({
      x: dragStartRef.current.initialPanX + dx,
      y: dragStartRef.current.initialPanY + dy,
    });
  };

  const handleMouseUp = () => {
    if (isDragging) setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      initialPanX: panPosition.x,
      initialPanY: panPosition.y,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStartRef.current.startX;
    const dy = e.touches[0].clientY - dragStartRef.current.startY;
    setPanPosition({
      x: dragStartRef.current.initialPanX + dx,
      y: dragStartRef.current.initialPanY + dy,
    });
  };

  const handleTouchEnd = () => {
    if (isDragging) setIsDragging(false);
  };

  // Zoom interactivo con la rueda del ratón (scroll) en el visor del flyer
  const handleFlyerWheel = (e: React.WheelEvent<HTMLDivElement> | WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const zoomStep = 0.15;
    const direction = e.deltaY < 0 ? 1 : -1;
    setFlyerZoom((prev) => {
      const next = Math.round((prev + direction * zoomStep) * 100) / 100;
      return Math.min(3.0, Math.max(0.6, next));
    });
  };

  const setFlyerContainerRef = (node: HTMLDivElement | null) => {
    if (flyerContainerRef.current) {
      flyerContainerRef.current.removeEventListener('wheel', handleFlyerWheel as any);
    }
    flyerContainerRef.current = node;
    if (node) {
      node.addEventListener('wheel', handleFlyerWheel as any, { passive: false });
    }
  };

  const fetchData = () => {
    if (!leadId) return;
    setLoading(true);
    Promise.all([
      leadService.getLeadDetails(leadId.toString()),
      leadService.getAvailabilityOptions(),
      configService.getEmpresa().catch(() => null),
    ])
      .then(([leadData, catData, empData]) => {
        setLead(leadData);
        setCatalogs(catData);
        if (empData?.horarioAtencion) {
          setCompanyHorario(empData.horarioAtencion);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOpen && leadId) fetchData();
  }, [isOpen, leadId]);

  // Pre-carga inteligente al obtener datos del lead y catálogos
  useEffect(() => {
    if (!lead || !catalogs || !catalogs.servicios?.length) return;

    // 1. Pre-seleccionar servicio solicitado
    let initialServicioId = altServicioId;
    const reqServicio = lead.Solicitudes?.[0]?.Servicio;
    const reqServicioId = lead.Solicitudes?.[0]?.id_servicio;
    if (!initialServicioId) {
      if (reqServicioId) {
        initialServicioId = reqServicioId.toString();
      } else if (reqServicio?.id_servicio) {
        initialServicioId = reqServicio.id_servicio.toString();
      } else if (reqServicio?.nombre) {
        const found = catalogs.servicios.find((s: any) =>
          s.nombre.toLowerCase().includes(reqServicio.nombre.toLowerCase())
        );
        if (found) initialServicioId = found.id_servicio.toString();
      }
      if (!initialServicioId && catalogs.servicios.length > 0) {
        initialServicioId = catalogs.servicios[0].id_servicio.toString();
      }
      if (initialServicioId) setAltServicioId(initialServicioId);
    }

    // 2. Pre-seleccionar sede preferida
    const prefSede = lead.Preferencias?.[0]?.sede_preferida;
    if (prefSede && !altSedeId) {
      const matchSede = catalogs.sedes?.find((s: any) =>
        s.nombre.toLowerCase().includes(prefSede.toLowerCase()) ||
        prefSede.toLowerCase().includes(s.nombre.toLowerCase())
      );
      if (matchSede) setAltSedeId(matchSede.id_sede.toString());
    }

    // 3. Pre-seleccionar profesional preferido
    const prefProf = lead.Preferencias?.[0]?.profesional_preferido;
    if (prefProf && !altProfesionalId) {
      const matchProf = catalogs.profesionales?.find((p: any) =>
        p.apellidos.toLowerCase().includes(prefProf.toLowerCase()) ||
        prefProf.toLowerCase().includes(p.apellidos.toLowerCase()) ||
        p.nombres.toLowerCase().includes(prefProf.toLowerCase())
      );
      if (matchProf) setAltProfesionalId(matchProf.id_profesional.toString());
    }

    // 4. Determinar precio de lista oficial y descuento inteligente
    const activeServicio = catalogs.servicios?.find((s: any) => s.id_servicio.toString() === initialServicioId);
    const officialPrice = Number(activeServicio?.Tarifas?.[0]?.precio || 180);
    if (altPrecio === '150.00' || !altPrecio) {
      setAltPrecio(officialPrice.toFixed(2));
    }

    // 5. Pre-seleccionar franja horaria sugerida analizando sus consultas previas
    const detectedSlots = new Set<'MANANA' | 'TARDE' | 'NOCHE'>();
    lead.Solicitudes?.forEach((s: any) => {
      const text = (s.motivo || '').toLowerCase();
      if (text.includes('franja: 1') || text.includes('franja: 01') || text.includes('mañana') || text.includes('08:00') || text.includes('morning')) {
        detectedSlots.add('MANANA');
      }
      if (text.includes('franja: 2') || text.includes('franja: 02') || text.includes('tarde') || text.includes('13:00') || text.includes('14:00') || text.includes('01:00 pm') || text.includes('02:00 pm')) {
        detectedSlots.add('TARDE');
      }
      if (text.includes('franja: 3') || text.includes('franja: 03') || text.includes('noche') || text.includes('18:00') || text.includes('06:00 pm') || text.includes('night')) {
        detectedSlots.add('NOCHE');
      }
    });

    // Revisar preferencia de horario si no se detectó en los motivos
    if (detectedSlots.size === 0 && lead.Preferencias?.[0]?.Horario?.hora_inicio) {
      const startHour = parseInt(String(lead.Preferencias[0].Horario.hora_inicio).substring(11, 13) || '0', 10);
      if (startHour >= 6 && startHour < 13) detectedSlots.add('MANANA');
      else if (startHour >= 13 && startHour < 18) detectedSlots.add('TARDE');
      else if (startHour >= 18) detectedSlots.add('NOCHE');
    }

    if (detectedSlots.has('TARDE') && detectedSlots.has('NOCHE')) {
      setAltFranja('Turno Tarde y Noche (01:00 PM – 09:00 PM)');
    } else if (detectedSlots.has('MANANA') && detectedSlots.has('TARDE')) {
      setAltFranja('Turno Mañana y Tarde (08:00 AM – 06:00 PM)');
    } else if (detectedSlots.has('TARDE')) {
      setAltFranja('Turno Tarde (01:00 PM – 06:00 PM)');
    } else if (detectedSlots.has('NOCHE')) {
      setAltFranja('Turno Noche (06:00 PM – 09:00 PM)');
    } else if (detectedSlots.has('MANANA')) {
      setAltFranja('Turno Mañana (08:00 AM – 01:00 PM)');
    }
  }, [lead, catalogs]);

  // Predicción de Estrategia de Negociación y Matching (IA)
  useEffect(() => {
    if (!lead || !catalogs || !catalogs.servicios?.length) return;
    setLoadingStrategy(true);
    predictLeadNegotiationStrategy({ lead, catalogs })
      .then((res) => {
        setAiStrategy(res);
      })
      .catch((err) => console.warn('Error predicting lead strategy:', err))
      .finally(() => setLoadingStrategy(false));
  }, [lead, catalogs]);

  const handleApplyAiStrategy = () => {
    if (!aiStrategy) return;
    setAltPrecio(aiStrategy.suggestedOfferedPrice.toFixed(2));
    setAltVigencia(aiStrategy.suggestedVigencia);
    if (aiStrategy.suggestedSedeId) {
      setAltSedeId(aiStrategy.suggestedSedeId);
    }
    if (aiStrategy.suggestedFranjaTexto) {
      setAltFranja(aiStrategy.suggestedFranjaTexto);
    }
    if (aiStrategy.suggestedConditions) {
      setAltCondiciones(aiStrategy.suggestedConditions);
    }
    toast({
      title: '¡Estrategia del Agente Negociador Aplicada!',
      description: `Tarifa S/ ${aiStrategy.suggestedOfferedPrice.toFixed(2)} (${aiStrategy.suggestedDiscountPct}% OFF) y vigencia ${aiStrategy.suggestedVigencia} cargadas al formulario.`,
    });
  };

  const handleCopyPitch = () => {
    if (!aiStrategy?.persuasiveSalesPitch) return;
    navigator.clipboard.writeText(aiStrategy.persuasiveSalesPitch);
    setCopiedPitch(true);
    toast({
      title: 'Mensaje Copiado',
      description: 'El argumento persuasivo de WhatsApp se copió al portapapeles.',
    });
    setTimeout(() => setCopiedPitch(false), 2500);
  };

  // Auto-selección inteligente: Si hay opciones y no hay opción seleccionada, auto-seleccionar la primera (ejecutado incondicionalmente antes de returns tempranos)
  useEffect(() => {
    const opts = lead?.Solicitudes?.[0]?.Opciones || [];
    if (opts.length > 0 && selectedOpcion === null) {
      setSelectedOpcion(opts[0].id_opcion);
    }
  }, [lead, selectedOpcion]);

  // Cálculo en vivo de la fecha límite de vigencia de la oferta comercial
  const calculatedExpiry = useMemo(() => {
    const today = startOfDay(new Date());
    if (altVigencia === '24h') return addDays(today, 1);
    if (altVigencia === '48h') return addDays(today, 2);
    if (altVigencia === '72h') return addDays(today, 3);
    if (altVigencia === '7d') return addDays(today, 7);
    if (altVigencia === 'custom' && altVigenciaCustom) {
      try {
        return parseISO(altVigenciaCustom);
      } catch {
        return addDays(today, 2);
      }
    }
    return addDays(today, 2);
  }, [altVigencia, altVigenciaCustom]);

  const getVigenciaLabel = (vig: string, customVal: string) => {
    if (vig === '24h') return '24 horas (Oferta Flash)';
    if (vig === '48h') return '48 horas (Recomendado)';
    if (vig === '72h') return '72 horas (3 días)';
    if (vig === '7d') return '7 días (Semanal)';
    return `Hasta ${customVal || 'Personalizado'}`;
  };

  // Precio de lista oficial del servicio actualmente seleccionado
  const currentOfficialPrice = useMemo(() => {
    const s = catalogs.servicios?.find((item: any) => item.id_servicio.toString() === altServicioId);
    return Number(s?.Tarifas?.[0]?.precio || 180);
  }, [catalogs.servicios, altServicioId]);

  const numericOfferPrice = useMemo(() => {
    const val = parseFloat(altPrecio);
    return isNaN(val) ? 0 : val;
  }, [altPrecio]);

  const discountMetrics = useMemo(() => {
    const saving = Math.max(0, currentOfficialPrice - numericOfferPrice);
    const pct = currentOfficialPrice > 0 ? Math.round((saving / currentOfficialPrice) * 100) : 0;
    return { saving, pct };
  }, [currentOfficialPrice, numericOfferPrice]);

  const applyQuickDiscount = (pct: number, type?: 'CAMPANA' | 'REGULAR') => {
    const discounted = currentOfficialPrice * (1 - pct / 100);
    setAltPrecio(discounted.toFixed(2));
    if (type === 'CAMPANA') {
      setAltCondiciones('Campaña Promocional Especial por tiempo limitado');
    } else if (type === 'REGULAR') {
      setAltCondiciones('');
    }
    if (offerErrors.precio) setOfferErrors(p => ({ ...p, precio: '' }));
  };

  const resetAltForm = () => {
    setAltServicioId('');
    setAltProfesionalId('');
    setAltSedeId('');
    setAltVigencia('48h');
    setAltVigenciaCustom('');
    setAltFranja('Horario Flexible (A elección del paciente al confirmar)');
    setAltPrecio('150.00');
    setAltCondiciones('');
    setOfferErrors({});
  };

  const handleAddAlternative = async () => {
    if (!leadId) return;
    const errors: Record<string, string> = {};
    if (!altServicioId) {
      errors.servicio = 'Selecciona un servicio para la promoción.';
    }
    if (!altPrecio || isNaN(Number(altPrecio)) || Number(altPrecio) <= 0) {
      errors.precio = 'Ingresa una tarifa válida mayor a 0';
    }
    if (Object.keys(errors).length > 0) {
      setOfferErrors(errors);
      return;
    }

    setOfferErrors({});
    setAddingAlternative(true);
    const ultimaSolicitud = lead?.Solicitudes?.[0];
    const expiryStr = format(calculatedExpiry, 'yyyy-MM-dd');
    const fullCondiciones = `[Vigencia: ${getVigenciaLabel(altVigencia, altVigenciaCustom)} - Vence: ${format(calculatedExpiry, 'dd/MM/yyyy')}] [Franja: ${altFranja}] ${altCondiciones ? `| ${altCondiciones}` : ''}`.trim();

    try {
      const res = await leadService.addAlternative(leadId.toString(), {
        id_solicitud: ultimaSolicitud?.id_solicitud,
        fecha: expiryStr,
        hora_inicio: altFranja.includes('Tarde') ? '14:00' : '09:00',
        hora_fin: altFranja.includes('Tarde') ? '19:00' : '13:00',
        id_profesional: (altProfesionalId && altProfesionalId !== 'ALL_PROFESSIONALS') ? altProfesionalId : undefined,
        id_sede: (altSedeId && altSedeId !== 'ALL_SEDES') ? altSedeId : undefined,
        precio_ofrecido: altPrecio,
        condiciones: fullCondiciones,
      });
      fetchData();
      resetAltForm();
      toast({ title: 'Promoción Registrada', description: 'La oferta comercial con vigencia activa ha sido añadida al tablero.' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo añadir la oferta comercial.', variant: 'destructive' });
    } finally {
      setAddingAlternative(false);
    }
  };

  const handleReserve = async () => {
    if (!selectedOpcion || !leadId) {
      toast({ title: 'Atención', description: 'Selecciona una alternativa del tablero.' });
      return;
    }
    const ultimaSolicitud = lead?.Solicitudes?.[0];
    setReserving(true);
    try {
      await leadService.reserve(leadId.toString(), { id_solicitud: ultimaSolicitud?.id_solicitud || 1, id_opcion: selectedOpcion });
      toast({ title: 'Trato Cerrado', description: 'El paciente pasa a la etapa PAYER.' });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });
      onClose();
    } catch {
      toast({ title: 'Error', description: 'Error al confirmar la reserva.', variant: 'destructive' });
    } finally {
      setReserving(false);
    }
  };

  const openEditOptionModal = (opt: any) => {
    setEditingOpt(opt);
    const priceNum = Number(opt.precio_ofrecido) || 0;
    setEditPrice(priceNum > 0 ? priceNum.toFixed(2) : '');

    const offerInfo = getActiveOfferDetails();
    const origPrice = offerInfo.precioOriginal || currentOfficialPrice || 180;
    const computedDiscount = origPrice > 0 && priceNum < origPrice
      ? Math.round(((origPrice - priceNum) / origPrice) * 100)
      : 0;
    setEditDiscountPct(computedDiscount);

    setEditSedeId(opt.Disponibilidad?.id_sede?.toString() || (catalogs.sedes?.[0]?.id_sede?.toString() || ''));
    setEditProfesionalId(opt.Disponibilidad?.id_profesional?.toString() || (catalogs.profesionales?.[0]?.id_profesional?.toString() || ''));

    const rawDate = opt.Disponibilidad?.fecha ? opt.Disponibilidad.fecha.split('T')[0] : '';
    setEditFecha(rawDate || format(addDays(new Date(), 2), 'yyyy-MM-dd'));
    setEditModalOpen(true);
  };

  const handleEditDiscountChange = (newDiscount: number) => {
    setEditDiscountPct(newDiscount);
    const offerInfo = getActiveOfferDetails();
    const origPrice = offerInfo.precioOriginal || currentOfficialPrice || 180;
    if (newDiscount <= 0) {
      setEditPrice(origPrice.toFixed(2));
    } else {
      const discounted = Math.max(0, origPrice * (1 - newDiscount / 100));
      setEditPrice(discounted.toFixed(2));
    }
  };

  const handleEditPriceChange = (newPriceStr: string) => {
    setEditPrice(newPriceStr);
    const newPrice = Number(newPriceStr);
    const offerInfo = getActiveOfferDetails();
    const origPrice = offerInfo.precioOriginal || currentOfficialPrice || 180;
    if (!isNaN(newPrice) && origPrice > 0 && newPrice < origPrice) {
      const computed = Math.round(((origPrice - newPrice) / origPrice) * 100);
      setEditDiscountPct(computed);
    } else {
      setEditDiscountPct(0);
    }
  };

  const setQuickExpiry = (days: number) => {
    setEditFecha(format(addDays(new Date(), days), 'yyyy-MM-dd'));
  };

  const handleSaveFullEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingOpt) return;
    const numPrice = Number(editPrice);
    if (isNaN(numPrice) || numPrice <= 0) {
      toast({ title: 'Precio Inválido', description: 'Ingresa un precio mayor a 0.', variant: 'destructive' });
      return;
    }

    setSavingEdit(true);
    try {
      await leadService.updateAlternative(editingOpt.id_opcion, {
        precio_ofrecido: numPrice,
        id_sede: editSedeId ? Number(editSedeId) : undefined,
        id_profesional: editProfesionalId ? Number(editProfesionalId) : undefined,
        fecha: editFecha || undefined,
      });

      setEditModalOpen(false);
      setEditingOpt(null);
      fetchData();
      toast({
        title: '¡Oferta Actualizada! 🎉',
        description: `Tarifa S/ ${numPrice.toFixed(2)} (${editDiscountPct}% OFF) guardada exitosamente.`,
      });
    } catch (err: any) {
      toast({ title: 'Error al actualizar', description: err.message || 'No se pudo guardar la oferta.', variant: 'destructive' });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDeleteOption = async () => {
    if (!deletingOptionTarget) return;
    setIsDeletingOption(true);
    try {
      await leadService.deleteAlternative(deletingOptionTarget.id_opcion);
      if (selectedOpcion === deletingOptionTarget.id_opcion) setSelectedOpcion(null);
      fetchData();
      toast({ title: 'Alternativa Removida' });
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setIsDeletingOption(false);
      setDeletingOptionTarget(null);
    }
  };

  if (!isOpen || !leadId) return null;

  const pref = lead?.Preferencias?.[0];
  const datAcad = lead?.DatosAcademicos?.[0];
  const datLab = lead?.DatosLaborales?.[0];
  const saludOdonto = lead?.SaludOdontologica?.[0];
  const interaccionReciente = lead?.Interacciones?.[0];
  const ultimaSolicitud = lead?.Solicitudes?.[0];
  const edad = calcAge(lead?.fecha_nacimiento);
  const opciones = ultimaSolicitud?.Opciones || [];

  // Variables de inteligencia comercial
  const isStudent = datAcad?.aplica === true || Boolean(datAcad?.universidad);
  const dolorLevel = saludOdonto?.nivel_dolor?.toLowerCase() || '';
  const hasUrgentPain = dolorLevel.includes('intenso') || dolorLevel.includes('moderado');

  const selectedOptData = opciones.find((o: any) => o.id_opcion === selectedOpcion);

  // Formateo de fecha límite sincronizado con la mesa de ofertas
  const formatCustomExpirationDate = (): string => {
    const rawDate = selectedOptData?.Disponibilidad?.fecha || (opciones.length > 0 ? opciones[0]?.Disponibilidad?.fecha : null);
    let targetDate: Date | null = null;

    if (rawDate) {
      const match = String(rawDate).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const [, y, m, d] = match;
        // Mediodía local evita desfases de día por husos horarios
        targetDate = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
      } else {
        targetDate = new Date(rawDate);
      }
    } else if (altVigencia === '24h') {
      targetDate = addDays(startOfDay(new Date()), 1);
    } else if (altVigencia === '48h') {
      targetDate = addDays(startOfDay(new Date()), 2);
    } else if (altVigencia === '72h') {
      targetDate = addDays(startOfDay(new Date()), 3);
    } else if (altVigencia === '7d') {
      targetDate = addDays(startOfDay(new Date()), 7);
    } else if (altVigencia === 'custom' && altVigenciaCustom) {
      try {
        const match = String(altVigenciaCustom).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          const [, y, m, d] = match;
          targetDate = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
        } else {
          targetDate = new Date(altVigenciaCustom);
        }
      } catch {
        targetDate = addDays(startOfDay(new Date()), 2);
      }
    }

    if (!targetDate || isNaN(targetDate.getTime())) {
      targetDate = addDays(startOfDay(new Date()), 2);
    }

    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const meses = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'
    ];

    return `${diasSemana[targetDate.getDay()]}, ${targetDate.getDate()} de ${meses[targetDate.getMonth()]}`;
  };

  // Helper centralizado para sincronizar oferta, precios oficiales y cálculo dinámico de descuento (% OFF)
  const getActiveOfferDetails = () => {
    const activeOpt = selectedOptData || (opciones.length > 0 ? opciones[0] : null);
    const reqServicio = ultimaSolicitud?.Servicio?.nombre || 'Consulta Odontológica';

    const catServ = catalogs.servicios?.find((s: any) =>
      s.id_servicio === ultimaSolicitud?.Servicio?.id_servicio ||
      s.id_servicio?.toString() === altServicioId ||
      s.nombre?.trim().toLowerCase() === reqServicio?.trim().toLowerCase()
    );

    const precioOriginal = Number(
      catServ?.Tarifas?.[0]?.precio ||
      ultimaSolicitud?.Servicio?.Tarifas?.[0]?.precio ||
      currentOfficialPrice ||
      180
    );

    const precio = activeOpt
      ? Number(activeOpt.precio_ofrecido)
      : (numericOfferPrice > 0 ? numericOfferPrice : 150);

    // Calcular descuento real porcentual
    let discountPct = 0;
    if (precioOriginal > 0 && precio < precioOriginal) {
      discountPct = Math.round(((precioOriginal - precio) / precioOriginal) * 100);
    } else if (discountMetrics?.pct > 0) {
      discountPct = discountMetrics.pct;
    } else {
      discountPct = 20;
    }

    const matchedSedeObj = activeOpt?.Disponibilidad?.Sede ||
      (altSedeId !== 'ALL_SEDES' && altSedeId
        ? catalogs.sedes?.find((s: any) => s.id_sede?.toString() === altSedeId)
        : catalogs.sedes?.[0]);

    const sede = matchedSedeObj
      ? `${matchedSedeObj.nombre} - ${matchedSedeObj.direccion || ''}`.trim()
      : 'Sede California - Av. Larco 820, Urb. California, Trujillo';

    const doctor = activeOpt?.Disponibilidad?.Profesional?.apellidos
      ? `Esp. ${activeOpt.Disponibilidad.Profesional.apellidos}`
      : 'Especialistas colegiados';

    // Determinar horario asignado por el admin o por la opción seleccionada
    const currentHorario = isCustomHorario && customHorarioText.trim()
      ? customHorarioText.trim()
      : (altFranja || companyHorario || 'Lunes a Sábado: 08:00 AM - 08:00 PM');

    // Calcular días restantes de la oferta para el badge Dias_Faltantes_Dscto
    const rawTargetDate = activeOpt?.Disponibilidad?.fecha || selectedOptData?.Disponibilidad?.fecha || (opciones.length > 0 ? opciones[0]?.Disponibilidad?.fecha : null);
    let daysDiff = 5;
    if (rawTargetDate) {
      const match = String(rawTargetDate).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const [, y, m, d] = match;
        const dObj = new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 59);
        const ms = dObj.getTime() - Date.now();
        daysDiff = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
      }
    } else if (altVigencia === '24h') daysDiff = 1;
    else if (altVigencia === '48h') daysDiff = 2;
    else if (altVigencia === '72h') daysDiff = 3;
    else if (altVigencia === '7d') daysDiff = 7;
    else if (altVigencia === 'custom' && altVigenciaCustom) {
      try {
        const dObj = new Date(altVigenciaCustom);
        const ms = dObj.getTime() - Date.now();
        daysDiff = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
      } catch (_) {
        daysDiff = 3;
      }
    }

    return {
      activeOpt,
      reqServicio,
      precio,
      precioOriginal,
      discountPct,
      sede,
      doctor,
      horario: currentHorario,
      diasFaltantes: daysDiff,
    };
  };

  const generateWhatsAppMessage = () => {
    const patientFirstName = lead?.nombres || 'Paciente';
    const reqServicio = ultimaSolicitud?.Servicio?.nombre || 'Consulta Odontológica';

    const offer = getActiveOfferDetails();
    if (offer.activeOpt) {
      const precio = Number(offer.precio).toFixed(2);
      const sede = offer.sede;
      const doctor = offer.doctor;
      const rawDate = offer.activeOpt?.Disponibilidad?.fecha || '';
      const fechaVigencia = rawDate ? rawDate.split('T')[0] : formatCustomExpirationDate();
      const cond = offer.activeOpt?.condiciones ? `\n📌 *Detalles de la oferta:* ${offer.activeOpt.condiciones}` : '';
      const dsctoLabel = offer.discountPct > 0 ? ` (${offer.discountPct}% OFF)` : '';

      return `¡Hola ${patientFirstName}! 👋 Te saludamos de NexoSalud Dental.\n\n` +
        `Diseñamos una *Oferta Comercial Exclusiva* para tu atención de *${offer.reqServicio}*:\n\n` +
        `💰 *Tarifa Promocional:* S/ ${precio}${dsctoLabel}\n` +
        `⏳ *Margen de Vigencia:* Válido hasta el ${fechaVigencia}\n` +
        `📍 *Sede:* ${sede}\n` +
        `👨‍⚕️ *Atención:* ${doctor}\n` +
        `${cond}\n\n` +
        `Para asegurar este precio con descuento, puedes separar tu turno en el siguiente enlace:\n` +
        `🔗 *https://nexosalud.pe/pre-reserva/${leadId}*\n\n` +
        `¡Quedamos atentos a tu confirmación para brindarte la mejor atención! ✨`;
    }

    if (opciones.length > 0) {
      const resumenOpciones = opciones.map((o: any, idx: number) => {
        const p = Number(o.precio_ofrecido).toFixed(2);
        const f = o.Disponibilidad?.fecha?.split('T')[0] || '';
        return `• *Propuesta ${idx + 1}:* S/ ${p} (Válido hasta ${f}) — Sede ${o.Disponibilidad?.Sede?.nombre || 'Principal'}${o.condiciones ? ` [${o.condiciones}]` : ''}`;
      }).join('\n');

      return `¡Hola ${patientFirstName}! 👋 De NexoSalud Dental.\n\n` +
        `Tenemos disponibles las siguientes promociones personalizadas para tu servicio de *${reqServicio}*:\n\n` +
        `${resumenOpciones}\n\n` +
        `\n` +
        `¿Cuál de estas alternativas se acomoda mejor a ti? Indícanos tu DNI para formalizar tu pre-reserva. 😊`;
    }

    return `¡Hola ${patientFirstName}! 👋 Te saludamos de NexoSalud Dental. Vemos tu interés en el servicio de *${reqServicio}*. Tenemos promociones activas con descuentos preferenciales para esta semana.\n\n¿Te gustaría conocer la propuesta comercial? Quedamos atentos a tus comentarios. ✨`;
  };

  const handleSendWhatsApp = () => {
    const rawPhone = (lead?.numero || '').replace(/\D/g, '');
    const cleanPhone = rawPhone.length === 9 ? `51${rawPhone}` : rawPhone;
    const message = generateWhatsAppMessage();
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    toast({ title: 'WhatsApp Abierto', description: 'Redirigiendo a WhatsApp con la propuesta comercial.' });
  };

  const handleSendEmail = async () => {
    setSendingEmail(true);
    try {
      const offerDetails = getActiveOfferDetails();
      const fechaLimiteFormatted = formatCustomExpirationDate();

      const conditions = altCondiciones || `Atención personalizada con ${offerDetails.doctor}. Cierre de tratamiento asegurado.`;
      const flyerUrl = canvaResult?.previewUrl || canvaResult?.downloadPngUrl || undefined;
      const designUrl = canvaResult?.designUrl || undefined;

      const res = await leadService.sendNegotiationEmail(lead?.id_persona || leadId, {
        serviceName: offerDetails.reqServicio,
        sedeName: offerDetails.sede,
        offeredPrice: Number(offerDetails.precio),
        originalPrice: Number(offerDetails.precioOriginal),
        discountPct: Number(offerDetails.discountPct),
        expirationDate: fechaLimiteFormatted,
        horarioTexto: offerDetails.horario,
        conditions,
        leadEmail: lead?.correo || lead?.email,
        leadPhone: lead?.numero,
        canvaFlyerUrl: flyerUrl,
        canvaDesignUrl: designUrl,
      });

      if (res?.success) {
        toast({
          title: '📧 ¡Correo de Simulación Enviado!',
          description: flyerUrl
            ? `Se envió el correo con el Flyer de Canva incrustado a tu bandeja (${res.recipient || 'benkr7@gmail.com'}).`
            : `Se envió el correo en formato texto estructurado a tu bandeja (${res.recipient || 'benkr7@gmail.com'}).`,
        });
      } else {
        toast({
          title: 'Aviso de Envío',
          description: res?.message || 'El correo fue procesado en modo simulación.',
        });
      }
    } catch (err: any) {
      console.error('Error enviando correo de simulación:', err);
      toast({
        title: 'Error al Enviar Correo',
        description: err.message || 'No se pudo conectar con el servidor de correo. Verifica la conexión.',
        variant: 'destructive',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCopyWhatsApp = () => {
    const message = generateWhatsAppMessage();
    navigator.clipboard.writeText(message);
    setCopiedWhatsApp(true);
    toast({ title: '¡Mensaje Copiado!', description: 'Texto copiado al portapapeles para enviar por chat o correo.' });
    setTimeout(() => setCopiedWhatsApp(false), 2000);
  };

  const handleGenerateCanvaAndDispatch = async (autoDispatch = false) => {
    setGeneratingCanva(true);
    try {
      const offerDetails = getActiveOfferDetails();
      const fechaLimiteFormatted = formatCustomExpirationDate();

      // 1. Generar con IA un título publicitario de máximo 3 palabras
      const tituloFlyerAI = await generateFlyerTitleWithAI(offerDetails.reqServicio, lead?.nombres);

      const resData = await leadService.generateCanvaFlyer(lead?.id_persona || leadId, {
        serviceName: offerDetails.reqServicio,
        sedeName: offerDetails.sede,
        doctorName: offerDetails.doctor,
        offeredPrice: Number(offerDetails.precio),
        originalPrice: Number(offerDetails.precioOriginal),
        discountPct: Number(offerDetails.discountPct),
        expirationDate: fechaLimiteFormatted,
        fechaLimite: fechaLimiteFormatted,
        diasFaltantes: offerDetails.diasFaltantes,
        horarioTexto: offerDetails.horario,
        tituloFlyer: tituloFlyerAI,
        conditions: altCondiciones || `Atención personalizada con ${offerDetails.doctor}. Cierre de tratamiento asegurado.`,
        sendEmail: false,
        leadEmail: lead?.correo || lead?.email,
        leadPhone: lead?.numero,
      });

      const canva = resData.canva;

      setCanvaResult({
        success: true,
        templateId: canva?.designId || 'EAHWLEXZ1lo',
        designUrl: canva?.designUrl,
        previewUrl: canva?.previewUrl,
        downloadPngUrl: canva?.downloadPngUrl || canva?.previewUrl,
        dataset: canva?.filledDataset,
      });

      toast({
        title: '🎨 ¡Flyer Canva Generado!',
        description: 'Imagen del flyer publicitario generada y lista para previsualizar o descargar.',
      });

      if (autoDispatch) {
        handleSendWhatsApp();
      }
    } catch (err: any) {
      console.warn('⚠️ Error llamando a Canva endpoint:', err);
      toast({
        title: 'Atención con Canva Connect',
        description: 'No se pudo conectar con Canva API. Si expiró la sesión, haz clic en "Conectar Canva".',
        variant: 'destructive',
      });
    } finally {
      setGeneratingCanva(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl h-[92vh] max-h-[92vh] sm:max-h-[95vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="p-5 pb-4 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 ring-4 ring-teal-50/70 dark:ring-teal-950/40 border border-teal-200/60 dark:border-teal-800/60">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Mesa de Negociación (LEAD)
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                  Configura ofertas comerciales con margen de vigencia activo y cierra el trato con el paciente.
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <div className="p-6"><LoadingState /></div>
          ) : !lead ? (
            <div className="p-6"><ErrorState message="No se encontró la oportunidad (LEAD)." /></div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80 dark:divide-slate-800 h-full max-h-full overflow-hidden">

              {/* ══ COLUMNA IZQUIERDA: Información del paciente (Fija / Scroll independiente) ══ */}
              <div className="p-4 space-y-3 overflow-y-auto h-full max-h-full no-scrollbar">

                {/* 1. Datos personales — siempre abierto */}
                <StaticSection
                  title="Datos Personales"
                  subtitle="Identificación general del individuo"
                  icon={<User className="h-3.5 w-3.5" />}
                >
                  <DataRow label="Nombre completo" value={`${lead.nombres} ${lead.apellidos}`} />
                  <div className="grid grid-cols-2 gap-3">
                    {edad && <DataRow label="Edad" icon={<Activity className="h-3.5 w-3.5" />} value={`${edad} años`} />}
                    {lead.zona && <DataRow label="Ciudad" icon={<MapPin className="h-3.5 w-3.5" />} value={lead.zona} />}
                  </div>
                  {lead.numero && <DataRow label="Teléfono" icon={<Phone className="h-3.5 w-3.5" />} value={lead.numero} />}
                  {lead.email && <DataRow label="Correo electrónico" icon={<Mail className="h-3.5 w-3.5" />} value={lead.email} />}
                </StaticSection>

                {/* Historial de Consultas Recurrentes (Inteligencia de Negociación) */}
                {lead.Solicitudes && lead.Solicitudes.length > 0 && (
                  <AccordionSection
                    title={`Historial de Consultas (${lead.Solicitudes.length})`}
                    subtitle="Trazabilidad de tratamientos consultados y dudas en web"
                    icon={<History className="h-3.5 w-3.5 text-amber-500" />}
                    defaultOpen={lead.Solicitudes.length > 1}
                  >
                    <div className="space-y-2">
                      {lead.Solicitudes.length > 1 && (
                        <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 flex items-center justify-between text-[11px]">
                          <span className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                            <RotateCw className="w-3 h-3 text-amber-700 dark:text-amber-400 shrink-0" /> Prospecto Recurrente
                          </span>
                          <span className="font-mono font-bold px-2 py-0.5 rounded bg-amber-200/80 dark:bg-amber-900/60 text-amber-950 dark:text-amber-200 text-[10px]">
                            x{lead.Solicitudes.length} Consultas
                          </span>
                        </div>
                      )}

                      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                        {lead.Solicitudes.map((sol: any, idx: number) => (
                          <div 
                            key={sol.id_solicitud || idx} 
                            className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                                Consulta #{lead.Solicitudes.length - idx}
                              </span>
                              {sol.fecha_solicitud && (
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {format(new Date(sol.fecha_solicitud), 'dd MMM yyyy, HH:mm')}
                                </span>
                              )}
                            </div>
                            <p className="font-semibold text-teal-700 dark:text-teal-400 text-xs">
                              {sol.Servicio?.nombre || 'Consulta General'}
                            </p>
                            {sol.motivo && (
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 italic bg-white dark:bg-slate-900/60 p-1.5 rounded-md border border-slate-200/60 dark:border-slate-800">
                                "{formatConsultaMotivo(sol.motivo)}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      {lead.Solicitudes.length > 1 && (
                        <div className="p-2 rounded-lg bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200/60 dark:border-teal-800/50 text-[10.5px] text-teal-900 dark:text-teal-200">
                          💡 <strong>Tip de Venta:</strong> Este paciente ha consultado varias veces. Aborda directamente sus preguntas anteriores y ofrécele facilidades o promociones en esta negociación.
                        </div>
                      )}
                    </div>
                  </AccordionSection>
                )}

                {/* 2. Gustos y preferencias — acordeón */}
                <AccordionSection
                  title="Gustos y Preferencias"
                  subtitle="Condiciones preferidas y variables clave para la negociación"
                  icon={<Settings2 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />}
                  defaultOpen={true}
                >
                  <div className="space-y-3">
                    {/* Preferencias de Sede y Horario recolectadas */}
                    <div className="space-y-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                      {pref?.sede_preferida ? (
                        <DataRow
                          label="Sede preferida"
                          icon={<MapPin className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />}
                          value={pref.sede_preferida}
                        />
                      ) : aiStrategy?.suggestedSedeNombre ? (
                        <DataRow
                          label="Sede preferida sugerida"
                          icon={<MapPin className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />}
                          value={aiStrategy.suggestedSedeNombre}
                        />
                      ) : null}

                      {pref?.Horario ? (
                        <DataRow
                          label="Horario preferido"
                          icon={<Clock className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />}
                          value={`${['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][pref.Horario.dia_semana] || `Día ${pref.Horario.dia_semana}`} (${String(pref.Horario.hora_inicio).substring(11, 16)} – ${String(pref.Horario.hora_fin).substring(11, 16)})`}
                        />
                      ) : aiStrategy?.suggestedFranjaTexto ? (
                        <DataRow
                          label="Horario preferido estimado"
                          icon={<Clock className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />}
                          value={aiStrategy.suggestedFranjaTexto}
                        />
                      ) : null}
                    </div>

                    {/* Patrones y Preferencias Determinantes para la Negociación Comercial */}
                    {aiStrategy ? (
                      <div className="space-y-2.5">
                        <DataRow
                          label="Canal prioritario de contacto"
                          icon={<MessageSquare className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
                          value={aiStrategy.preferredChannel}
                        />

                        <DataRow
                          label="Modalidad de pago esperada"
                          icon={<CreditCard className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />}
                          value={aiStrategy.paymentPreference}
                        />

                        <DataRow
                          label="Factor clave de decisión"
                          icon={<Target className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />}
                          value={aiStrategy.decisionDriver}
                        />

                        <DataRow
                          label="Disposición a servicios complementarios"
                          icon={<Layers className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />}
                          value={aiStrategy.crossSellingOpenness}
                        />

                        <DataRow
                          label="Freno / Barrera principal a mitigar"
                          icon={<ShieldAlert className="h-3.5 w-3.5 text-rose-500" />}
                          value={aiStrategy.primaryBarrier}
                        />

                        <DataRow
                          label="Flexibilidad de agenda"
                          icon={<Clock className="h-3.5 w-3.5 text-slate-500" />}
                          value={aiStrategy.agendaFlexibility}
                        />
                      </div>
                    ) : !pref && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 italic">Analizando preferencias del prospecto...</p>
                    )}
                  </div>
                </AccordionSection>

                {/* 3. Salud Odontológica — acordeón */}
                <AccordionSection
                  title="Salud Odontológica"
                  subtitle="Antecedentes clínicos y contexto bucal del paciente"
                  icon={<HeartPulse className="h-3.5 w-3.5" />}
                  defaultOpen={hasUrgentPain}
                >
                  {!saludOdonto ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic">Sin historial odontológico registrado</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <DataRow label="Última visita" icon={<Calendar className="h-3.5 w-3.5" />} value={saludOdonto.ultima_visita_odontologica} />
                        <DataRow label="Motivo de consulta" value={saludOdonto.motivo_consulta} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <DataRow label="Nivel de dolor" value={saludOdonto.nivel_dolor} />
                        <DataRow label="Cond. especial de atención" value={saludOdonto.condicion_atencion_especial} />
                      </div>
                    </div>
                  )}
                </AccordionSection>

                {/* 6. Otros datos administrativos — acordeón */}
                <AccordionSection
                  title="Otros Datos Administrativos"
                  subtitle="Parámetros de negociación y seguimiento de contacto"
                  icon={<Settings2 className="h-3.5 w-3.5" />}
                >
                  <div className="grid grid-cols-2 gap-3">
                    {lead.CanalOrigen && <DataRow label="Canal de captación" value={lead.CanalOrigen.nombre} />}
                    {ultimaSolicitud && <DataRow label="Nivel de interés" value={ultimaSolicitud.tipo_consulta || 'Consulta general'} />}
                  </div>
                  {interaccionReciente?.mensaje && (
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Observaciones administrativas</span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200/70 dark:border-slate-700/60">
                        {interaccionReciente.mensaje}
                      </p>
                    </div>
                  )}
                </AccordionSection>

              </div>

              {/* ══ COLUMNA DERECHA: Negociación (Scroll independiente) ══ */}
              <div className="p-5 space-y-5 overflow-y-auto h-full max-h-full no-scrollbar">

                {/* ── 1. Recomendación Predictiva de Oferta (IA / BI) ── */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-50/90 via-white to-amber-50/40 dark:from-teal-950/40 dark:via-slate-900 dark:to-slate-950 border border-teal-200/90 dark:border-teal-800/80 shadow-sm relative overflow-hidden transition-all space-y-3.5">
                  <div className="relative z-10 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-100/80 dark:border-teal-900/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white text-[10px] font-bold">
                          1
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              Recomendación Predictiva de Oferta
                            </h3>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 font-bold border border-teal-200 dark:border-teal-800 flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5 text-teal-600 dark:text-teal-400" />
                              IA / BI
                            </span>
                          </div>
                          <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                            Estrategia de pricing, timing y persuasión predictiva según perfil clínico y urgencia.
                          </p>
                        </div>
                      </div>

                      {/* Lead Scoring Badge */}
                      {aiStrategy && (
                        <div
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs transition-all ${
                            aiStrategy.scoreLevel === 'HOT'
                              ? 'bg-rose-50 text-rose-950 dark:bg-rose-950/70 dark:text-rose-200 border-rose-300 dark:border-rose-800'
                              : aiStrategy.scoreLevel === 'WARM'
                              ? 'bg-amber-50 text-amber-950 dark:bg-amber-950/70 dark:text-amber-200 border-amber-300 dark:border-amber-800'
                              : 'bg-sky-50 text-sky-950 dark:bg-sky-950/70 dark:text-sky-200 border-sky-300 dark:border-sky-800'
                          }`}
                        >
                          {aiStrategy.scoreLevel === 'HOT' ? (
                            <Flame className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 fill-rose-500/20 shrink-0" />
                          ) : aiStrategy.scoreLevel === 'WARM' ? (
                            <Sun className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 fill-amber-500/20 shrink-0" />
                          ) : (
                            <Snowflake className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                          )}
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Lead Score:</span>
                          <span className="font-mono font-bold text-sm">{aiStrategy.leadScore}/100</span>
                          <span
                            className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${
                              aiStrategy.scoreLevel === 'HOT'
                                ? 'bg-rose-100/90 text-rose-800 border-rose-200 dark:bg-rose-900/60 dark:text-rose-200 dark:border-rose-800'
                                : aiStrategy.scoreLevel === 'WARM'
                                ? 'bg-amber-100/90 text-amber-800 border-amber-200 dark:bg-amber-900/60 dark:text-amber-200 dark:border-amber-800'
                                : 'bg-sky-100/90 text-sky-800 border-sky-200 dark:bg-sky-900/60 dark:text-sky-200 dark:border-sky-800'
                            }`}
                          >
                            {aiStrategy.scoreLevel === 'HOT'
                              ? 'Caliente'
                              : aiStrategy.scoreLevel === 'WARM'
                              ? 'Tibio'
                              : 'Frío'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Grid de 3 Pilares Predictivos */}
                    {aiStrategy ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                        {/* Pilar 1: Sensibilidad al Precio & Descuento Óptimo */}
                        <div className="p-3 rounded-xl bg-white/95 dark:bg-slate-900/90 border border-slate-200/90 dark:border-teal-800/50 hover:border-teal-400/80 transition-colors space-y-1.5 shadow-2xs">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-800 dark:text-slate-200">
                            <span className="flex items-center gap-1.5 text-teal-700 dark:text-teal-300">
                              <DollarSign className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                              Sensibilidad Precio
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {aiStrategy.priceSensitivity}
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-teal-900 dark:text-teal-200">
                              Sugerido: S/ {aiStrategy.suggestedOfferedPrice.toFixed(2)}
                              <span className="text-[10.5px] font-normal text-slate-400 line-through ml-1.5">
                                S/ {aiStrategy.originalPrice.toFixed(2)}
                              </span>
                            </p>
                            <p className="text-[10.5px] text-emerald-600 dark:text-emerald-400 font-semibold">
                              Descuento óptimo: {aiStrategy.suggestedDiscountPct}% OFF
                            </p>
                          </div>
                        </div>

                        {/* Pilar 2: Urgencia Clínica & Vigencia de la Oferta */}
                        <div className="p-3 rounded-xl bg-white/95 dark:bg-slate-900/90 border border-slate-200/90 dark:border-teal-800/50 hover:border-teal-400/80 transition-colors space-y-1.5 shadow-2xs">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-800 dark:text-slate-200">
                            <span className="flex items-center gap-1.5 text-teal-700 dark:text-teal-300">
                              <HeartPulse className="h-3.5 w-3.5 text-rose-500" />
                              Urgencia Clínica
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 truncate max-w-[90px]">
                              {aiStrategy.urgencyLevel.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              Vigencia sugerida: {aiStrategy.suggestedVigencia === '24h' ? '24 Horas (Flash)' : aiStrategy.suggestedVigencia === '48h' ? '48 Horas' : '72 Horas'}
                            </p>
                            <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-tight">
                              {aiStrategy.urgencyLevel === 'CRÍTICA_DOLOR' ? 'Priorizar cita hoy mismo.' : 'Tratamiento planificado.'}
                            </p>
                          </div>
                        </div>

                        {/* Pilar 3: Terna de Matching (Sede & Franja) */}
                        <div className="p-3 rounded-xl bg-white/95 dark:bg-slate-900/90 border border-slate-200/90 dark:border-teal-800/50 hover:border-teal-400/80 transition-colors space-y-1.5 shadow-2xs">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-800 dark:text-slate-200">
                            <span className="flex items-center gap-1.5 text-teal-700 dark:text-teal-300">
                              <MapPin className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                              Sede & Franja
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
                              MATCH
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                              {aiStrategy.suggestedSedeNombre}
                            </p>
                            <p className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">
                              {aiStrategy.suggestedFranjaTexto}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-50 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-600" />
                        <span>El Agente Negociador está analizando la mejor estrategia de oferta...</span>
                      </div>
                    )}

                    {/* Argumento Persuasivo para WhatsApp & Botón de Aplicación con 1 Clic */}
                    {aiStrategy && (
                      <div className="p-3 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-teal-200/80 dark:border-teal-800/60 space-y-2.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <MessageSquare className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                            Pitch Comercial Recomendado para WhatsApp:
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={handleCopyPitch}
                              className="text-[10.5px] font-semibold text-teal-700 dark:text-teal-300 hover:text-teal-900 flex items-center gap-1 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 px-2.5 py-1 rounded-lg border border-teal-200 dark:border-teal-800 transition-colors cursor-pointer"
                            >
                              {copiedPitch ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                              <span>{copiedPitch ? 'Copiado' : 'Copiar Pitch'}</span>
                            </button>
                            <Button
                              type="button"
                              onClick={handleApplyAiStrategy}
                              className="h-7.5 px-3 rounded-lg text-[11px] font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-2xs gap-1.5 cursor-pointer transition-all"
                            >
                              <Zap className="h-3 w-3 text-amber-300" />
                              <span>Aplicar Recomendación a la Oferta</span>
                            </Button>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-700 dark:text-slate-300 italic bg-slate-50/80 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 leading-relaxed font-sans">
                          "{aiStrategy.persuasiveSalesPitch}"
                        </p>

                        {aiStrategy.strategyReason && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                            💡 <strong>Criterio Comercial:</strong> {aiStrategy.strategyReason}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Banner solicitud original del paciente */}
                {ultimaSolicitud && (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 shrink-0">
                        <Stethoscope className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                          Servicio Solicitado en BUYER
                        </span>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {ultimaSolicitud.Servicio?.nombre || 'Servicio Odontológico Integral'}
                        </p>
                        {ultimaSolicitud.motivo && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 italic">
                            "{ultimaSolicitud.motivo}"
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Diseñar oferta comercial / promoción */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white text-[10px] font-bold">2</span>
                      Diseñar Oferta Comercial / Promoción
                    </h3>
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/60 flex items-center gap-1">
                      <Timer className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      Válida hasta: {format(calculatedExpiry, 'dd/MM/yyyy')}
                    </span>
                  </div>

                  <div className="space-y-4 p-4 bg-white dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/90 rounded-2xl shadow-sm">

                    {/* A. Margen de Vigencia Activo de la Promoción */}
                    <div className="p-3 rounded-xl bg-slate-50/90 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/70 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Timer className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                          Margen de Vigencia Activo de la Oferta:
                        </Label>
                        <span className="text-[11px] font-bold text-teal-700 dark:text-teal-300">
                          {getVigenciaLabel(altVigencia, altVigenciaCustom)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setAltVigencia('24h')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${altVigencia === '24h'
                              ? 'bg-amber-600 text-white shadow-2xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                            }`}
                        >
                          <Zap className="w-3 h-3 text-amber-400" />
                          24 Horas (Flash)
                        </button>

                        <button
                          type="button"
                          onClick={() => setAltVigencia('48h')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${altVigencia === '48h'
                              ? 'bg-teal-600 text-white shadow-2xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                            }`}
                        >
                          <Sparkles className="w-3 h-3 text-teal-300" />
                          48 Horas (Recomendado)
                        </button>

                        <button
                          type="button"
                          onClick={() => setAltVigencia('72h')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${altVigencia === '72h'
                              ? 'bg-teal-600 text-white shadow-2xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                            }`}
                        >
                          <Calendar className="w-3 h-3" />
                          72 Horas (3 Días)
                        </button>

                        <button
                          type="button"
                          onClick={() => setAltVigencia('7d')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${altVigencia === '7d'
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                            }`}
                        >
                          <Tag className="w-3 h-3" />
                          7 Días (Campaña Semanal)
                        </button>

                        <button
                          type="button"
                          onClick={() => setAltVigencia('custom')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${altVigencia === 'custom'
                              ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-2xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                            }`}
                        >
                          Personalizado
                        </button>
                      </div>

                      {altVigencia === 'custom' && (
                        <div className="pt-1.5 flex items-center gap-2">
                          <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Fecha límite de la oferta:</Label>
                          <input
                            type="date"
                            className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 px-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                            value={altVigenciaCustom}
                            onChange={(e) => setAltVigenciaCustom(e.target.value)}
                          />
                        </div>
                      )}
                    </div>

                    {/* B. Servicio, Sede y Especialista de Referencia */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Servicio Ofertado</Label>
                        <Select
                          onValueChange={(v) => {
                            setAltServicioId(v);
                            const serv = catalogs.servicios?.find((s: any) => s.id_servicio.toString() === v);
                            const baseP = Number(serv?.Tarifas?.[0]?.precio || 180);
                            if (isStudent) {
                              setAltPrecio(Math.round(baseP * 0.85).toFixed(2));
                            } else {
                              setAltPrecio(baseP.toFixed(2));
                            }
                          }}
                          value={altServicioId}
                        >
                          <SelectTrigger className="h-9 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium [&>span]:text-slate-900 dark:[&>span]:text-slate-100">
                            <SelectValue placeholder="Seleccionar servicio..." />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                            {catalogs.servicios?.map((s: any) => (
                              <SelectItem key={s.id_servicio} value={s.id_servicio.toString()} className="text-xs text-slate-900 dark:text-slate-100">
                                {s.nombre} {s.Tarifas?.[0]?.precio ? `(S/ ${Number(s.Tarifas[0].precio).toFixed(2)})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {offerErrors.servicio && <p className="text-[10px] text-rose-500">{offerErrors.servicio}</p>}
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Sede Preferencial</Label>
                        <Select onValueChange={(v) => setAltSedeId(v)} value={altSedeId}>
                          <SelectTrigger className="h-9 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium [&>span]:text-slate-900 dark:[&>span]:text-slate-100">
                            <SelectValue placeholder="Todas las sedes..." />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                            <SelectItem value="ALL_SEDES" className="font-semibold text-slate-900 dark:text-slate-100">Todas las sedes (A elección)</SelectItem>
                            {catalogs.sedes?.map((s: any) => (
                              <SelectItem key={s.id_sede} value={s.id_sede.toString()} className="text-slate-900 dark:text-slate-100">
                                {s.nombre} {s.direccion ? `- ${s.direccion}` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Especialista Sugerido</Label>
                        <Select onValueChange={(v) => setAltProfesionalId(v)} value={altProfesionalId}>
                          <SelectTrigger className="h-9 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium [&>span]:text-slate-900 dark:[&>span]:text-slate-100">
                            <SelectValue placeholder="Cualquier especialista..." />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                            <SelectItem value="ALL_PROFESSIONALS" className="font-semibold text-slate-900 dark:text-slate-100">Cualquier especialista colegiado</SelectItem>
                            {catalogs.profesionales?.map((p: any) => (
                              <SelectItem key={p.id_profesional} value={p.id_profesional.toString()} className="text-slate-900 dark:text-slate-100">
                                Esp. {p.nombres} {p.apellidos}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* C. Franja Horaria Sugerida para la Promoción & Personalización */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                          Franja Horaria o Turno de la Promoción
                        </Label>
                        {isCustomHorario && (
                          <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md border border-teal-200 dark:border-teal-800">
                            Personalizado
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        {/* 1. Turno Mañana (adaptado a hora inicial de la clínica) */}
                        <button
                          type="button"
                          onClick={() => {
                            const val = `Turno Mañana (${openTime} – 01:00 PM)`;
                            setAltFranja(val);
                            setIsCustomHorario(false);
                            setCustomHorarioText(val);
                          }}
                          className={`p-2.5 rounded-xl text-[11px] font-semibold text-left border transition-all ${!isCustomHorario && altFranja.startsWith('Turno Mañana')
                              ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-600 dark:border-teal-500 text-teal-900 dark:text-teal-200 shadow-2xs ring-1 ring-teal-500'
                              : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-teal-300'
                            }`}
                        >
                          <span className="block font-bold text-teal-700 dark:text-teal-300">🌅 Turno Mañana</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{openTime} – 01:00 PM</span>
                        </button>

                        {/* 2. Turno Tarde */}
                        <button
                          type="button"
                          onClick={() => {
                            const val = 'Turno Tarde (01:00 PM – 06:00 PM)';
                            setAltFranja(val);
                            setIsCustomHorario(false);
                            setCustomHorarioText(val);
                          }}
                          className={`p-2.5 rounded-xl text-[11px] font-semibold text-left border transition-all ${!isCustomHorario && altFranja.startsWith('Turno Tarde')
                              ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-600 dark:border-teal-500 text-teal-900 dark:text-teal-200 shadow-2xs ring-1 ring-teal-500'
                              : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-teal-300'
                            }`}
                        >
                          <span className="block font-bold text-teal-700 dark:text-teal-300">☀️ Turno Tarde</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">01:00 PM – 06:00 PM</span>
                        </button>

                        {/* 3. Turno Noche (adaptado a hora final de la clínica) */}
                        <button
                          type="button"
                          onClick={() => {
                            const val = `Turno Noche (06:00 PM – ${closeTime})`;
                            setAltFranja(val);
                            setIsCustomHorario(false);
                            setCustomHorarioText(val);
                          }}
                          className={`p-2.5 rounded-xl text-[11px] font-semibold text-left border transition-all ${!isCustomHorario && altFranja.startsWith('Turno Noche')
                              ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-600 dark:border-teal-500 text-teal-900 dark:text-teal-200 shadow-2xs ring-1 ring-teal-500'
                              : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-teal-300'
                            }`}
                        >
                          <span className="block font-bold text-teal-700 dark:text-teal-300">🌙 Turno Noche</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">06:00 PM – {closeTime}</span>
                        </button>

                        {/* 4. Turno Personalizado Interactivo */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomHorario(true);
                            const val = `Turno Personalizado (${customStartHour} – ${customEndHour})`;
                            setAltFranja(val);
                            setCustomHorarioText(val);
                          }}
                          className={`p-2.5 rounded-xl text-[11px] font-semibold text-left border transition-all ${isCustomHorario
                              ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-600 dark:border-teal-500 text-teal-900 dark:text-teal-200 shadow-2xs ring-1 ring-teal-500'
                              : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-teal-300'
                            }`}
                        >
                          <span className="block font-bold text-teal-700 dark:text-teal-300">⚙️ Personalizado</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                            {isCustomHorario ? `${customStartHour} – ${customEndHour}` : 'Elegir horario'}
                          </span>
                        </button>
                      </div>

                      {/* Selector Interactivo de Horario Personalizado (Sin escribir, solo clics rápidos) */}
                      {isCustomHorario && (
                        <div className="p-3 bg-teal-50/40 dark:bg-teal-950/20 border border-teal-200/70 dark:border-teal-800/60 rounded-xl space-y-2.5 animate-in fade-in-50 duration-200">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                              Configuración Rápida de Horario Personalizado:
                            </span>
                            <span className="text-[10px] text-teal-800 dark:text-teal-300 font-bold font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                              {customStartHour} a {customEndHour}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {/* Selector Hora Inicio */}
                            <div className="space-y-1">
                              <label className="text-[10.5px] font-semibold text-slate-600 dark:text-slate-300">
                                Hora de Inicio:
                              </label>
                              <Select
                                value={customStartHour}
                                onValueChange={(val) => {
                                  setCustomStartHour(val);
                                  const newFranja = `Turno Personalizado (${val} – ${customEndHour})`;
                                  setCustomHorarioText(newFranja);
                                  setAltFranja(newFranja);
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-900 border-teal-200 dark:border-teal-800 rounded-lg">
                                  <SelectValue placeholder="Hora de inicio" />
                                </SelectTrigger>
                                <SelectContent className="max-h-56 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                  {TIME_OPTIONS.map((time) => (
                                    <SelectItem key={`modal-start-${time}`} value={time} className="text-xs">
                                      {time}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Selector Hora Fin */}
                            <div className="space-y-1">
                              <label className="text-[10.5px] font-semibold text-slate-600 dark:text-slate-300">
                                Hora de Fin / Cierre:
                              </label>
                              <Select
                                value={customEndHour}
                                onValueChange={(val) => {
                                  setCustomEndHour(val);
                                  const newFranja = `Turno Personalizado (${customStartHour} – ${val})`;
                                  setCustomHorarioText(newFranja);
                                  setAltFranja(newFranja);
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-900 border-teal-200 dark:border-teal-800 rounded-lg">
                                  <SelectValue placeholder="Hora de fin" />
                                </SelectTrigger>
                                <SelectContent className="max-h-56 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                  {TIME_OPTIONS.map((time) => (
                                    <SelectItem key={`modal-end-${time}`} value={time} className="text-xs">
                                      {time}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Chips Rápidos de 1 Clic */}
                          <div className="pt-1 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Atajos rápidos:</span>
                            {[
                              { label: 'Todo el Día', start: openTime, end: closeTime },
                              { label: 'Mañana Extendida', start: '08:00 AM', end: '03:00 PM' },
                              { label: 'Tarde y Noche', start: '01:00 PM', end: '09:00 PM' },
                              { label: 'Sábados Exclusivo', start: '08:00 AM', end: '02:00 PM' },
                              { label: 'Flexible / A Elección', fullText: 'Horario Flexible (A elección del paciente al confirmar)' },
                            ].map((preset) => (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => {
                                  if (preset.fullText) {
                                    setCustomHorarioText(preset.fullText);
                                    setAltFranja(preset.fullText);
                                  } else if (preset.start && preset.end) {
                                    setCustomStartHour(preset.start);
                                    setCustomEndHour(preset.end);
                                    const val = `Turno Personalizado (${preset.start} – ${preset.end})`;
                                    setCustomHorarioText(val);
                                    setAltFranja(val);
                                  }
                                }}
                                className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 hover:bg-teal-100/60 transition-colors shadow-2xs"
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* D. Comparador Financiero en Vivo & Descuentos Rápidos */}
                    <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/70 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            Tarifa de Negociación y Descuentos Rápidos
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mr-1">Aplicar:</span>
                          <button
                            type="button"
                            onClick={() => applyQuickDiscount(15, 'CAMPANA')}
                            className="px-2 py-1 rounded-lg text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-200 transition-colors flex items-center gap-1"
                            title="Descuento promocional (-15%)"
                          >
                            <GraduationCap className="w-3 h-3" />
                            Promoción (-15%)
                          </button>
                          <button
                            type="button"
                            onClick={() => applyQuickDiscount(20, 'CAMPANA')}
                            className="px-2 py-1 rounded-lg text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:bg-amber-200 transition-colors flex items-center gap-1"
                            title="Descuento especial por pronto pago o campaña (-20%)"
                          >
                            <Zap className="w-3 h-3" />
                            Campaña (-20%)
                          </button>
                          <button
                            type="button"
                            onClick={() => applyQuickDiscount(0, 'REGULAR')}
                            className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 transition-colors"
                            title="Precio de lista oficial 100%"
                          >
                            Tarifa Regular
                          </button>
                        </div>
                      </div>

                      {/* Resumen Comparativo de Precio */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                        <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex flex-col">
                          <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Precio de Lista Oficial</span>
                          <span className="text-sm font-bold text-slate-600 dark:text-slate-400 line-through">
                            S/ {currentOfficialPrice.toFixed(2)}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 flex flex-col">
                          <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300 uppercase">Precio Ofertado al Paciente</span>
                          <span className="text-sm font-extrabold text-teal-700 dark:text-teal-300 font-mono">
                            S/ {numericOfferPrice.toFixed(2)}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-col">
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">Ahorro para el Paciente</span>
                          <div className="flex items-center gap-1">
                            <TrendingDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                              S/ {discountMetrics.saving.toFixed(2)} ({discountMetrics.pct}% OFF)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* E. Precio editable y condiciones */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1">
                        <Label className={`text-[11px] font-medium ${offerErrors.precio ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'}`}>Precio ofrecido editable (S/)</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                          <input
                            type="number"
                            step="0.5"
                            className={`flex h-9 w-full rounded-xl border pl-7 pr-3 text-xs text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-1 font-semibold ${offerErrors.precio ? '!border-rose-500 !ring-1 !ring-rose-500' : 'border-slate-200 dark:border-slate-700 focus:ring-teal-500'}`}
                            value={altPrecio}
                            onChange={(e) => {
                              setAltPrecio(e.target.value);
                              if (offerErrors.precio) setOfferErrors(p => ({ ...p, precio: '' }));
                            }}
                          />
                        </div>
                        {offerErrors.precio && <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{offerErrors.precio}</p>}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Condición / Beneficio adicional</Label>
                        <input
                          type="text"
                          className="flex h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                          placeholder="Ej. Pago en cuotas, vigencia especial..."
                          value={altCondiciones}
                          onChange={(e) => setAltCondiciones(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button onClick={handleAddAlternative} disabled={addingAlternative} className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs h-9 px-5 shadow-sm font-semibold">
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        {addingAlternative ? 'Registrando...' : 'Añadir Oferta al Tablero'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 3. Tablero de ofertas comerciales activas */}
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white text-[10px] font-bold">3</span>
                    Ofertas Comerciales sobre la Mesa (Selecciona una para enviar o cerrar trato)
                  </h3>

                  {opciones.length === 0 ? (
                    <div className="py-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30">
                      <p className="text-xs text-slate-400 dark:text-slate-500">Aún no se han generado ofertas comerciales para este paciente.</p>
                      <p className="text-[11px] text-slate-300 dark:text-slate-600 mt-1">Usa el formulario superior para construir una propuesta atractiva con vigencia.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {opciones.map((opt: any) => {
                        const optPrice = Number(opt.precio_ofrecido);
                        const offerInfo = getActiveOfferDetails();
                        const optDiscount = offerInfo.precioOriginal > 0 && optPrice < offerInfo.precioOriginal
                          ? Math.round(((offerInfo.precioOriginal - optPrice) / offerInfo.precioOriginal) * 100)
                          : 0;

                        return (
                        <div
                          key={opt.id_opcion}
                          onClick={() => setSelectedOpcion(opt.id_opcion)}
                          className={`relative p-4 border-2 rounded-2xl cursor-pointer transition-all flex flex-col justify-between gap-3 ${selectedOpcion === opt.id_opcion
                            ? 'bg-teal-50/50 dark:bg-teal-950/40 border-teal-600 dark:border-teal-500 shadow-md ring-1 ring-teal-500/30'
                            : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-600'
                            }`}
                        >
                          {selectedOpcion === opt.id_opcion && (
                            <div className="absolute -top-2.5 -right-2.5 bg-teal-600 text-white rounded-full p-1 shadow-md z-10">
                              <CheckCircle2 className="h-4 w-4" />
                            </div>
                          )}

                          {/* Fila 1 Superior: Fecha Límite a la izquierda, Etiqueta de Descuento CENTRADA, y Botones a la derecha */}
                          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/80 pb-2.5">
                            {/* Izquierda: Fecha Límite */}
                            <span className="inline-flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-200 text-xs bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 px-2.5 py-1 rounded-lg shrink-0">
                              <Clock className="h-3.5 w-3.5 text-amber-500" />
                              Válido hasta: {opt.Disponibilidad?.fecha?.split('T')[0] || 'Vigente'}
                            </span>

                            {/* Centro: Etiqueta de Descuento CENTRADA */}
                            <div className="flex-1 flex justify-center">
                              {optDiscount > 0 ? (
                                <span className="text-[11px] font-extrabold px-3 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-2xs tracking-wide">
                                  {optDiscount}% OFF
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                                  Tarifa Regular
                                </span>
                              )}
                            </div>

                            {/* Derecha: Acciones (Editar completo / Eliminar) */}
                            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                title="Editar oferta comercial (precio, descuento, sede, especialista y fecha)"
                                onClick={(e) => { e.stopPropagation(); openEditOptionModal(opt); }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950 transition border border-transparent hover:border-teal-200 dark:hover:border-teal-800"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                title="Eliminar alternativa"
                                onClick={(e) => { e.stopPropagation(); setDeletingOptionTarget(opt); }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition border border-transparent hover:border-rose-200 dark:hover:border-rose-800"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Fila 2 Central: Tarifa Ofertada separada de la fecha con espacio y caja elegante */}
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-800">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                Tarifa Ofertada
                              </span>
                              <p className={`font-mono font-black text-lg leading-tight ${selectedOpcion === opt.id_opcion ? 'text-teal-700 dark:text-teal-300' : 'text-slate-900 dark:text-white'}`}>
                                S/ {optPrice.toFixed(2)}
                              </p>
                            </div>
                            {offerInfo.precioOriginal > optPrice && (
                              <div className="text-right">
                                <span className="text-[10px] font-semibold text-slate-400 line-through block">
                                  Lista: S/ {offerInfo.precioOriginal.toFixed(2)}
                                </span>
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                  Ahorra S/ {(offerInfo.precioOriginal - optPrice).toFixed(2)}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Fila 3 Inferior: Sede y Especialista */}
                          <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                              <span className="font-medium text-slate-800 dark:text-slate-200">
                                Sede: <span className="font-semibold">{opt.Disponibilidad?.Sede?.nombre || 'Todas las sedes'}</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <User className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                              <span className="font-medium text-slate-800 dark:text-slate-200">
                                Especialista: <span className="font-semibold">{opt.Disponibilidad?.Profesional?.apellidos ? `Esp. ${opt.Disponibilidad?.Profesional?.apellidos}` : 'Por asignar'}</span>
                              </span>
                            </div>
                            {opt.condiciones && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800 leading-tight">
                                {opt.condiciones}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  )}
                </div>

                {/* ── 4. Envío de Oferta Omnicanal & Generador Gráfico Canva ── */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/90 border border-purple-200/80 dark:border-purple-900/60 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-100 dark:border-purple-900/60 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-bold">
                        4
                      </span>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        Envío de Oferta Omnicanal & Generador Canva
                      </h3>
                    </div>
                    <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-md border border-purple-200/60 dark:border-purple-800/60 flex items-center gap-1">
                      <CanvaIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      Canva Connect Autofill
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                        <MessageSquare className="w-3 h-3 text-emerald-500" />
                        Vista Previa del Mensaje para el Paciente:
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyWhatsApp}
                        className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-teal-50 dark:hover:bg-teal-950/50"
                      >
                        {copiedWhatsApp ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedWhatsApp ? '¡Copiado!' : 'Copiar texto'}
                      </button>
                    </div>

                    <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line bg-slate-50/80 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/70 font-sans leading-relaxed">
                      {generateWhatsAppMessage()}
                    </p>

                    {/* Botones de acción planos sin shadow ni botón Copiar duplicado */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <Button
                        type="button"
                        onClick={() => handleGenerateCanvaAndDispatch(false)}
                        disabled={generatingCanva}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs h-9 px-4 font-semibold flex items-center gap-2 cursor-pointer transition-all border-0 shadow-none"
                      >
                        <CanvaIcon className="w-4 h-4 shrink-0 text-white" />
                        <span>{generatingCanva ? 'Generando en Canva...' : 'Generar Flyer con Canva & Despachar'}</span>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={async () => {
                          const url = await leadService.getCanvaAuthUrl();
                          window.location.href = url;
                        }}
                        className="border border-purple-300 hover:border-purple-400 bg-purple-50 hover:bg-purple-100 text-purple-800 hover:text-purple-950 dark:bg-purple-950/60 dark:hover:bg-purple-900/80 dark:text-purple-200 dark:hover:text-white rounded-xl text-xs h-9 px-3 font-semibold flex items-center gap-1.5 shadow-none transition-colors cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        <span>Conectar Canva</span>
                      </Button>

                      <Button
                        type="button"
                        onClick={handleSendWhatsApp}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs h-9 px-3.5 font-semibold flex items-center gap-1.5 border-0 shadow-none"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>Enviar WhatsApp</span>
                      </Button>

                      <Button
                        type="button"
                        disabled={sendingEmail}
                        onClick={handleSendEmail}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs h-9 px-3.5 font-semibold flex items-center gap-1.5 border-0 shadow-none transition-all disabled:opacity-70"
                      >
                        {sendingEmail ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Enviando...</span>
                          </>
                        ) : (
                          <>
                            <Mail className="w-4 h-4" />
                            <span>Enviar Correo</span>
                          </>
                        )}
                      </Button>
                    </div>

                    {/* ── Tarjeta de Visualización y Descarga del Flyer Oficial Canva ── */}
                    <div className="mt-3 p-4 rounded-2xl bg-gradient-to-br from-purple-50/70 via-indigo-50/40 to-slate-50/70 dark:from-purple-950/40 dark:via-indigo-950/20 dark:to-slate-900/60 border border-purple-200/80 dark:border-purple-800/60 space-y-3 shadow-sm">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <CanvaIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            Flyer Publicitario Oficial Canva
                          </span>
                          {generatingCanva ? (
                            <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-100/80 dark:bg-purple-950/60 px-2 py-0.5 rounded-full flex items-center gap-1 border border-purple-300 dark:border-purple-800 animate-pulse">
                              <div className="w-2 h-2 rounded-full bg-purple-600 animate-ping" />
                              Generando en Canva...
                            </span>
                          ) : canvaResult ? (
                            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-300 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Imagen Generada
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                              Pendiente de generación
                            </span>
                          )}
                        </div>

                        {canvaResult && (
                          <div className="flex items-center gap-2">
                            <a
                              href={canvaResult.downloadPngUrl || canvaResult.previewUrl}
                              download={`Flyer_NexoSalud_${lead?.nombres || 'Oferta'}.png`}
                              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/50 flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Descargar Imagen</span>
                            </a>

                            {canvaResult.designUrl && canvaResult.designUrl !== 'https://www.canva.com/' && (
                              <a
                                href={canvaResult.designUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 transition-colors shadow-2xs"
                              >
                                <span>Abrir en Canva</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Contenedor Visual de la Imagen del Flyer con Spinner y Zoom */}
                      {generatingCanva ? (
                        <div className="py-12 px-6 flex flex-col items-center justify-center text-center space-y-3 bg-purple-50/70 dark:bg-purple-950/40 rounded-xl border border-purple-200/80 dark:border-purple-800/60 animate-in fade-in duration-200">
                          <div className="relative">
                            <div className="w-12 h-12 rounded-full border-3 border-purple-200 dark:border-purple-800 border-t-purple-600 animate-spin" />
                            <CanvaIcon className="w-5 h-5 text-purple-600 absolute inset-0 m-auto animate-pulse" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-purple-900 dark:text-purple-200">
                              Diseñando y Generando Flyer Oficial en Canva...
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Reemplazando tratamientos, tarifas y sede del paciente en alta definición.
                            </p>
                          </div>
                        </div>
                      ) : canvaResult?.previewUrl ? (
                        <div className="flex flex-col md:flex-row items-center gap-4 bg-white/90 dark:bg-slate-900/90 p-3.5 rounded-xl border border-purple-100 dark:border-purple-900/40">
                          {/* Vista previa de la Imagen del Flyer */}
                          <div className="relative group shrink-0 max-w-[260px] sm:max-w-[300px] w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-md bg-slate-950 flex items-center justify-center min-h-[300px]">
                            {flyerImageLoading && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-xs z-10 text-white gap-2">
                                <div className="w-8 h-8 rounded-full border-2 border-purple-400/40 border-t-purple-400 animate-spin" />
                                <span className="text-[10px] font-medium text-slate-200">Cargando imagen...</span>
                              </div>
                            )}
                            <img
                              src={canvaResult.previewUrl}
                              alt="Flyer Oficial Canva"
                              onLoad={() => setFlyerImageLoading(false)}
                              className={`w-full h-auto max-h-[360px] object-contain transition-transform duration-300 group-hover:scale-[1.02] cursor-pointer ${flyerImageLoading ? 'opacity-0' : 'opacity-100'}`}
                              onClick={() => setShowPreviewModal(true)}
                              title="Haz clic para abrir el visor en modal"
                            />
                            <div
                              onClick={() => setShowPreviewModal(true)}
                              className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                            >
                              <span className="text-[11px] font-bold text-white bg-slate-900/80 px-2.5 py-1 rounded-lg backdrop-blur-xs flex items-center gap-1.5 shadow-sm">
                                <ImageIcon className="w-3.5 h-3.5" /> Ver en Pantalla Completa
                              </span>
                            </div>
                          </div>

                          {/* Resumen de Datos Clave mapeados en el Flyer */}
                          <div className="flex-1 w-full space-y-2.5">
                            <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
                              <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                                Estructura Publicitaria Lista para Enviar:
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60">
                                  <span className="font-semibold text-slate-500 dark:text-slate-400 block text-[10px]">Paciente:</span>
                                  <span className="font-medium text-slate-800 dark:text-slate-200">{lead?.nombres} {lead?.apellidos}</span>
                                </div>
                                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60">
                                  <span className="font-semibold text-slate-500 dark:text-slate-400 block text-[10px]">Tratamiento Ofertado:</span>
                                  <span className="font-medium text-slate-800 dark:text-slate-200">{selectedOptData?.Disponibilidad?.Servicio?.nombre || 'Consulta Odontológica'}</span>
                                </div>
                                <div className="p-2 rounded-lg bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200/70 dark:border-purple-800/50">
                                  <span className="font-semibold text-purple-600 dark:text-purple-400 block text-[10px]">Titular IA (Máx 3 palabras):</span>
                                  <span className="font-bold text-purple-900 dark:text-purple-200">{canvaResult?.dataset?.Titulo_Flyer?.text || 'MEJOREMOS TU SONRISA'}</span>
                                </div>
                                <div className="p-2 rounded-lg bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-800/50">
                                  <span className="font-semibold text-amber-700 dark:text-amber-400 block text-[10px]">Fecha Límite Oficial:</span>
                                  <span className="font-bold text-amber-900 dark:text-amber-200">{canvaResult?.dataset?.Fecha_Limite?.text || 'Viernes, 26 de marzo'}</span>
                                </div>
                                <div className="p-2 rounded-lg bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200/70 dark:border-teal-800/50">
                                  <span className="font-semibold text-teal-600 dark:text-teal-400 block text-[10px]">Tarifa Promocional:</span>
                                  <span className="font-bold text-teal-800 dark:text-teal-200 font-mono">S/ {selectedOptData ? Number(selectedOptData.precio_ofrecido).toFixed(2) : '150.00'}</span>
                                </div>
                                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60">
                                  <span className="font-semibold text-slate-500 dark:text-slate-400 block text-[10px]">Sede de Atención:</span>
                                  <span className="font-medium text-slate-800 dark:text-slate-200">{selectedOptData?.Disponibilidad?.Sede?.nombre || 'Sede Miraflores'}</span>
                                </div>
                              </div>
                            </div>

                            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2">
                              <span>Esta imagen se adjunta automáticamente al enviar por correo y puedes compartirla directamente por WhatsApp.</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-6 px-4 rounded-xl border border-dashed border-purple-200 dark:border-purple-900/60 bg-white/50 dark:bg-slate-900/40 space-y-2">
                          <div className="flex justify-center">
                            <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
                              <CanvaIcon className="w-5 h-5" />
                            </div>
                          </div>
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                            Aún no has generado el Flyer para este paciente
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                            Presiona el botón superior <strong className="text-purple-700 dark:text-purple-300">"Generar Flyer con Canva &amp; Despachar"</strong> para crear la imagen oficial con los datos del paciente y la oferta activa.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── 5. Copiloto de Detección y Apoyo ante Objeciones ── */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-white text-[10px] font-bold">
                        5
                      </span>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                        Copiloto de Apoyo ante Objeciones
                      </h3>
                    </div>
                    <span className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md border border-teal-200/60 dark:border-teal-800/60">
                      Asistente en Vivo
                    </span>
                  </div>

                  {/* Selector de tipo de objeción */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setObjectionCategory('PRECIO')}
                      className={`text-[11px] font-semibold px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${objectionCategory === 'PRECIO'
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Objeción: "Está caro"</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setObjectionCategory('HORARIO')}
                      className={`text-[11px] font-semibold px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${objectionCategory === 'HORARIO'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Objeción: "No puedo a esa hora"</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setObjectionCategory('SEDE')}
                      className={`text-[11px] font-semibold px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${objectionCategory === 'SEDE'
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Objeción: "Me queda lejos"</span>
                    </button>
                  </div>

                  {/* Contenido contextual de la objeción seleccionada */}
                  {objectionCategory === 'PRECIO' && (
                    <div className="p-3 bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/70 rounded-xl space-y-2 text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                        Argumento & Solución Comercial:
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        Explica la garantía clínica de NexoSalud, instrumentación esterilizada y especialista colegiado. Si el paciente aún duda, aplica un descuento rápido sobre el precio oficial:
                      </p>
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => applyQuickDiscount(15, 'CAMPANA')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs h-7 px-2.5 font-medium flex items-center gap-1 border-0 shadow-none"
                        >
                          <GraduationCap className="w-3 h-3" />
                          Aplicar promoción (-15%)
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => applyQuickDiscount(15, 'CAMPANA')}
                          className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs h-7 px-2.5 font-medium flex items-center gap-1 border-0 shadow-none"
                        >
                          <Briefcase className="w-3 h-3" />
                          Aplicar promoción (-15%)
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => applyQuickDiscount(20, 'CAMPANA')}
                          className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs h-7 px-2.5 font-medium flex items-center gap-1 border-0 shadow-none"
                        >
                          <Zap className="w-3 h-3" />
                          Campaña (-20%)
                        </Button>
                        <span className="text-[10px] text-slate-400">
                          (Recuerda presionar "Añadir Oferta al Tablero" para crear la propuesta)
                        </span>
                      </div>
                    </div>
                  )}

                  {objectionCategory === 'HORARIO' && (
                    <div className="p-3 bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/70 rounded-xl space-y-2 text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        Flexibilidad Horaria & Turnos Alternos:
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        La promoción no exige una cita fija inmediata. El paciente puede elegir <strong>Horario Flexible</strong> o convenir atención en Sábados según su disponibilidad.
                      </p>
                      <Button
                        size="sm"
                        type="button"
                        onClick={() => setAltFranja('Horario Flexible (A elección del paciente al confirmar)')}
                        className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs h-7 px-2.5 font-medium border-0 shadow-none"
                      >
                        Pactar Horario Flexible
                      </Button>
                    </div>
                  )}

                  {objectionCategory === 'SEDE' && (
                    <div className="p-3 bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/70 rounded-xl space-y-2 text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                        Red de Sedes & Cobertura:
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        NexoSalud cuenta con sedes en puntos estratégicos. Cambia la sede en el selector superior para que la oferta sea válida en la sede más cercana a {lead?.zona || 'Trujillo/Lima'}.
                      </p>
                    </div>
                  )}
                </div>

                {/* ── 6. Preparación y Resumen del Paso a PAYER ── */}
                {selectedOptData && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-50/90 to-emerald-50/80 dark:from-teal-950/40 dark:to-emerald-950/30 border border-teal-200/90 dark:border-teal-800/80 shadow-sm space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="flex items-center justify-between border-b border-teal-100 dark:border-teal-900/60 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                          6
                        </span>
                        <h4 className="text-xs font-bold text-teal-950 dark:text-teal-200 uppercase tracking-wider">
                          Resumen del Trato Comercial (Paso a PAYER)
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                        Opción Seleccionada
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="bg-white/90 dark:bg-slate-900/90 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                        <span className="text-[10px] text-slate-400 font-semibold block">Vigencia Promoción</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          Hasta {selectedOptData.Disponibilidad?.fecha?.split('T')[0] || 'Vigente'}
                        </span>
                      </div>

                      <div className="bg-white/90 dark:bg-slate-900/90 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                        <span className="text-[10px] text-slate-400 font-semibold block">Sede</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {selectedOptData.Disponibilidad?.Sede?.nombre || 'Todas las sedes'}
                        </span>
                      </div>

                      <div className="bg-white/90 dark:bg-slate-900/90 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                        <span className="text-[10px] text-slate-400 font-semibold block">Especialista</span>
                        <span className="font-bold text-slate-900 dark:text-white truncate block">
                          {selectedOptData.Disponibilidad?.Profesional?.apellidos ? `Esp. ${selectedOptData.Disponibilidad?.Profesional?.apellidos}` : 'Por asignar'}
                        </span>
                      </div>

                      <div className="bg-teal-100/80 dark:bg-teal-900/60 p-2.5 rounded-xl border border-teal-300/80 dark:border-teal-700 flex flex-col justify-center">
                        <span className="text-[10px] text-teal-800 dark:text-teal-300 font-semibold block">Monto a Cobrar (PAYER)</span>
                        <span className="font-black font-mono text-base text-teal-900 dark:text-teal-100">
                          S/ {Number(selectedOptData.precio_ofrecido).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="p-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80 shrink-0 flex items-center justify-between gap-3 rounded-b-2xl">
          <Button variant="ghost" className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" onClick={onClose}>
            Pausar negociación
          </Button>
          <Button
            onClick={handleReserve}
            disabled={reserving || !selectedOpcion || !lead}
            className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-sm text-xs font-semibold px-5 py-2 h-9"
          >
            {reserving ? 'Cerrando trato...' : 'Cerrar Trato (Pasar a PAYER)'}
            {!reserving && <ArrowRight className="h-3.5 w-3.5 ml-1.5" />}
          </Button>
        </div>

        <ConfirmationDialog
          isOpen={!!deletingOptionTarget}
          onClose={() => setDeletingOptionTarget(null)}
          onConfirm={handleConfirmDeleteOption}
          isLoading={isDeletingOption}
          title="¿Remover oferta comercial del tablero?"
          description={`Se descartará la propuesta comercial seleccionada (Tarifa S/ ${Number(deletingOptionTarget?.precio_ofrecido || 0).toFixed(2)}).`}
          confirmText="Sí, Remover Oferta"
          cancelText="Conservar"
          variant="destructive"
        />
      </DialogContent>

            {/* ── Modal de Edición Completa de Oferta Comercial (Precio, Descuento, Sede, Especialista, Fecha) ── */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl z-[160] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              Editar Oferta Comercial sobre la Mesa
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveFullEdit} className="space-y-4 pt-2">
            {/* Descuento y Precio Sincronizados */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  Tarifa & Porcentaje de Descuento
                </Label>
                <span className="text-xs font-semibold text-slate-400">
                  Base: S/ {getActiveOfferDetails().precioOriginal?.toFixed(2) || currentOfficialPrice.toFixed(2)}
                </span>
              </div>

              {/* Botones de descuento rápido */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Atajo:</span>
                <button
                  type="button"
                  onClick={() => handleEditDiscountChange(15)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-colors ${
                    editDiscountPct === 15
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  -15% OFF
                </button>
                <button
                  type="button"
                  onClick={() => handleEditDiscountChange(20)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-colors ${
                    editDiscountPct === 20
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100'
                  }`}
                >
                  -20% OFF
                </button>
                <button
                  type="button"
                  onClick={() => handleEditDiscountChange(25)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-colors ${
                    editDiscountPct === 25
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100'
                  }`}
                >
                  -25% OFF
                </button>
                <button
                  type="button"
                  onClick={() => handleEditDiscountChange(0)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-colors ${
                    editDiscountPct === 0
                      ? 'bg-slate-700 text-white border-slate-700'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Regular (0%)
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    % de Descuento
                  </Label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      min="0"
                      max="90"
                      value={editDiscountPct}
                      onChange={(e) => handleEditDiscountChange(Number(e.target.value))}
                      className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                    <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Precio Ofrecido (S/)
                  </Label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="number"
                      step="0.5"
                      value={editPrice}
                      onChange={(e) => handleEditPriceChange(e.target.value)}
                      className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 pl-7 pr-3 text-xs font-mono font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sede y Especialista */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-teal-600" /> Sede
                </Label>
                <Select value={editSedeId} onValueChange={setEditSedeId}>
                  <SelectTrigger className="h-9 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium">
                    <SelectValue placeholder="Seleccionar sede..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                    {catalogs.sedes?.map((s: any) => (
                      <SelectItem key={s.id_sede} value={s.id_sede.toString()} className="text-slate-900 dark:text-slate-100 text-xs">
                        {s.nombre} {s.direccion ? `- ${s.direccion}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-teal-600" /> Especialista
                </Label>
                <Select value={editProfesionalId} onValueChange={setEditProfesionalId}>
                  <SelectTrigger className="h-9 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium">
                    <SelectValue placeholder="Seleccionar especialista..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                    {catalogs.profesionales?.map((p: any) => (
                      <SelectItem key={p.id_profesional} value={p.id_profesional.toString()} className="text-slate-900 dark:text-slate-100 text-xs">
                        Esp. {p.nombres} {p.apellidos}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Fecha Límite (Margen de Vigencia) */}
            <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Fecha Límite de Vigencia
                </Label>
                <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">
                  Margen de la Oferta
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setQuickExpiry(1)}
                  className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-amber-100 transition-colors"
                >
                  +24h (Flash)
                </button>
                <button
                  type="button"
                  onClick={() => setQuickExpiry(2)}
                  className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-amber-100 transition-colors"
                >
                  +48h (Recomendado)
                </button>
                <button
                  type="button"
                  onClick={() => setQuickExpiry(3)}
                  className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-amber-100 transition-colors"
                >
                  +72h (3 Días)
                </button>
                <button
                  type="button"
                  onClick={() => setQuickExpiry(7)}
                  className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-amber-100 transition-colors"
                >
                  +7 Días
                </button>
              </div>

              <input
                type="date"
                value={editFecha}
                onChange={(e) => setEditFecha(e.target.value)}
                className="w-full h-9 rounded-xl border border-amber-200 dark:border-amber-800/80 px-3 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Botones de Acción */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditModalOpen(false)}
                className="text-xs h-9 rounded-xl text-slate-600 dark:text-slate-400"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingEdit}
                className="bg-teal-600 hover:bg-teal-700 text-white text-xs h-9 px-4 rounded-xl font-bold shadow-md shadow-teal-600/20 flex items-center gap-1.5"
              >
                {savingEdit ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" /> Guardar Cambios
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal de Vista Previa Grande del Flyer ── */}
      <Dialog 
        open={showPreviewModal} 
        onOpenChange={(open) => {
          setShowPreviewModal(open);
          if (!open) handleResetZoomAndPan();
        }}
      >
        <DialogContent className="max-w-4xl max-h-[96vh] p-5 sm:p-6 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col items-center z-[150] overflow-hidden">
          {/* Header en Modo Claro con botones limpios y alineados */}
          <DialogHeader className="w-full flex flex-row items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <div className="w-8 h-8 rounded-xl bg-purple-50 dark:purple-950/60 border border-purple-200/80 dark:border-purple-800 flex items-center justify-center shrink-0">
                <CanvaIcon className="w-4 h-4 text-[#00C4CC]" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  Vista Previa del Flyer
                </DialogTitle>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {lead?.nombres} {lead?.apellidos}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 mr-6 shrink-0 flex-nowrap">
              {/* Botón Descargar PNG */}
              <a
                href={canvaResult?.downloadPngUrl || canvaResult?.previewUrl}
                download={`Flyer_NexoSalud_${lead?.nombres || 'Oferta'}.png`}
                className="h-9 px-4 rounded-lg bg-purple-600 hover:bg-purple-700 active:scale-[0.98] text-white text-xs font-medium inline-flex items-center justify-center gap-2 transition-all shadow-sm shadow-purple-600/20 whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>Descargar PNG</span>
              </a>

              {/* Botón Abrir en Canva con logo oficial de Canva */}
              {canvaResult?.designUrl && canvaResult.designUrl !== 'https://www.canva.com/' && (
                <a
                  href={canvaResult.designUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="h-9 px-4 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 active:scale-[0.98] text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-medium inline-flex items-center justify-center gap-2 transition-all shadow-2xs whitespace-nowrap cursor-pointer"
                >
                  <CanvaIcon className="w-4 h-4 text-[#00C4CC] shrink-0" />
                  <span>Abrir en Canva</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </a>
              )}
            </div>
          </DialogHeader>

          {/* Contenedor del Flyer con Zoom mediante Scroll y Arrastre Libre (Pan & Drag) */}
          <div 
            ref={setFlyerContainerRef}
            onWheel={handleFlyerWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onDoubleClick={() => {
              if (flyerZoom > 1 || panPosition.x !== 0 || panPosition.y !== 0) {
                handleResetZoomAndPan();
              } else {
                setFlyerZoom(1.75);
              }
            }}
            className={`relative w-full flex-1 min-h-[50vh] max-h-[75vh] flex items-center justify-center p-4 bg-slate-100/90 dark:bg-slate-950/60 border border-slate-200/90 dark:border-slate-800 rounded-2xl mt-3 overflow-hidden select-none ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            title="Usa la rueda (scroll) para zoom y arrastra con el ratón para moverte libremente"
          >
            <div 
              className="flex items-center justify-center pointer-events-none"
              style={{
                transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${flyerZoom})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 100ms ease-out',
              }}
            >
              <img
                src={canvaResult?.previewUrl}
                alt="Flyer Oficial Canva Grande"
                className="max-h-[68vh] w-auto object-contain rounded-xl shadow-xl pointer-events-none select-none"
                draggable={false}
              />
            </div>

            {/* Píldora inferior flotante pequeña y transparente */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/40 hover:bg-slate-900/60 backdrop-blur-md border border-white/15 text-[11px] font-mono text-white/90 shadow-sm transition-all select-none pointer-events-auto">
              <span>{Math.round(flyerZoom * 100)}%</span>
              {(flyerZoom !== 1 || panPosition.x !== 0 || panPosition.y !== 0) && (
                <>
                  <span className="text-white/30">|</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResetZoomAndPan();
                    }}
                    className="text-[10px] text-teal-300 hover:text-white transition-colors cursor-pointer inline-flex items-center gap-0.5"
                    title="Restablecer tamaño y posición original (100%)"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Reset</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
