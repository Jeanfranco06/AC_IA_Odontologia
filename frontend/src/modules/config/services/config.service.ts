const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface EmpresaConfig {
  nombreComercial: string;
  razonSocial: string;
  ruc: string;
  telefonoPrincipal: string;
  emailContacto: string;
  direccionFiscal: string;
  slogan: string;
  horarioAtencion: string;
  sitioWeb: string;
  ciudadPrincipal: string;
  metodologia: string;
}

export interface ServicioConfig {
  id_servicio: number;
  nombre: string;
  descripcion: string;
  activo: boolean;
  precio: number | null;
  id_tarifa: number | null;
  especialistas: string[];
  especialistasDetalle?: {
    id_profesional: number;
    nombres: string;
    apellidos: string;
    especialidad: string;
  }[];
  descuentoMaximo?: number;
  descuentosPermitidos?: number[];
  serviciosRelacionadosIds?: number[];
  serviciosRelacionadosNombres?: string[];
}

export interface SedeConfig {
  id_sede: number;
  nombre: string;
  direccion: string;
  zona: string | null;
  activo: boolean;
}

export interface ProfesionalConfig {
  id_profesional: number;
  nombres: string;
  apellidos: string;
  numero_colegiatura: string;
  especialidad: string;
  activo: boolean;
  servicios: { id_servicio: number; nombre: string }[];
}

export interface CanalConfig {
  id_canal: number;
  nombre: string;
  activo: boolean;
}

export interface FuenteConfig {
  id_fuente: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export interface UsuarioConfig {
  id_usuario: number;
  nombres: string;
  apellidos: string;
  email: string;
  id_rol: number;
  activo: boolean;
  Rol?: { id_rol: number; nombre: string };
}

export interface RolConfig {
  id_rol: number;
  nombre: string;
}

export const configService = {
  // Empresa
  getEmpresa: async (): Promise<EmpresaConfig> => {
    const res = await fetch(`${API_URL}/config/empresa`);
    if (!res.ok) throw new Error('Error al obtener datos de empresa');
    return res.json();
  },
  updateEmpresa: async (data: Partial<EmpresaConfig>): Promise<{ success: boolean; empresa: EmpresaConfig }> => {
    const res = await fetch(`${API_URL}/config/empresa`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Error al actualizar datos de empresa');
    return res.json();
  },

  // Servicios
  getServicios: async (): Promise<ServicioConfig[]> => {
    const res = await fetch(`${API_URL}/config/servicios`);
    if (!res.ok) throw new Error('Error al obtener servicios');
    return res.json();
  },
  createServicio: async (data: { nombre: string; descripcion?: string; precio?: number; activo?: boolean; descuentoMaximo?: number; descuentosPermitidos?: number[]; serviciosRelacionadosIds?: number[] }): Promise<any> => {
    const res = await fetch(`${API_URL}/config/servicios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Error al crear servicio');
    return res.json();
  },
  updateServicio: async (id: number, data: { nombre?: string; descripcion?: string; precio?: number; activo?: boolean; descuentoMaximo?: number; descuentosPermitidos?: number[]; serviciosRelacionadosIds?: number[] }): Promise<any> => {
    const res = await fetch(`${API_URL}/config/servicios/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Error al actualizar servicio');
    return res.json();
  },

  assignEspecialistas: async (servicioId: number, profesionalesIds: number[]): Promise<any> => {
    const res = await fetch(`${API_URL}/config/servicios/${servicioId}/especialistas`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profesionalesIds }),
    });
    if (!res.ok) throw new Error('Error al asignar especialistas al tratamiento');
    return res.json();
  },

  // Sedes
  getSedes: async (): Promise<SedeConfig[]> => {
    const res = await fetch(`${API_URL}/config/sedes`);
    if (!res.ok) throw new Error('Error al obtener sedes');
    return res.json();
  },
  createSede: async (data: { nombre: string; direccion: string; zona?: string; activo?: boolean }): Promise<any> => {
    const res = await fetch(`${API_URL}/config/sedes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Error al crear sede');
    return res.json();
  },
  updateSede: async (id: number, data: { nombre?: string; direccion?: string; zona?: string; activo?: boolean }): Promise<any> => {
    const res = await fetch(`${API_URL}/config/sedes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Error al actualizar sede');
    return res.json();
  },

  // Profesionales
  getProfesionales: async (): Promise<ProfesionalConfig[]> => {
    const res = await fetch(`${API_URL}/config/profesionales`);
    if (!res.ok) throw new Error('Error al obtener especialistas');
    return res.json();
  },
  createProfesional: async (data: { nombres: string; apellidos: string; numero_colegiatura?: string; especialidad?: string; serviciosIds?: number[] }): Promise<any> => {
    const res = await fetch(`${API_URL}/config/profesionales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Error al registrar especialista');
    return res.json();
  },
  updateProfesional: async (id: number, data: { nombres?: string; apellidos?: string; numero_colegiatura?: string; especialidad?: string; activo?: boolean; serviciosIds?: number[] }): Promise<any> => {
    const res = await fetch(`${API_URL}/config/profesionales/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Error al actualizar especialista');
    return res.json();
  },

  // Canales y Fuentes
  getCanalesFuentes: async (): Promise<{ canales: CanalConfig[]; fuentes: FuenteConfig[] }> => {
    const res = await fetch(`${API_URL}/config/canales-fuentes`);
    if (!res.ok) throw new Error('Error al obtener canales y fuentes');
    return res.json();
  },
  createCanal: async (data: { nombre: string; activo?: boolean }): Promise<any> => {
    const res = await fetch(`${API_URL}/config/canales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Error al crear canal');
    return res.json();
  },
  updateCanal: async (id: number, data: { nombre?: string; activo?: boolean }): Promise<any> => {
    const res = await fetch(`${API_URL}/config/canales/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Error al actualizar canal');
    return res.json();
  },
  createFuente: async (data: { nombre: string; descripcion?: string; activo?: boolean }): Promise<any> => {
    const res = await fetch(`${API_URL}/config/fuentes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Error al crear fuente');
    return res.json();
  },
  updateFuente: async (id: number, data: { nombre?: string; descripcion?: string; activo?: boolean }): Promise<any> => {
    const res = await fetch(`${API_URL}/config/fuentes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Error al actualizar fuente');
    return res.json();
  },

  // Usuarios y Roles
  getUsuariosRoles: async (): Promise<{ usuarios: UsuarioConfig[]; roles: RolConfig[] }> => {
    const res = await fetch(`${API_URL}/config/usuarios`);
    if (!res.ok) throw new Error('Error al obtener usuarios y roles');
    return res.json();
  },
  createUsuario: async (data: { nombres: string; apellidos: string; email: string; id_rol: number; activo?: boolean }): Promise<any> => {
    const res = await fetch(`${API_URL}/config/usuarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Error al crear usuario');
    return res.json();
  },
  updateUsuario: async (id: number, data: { nombres?: string; apellidos?: string; email?: string; id_rol?: number; activo?: boolean }): Promise<any> => {
    const res = await fetch(`${API_URL}/config/usuarios/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Error al actualizar usuario');
    return res.json();
  },
};
