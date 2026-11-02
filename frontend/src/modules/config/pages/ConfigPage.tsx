import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { useToast } from '@/shared/hooks/use-toast';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { configService } from '../services/config.service';
import type {
  EmpresaConfig,
  ServicioConfig,
  SedeConfig,
  ProfesionalConfig,
  CanalConfig,
  FuenteConfig,
  UsuarioConfig,
  RolConfig,
} from '../services/config.service';
import {
  Building2,
  Stethoscope,
  MapPin,
  UserCheck,
  Radio,
  Users,
  Plus,
  Edit2,
  Save,
  Loader2,
  Sparkles,
  Phone,
  Mail,
  FileText,
  Clock,
  Globe,
  ShieldCheck,
  Search,
  Check,
  ChevronLeft,
  ChevronRight,
  UserPlus,
} from 'lucide-react';

type TabKey = 'empresa' | 'servicios' | 'sedes' | 'profesionales' | 'canales' | 'usuarios';

export default function ConfigPage() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs: TabKey[] = ['empresa', 'servicios', 'sedes', 'profesionales', 'canales', 'usuarios'];
  const tabParam = searchParams.get('tab') as TabKey | null;
  const [activeTab, setActiveTabState] = useState<TabKey>(
    tabParam && validTabs.includes(tabParam) ? tabParam : 'empresa'
  );

  useEffect(() => {
    const nextTab = searchParams.get('tab') as TabKey | null;
    if (nextTab && validTabs.includes(nextTab) && nextTab !== activeTab) {
      setActiveTabState(nextTab);
    }
  }, [searchParams, activeTab]);

  const setActiveTab = (tab: TabKey) => {
    setActiveTabState(tab);
    setSearchParams({ tab }, { replace: true });
  };
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // Estados de datos
  const [empresa, setEmpresa] = useState<EmpresaConfig | null>(null);
  const [servicios, setServicios] = useState<ServicioConfig[]>([]);
  const [sedes, setSedes] = useState<SedeConfig[]>([]);
  const [profesionales, setProfesionales] = useState<ProfesionalConfig[]>([]);
  const [canales, setCanales] = useState<CanalConfig[]>([]);
  const [fuentes, setFuentes] = useState<FuenteConfig[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioConfig[]>([]);
  const [roles, setRoles] = useState<RolConfig[]>([]);

  // Paginación (9 elementos por página)
  const ITEMS_PER_PAGE = 9;
  const [serviciosPage, setServiciosPage] = useState(1);
  const [sedesPage, setSedesPage] = useState(1);
  const [profesionalesPage, setProfesionalesPage] = useState(1);
  const [usuariosPage, setUsuariosPage] = useState(1);

  // Modales
  const [servicioModalOpen, setServicioModalOpen] = useState(false);
  const [editingServicio, setEditingServicio] = useState<ServicioConfig | null>(null);
  const [servicioForm, setServicioForm] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
    descuentoMaximo: 15,
    serviciosRelacionadosIds: [] as number[],
  });

  // Modal Asignar Especialistas a un Tratamiento
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [targetServicio, setTargetServicio] = useState<ServicioConfig | null>(null);
  const [doctorSearch, setDoctorSearch] = useState('');
  const [selectedDoctorIds, setSelectedDoctorIds] = useState<number[]>([]);

  const [sedeModalOpen, setSedeModalOpen] = useState(false);
  const [editingSede, setEditingSede] = useState<SedeConfig | null>(null);
  const [sedeForm, setSedeForm] = useState({ nombre: '', direccion: '', zona: '' });

  const [profesionalModalOpen, setProfesionalModalOpen] = useState(false);
  const [editingProfesional, setEditingProfesional] = useState<ProfesionalConfig | null>(null);
  const [profesionalForm, setProfesionalForm] = useState({
    nombres: '',
    apellidos: '',
    numero_colegiatura: '',
    especialidad: '',
    serviciosIds: [] as number[],
  });

  const [usuarioModalOpen, setUsuarioModalOpen] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<UsuarioConfig | null>(null);
  const [usuarioForm, setUsuarioForm] = useState({
    nombres: '',
    apellidos: '',
    email: '',
    id_rol: 1,
  });

  const [canalModalOpen, setCanalModalOpen] = useState(false);
  const [canalNombre, setCanalNombre] = useState('');

  const [fuenteModalOpen, setFuenteModalOpen] = useState(false);
  const [fuenteForm, setFuenteForm] = useState({ nombre: '', descripcion: '' });

  // Carga inicial
  const loadAllData = async () => {
    setLoading(true);
    try {
      const [empRes, servRes, sedesRes, profRes, canalesFuentesRes, usersRes] = await Promise.all([
        configService.getEmpresa().catch(() => null),
        configService.getServicios().catch(() => []),
        configService.getSedes().catch(() => []),
        configService.getProfesionales().catch(() => []),
        configService.getCanalesFuentes().catch(() => ({ canales: [], fuentes: [] })),
        configService.getUsuariosRoles().catch(() => ({ usuarios: [], roles: [] })),
      ]);

      if (empRes) setEmpresa(empRes);
      setServicios(servRes);
      setSedes(sedesRes);
      setProfesionales(profRes);
      setCanales(canalesFuentesRes.canales || []);
      setFuentes(canalesFuentesRes.fuentes || []);
      setUsuarios(usersRes.usuarios || []);
      setRoles(usersRes.roles || []);
    } catch (err: any) {
      console.error('Error al cargar datos de configuración:', err);
      toast({
        title: 'Error de conexión',
        description: 'No se pudieron cargar todos los parámetros del sistema.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Guardar datos de Empresa
  const handleSaveEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa) return;
    setSaving(true);
    try {
      await configService.updateEmpresa(empresa);
      toast({
        title: 'Configuración guardada',
        description: 'Los datos institucionales de la empresa se actualizaron correctamente.',
      });
    } catch (err: any) {
      toast({
        title: 'Error al guardar',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Guardar / Editar Servicio con tope de descuento y venta cruzada
  const handleSaveServicio = async () => {
    if (!servicioForm.nombre.trim()) {
      toast({ title: 'Campo requerido', description: 'Ingresa el nombre del servicio.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const precioNum = servicioForm.precio ? Number(servicioForm.precio) : undefined;
      const descMax = Number(servicioForm.descuentoMaximo) >= 0 ? Number(servicioForm.descuentoMaximo) : 15;

      if (editingServicio) {
        await configService.updateServicio(editingServicio.id_servicio, {
          nombre: servicioForm.nombre,
          descripcion: servicioForm.descripcion,
          precio: precioNum,
          descuentoMaximo: descMax,
          serviciosRelacionadosIds: servicioForm.serviciosRelacionadosIds,
        });
        toast({
          title: 'Servicio actualizado',
          description: 'Reglas comerciales, descuento máximo y tratamientos relacionados guardados.',
        });
      } else {
        await configService.createServicio({
          nombre: servicioForm.nombre,
          descripcion: servicioForm.descripcion,
          precio: precioNum,
          descuentoMaximo: descMax,
          serviciosRelacionadosIds: servicioForm.serviciosRelacionadosIds,
        });
        toast({ title: 'Servicio creado exitosamente' });
      }
      setServicioModalOpen(false);
      const updated = await configService.getServicios();
      setServicios(updated);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleServicio = async (s: ServicioConfig) => {
    try {
      await configService.updateServicio(s.id_servicio, { activo: !s.activo });
      setServicios((prev) =>
        prev.map((item) => (item.id_servicio === s.id_servicio ? { ...item, activo: !s.activo } : item))
      );
      toast({ title: `Servicio ${!s.activo ? 'activado' : 'desactivado'}` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // Asignar Doctores a un Tratamiento
  const handleOpenAssignDoctors = (s: ServicioConfig) => {
    setTargetServicio(s);
    setDoctorSearch('');
    const currentDocIds = s.especialistasDetalle?.map((d) => d.id_profesional) || [];
    if (currentDocIds.length === 0 && s.especialistas.length > 0) {
      const matched = profesionales
        .filter((p) =>
          s.especialistas.some(
            (name) =>
              `${p.nombres} ${p.apellidos}`.toLowerCase().includes(name.toLowerCase()) ||
              name.toLowerCase().includes(p.apellidos.toLowerCase())
          )
        )
        .map((p) => p.id_profesional);
      setSelectedDoctorIds(matched);
    } else {
      setSelectedDoctorIds(currentDocIds);
    }
    setAssignModalOpen(true);
  };

  const filteredDoctors = useMemo(() => {
    if (!doctorSearch.trim()) return profesionales;
    const q = doctorSearch.toLowerCase();
    return profesionales.filter(
      (p) =>
        `${p.nombres} ${p.apellidos}`.toLowerCase().includes(q) ||
        (p.especialidad && p.especialidad.toLowerCase().includes(q)) ||
        (p.numero_colegiatura && p.numero_colegiatura.toLowerCase().includes(q))
    );
  }, [profesionales, doctorSearch]);

  const handleSaveDoctorAssignment = async () => {
    if (!targetServicio) return;
    setSaving(true);
    try {
      await configService.assignEspecialistas(targetServicio.id_servicio, selectedDoctorIds);
      toast({
        title: 'Especialistas asignados',
        description: `Se actualizaron los especialistas acreditados para ${targetServicio.nombre}.`,
      });
      setAssignModalOpen(false);
      const updated = await configService.getServicios();
      setServicios(updated);
      const updatedProf = await configService.getProfesionales();
      setProfesionales(updatedProf);
    } catch (err: any) {
      toast({ title: 'Error al asignar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Guardar / Editar Sede
  const handleSaveSede = async () => {
    if (!sedeForm.nombre.trim() || !sedeForm.direccion.trim()) {
      toast({ title: 'Campos requeridos', description: 'Nombre y dirección son obligatorios.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editingSede) {
        await configService.updateSede(editingSede.id_sede, {
          nombre: sedeForm.nombre,
          direccion: sedeForm.direccion,
          zona: sedeForm.zona,
        });
        toast({ title: 'Sede actualizada' });
      } else {
        await configService.createSede({
          nombre: sedeForm.nombre,
          direccion: sedeForm.direccion,
          zona: sedeForm.zona,
        });
        toast({ title: 'Sede registrada exitosamente' });
      }
      setSedeModalOpen(false);
      const updated = await configService.getSedes();
      setSedes(updated);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSede = async (s: SedeConfig) => {
    try {
      await configService.updateSede(s.id_sede, { activo: !s.activo });
      setSedes((prev) =>
        prev.map((item) => (item.id_sede === s.id_sede ? { ...item, activo: !s.activo } : item))
      );
      toast({ title: `Sede ${!s.activo ? 'activada' : 'desactivada'}` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // Guardar / Editar Profesional
  const handleSaveProfesional = async () => {
    if (!profesionalForm.nombres.trim() || !profesionalForm.apellidos.trim()) {
      toast({ title: 'Campos requeridos', description: 'Nombres y apellidos son requeridos.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editingProfesional) {
        await configService.updateProfesional(editingProfesional.id_profesional, {
          nombres: profesionalForm.nombres,
          apellidos: profesionalForm.apellidos,
          numero_colegiatura: profesionalForm.numero_colegiatura,
          especialidad: profesionalForm.especialidad,
          serviciosIds: profesionalForm.serviciosIds,
        });
        toast({ title: 'Profesional actualizado' });
      } else {
        await configService.createProfesional({
          nombres: profesionalForm.nombres,
          apellidos: profesionalForm.apellidos,
          numero_colegiatura: profesionalForm.numero_colegiatura,
          especialidad: profesionalForm.especialidad,
          serviciosIds: profesionalForm.serviciosIds,
        });
        toast({ title: 'Profesional registrado exitosamente' });
      }
      setProfesionalModalOpen(false);
      const updated = await configService.getProfesionales();
      setProfesionales(updated);
      const updatedServ = await configService.getServicios();
      setServicios(updatedServ);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleProfesional = async (p: ProfesionalConfig) => {
    try {
      await configService.updateProfesional(p.id_profesional, { activo: !p.activo });
      setProfesionales((prev) =>
        prev.map((item) => (item.id_profesional === p.id_profesional ? { ...item, activo: !p.activo } : item))
      );
      toast({ title: `Profesional ${!p.activo ? 'activado' : 'desactivado'}` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // Guardar Canal
  const handleCreateCanal = async () => {
    if (!canalNombre.trim()) return;
    try {
      await configService.createCanal({ nombre: canalNombre });
      toast({ title: 'Canal agregado' });
      setCanalModalOpen(false);
      const res = await configService.getCanalesFuentes();
      setCanales(res.canales || []);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // Guardar Fuente
  const handleCreateFuente = async () => {
    if (!fuenteForm.nombre.trim()) return;
    try {
      await configService.createFuente({ nombre: fuenteForm.nombre, descripcion: fuenteForm.descripcion });
      toast({ title: 'Fuente agregada' });
      setFuenteModalOpen(false);
      const res = await configService.getCanalesFuentes();
      setFuentes(res.fuentes || []);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // Guardar / Editar Usuario
  const handleSaveUsuario = async () => {
    if (!usuarioForm.nombres.trim() || !usuarioForm.email.trim()) {
      toast({ title: 'Campos requeridos', description: 'Nombres y correo son requeridos.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editingUsuario) {
        await configService.updateUsuario(editingUsuario.id_usuario, {
          nombres: usuarioForm.nombres,
          apellidos: usuarioForm.apellidos,
          email: usuarioForm.email,
          id_rol: usuarioForm.id_rol,
        });
        toast({ title: 'Usuario actualizado' });
      } else {
        await configService.createUsuario({
          nombres: usuarioForm.nombres,
          apellidos: usuarioForm.apellidos,
          email: usuarioForm.email,
          id_rol: usuarioForm.id_rol,
        });
        toast({ title: 'Usuario registrado exitosamente' });
      }
      setUsuarioModalOpen(false);
      const res = await configService.getUsuariosRoles();
      setUsuarios(res.usuarios || []);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleUsuario = async (u: UsuarioConfig) => {
    try {
      await configService.updateUsuario(u.id_usuario, { activo: !u.activo });
      setUsuarios((prev) =>
        prev.map((item) => (item.id_usuario === u.id_usuario ? { ...item, activo: !u.activo } : item))
      );
      toast({ title: `Usuario ${!u.activo ? 'activado' : 'desactivado'}` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // Helper de paginación para tabs con tarjetas (9 elementos por página)
  const renderPagination = (
    currentPage: number,
    totalItems: number,
    onPageChange: (p: number) => void
  ) => {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
    if (totalPages <= 1) return null;
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
        <p className="text-xs text-slate-500">
          Mostrando <span className="font-semibold text-slate-700 dark:text-slate-300">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> - <span className="font-semibold text-slate-700 dark:text-slate-300">{Math.min(currentPage * ITEMS_PER_PAGE, totalItems)}</span> de <span className="font-semibold text-slate-700 dark:text-slate-300">{totalItems}</span> registros
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="h-8 px-3 text-xs border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
          >
            <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Anterior
          </Button>
          <span className="text-xs font-semibold px-2 text-slate-600 dark:text-slate-400">
            Página {currentPage} de {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="h-8 px-3 text-xs border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
          >
            Siguiente <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </div>
    );
  };

  // Configuración de pestañas
  const tabsConfig = [
    { key: 'empresa', label: 'Clínica Odontológica', icon: Building2, count: null },
    { key: 'servicios', label: 'Servicios y Tarifas', icon: Stethoscope, count: servicios.length },
    { key: 'sedes', label: 'Sedes (Trujillo)', icon: MapPin, count: sedes.length },
    { key: 'profesionales', label: 'Especialistas', icon: UserCheck, count: profesionales.length },
    { key: 'canales', label: 'Canales y Fuentes', icon: Radio, count: canales.length + fuentes.length },
    { key: 'usuarios', label: 'Operadores y Roles', icon: Users, count: usuarios.length },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-teal-600 text-white shadow-md shadow-teal-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Configuración del Sistema Odontológico
              </h1>
              <p className="text-xs text-teal-700 dark:text-teal-400 font-semibold font-mono">
                {empresa?.nombreComercial || 'NexoSalud Dental'} • Parámetros de Operación Clínica
              </p>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Centro de administración de parámetros institucionales, catálogo odontológico, sedes físicas, staff clínico y orígenes de captación IMPULSE.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs px-3 py-1 font-mono">
            Modo: IMPULSE BI 360
          </Badge>
          <Badge className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs px-3 py-1">
            En línea
          </Badge>
        </div>
      </div>

      {/* Barra de Pestañas (Tabs) */}
      <div className="flex items-center gap-1.5 overflow-x-auto p-1.5 bg-slate-100/80 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
        {tabsConfig.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-sm border border-slate-200/80 dark:border-slate-700 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/40'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive
                      ? 'bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-200/60'
                      : 'bg-slate-200/70 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Contenido Principal de Pestañas */}
      {loading ? (
        <LoadingState />
      ) : (
        <div className="space-y-6">
          {/* TAB 1: EMPRESA */}
          {activeTab === 'empresa' && empresa && (
            <Card className="p-6 border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl bg-white dark:bg-slate-900">
              <form onSubmit={handleSaveEmpresa} className="space-y-6">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-teal-600" />
                      Perfil Institucional de la Clínica Odontológica
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Identidad legal y comercial utilizada en comprobantes, links de agendamiento y comunicaciones automáticas con pacientes.
                    </p>
                  </div>
                  <Button
                    type="submit"
                    disabled={saving}
                    className="bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs h-9 px-4 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Guardar Cambios
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nombre Comercial</Label>
                    <Input
                      value={empresa.nombreComercial}
                      onChange={(e) => setEmpresa({ ...empresa, nombreComercial: e.target.value })}
                      className="text-xs h-9 rounded-xl"
                      placeholder="Ej: NexoSalud Odontología Especializada"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Razón Social Legal</Label>
                    <Input
                      value={empresa.razonSocial}
                      onChange={(e) => setEmpresa({ ...empresa, razonSocial: e.target.value })}
                      className="text-xs h-9 rounded-xl"
                      placeholder="Ej: NexoSalud Dental S.A.C."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Número de RUC</Label>
                    <Input
                      value={empresa.ruc}
                      maxLength={11}
                      onChange={(e) => setEmpresa({ ...empresa, ruc: e.target.value })}
                      className="text-xs h-9 rounded-xl font-mono"
                      placeholder="20608945123"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Teléfono / WhatsApp Oficial</Label>
                    <Input
                      value={empresa.telefonoPrincipal}
                      onChange={(e) => setEmpresa({ ...empresa, telefonoPrincipal: e.target.value })}
                      className="text-xs h-9 rounded-xl font-mono"
                      placeholder="+51 970 292 710"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Correo Electrónico Central</Label>
                    <Input
                      value={empresa.emailContacto}
                      type="email"
                      onChange={(e) => setEmpresa({ ...empresa, emailContacto: e.target.value })}
                      className="text-xs h-9 rounded-xl"
                      placeholder="contacto@nexosalud.pe"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Ciudad Principal</Label>
                    <Input
                      value={empresa.ciudadPrincipal}
                      onChange={(e) => setEmpresa({ ...empresa, ciudadPrincipal: e.target.value })}
                      className="text-xs h-9 rounded-xl"
                      placeholder="Trujillo, Perú"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Dirección Fiscal / Sede Central</Label>
                    <Input
                      value={empresa.direccionFiscal}
                      onChange={(e) => setEmpresa({ ...empresa, direccionFiscal: e.target.value })}
                      className="text-xs h-9 rounded-xl"
                      placeholder="Av. Larco 820, Urb. California, Trujillo"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Horario de Atención General</Label>
                    <Input
                      value={empresa.horarioAtencion}
                      onChange={(e) => setEmpresa({ ...empresa, horarioAtencion: e.target.value })}
                      className="text-xs h-9 rounded-xl"
                      placeholder="Lunes a Sábado: 08:00 AM - 08:00 PM"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-3">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Eslogan Comercial / Posicionamiento</Label>
                    <Input
                      value={empresa.slogan}
                      onChange={(e) => setEmpresa({ ...empresa, slogan: e.target.value })}
                      className="text-xs h-9 rounded-xl"
                      placeholder="Red Odontológica Integral de Alta Complejidad"
                    />
                  </div>
                </div>
              </form>
            </Card>
          )}

          {/* TAB 2: SERVICIOS Y TARIFAS */}
          {activeTab === 'servicios' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Stethoscope className="h-5 w-5 text-teal-600" />
                    Catálogo de Procedimientos y Tratamientos
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Tratamientos disponibles para cotización IA, tope máximo de descuento, venta cruzada y agenda odontológica.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setEditingServicio(null);
                    setServicioForm({
                      nombre: '',
                      descripcion: '',
                      precio: '',
                      descuentoMaximo: 15,
                      serviciosRelacionadosIds: [],
                    });
                    setServicioModalOpen(true);
                  }}
                  className="bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs h-9 px-3.5 rounded-xl flex items-center gap-1.5 self-start sm:self-auto cursor-pointer shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nuevo Servicio
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {servicios
                  .slice((serviciosPage - 1) * ITEMS_PER_PAGE, serviciosPage * ITEMS_PER_PAGE)
                  .map((s) => (
                    <Card
                      key={s.id_servicio}
                      className="p-4 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between hover:border-teal-300 dark:hover:border-teal-700 transition-all"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 border border-teal-200/50">
                              <Stethoscope className="h-4 w-4" />
                            </div>
                            <div>
                              <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                                {s.nombre}
                              </h3>
                              <span className="text-[10px] text-slate-400 font-mono">ID: #{s.id_servicio}</span>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={
                              s.activo
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]'
                                : 'bg-slate-100 text-slate-500 border-slate-200 text-[10px]'
                            }
                          >
                            {s.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed min-h-[32px]">
                          {s.descripcion || 'Sin descripción clínica registrada.'}
                        </p>

                        {/* Tarifa Base y Candado Descuento IA */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800 flex flex-col justify-center">
                            <span className="text-[10px] text-slate-500 font-medium">Tarifa Base:</span>
                            <span className="text-xs font-black text-slate-900 dark:text-white font-mono">
                              {s.precio !== null ? `S/ ${s.precio.toFixed(2)}` : 'A cotizar'}
                            </span>
                          </div>

                          <div className="p-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/50 flex flex-col justify-center">
                            <span className="text-[10px] text-amber-800 dark:text-amber-300 font-medium flex items-center gap-0.5">
                              <ShieldCheck className="h-3 w-3 text-amber-600 shrink-0" /> Tope Descuento:
                            </span>
                            <span className="text-xs font-bold text-amber-900 dark:text-amber-200 font-mono">
                              {(s.descuentoMaximo ?? 15) > 0 ? `${s.descuentoMaximo ?? 15}% máx.` : '0% (Sin desc.)'}
                            </span>
                          </div>
                        </div>

                        {/* Cross-Selling / Tratamientos Relacionados */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10.5px]">
                            <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                              <Sparkles className="h-3 w-3 text-teal-600" /> Cross-Selling IA (Canva):
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {(s.serviciosRelacionadosNombres?.length || 0)} sugeridos
                            </span>
                          </div>
                          {s.serviciosRelacionadosNombres && s.serviciosRelacionadosNombres.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {s.serviciosRelacionadosNombres.slice(0, 3).map((nom, i) => (
                                <span
                                  key={i}
                                  className="text-[9.5px] bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60 rounded-md px-1.5 py-0.5 font-medium"
                                >
                                  {nom}
                                </span>
                              ))}
                              {s.serviciosRelacionadosNombres.length > 3 && (
                                <span className="text-[9.5px] text-slate-400 font-medium">
                                  +{s.serviciosRelacionadosNombres.length - 3} más
                                </span>
                              )}
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-400 italic">Sin tratamientos sugeridos configurados.</p>
                          )}
                        </div>

                        {/* Especialistas Asignados */}
                        <div className="space-y-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-between text-[10.5px]">
                            <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                              <UserCheck className="h-3 w-3 text-teal-600" /> Doctores Asignados:
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenAssignDoctors(s)}
                              className="text-[10.5px] font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 flex items-center gap-0.5 hover:underline cursor-pointer"
                            >
                              <UserPlus className="h-3 w-3" /> Asignar
                            </button>
                          </div>
                          {s.especialistas.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {s.especialistas.map((esp, i) => (
                                <span
                                  key={i}
                                  className="text-[9.5px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded px-1.5 py-0.5"
                                >
                                  {esp}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 italic">
                              No hay especialistas asignados.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Botones de Acción */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-3 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleServicio(s)}
                          className={`text-[10.5px] font-medium h-7 px-2.5 rounded-lg border transition-colors cursor-pointer ${
                            s.activo
                              ? 'border-slate-200 text-slate-700 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-rose-950/60 dark:hover:text-rose-300'
                              : 'border-emerald-200 text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                          }`}
                        >
                          {s.activo ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingServicio(s);
                            setServicioForm({
                              nombre: s.nombre,
                              descripcion: s.descripcion,
                              precio: s.precio ? s.precio.toString() : '',
                              descuentoMaximo: s.descuentoMaximo ?? 15,
                              serviciosRelacionadosIds: s.serviciosRelacionadosIds ?? [],
                            });
                            setServicioModalOpen(true);
                          }}
                          className="text-[10.5px] font-medium h-7 px-2.5 rounded-lg text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 dark:hover:bg-teal-900/60 border border-teal-200/80 dark:border-teal-800 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="h-3 w-3" /> Editar
                        </button>
                      </div>
                    </Card>
                  ))}
              </div>

              {renderPagination(serviciosPage, servicios.length, setServiciosPage)}
            </div>
          )}

          {/* TAB 3: SEDES */}
          {activeTab === 'sedes' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-teal-600" />
                    Sedes Físicas y Consultorios (Trujillo)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Ubicaciones físicas habilitadas para citas presenciales y generación de flyers promocionales.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setEditingSede(null);
                    setSedeForm({ nombre: '', direccion: '', zona: '' });
                    setSedeModalOpen(true);
                  }}
                  className="bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs h-9 px-3.5 rounded-xl flex items-center gap-1.5 self-start sm:self-auto cursor-pointer shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nueva Sede
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {sedes
                  .slice((sedesPage - 1) * ITEMS_PER_PAGE, sedesPage * ITEMS_PER_PAGE)
                  .map((sede) => (
                    <Card
                      key={sede.id_sede}
                      className="p-4 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between hover:border-teal-300 dark:hover:border-teal-700 transition-all"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 border border-teal-200/50">
                              <MapPin className="h-4 w-4" />
                            </div>
                            <div>
                              <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                                {sede.nombre}
                              </h3>
                              <span className="text-[10px] text-slate-400 font-mono">ID: #{sede.id_sede}</span>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={
                              sede.activo
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]'
                                : 'bg-slate-100 text-slate-500 border-slate-200 text-[10px]'
                            }
                          >
                            {sede.activo ? 'Activa' : 'Inactiva'}
                          </Badge>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800 space-y-1">
                          <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                            📍 {sede.direccion}
                          </p>
                          <p className="text-[10.5px] text-slate-500">
                            Zona / Sector:{' '}
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {sede.zona || 'Trujillo'}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-3 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleSede(sede)}
                          className={`text-[10.5px] font-medium h-7 px-2.5 rounded-lg border transition-colors cursor-pointer ${
                            sede.activo
                              ? 'border-slate-200 text-slate-700 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-rose-950/60 dark:hover:text-rose-300'
                              : 'border-emerald-200 text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                          }`}
                        >
                          {sede.activo ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSede(sede);
                            setSedeForm({
                              nombre: sede.nombre,
                              direccion: sede.direccion,
                              zona: sede.zona || '',
                            });
                            setSedeModalOpen(true);
                          }}
                          className="text-[10.5px] font-medium h-7 px-2.5 rounded-lg text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 dark:hover:bg-teal-900/60 border border-teal-200/80 dark:border-teal-800 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="h-3 w-3" /> Editar
                        </button>
                      </div>
                    </Card>
                  ))}
              </div>

              {renderPagination(sedesPage, sedes.length, setSedesPage)}
            </div>
          )}

          {/* TAB 4: ESPECIALISTAS */}
          {activeTab === 'profesionales' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-teal-600" />
                    Directorio de Odontólogos y Especialistas
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Staff médico acreditado con número de colegiatura y procedimientos que atiende.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setEditingProfesional(null);
                    setProfesionalForm({
                      nombres: '',
                      apellidos: '',
                      numero_colegiatura: '',
                      especialidad: '',
                      serviciosIds: [],
                    });
                    setProfesionalModalOpen(true);
                  }}
                  className="bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs h-9 px-3.5 rounded-xl flex items-center gap-1.5 self-start sm:self-auto cursor-pointer shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nuevo Especialista
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {profesionales
                  .slice((profesionalesPage - 1) * ITEMS_PER_PAGE, profesionalesPage * ITEMS_PER_PAGE)
                  .map((prof) => (
                    <Card
                      key={prof.id_profesional}
                      className="p-4 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between hover:border-teal-300 dark:hover:border-teal-700 transition-all"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 border border-teal-200/50">
                              <UserCheck className="h-4 w-4" />
                            </div>
                            <div>
                              <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                                Dr(a). {prof.nombres} {prof.apellidos}
                              </h3>
                              <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold">
                                {prof.especialidad}
                              </span>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={
                              prof.activo
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]'
                                : 'bg-slate-100 text-slate-500 border-slate-200 text-[10px]'
                            }
                          >
                            {prof.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800 space-y-1">
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                            Colegiatura:{' '}
                            <span className="font-bold text-slate-800 dark:text-white">
                              {prof.numero_colegiatura || 'En trámite'}
                            </span>
                          </p>
                          <div className="text-[10.5px] text-slate-500">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              Servicios que realiza:{' '}
                            </span>
                            {prof.servicios.length > 0 ? (
                              <span className="text-slate-700 dark:text-slate-300">
                                {prof.servicios.map((s) => s.nombre).join(', ')}
                              </span>
                            ) : (
                              <span className="italic text-slate-400">Todos los tratamientos generales</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-3 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleProfesional(prof)}
                          className={`text-[10.5px] font-medium h-7 px-2.5 rounded-lg border transition-colors cursor-pointer ${
                            prof.activo
                              ? 'border-slate-200 text-slate-700 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-rose-950/60 dark:hover:text-rose-300'
                              : 'border-emerald-200 text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                          }`}
                        >
                          {prof.activo ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProfesional(prof);
                            setProfesionalForm({
                              nombres: prof.nombres,
                              apellidos: prof.apellidos,
                              numero_colegiatura: prof.numero_colegiatura,
                              especialidad: prof.especialidad,
                              serviciosIds: prof.servicios.map((s) => s.id_servicio),
                            });
                            setProfesionalModalOpen(true);
                          }}
                          className="text-[10.5px] font-medium h-7 px-2.5 rounded-lg text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 dark:hover:bg-teal-900/60 border border-teal-200/80 dark:border-teal-800 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="h-3 w-3" /> Editar
                        </button>
                      </div>
                    </Card>
                  ))}
              </div>

              {renderPagination(profesionalesPage, profesionales.length, setProfesionalesPage)}
            </div>
          )}

          {/* TAB 5: CANALES Y FUENTES */}
          {activeTab === 'canales' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Canales */}
              <Card className="p-5 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Radio className="h-4 w-4 text-teal-600" /> Canales de Contacto
                    </h3>
                    <p className="text-[11px] text-slate-500">Medios directos por donde ingresa la interacción.</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setCanalNombre('');
                      setCanalModalOpen(true);
                    }}
                    className="h-8 text-xs bg-teal-700 hover:bg-teal-800 text-white rounded-xl px-3 cursor-pointer shadow-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Nuevo Canal
                  </Button>
                </div>

                <div className="space-y-2">
                  {canales.map((c) => (
                    <div
                      key={c.id_canal}
                      className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between"
                    >
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200">{c.nombre}</span>
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9.5px] hover:bg-emerald-50 hover:text-emerald-700 font-medium"
                      >
                        Activo
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Fuentes */}
              <Card className="p-5 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Globe className="h-4 w-4 text-teal-600" /> Fuentes de Tráfico
                    </h3>
                    <p className="text-[11px] text-slate-500">Orígenes de atribución y pautas publicitarias.</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setFuenteForm({ nombre: '', descripcion: '' });
                      setFuenteModalOpen(true);
                    }}
                    className="h-8 text-xs bg-teal-700 hover:bg-teal-800 text-white rounded-xl px-3 cursor-pointer shadow-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Nueva Fuente
                  </Button>
                </div>

                <div className="space-y-2">
                  {fuentes.map((f) => (
                    <div
                      key={f.id_fuente}
                      className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200">{f.nombre}</p>
                        {f.descripcion && <p className="text-[10px] text-slate-500">{f.descripcion}</p>}
                      </div>
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9.5px] hover:bg-emerald-50 hover:text-emerald-700 font-medium"
                      >
                        Activo
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* TAB 6: USUARIOS Y ROLES */}
          {activeTab === 'usuarios' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className="h-5 w-5 text-teal-600" />
                    Usuarios Operadores del Dashboard NexoSalud
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Personal administrativo y comercial con acceso al control del embudo IMPULSE.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setEditingUsuario(null);
                    setUsuarioForm({ nombres: '', apellidos: '', email: '', id_rol: roles[0]?.id_rol || 1 });
                    setUsuarioModalOpen(true);
                  }}
                  className="bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs h-9 px-3.5 rounded-xl flex items-center gap-1.5 self-start sm:self-auto cursor-pointer shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nuevo Usuario
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {usuarios
                  .slice((usuariosPage - 1) * ITEMS_PER_PAGE, usuariosPage * ITEMS_PER_PAGE)
                  .map((u) => (
                    <Card
                      key={u.id_usuario}
                      className="p-4 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between hover:border-teal-300 dark:hover:border-teal-700 transition-all"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 border border-teal-200/50">
                              <Users className="h-4 w-4" />
                            </div>
                            <div>
                              <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                                {u.nombres} {u.apellidos}
                              </h3>
                              <span className="text-[10px] text-slate-400 font-mono">{u.email}</span>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={
                              u.activo
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]'
                                : 'bg-slate-100 text-slate-500 border-slate-200 text-[10px]'
                            }
                          >
                            {u.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </div>

                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                          <span className="text-[10.5px] text-slate-500 font-medium">Rol de Acceso:</span>
                          <Badge
                            variant="outline"
                            className="text-[10.5px] font-semibold text-teal-700 dark:text-teal-300 border-teal-200"
                          >
                            {u.Rol?.nombre || 'Administrador'}
                          </Badge>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-3 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleUsuario(u)}
                          className={`text-[10.5px] font-medium h-7 px-2.5 rounded-lg border transition-colors cursor-pointer ${
                            u.activo
                              ? 'border-slate-200 text-slate-700 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-rose-950/60 dark:hover:text-rose-300'
                              : 'border-emerald-200 text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                          }`}
                        >
                          {u.activo ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingUsuario(u);
                            setUsuarioForm({
                              nombres: u.nombres,
                              apellidos: u.apellidos,
                              email: u.email,
                              id_rol: u.id_rol,
                            });
                            setUsuarioModalOpen(true);
                          }}
                          className="text-[10.5px] font-medium h-7 px-2.5 rounded-lg text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 dark:hover:bg-teal-900/60 border border-teal-200/80 dark:border-teal-800 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="h-3 w-3" /> Editar
                        </button>
                      </div>
                    </Card>
                  ))}
              </div>

              {renderPagination(usuariosPage, usuarios.length, setUsuariosPage)}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODALES DE CREACIÓN Y EDICIÓN
      ───────────────────────────────────────────────────────────── */}

      {/* Modal Servicio Odontológico con Descuentos Máximos y Cross-Selling */}
      <Dialog open={servicioModalOpen} onOpenChange={setServicioModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <Stethoscope className="h-5 w-5 text-teal-600" />
              {editingServicio ? 'Editar Servicio Odontológico' : 'Registrar Nuevo Servicio'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Nombre del Tratamiento */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nombre del Tratamiento *
              </Label>
              <Input
                value={servicioForm.nombre}
                onChange={(e) => setServicioForm({ ...servicioForm, nombre: e.target.value })}
                placeholder="Ej: Endodoncia Mecanizada"
                className="text-xs h-9 rounded-xl"
              />
            </div>

            {/* Descripción Clínica */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Descripción Clínica
              </Label>
              <Input
                value={servicioForm.descripcion}
                onChange={(e) => setServicioForm({ ...servicioForm, descripcion: e.target.value })}
                placeholder="Detalle clínico, indicaciones y garantía"
                className="text-xs h-9 rounded-xl"
              />
            </div>

            {/* Tarifa Base y Descuento Máximo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tarifa Base de Lista (S/.)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={servicioForm.precio}
                  onChange={(e) => setServicioForm({ ...servicioForm, precio: e.target.value })}
                  placeholder="150.00"
                  className="text-xs h-9 font-mono rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Tope Descuento Máximo (%)</span>
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    Candado IA: {servicioForm.descuentoMaximo}%
                  </span>
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={servicioForm.descuentoMaximo}
                  onChange={(e) =>
                    setServicioForm({
                      ...servicioForm,
                      descuentoMaximo: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                    })
                  }
                  className="text-xs h-9 font-mono rounded-xl"
                />
              </div>
            </div>

            {/* Presets Rápidos de Descuento Seguro */}
            <div className="space-y-1.5 p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/60">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-900 dark:text-amber-200">
                <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Presets de Descuento Máximo Seguro para la IA:</span>
              </div>
              <p className="text-[10px] text-amber-800/80 dark:text-amber-300/80">
                La IA jamás podrá ofrecer un descuento superior a este límite en la negociación con el paciente.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[0, 10, 15, 20, 25, 30].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setServicioForm({ ...servicioForm, descuentoMaximo: pct })}
                    className={`text-[10.5px] px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                      servicioForm.descuentoMaximo === pct
                        ? 'bg-amber-600 text-white shadow-xs font-bold'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-amber-100 hover:text-amber-900'
                    }`}
                  >
                    {pct === 0 ? '0% (Sin Descuento)' : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Cross-Selling / Venta Cruzada IA */}
            <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <div>
                <Label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-teal-600" />
                  Tratamientos Complementarios para Venta Cruzada (Cross-Selling IA)
                </Label>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Marca qué otros servicios se relacionan clínicamente con este tratamiento. La IA ofrecerá estos tratamientos al paciente en vez de inventar descuentos y los plasmará en el flyer de Canva.
                </p>
              </div>

              <div className="max-h-44 overflow-y-auto p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 space-y-1.5">
                {servicios
                  .filter((other) => !editingServicio || other.id_servicio !== editingServicio.id_servicio)
                  .map((other) => {
                    const isChecked = servicioForm.serviciosRelacionadosIds.includes(other.id_servicio);
                    return (
                      <label
                        key={other.id_servicio}
                        className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                          isChecked
                            ? 'bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200 font-medium'
                            : 'hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setServicioForm({
                                  ...servicioForm,
                                  serviciosRelacionadosIds: [
                                    ...servicioForm.serviciosRelacionadosIds,
                                    other.id_servicio,
                                  ],
                                });
                              } else {
                                setServicioForm({
                                  ...servicioForm,
                                  serviciosRelacionadosIds: servicioForm.serviciosRelacionadosIds.filter(
                                    (id) => id !== other.id_servicio
                                  ),
                                });
                              }
                            }}
                            className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                          />
                          <span>{other.nombre}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {other.precio ? `S/ ${other.precio.toFixed(2)}` : 'A cotizar'}
                        </span>
                      </label>
                    );
                  })}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" size="sm" onClick={() => setServicioModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={saving}
              onClick={handleSaveServicio}
              className="bg-teal-700 hover:bg-teal-800 text-white font-medium shadow-xs cursor-pointer"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null} Guardar Tratamiento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Asignar Especialistas a Tratamiento con Buscador */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <UserCheck className="h-4 w-4 text-teal-600" />
              Asignar Especialistas y Doctores
            </DialogTitle>
            <p className="text-xs text-slate-500">
              Tratamiento: <span className="font-bold text-teal-700 dark:text-teal-300">{targetServicio?.nombre}</span>
            </p>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Buscador de doctores */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                value={doctorSearch}
                onChange={(e) => setDoctorSearch(e.target.value)}
                placeholder="Buscar especialista o doctor por nombre, especialidad o COP..."
                className="pl-9 text-xs h-9 rounded-xl border-slate-200 dark:border-slate-700 focus-visible:ring-teal-500"
              />
            </div>

            {/* Lista de especialistas con selección */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 p-1 rounded-xl border border-slate-100 dark:border-slate-800">
              {filteredDoctors.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  No se encontraron especialistas con "{doctorSearch}".
                </div>
              ) : (
                filteredDoctors.map((doc) => {
                  const isAssigned = selectedDoctorIds.includes(doc.id_profesional);
                  return (
                    <div
                      key={doc.id_profesional}
                      onClick={() => {
                        if (isAssigned) {
                          setSelectedDoctorIds((prev) => prev.filter((id) => id !== doc.id_profesional));
                        } else {
                          setSelectedDoctorIds((prev) => [...prev, doc.id_profesional]);
                        }
                      }}
                      className={`p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer select-none ${
                        isAssigned
                          ? 'bg-teal-50/70 dark:bg-teal-950/40 border-teal-300 dark:border-teal-700 shadow-xs'
                          : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          Dr(a). {doc.nombres} {doc.apellidos}
                          {doc.numero_colegiatura && (
                            <span className="text-[10px] text-slate-400 font-mono font-normal">
                              ({doc.numero_colegiatura})
                            </span>
                          )}
                        </p>
                        <p className="text-[10.5px] text-teal-700 dark:text-teal-400 font-medium">
                          {doc.especialidad || 'Odontología General'}
                        </p>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all ${
                          isAssigned
                            ? 'bg-teal-700 text-white'
                            : 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                        }`}
                      >
                        {isAssigned && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>
                Doctores seleccionados: <strong className="text-teal-700 dark:text-teal-300">{selectedDoctorIds.length}</strong>
              </span>
              {selectedDoctorIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedDoctorIds([])}
                  className="text-rose-600 hover:underline cursor-pointer"
                >
                  Limpiar selección
                </button>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" size="sm" onClick={() => setAssignModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={saving}
              onClick={handleSaveDoctorAssignment}
              className="bg-teal-700 hover:bg-teal-800 text-white cursor-pointer"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null} Guardar Asignación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Sede */}
      <Dialog open={sedeModalOpen} onOpenChange={setSedeModalOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              {editingSede ? 'Editar Sede (Trujillo)' : 'Registrar Nueva Sede'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Nombre de la Sede *</Label>
              <Input
                value={sedeForm.nombre}
                onChange={(e) => setSedeForm({ ...sedeForm, nombre: e.target.value })}
                placeholder="Ej: Sede Larco"
                className="text-xs h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dirección Exacta *</Label>
              <Input
                value={sedeForm.direccion}
                onChange={(e) => setSedeForm({ ...sedeForm, direccion: e.target.value })}
                placeholder="Ej: Av. Larco 820, Urb. California, Trujillo"
                className="text-xs h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Zona / Sector</Label>
              <Input
                value={sedeForm.zona}
                onChange={(e) => setSedeForm({ ...sedeForm, zona: e.target.value })}
                placeholder="Ej: Víctor Larco"
                className="text-xs h-9"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSedeModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={saving}
              onClick={handleSaveSede}
              className="bg-teal-700 hover:bg-teal-800 text-white"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Profesional */}
      <Dialog open={profesionalModalOpen} onOpenChange={setProfesionalModalOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              {editingProfesional ? 'Editar Especialista' : 'Registrar Nuevo Especialista'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Nombres *</Label>
                <Input
                  value={profesionalForm.nombres}
                  onChange={(e) => setProfesionalForm({ ...profesionalForm, nombres: e.target.value })}
                  placeholder="Carlos"
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Apellidos *</Label>
                <Input
                  value={profesionalForm.apellidos}
                  onChange={(e) => setProfesionalForm({ ...profesionalForm, apellidos: e.target.value })}
                  placeholder="Mendoza"
                  className="text-xs h-9"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Colegiatura Odontológica (COP)</Label>
              <Input
                value={profesionalForm.numero_colegiatura}
                onChange={(e) => setProfesionalForm({ ...profesionalForm, numero_colegiatura: e.target.value })}
                placeholder="COP-45892"
                className="text-xs h-9 font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Especialidad</Label>
              <Input
                value={profesionalForm.especialidad}
                onChange={(e) => setProfesionalForm({ ...profesionalForm, especialidad: e.target.value })}
                placeholder="Ortodoncia y Ortopedia Maxilar"
                className="text-xs h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tratamientos que realiza</Label>
              <div className="max-h-28 overflow-y-auto p-2 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1 bg-slate-50 dark:bg-slate-800/40">
                {servicios.map((s) => {
                  const isChecked = profesionalForm.serviciosIds.includes(s.id_servicio);
                  return (
                    <label key={s.id_servicio} className="flex items-center gap-2 text-xs cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setProfesionalForm({
                              ...profesionalForm,
                              serviciosIds: [...profesionalForm.serviciosIds, s.id_servicio],
                            });
                          } else {
                            setProfesionalForm({
                              ...profesionalForm,
                              serviciosIds: profesionalForm.serviciosIds.filter((id) => id !== s.id_servicio),
                            });
                          }
                        }}
                        className="rounded text-teal-600 focus:ring-teal-500 h-3.5 w-3.5"
                      />
                      <span>{s.nombre}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setProfesionalModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={saving}
              onClick={handleSaveProfesional}
              className="bg-teal-700 hover:bg-teal-800 text-white"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Usuario */}
      <Dialog open={usuarioModalOpen} onOpenChange={setUsuarioModalOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              {editingUsuario ? 'Editar Usuario Operador' : 'Registrar Nuevo Operador'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Nombres *</Label>
                <Input
                  value={usuarioForm.nombres}
                  onChange={(e) => setUsuarioForm({ ...usuarioForm, nombres: e.target.value })}
                  placeholder="Lucía"
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Apellidos *</Label>
                <Input
                  value={usuarioForm.apellidos}
                  onChange={(e) => setUsuarioForm({ ...usuarioForm, apellidos: e.target.value })}
                  placeholder="Sánchez"
                  className="text-xs h-9"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Correo Electrónico (Acceso) *</Label>
              <Input
                type="email"
                value={usuarioForm.email}
                onChange={(e) => setUsuarioForm({ ...usuarioForm, email: e.target.value })}
                placeholder="lucia@nexosalud.pe"
                className="text-xs h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Rol de Acceso *</Label>
              <select
                value={usuarioForm.id_rol}
                onChange={(e) => setUsuarioForm({ ...usuarioForm, id_rol: Number(e.target.value) })}
                className="w-full text-xs h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3"
              >
                {roles.map((r) => (
                  <option key={r.id_rol} value={r.id_rol}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setUsuarioModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={saving}
              onClick={handleSaveUsuario}
              className="bg-teal-700 hover:bg-teal-800 text-white"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Canal */}
      <Dialog open={canalModalOpen} onOpenChange={setCanalModalOpen}>
        <DialogContent className="max-w-xs rounded-2xl bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Agregar Canal</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs">Nombre del Canal</Label>
            <Input
              value={canalNombre}
              onChange={(e) => setCanalNombre(e.target.value)}
              placeholder="Ej: TikTok Direct"
              className="text-xs h-9"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCanalModalOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCreateCanal} className="bg-teal-700 hover:bg-teal-800 text-white">
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Fuente */}
      <Dialog open={fuenteModalOpen} onOpenChange={setFuenteModalOpen}>
        <DialogContent className="max-w-xs rounded-2xl bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Agregar Fuente</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Nombre de la Fuente</Label>
              <Input
                value={fuenteForm.nombre}
                onChange={(e) => setFuenteForm({ ...fuenteForm, nombre: e.target.value })}
                placeholder="Ej: Convenio Universidad"
                className="text-xs h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descripción</Label>
              <Input
                value={fuenteForm.descripcion}
                onChange={(e) => setFuenteForm({ ...fuenteForm, descripcion: e.target.value })}
                placeholder="Pauta o convenio institucional"
                className="text-xs h-9"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setFuenteModalOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCreateFuente} className="bg-teal-700 hover:bg-teal-800 text-white">
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
