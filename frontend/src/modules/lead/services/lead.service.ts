import { leadUseCases } from '@/application/use-cases/lead';

const useApi = import.meta.env.VITE_USE_API !== 'false';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const leadService = {
  getLeadDetails: async (id: string) => {
    const cleanId = id ? (id.replace(/\D/g, '') || id) : id;
    let data: any = null;

    try {
      const res = await fetch(`${API_URL}/lead/${cleanId}`);
      if (res.ok) {
        data = await res.json();
      }
    } catch (err) {
      console.warn('Backend fetch for lead failed, attempting fallback:', err);
    }

    if (!data && !useApi) {
      data = await leadUseCases.getLeadById(id);
    }

    if (!data) return null;

    // Direct backend Prisma object structure (has nombres/apellidos)
    if (data.nombres || data.apellidos) {
      return data;
    }

    // Mock/Domain object structure (has person property)
    if (data.person) {
      return {
        id_persona: Number(data.id || id),
        nombres: data.person.firstName || '',
        apellidos: data.person.lastName || '',
        email: data.person.email || '',
        numero: data.person.phone || '',
        dni: data.person.documentNumber || '',
        Interacciones: [{ Canal: { nombre: data.buyer?.channel || 'Web' } }],
        Solicitudes: [{
          id_solicitud: 1,
          Servicio: { nombre: data.requestedServiceId || 'Evaluación' },
          motivo: data.buyer?.concreteRequest || '',
          Opciones: (data.alternatives || []).map((alt: any) => ({
            id_opcion: alt.id,
            precio_ofrecido: alt.price,
            seleccionada: alt.id === data.selectedAlternativeId,
            Disponibilidad: {
              fecha: alt.date + "T00:00:00.000Z",
              hora_inicio: "1970-01-01T" + alt.time + ":00.000Z",
              hora_fin: "1970-01-01T" + alt.time + ":00.000Z",
              Sede: { nombre: alt.branch },
              Profesional: { apellidos: alt.professional }
            }
          }))
        }],
        Preferencias: [{ sede_preferida: data.declaredPreferences || data.buyer?.preferences || 'Sede Central' }],
        SaludOdontologica: data.SaludOdontologica || (data.saludOdontologica ? [data.saludOdontologica] : (data.buyer?.saludOdontologica ? [data.buyer.saludOdontologica] : [])),
        DatosAcademicos: data.DatosAcademicos || (data.datosAcademicos ? [data.datosAcademicos] : (data.buyer?.datosAcademicos ? [data.buyer.datosAcademicos] : [])),
        DatosLaborales: data.DatosLaborales || (data.datosLaborales ? [data.datosLaborales] : (data.buyer?.datosLaborales ? [data.buyer.datosLaborales] : [])),
      };
    }

    return data;
  },

  getAvailabilityOptions: async () => {
    try {
      const res = await fetch(`${API_URL}/lead/options/availability`);
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn('Backend fetch for availability options failed:', err);
    }
    return { profesionales: [], sedes: [], servicios: [], disponibilidades: [] };
  },

  reserve: async (id: string, data: any) => {
    if (!useApi) {
      if (!data.id_opcion) throw new Error('Opcion no seleccionada');
      return leadUseCases.selectAlternativeAndReserve(id, data.id_opcion);
    }
    const res = await fetch(`${API_URL}/lead/${id}/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al registrar reserva');
    return res.json();
  },

  getAllLeads: async () => {
    if (!useApi) return leadUseCases.getAllLeads();
    const res = await fetch(`${API_URL}/lead`);
    if (!res.ok) throw new Error('Error al cargar leads');
    return res.json();
  },

  updateLead: async (id: string, data: any) => {
    if (!useApi) return leadUseCases.updateLead(id, data);
    const res = await fetch(`${API_URL}/lead/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al actualizar lead');
    return res.json();
  },

  addAlternative: async (id: string, data: any) => {
    if (!useApi) return leadUseCases.addAlternative(id, data);
    const res = await fetch(`${API_URL}/lead/${id}/alternative`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al añadir alternativa');
    return res.json();
  },

  updateAlternative: async (id_opcion: number | string, data: any) => {
    if (!useApi) return leadUseCases.updateAlternative(id_opcion as string, data);
    const res = await fetch(`${API_URL}/lead/options/${id_opcion}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al actualizar alternativa');
    return res.json();
  },

  deleteAlternative: async (id_opcion: number | string) => {
    if (!useApi) return leadUseCases.deleteAlternative(id_opcion as string);
    const res = await fetch(`${API_URL}/lead/options/${id_opcion}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Error al eliminar alternativa');
    return res.json();
  },

  convertToPayer: async (id: string, data: any = {}) => {
    if (!useApi) return leadUseCases.convertToPayer(id);
    const res = await fetch(`${API_URL}/lead/${id}/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al convertir lead a payer');
    return res.json();
  },

  abandonLead: async (id: string, motivo?: string) => {
    if (!useApi) return null;
    const res = await fetch(`${API_URL}/lead/${id}/abandon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo })
    });
    if (!res.ok) throw new Error('Error al registrar abandono del lead');
    return res.json();
  },

  generateCanvaFlyer: async (leadId: string | number, payload: any) => {
    const endpoints = [
      `${API_URL}/leads/${leadId}/canva-flyer`,
      `${API_URL}/lead/${leadId}/canva-flyer`,
      `/api/leads/${leadId}/canva-flyer`,
      `/api/lead/${leadId}/canva-flyer`,
      `https://proyecto-odontologia-backend.onrender.com/api/leads/${leadId}/canva-flyer`,
      `https://proyecto-odontologia-backend.onrender.com/api/lead/${leadId}/canva-flyer`,
    ];

    let lastError: any = null;
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            return await res.json();
          }
        }
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error('No se pudo conectar con el servicio de Canva');
  },

  sendNegotiationEmail: async (leadId: string | number, payload: any) => {
    const endpoints = [
      `${API_URL}/lead/send-offer-email`,
      `${API_URL}/leads/${leadId}/send-email`,
      `${API_URL}/lead/${leadId}/send-email`,
      `https://proyecto-odontologia-backend.onrender.com/api/lead/send-offer-email`,
      `https://proyecto-odontologia-backend.onrender.com/api/lead/${leadId}/send-email`,
    ];

    const uniqueEndpoints = Array.from(new Set(endpoints));

    let lastError: any = null;
    for (const ep of uniqueEndpoints) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, leadId }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            return await res.json();
          }
        }
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error('No se pudo enviar el correo de simulación');
  },

  exchangeCanvaCode: async (code: string) => {
    const endpoints = [
      `${API_URL}/canva/exchange`,
      `${API_URL}/canva-exchange`,
      `/api/canva/exchange`,
      `/api/canva-exchange`,
      `https://proyecto-odontologia-backend.onrender.com/api/canva/exchange`,
    ];
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        if (res.ok) return await res.json();
      } catch (_) {}
    }
    throw new Error('Error al intercambiar código de Canva');
  },

  getCanvaAuthUrl: async () => {
    const endpoints = [
      `${API_URL}/canva/auth-url`,
      `/api/canva/auth-url`,
      `https://proyecto-odontologia-backend.onrender.com/api/canva/auth-url`,
    ];
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep);
        if (res.ok) {
          const data = await res.json();
          if (data.authUrl) return data.authUrl;
        }
      } catch (_) {}
    }
    const clientId = 'OC-AaDW_EAnA5pf';
    const redirectUri = encodeURIComponent('https://proyecto-in-odontologia.vercel.app/lead');
    const scopes = encodeURIComponent('brandtemplate:content:read brandtemplate:meta:read design:content:read design:content:write design:meta:read asset:read asset:write');
    const codeChallenge = 'Lbn6gs4NoMLnUCyrIV9yLsreYNFd1XtBOt8Cx5igIbI';
    return `https://www.canva.com/api/oauth/authorize?code_challenge_method=s256&response_type=code&client_id=${clientId}&scope=${scopes}&code_challenge=${codeChallenge}&redirect_uri=${redirectUri}`;
  },

  getPublicOffer: async (leadId: string | number) => {
    const cleanId = String(leadId).replace(/\D/g, '') || leadId;
    const endpoints = [
      `${API_URL}/lead/public/${cleanId}`,
      `/api/lead/public/${cleanId}`,
      `https://proyecto-odontologia-backend.onrender.com/api/lead/public/${cleanId}`,
    ];
    let lastError = null;
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep);
        if (res.ok) return await res.json();
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError || new Error('No se pudo cargar la oferta comercial');
  },

  submitPublicPreReserve: async (leadId: string | number, payload: any) => {
    const cleanId = String(leadId).replace(/\D/g, '') || leadId;
    const endpoints = [
      `${API_URL}/lead/public/${cleanId}/pre-reserve`,
      `/api/lead/public/${cleanId}/pre-reserve`,
      `https://proyecto-odontologia-backend.onrender.com/api/lead/public/${cleanId}/pre-reserve`,
    ];
    let lastError = null;
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) return await res.json();
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al procesar la pre-reserva');
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError || new Error('No se pudo completar la pre-reserva');
  },
};