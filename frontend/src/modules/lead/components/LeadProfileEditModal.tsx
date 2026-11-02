import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Target,
  HeartPulse,
  GraduationCap,
  Briefcase,
  User,
  MapPin,
  Clock,
  Sparkles,
  Save,
  Loader2,
  Check,
  AlertCircle,
  Building2,
  Stethoscope,
  ShieldAlert,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { useToast } from '@/shared/hooks/use-toast';
import { leadService } from '../services/lead.service';

interface LeadProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: any;
  leadId: string;
  options?: {
    sedes?: any[];
    profesionales?: any[];
    servicios?: any[];
  };
  onProfileUpdated: (updatedLead: any) => void;
}

export function LeadProfileEditModal({
  isOpen,
  onClose,
  lead,
  leadId,
  options,
  onProfileUpdated,
}: LeadProfileEditModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'PREFERENCIAS' | 'SALUD' | 'CONVENIOS' | 'CONTACTO'>('PREFERENCIAS');
  const [saving, setSaving] = useState(false);

  // Form State
  const [form, setForm] = useState({
    // Contacto
    nombres: '',
    apellidos: '',
    dni: '',
    numero: '',
    email: '',

    // Preferencias
    sede_preferida: '',
    id_horario: '1',
    id_modalidad: '1',
    profesional_preferido: '',

    // Salud Odontológica
    nivel_dolor: 'Ninguno',
    presenta_sensibilidad: 'No',
    sangrado_o_inflamacion: 'Ninguno',
    ultima_visita_odontologica: 'Hace 6 a 12 meses',
    tratamiento_previo: '',
    usa_aparato_o_protesis: 'Ninguno',
    condicion_atencion_especial: 'Ninguna',
    motivo_consulta: '',

    // Académicos
    estudianteAplica: false,
    universidad: '',
    carrera: '',
    ciclo: '',

    // Laborales
    laboralAplica: false,
    ocupacion: '',
    empresa: '',
    modalidadLaboral: 'Presencial',
    disponibilidadLaboral: '',
  });

  // Populate form with current lead data whenever modal opens or lead changes
  useEffect(() => {
    if (!lead || !isOpen) return;

    const persona = lead.person || lead;
    const pref = lead.Preferencias?.[0] || lead.buyer?.preferences || {};
    const salud = lead.SaludOdontologica?.[0] || lead.buyer?.saludOdontologica || {};
    const academico = lead.DatosAcademicos?.[0] || lead.buyer?.datosAcademicos || {};
    const laboral = lead.DatosLaborales?.[0] || lead.buyer?.datosLaborales || {};
    const solicitud = lead.Solicitudes?.[lead.Solicitudes.length - 1] || {};

    const hasStudentData = Boolean(academico?.universidad);
    const hasWorkData = Boolean(laboral?.empresa || laboral?.ocupacion);

    setForm({
      nombres: persona.nombres || persona.firstName || '',
      apellidos: persona.apellidos || persona.lastName || '',
      dni: persona.dni || persona.documentNumber || '',
      numero: persona.numero || persona.phone || '',
      email: persona.email || '',

      sede_preferida: pref.sede_preferida || 'Sede California',
      id_horario: pref.id_horario ? String(pref.id_horario) : '1',
      id_modalidad: pref.id_modalidad ? String(pref.id_modalidad) : '1',
      profesional_preferido: pref.profesional_preferido || '',

      nivel_dolor: salud.nivel_dolor || 'Ninguno',
      presenta_sensibilidad: salud.presenta_sensibilidad || 'No',
      sangrado_o_inflamacion: salud.sangrado_o_inflamacion || 'Ninguno',
      ultima_visita_odontologica: salud.ultima_visita_odontologica || 'Hace 6 a 12 meses',
      tratamiento_previo: salud.tratamiento_previo || '',
      usa_aparato_o_protesis: salud.usa_aparato_o_protesis || 'Ninguno',
      condicion_atencion_especial: salud.condicion_atencion_especial || 'Ninguna',
      motivo_consulta: salud.motivo_consulta || solicitud.motivo || '',

      estudianteAplica: hasStudentData,
      universidad: academico.universidad || '',
      carrera: academico.carrera || '',
      ciclo: academico.ciclo || '',

      laboralAplica: hasWorkData,
      ocupacion: laboral.ocupacion || '',
      empresa: laboral.empresa || '',
      modalidadLaboral: laboral.modalidad || 'Presencial',
      disponibilidadLaboral: laboral.disponibilidad || '',
    });
  }, [lead, isOpen]);

  const handleChange = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        nombres: form.nombres,
        apellidos: form.apellidos,
        dni: form.dni,
        numero: form.numero,
        email: form.email,

        pref_sede_preferida: form.sede_preferida,
        pref_id_horario: Number(form.id_horario) || 1,
        pref_id_modalidad: Number(form.id_modalidad) || 1,
        pref_profesional_preferido: form.profesional_preferido,

        nivel_dolor: form.nivel_dolor,
        presenta_sensibilidad: form.presenta_sensibilidad,
        sangrado_o_inflamacion: form.sangrado_o_inflamacion,
        ultima_visita_odontologica: form.ultima_visita_odontologica,
        tratamiento_previo: form.tratamiento_previo,
        usa_aparato_o_protesis: form.usa_aparato_o_protesis,
        condicion_atencion_especial: form.condicion_atencion_especial,
        motivo_consulta: form.motivo_consulta,

        estudianteAplica: form.estudianteAplica,
        universidad: form.estudianteAplica ? form.universidad : '',
        carrera: form.estudianteAplica ? form.carrera : '',
        ciclo: form.estudianteAplica ? form.ciclo : '',

        laboralAplica: form.laboralAplica,
        ocupacion: form.laboralAplica ? form.ocupacion : '',
        empresa: form.laboralAplica ? form.empresa : '',
        modalidadLaboral: form.laboralAplica ? form.modalidadLaboral : '',
        disponibilidadLaboral: form.laboralAplica ? form.disponibilidadLaboral : '',
      };

      const res = await leadService.updateLead(leadId, payload);
      const updatedData = res?.data || res;

      toast({
        title: 'Perfil de Negociación guardado',
        description: 'Se actualizaron los datos del paciente y se recalculó la estrategia de cierre.',
      });

      onProfileUpdated(updatedData);
      onClose();
    } catch (err: any) {
      console.error('Error al guardar perfil de negociación:', err);
      toast({
        title: 'Error al guardar',
        description: err.message || 'No se pudieron actualizar los datos del lead.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'PREFERENCIAS', label: 'Preferencias de Atención', icon: Target },
    { id: 'SALUD', label: 'Salud Odontológica', icon: HeartPulse },
    { id: 'CONVENIOS', label: 'Convenios (Estudio / Trabajo)', icon: GraduationCap },
    { id: 'CONTACTO', label: 'Contacto & Identidad', icon: User },
  ] as const;

  const currentTabIndex = tabs.findIndex((t) => t.id === activeTab);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !saving && !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        {/* Encabezado Profesional */}
        <div className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-teal-600/10 dark:bg-teal-500/20 p-2 text-teal-600 dark:text-teal-400">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Completar Perfil de Negociación</span>
                    <span className="text-xs font-medium text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/80 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-800/60">
                      Asesor Comercial
                    </span>
                  </DialogTitle>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Registre la información clave recopilada durante la prospección para personalizar las opciones y activar convenios.
                  </p>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Navegación por Pestañas / Pasos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-4">
            {tabs.map((tab, idx) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all text-left cursor-pointer ${
                    isActive
                      ? 'bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-400 shadow-xs ring-1 ring-slate-200 dark:ring-slate-700 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50'
                  }`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                    isActive ? 'bg-teal-600 text-white font-bold' : 'bg-slate-200 dark:bg-slate-800 text-slate-600'
                  }`}>
                    {idx + 1}
                  </span>
                  <span className="truncate">{tab.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cuerpo del Formulario con Scroll Vertical Limpio */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* TAB 1: PREFERENCIAS DE ATENCIÓN */}
          {activeTab === 'PREFERENCIAS' && (
            <div className="space-y-4">
              <div className="rounded-lg bg-teal-50/50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/50 p-3 text-xs text-teal-800 dark:text-teal-300">
                <p className="font-semibold flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-teal-600 shrink-0" />
                  Preferencias declaradas por el prospecto
                </p>
                <p className="mt-0.5 text-slate-600 dark:text-slate-400">
                  Defina la sede, disponibilidad de franja y profesional de preferencia para formular alternativas con alta probabilidad de aceptación.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="sede_preferida" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Sede Preferida
                  </Label>
                  <Select
                    value={form.sede_preferida}
                    onValueChange={(val) => handleChange('sede_preferida', val)}
                  >
                    <SelectTrigger id="sede_preferida" className="text-xs">
                      <SelectValue placeholder="Seleccione una sede..." />
                    </SelectTrigger>
                    <SelectContent>
                      {options?.sedes && options.sedes.length > 0 ? (
                        options.sedes.map((s: any) => (
                          <SelectItem key={s.id_sede || s.nombre} value={s.nombre}>
                            {s.nombre} {s.direccion ? `(${s.direccion})` : ''}
                          </SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="Sede California">Sede California (Av. Larco 820)</SelectItem>
                          <SelectItem value="Sede El Golf">Sede El Golf (Av. El Golf 540)</SelectItem>
                          <SelectItem value="Sede Centro Historico">Sede Centro Histórico (Jr. Pizarro 456)</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="id_horario" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Franja Horaria Preferida
                  </Label>
                  <Select
                    value={form.id_horario}
                    onValueChange={(val) => handleChange('id_horario', val)}
                  >
                    <SelectTrigger id="id_horario" className="text-xs">
                      <SelectValue placeholder="Seleccione franja..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Mañana (08:00 AM - 12:00 PM)</SelectItem>
                      <SelectItem value="2">Mediodía (12:00 PM - 03:00 PM)</SelectItem>
                      <SelectItem value="3">Tarde (03:00 PM - 07:00 PM)</SelectItem>
                      <SelectItem value="4">Noche (07:00 PM - 09:00 PM)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="id_modalidad" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Modalidad de Atención
                  </Label>
                  <Select
                    value={form.id_modalidad}
                    onValueChange={(val) => handleChange('id_modalidad', val)}
                  >
                    <SelectTrigger id="id_modalidad" className="text-xs">
                      <SelectValue placeholder="Seleccione modalidad..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Presencial en Consultorio</SelectItem>
                      <SelectItem value="2">Teleorientación / Virtual Previa</SelectItem>
                      <SelectItem value="3">Evaluación a Domicilio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="profesional_preferido" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Odontólogo o Especialista Preferido
                  </Label>
                  <Select
                    value={form.profesional_preferido || 'INDIFERENTE'}
                    onValueChange={(val) => handleChange('profesional_preferido', val === 'INDIFERENTE' ? '' : val)}
                  >
                    <SelectTrigger id="profesional_preferido" className="text-xs">
                      <SelectValue placeholder="Cualquier profesional disponible..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INDIFERENTE">Indiferente / Sin preferencia</SelectItem>
                      {options?.profesionales && options.profesionales.length > 0 ? (
                        options.profesionales.map((p: any) => (
                          <SelectItem
                            key={p.id_profesional || p.apellidos}
                            value={`Dr. ${p.nombres || ''} ${p.apellidos}`.trim()}
                          >
                            Dr. {p.nombres} {p.apellidos}
                          </SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="Dr. Carlos Mendoza">Dr. Carlos Mendoza Ríos</SelectItem>
                          <SelectItem value="Dra. Lucía Vargas">Dra. Lucía Vargas Paredes</SelectItem>
                          <SelectItem value="Dr. Andrés Salazar">Dr. Andrés Salazar Luna</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SALUD ODONTOLÓGICA & GATILLADORES */}
          {activeTab === 'SALUD' && (
            <div className="space-y-4">
              <div className="rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 p-3 text-xs text-rose-800 dark:text-rose-300">
                <p className="font-semibold flex items-center gap-1.5">
                  <HeartPulse className="h-4 w-4 text-rose-600 shrink-0" />
                  Gatilladores Clínicos de Decisión
                </p>
                <p className="mt-0.5 text-slate-600 dark:text-slate-400">
                  El nivel de dolor o fobia dental son determinantes para argumentar la urgencia y el alivio inmediato durante la llamada o chat de negociación.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="nivel_dolor" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Nivel de Dolor Reportado
                  </Label>
                  <Select
                    value={form.nivel_dolor}
                    onValueChange={(val) => handleChange('nivel_dolor', val)}
                  >
                    <SelectTrigger id="nivel_dolor" className="text-xs">
                      <SelectValue placeholder="Seleccione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ninguno">Ninguno (Consulta electiva o chequeo)</SelectItem>
                      <SelectItem value="Leve">Leve (Molestia intermitente)</SelectItem>
                      <SelectItem value="Moderado">Moderado (Dificulta masticar)</SelectItem>
                      <SelectItem value="Agudo">Agudo / Urgente (Dolor constante intenso)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="presenta_sensibilidad" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Sensibilidad Térmica (Frío / Calor / Dulce)
                  </Label>
                  <Select
                    value={form.presenta_sensibilidad}
                    onValueChange={(val) => handleChange('presenta_sensibilidad', val)}
                  >
                    <SelectTrigger id="presenta_sensibilidad" className="text-xs">
                      <SelectValue placeholder="Seleccione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="No">No presenta</SelectItem>
                      <SelectItem value="Leve">Leve o pasajera</SelectItem>
                      <SelectItem value="Moderada">Moderada</SelectItem>
                      <SelectItem value="Alta">Alta / Punzante</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sangrado_o_inflamacion" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Sangrado o Inflamación de Encías
                  </Label>
                  <Select
                    value={form.sangrado_o_inflamacion}
                    onValueChange={(val) => handleChange('sangrado_o_inflamacion', val)}
                  >
                    <SelectTrigger id="sangrado_o_inflamacion" className="text-xs">
                      <SelectValue placeholder="Seleccione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ninguno">Ninguno</SelectItem>
                      <SelectItem value="Ocasional">Ocasional al cepillarse</SelectItem>
                      <SelectItem value="Frecuente">Frecuente o espontáneo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="condicion_atencion_especial" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Fobia Dental / Ansiedad Clínica
                  </Label>
                  <Select
                    value={form.condicion_atencion_especial}
                    onValueChange={(val) => handleChange('condicion_atencion_especial', val)}
                  >
                    <SelectTrigger id="condicion_atencion_especial" className="text-xs">
                      <SelectValue placeholder="Seleccione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ninguna">Ninguna / Paciente tranquilo</SelectItem>
                      <SelectItem value="Miedo al taladro / agujas">Fobia al instrumental o anestesia</SelectItem>
                      <SelectItem value="Ansiedad dental generalizada">Ansiedad dental moderada</SelectItem>
                      <SelectItem value="Condición médica preexistente">Condición médica especial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ultima_visita_odontologica" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Última Visita Odontológica
                  </Label>
                  <Select
                    value={form.ultima_visita_odontologica}
                    onValueChange={(val) => handleChange('ultima_visita_odontologica', val)}
                  >
                    <SelectTrigger id="ultima_visita_odontologica" className="text-xs">
                      <SelectValue placeholder="Seleccione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Menos de 6 meses">Menos de 6 meses</SelectItem>
                      <SelectItem value="Hace 6 a 12 meses">Hace 6 a 12 meses</SelectItem>
                      <SelectItem value="Hace más de 1 año">Hace más de 1 año</SelectItem>
                      <SelectItem value="Más de 3 años o nunca">Más de 3 años o nunca</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="usa_aparato_o_protesis" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Aparatos o Prótesis Actuales
                  </Label>
                  <Select
                    value={form.usa_aparato_o_protesis}
                    onValueChange={(val) => handleChange('usa_aparato_o_protesis', val)}
                  >
                    <SelectTrigger id="usa_aparato_o_protesis" className="text-xs">
                      <SelectValue placeholder="Seleccione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ninguno">Ninguno</SelectItem>
                      <SelectItem value="Brackets en curso">Brackets en curso</SelectItem>
                      <SelectItem value="Prótesis removible">Prótesis removible</SelectItem>
                      <SelectItem value="Férula de descarga nocturna">Férula de descarga / bruxismo</SelectItem>
                      <SelectItem value="Corona o puente">Corona o puente fijo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <Label htmlFor="motivo_consulta" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Motivo de Consulta y Explicación del Paciente
                </Label>
                <Input
                  id="motivo_consulta"
                  value={form.motivo_consulta}
                  onChange={(e) => handleChange('motivo_consulta', e.target.value)}
                  placeholder="ej. Dolor en molar superior derecho al masticar, desea revisión urgente"
                  className="text-xs"
                />
              </div>
            </div>
          )}

          {/* TAB 3: CONVENIOS (ESTUDIO / TRABAJO) */}
          {activeTab === 'CONVENIOS' && (
            <div className="space-y-5">
              <div className="rounded-lg bg-sky-50/50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/50 p-3 text-xs text-sky-800 dark:text-sky-300">
                <p className="font-semibold flex items-center gap-1.5">
                  <GraduationCap className="h-4 w-4 text-sky-600 shrink-0" />
                  Activación de Convenios y Descuentos Institucionales
                </p>
                <p className="mt-0.5 text-slate-600 dark:text-slate-400">
                  Identificar a estudiantes universitarios de Trujillo (UCV, UPN, UNT, UPAO) o colaboradores de empresas aliadas permite justificar tarifas reducidas (hasta -15%) de forma transparente.
                </p>
              </div>

              {/* Subsección: Convenio Estudiantil */}
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-white dark:bg-slate-900/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-sky-600" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        Convenio Estudiantil (15% OFF Tarifa Oficial)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Aplica para estudiantes universitarios o de institutos acreditados.
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.estudianteAplica}
                      onChange={(e) => handleChange('estudianteAplica', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
                  </label>
                </div>

                {form.estudianteAplica && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-600 dark:text-slate-400">Universidad / Instituto</Label>
                      <Select
                        value={form.universidad}
                        onValueChange={(val) => handleChange('universidad', val)}
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue placeholder="Seleccione institución..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Universidad César Vallejo (UCV)">UCV - Universidad César Vallejo</SelectItem>
                          <SelectItem value="Universidad Privada del Norte (UPN)">UPN - Univ. Privada del Norte</SelectItem>
                          <SelectItem value="Universidad Nacional de Trujillo (UNT)">UNT - Univ. Nacional de Trujillo</SelectItem>
                          <SelectItem value="Universidad Privada Antenor Orrego (UPAO)">UPAO - Univ. Antenor Orrego</SelectItem>
                          <SelectItem value="TECSUP Trujillo">TECSUP Trujillo</SelectItem>
                          <SelectItem value="SENATI Trujillo">SENATI Trujillo</SelectItem>
                          <SelectItem value="Otra Institución">Otra Institución</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-600 dark:text-slate-400">Carrera</Label>
                      <Input
                        value={form.carrera}
                        onChange={(e) => handleChange('carrera', e.target.value)}
                        placeholder="ej. Medicina, Derecho, Ing. Sistemas"
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-600 dark:text-slate-400">Ciclo / Nivel</Label>
                      <Input
                        value={form.ciclo}
                        onChange={(e) => handleChange('ciclo', e.target.value)}
                        placeholder="ej. 5to Ciclo"
                        className="text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Subsección: Perfil Laboral */}
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-white dark:bg-slate-900/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-emerald-600" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        Perfil Laboral / Convenio Corporativo
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Ocupación, empresa empleadora y flexibilidad horaria del paciente.
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.laboralAplica}
                      onChange={(e) => handleChange('laboralAplica', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {form.laboralAplica && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-600 dark:text-slate-400">Ocupación / Cargo</Label>
                      <Input
                        value={form.ocupacion}
                        onChange={(e) => handleChange('ocupacion', e.target.value)}
                        placeholder="ej. Analista Contable, Docente, Asesor Comercial"
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-600 dark:text-slate-400">Empresa o Institución</Label>
                      <Input
                        value={form.empresa}
                        onChange={(e) => handleChange('empresa', e.target.value)}
                        placeholder="ej. Danper, BCP Trujillo, GORE La Libertad"
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-600 dark:text-slate-400">Modalidad de Trabajo</Label>
                      <Select
                        value={form.modalidadLaboral}
                        onValueChange={(val) => handleChange('modalidadLaboral', val)}
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue placeholder="Seleccione modalidad..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Presencial">Presencial</SelectItem>
                          <SelectItem value="Remoto">Remoto / Home Office</SelectItem>
                          <SelectItem value="Híbrido">Híbrido</SelectItem>
                          <SelectItem value="Independiente">Independiente / Autónomo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-600 dark:text-slate-400">Disponibilidad según Trabajo</Label>
                      <Input
                        value={form.disponibilidadLaboral}
                        onChange={(e) => handleChange('disponibilidadLaboral', e.target.value)}
                        placeholder="ej. Disponible a partir de las 6:30 PM o Sábados"
                        className="text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: CONTACTO & IDENTIDAD */}
          {activeTab === 'CONTACTO' && (
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-100 dark:bg-slate-800/60 p-3 text-xs text-slate-700 dark:text-slate-300">
                <p className="font-semibold flex items-center gap-1.5">
                  <User className="h-4 w-4 text-slate-600 dark:text-slate-400 shrink-0" />
                  Datos de Contacto y Filiación del Paciente
                </p>
                <p className="mt-0.5 text-slate-500">
                  Verifique que el número de teléfono móvil sea correcto para el despacho de recordatorios y confirmación vía WhatsApp.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="nombres" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Nombres
                  </Label>
                  <Input
                    id="nombres"
                    value={form.nombres}
                    onChange={(e) => handleChange('nombres', e.target.value)}
                    placeholder="Nombres del paciente"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="apellidos" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Apellidos
                  </Label>
                  <Input
                    id="apellidos"
                    value={form.apellidos}
                    onChange={(e) => handleChange('apellidos', e.target.value)}
                    placeholder="Apellidos del paciente"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dni" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Documento Nacional de Identidad (DNI)
                  </Label>
                  <Input
                    id="dni"
                    value={form.dni}
                    onChange={(e) => handleChange('dni', e.target.value)}
                    placeholder="8 dígitos"
                    maxLength={8}
                    className="text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="numero" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Teléfono Móvil / WhatsApp
                  </Label>
                  <Input
                    id="numero"
                    value={form.numero}
                    onChange={(e) => handleChange('numero', e.target.value)}
                    placeholder="+51 9XXXXXXXX"
                    className="text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Correo Electrónico
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="paciente@ejemplo.com"
                    className="text-xs"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pie de Página con Botones de Navegación y Guardado */}
        <div className="bg-slate-50 dark:bg-slate-950/70 border-t border-slate-200 dark:border-slate-800 px-6 py-3.5 flex items-center justify-between">
          <div>
            {currentTabIndex > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveTab(tabs[currentTabIndex - 1].id)}
                disabled={saving}
                className="text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                Anterior
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={saving}
              className="text-xs"
            >
              Cancelar
            </Button>

            {currentTabIndex < tabs.length - 1 ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setActiveTab(tabs[currentTabIndex + 1].id)}
                className="text-xs bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
              >
                Siguiente
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            ) : null}

            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="text-xs bg-[#0f766e] hover:bg-[#0d655e] text-white shadow-xs font-semibold"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Guardando Perfil...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  Guardar Perfil de Negociación
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
