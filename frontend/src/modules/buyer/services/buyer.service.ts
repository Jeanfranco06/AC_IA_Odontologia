import { buyerUseCases } from '@/application/use-cases/buyer';
import type {
  BuyerCatalogs,
  SedeCatalogItem,
  ServicioCatalogItem,
} from '../types/buyer.types';

const useApi = import.meta.env.VITE_USE_API !== 'false';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const buyerService = {
  // ── CATÁLOGOS COMERCIALES ──────────────────────────────────────────
  getCatalogs: async (): Promise<BuyerCatalogs> => {
    if (!useApi) {
      return {
        servicios: [
          { id_servicio: 1, nombre: 'Evaluación General' },
          { id_servicio: 2, nombre: 'Ortodoncia Inicial' },
          { id_servicio: 3, nombre: 'Blanqueamiento Dental' },
          { id_servicio: 4, nombre: 'Implante Dental' },
          { id_servicio: 5, nombre: 'Diseño de Sonrisa' },
          { id_servicio: 6, nombre: 'Odontopediatría' },
        ],
        canales: [
          { id_canal: 1, nombre: 'Presencial (Recepción en Sede)' },
          { id_canal: 2, nombre: 'Llamada Telefónica' },
          { id_canal: 3, nombre: 'WhatsApp Directo' },
          { id_canal: 4, nombre: 'Página Web / Portal Online' },
          { id_canal: 5, nombre: 'Redes Sociales (Instagram / FB / TikTok)' },
          { id_canal: 6, nombre: 'Recomendación / Referido' },
        ],
        fuentes: [
          { id_fuente: 1, nombre: 'Visita Espontánea / Walk-in' },
          { id_fuente: 2, nombre: 'Meta Ads (Instagram / FB)' },
          { id_fuente: 3, nombre: 'Google Ads / Búsqueda' },
          { id_fuente: 4, nombre: 'Búsqueda Orgánica Web' },
          { id_fuente: 5, nombre: 'Recomendación de Paciente' },
        ],
        sedes: [
          { id_sede: 1, nombre: 'Sede California', direccion: 'Av. Larco 820, Urb. California, Trujillo' },
          { id_sede: 2, nombre: 'Sede Primavera', direccion: 'Av. Teodoro Valcárcel 345, Urb. Primavera, Trujillo' },
          { id_sede: 3, nombre: 'Sede Centro Histórico', direccion: 'Jr. Pizarro 456, Centro Histórico, Trujillo' },
        ],
        modalidades: [
          { id_modalidad: 1, nombre: 'Presencial' },
          { id_modalidad: 2, nombre: 'Virtual' },
          { id_modalidad: 3, nombre: 'Teleconsulta' },
          { id_modalidad: 4, nombre: 'Domiciliaria' },
        ],
        horarios: [],
      };
    }
    const res = await fetch(`${API_URL}/buyer/catalogs`);
    if (!res.ok) throw new Error('Error al cargar catálogos comerciales');
    return res.json();
  },

  // ── DEDUPLICACIÓN EN TIEMPO REAL ────────────────────────────────────
  checkDuplicate: async (params: { phone?: string; email?: string; dni?: string; excludeId?: string | number }) => {
    const query = new URLSearchParams();
    if (params.phone) query.append('phone', params.phone);
    if (params.email) query.append('email', params.email);
    if (params.dni) query.append('dni', params.dni);
    if (params.excludeId !== undefined && params.excludeId !== null) query.append('excludeId', String(params.excludeId));

    try {
      const res = await fetch(`${API_URL}/buyer/check-duplicate?${query.toString()}`);
      if (!res.ok) return { isDuplicate: false };
      return res.json();
    } catch (e) {
      console.warn('Error checking duplicate:', e);
      return { isDuplicate: false };
    }
  },

  // ── CAPTACIÓN PÚBLICA (LANDING PAGE - FORMULARIO INTUITIVO) ───────────
  registerOpportunity: async (data: {
    nombre: string;
    telefono: string;
    motivo_consulta?: string;
    id_servicio?: number | null;
    id_sede?: number | null;
    email?: string | null;
    consentimiento_atencion: boolean;
    utm_source?: string;
    utm_campaign?: string;
  }) => {
    const nameParts = data.nombre.trim().split(/\s+/);
    const firstName = nameParts[0] || data.nombre;
    const lastName = nameParts.slice(1).join(' ') || 'General';

    const payload = {
      nombres: firstName,
      apellidos: lastName,
      numero: data.telefono,
      email: data.email || null,
      id_canal: 4, // Página Web
      id_fuente: 4, // Búsqueda Orgánica Web
      id_servicio: data.id_servicio || null,
      id_sede: data.id_sede || null,
      necesidad_declarada: data.motivo_consulta || 'Información de orientación y tratamientos dentales',
      motivo_consulta: data.motivo_consulta || 'Información de orientación y tratamientos dentales',
      autoriza_contacto: data.consentimiento_atencion,
      consentimiento_atencion: data.consentimiento_atencion,
      utm_source: data.utm_source,
      utm_campaign: data.utm_campaign,
    };

    const res = await fetch(`${API_URL}/buyer/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || 'Error al registrar la solicitud');
    }
    return res.json();
  },

  // ── REGISTRO Y CONVERSIÓN CON RESILIENCIA ───────────────────────────
  registerAndConvert: async (data: any) => {
    try {
      const res = await fetch(`${API_URL}/buyer/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        return await res.json();
      }
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || 'Error al registrar la solicitud');
    } catch (err: any) {
      if (!useApi) {
        const buyer = await buyerUseCases.createBuyer(data);
        return buyerUseCases.convertToLead((buyer as any).id || (buyer as any).id_persona);
      }
      throw err;
    }
  },

  // ── OBTENER BUYER POR ID CON FALLBACK ──────────────────────────────
  getBuyerById: async (id: string | number) => {
    if (!useApi) {
      const all = await buyerUseCases.getAllBuyers();
      return all.find((b: any) => String(b.id) === String(id) || String(b.personId) === String(id)) || null;
    }
    try {
      const res = await fetch(`${API_URL}/buyer/${id}`);
      if (res.ok) {
        return res.json();
      }
    } catch (e) {
      console.warn('Error fetching buyer by id directly, trying fallback:', e);
    }
    try {
      const allRes = await fetch(`${API_URL}/buyer`);
      if (allRes.ok) {
        const list = await allRes.json();
        return (
          list.find(
            (b: any) =>
              String(b.id) === String(id) ||
              String(b.personId) === String(id) ||
              String(b.id_oportunidad) === String(id)
          ) || null
        );
      }
    } catch (_) {}
    return null;
  },

  // ── VISTAS Y ADMINISTRACIÓN ─────────────────────────────────────────
  getAllBuyers: async () => {
    if (!useApi) return buyerUseCases.getAllBuyers();
    const res = await fetch(`${API_URL}/buyer`);
    if (!res.ok) throw new Error('Error al cargar buyers');
    return res.json();
  },

  createBuyer: async (data: any) => {
    if (!useApi) return buyerUseCases.createBuyer(data);
    const res = await fetch(`${API_URL}/buyer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al crear buyer');
    }
    return res.json();
  },

  updateBuyer: async (id: string, data: any) => {
    if (!useApi) return buyerUseCases.updateBuyer(id, data);
    const res = await fetch(`${API_URL}/buyer/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al actualizar buyer');
    }
    return res.json();
  },

  convertToLead: async (id: string, payload?: any) => {
    if (!useApi) return buyerUseCases.convertToLead(id);
    const res = await fetch(`${API_URL}/buyer/${id}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al convertir buyer a lead');
    }
    return res.json();
  },
};
