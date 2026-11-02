export interface PatientSession {
  id_persona: number;
  nombres: string;
  apellidos: string;
  fullName: string;
  dni: string;
  email: string | null;
  numero: string | null;
  sede_preferida: string | null;
  id_etapa_actual: number;
  etapa_nombre: string;
  ultima_atencion?: {
    fecha: string;
    servicio: string;
    doctor: string;
    sede: string;
  } | null;
  proxima_cita?: {
    id_reserva: number;
    fecha: string;
    hora: string;
    servicio: string;
    doctor: string;
    sede: string;
    estado: string;
  } | null;
}

const API_BASE = '/api/patient-auth';

export const patientAuthApi = {
  async loginWithPassword(dni: string, password: string): Promise<PatientSession> {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');
    return data.session;
  },

  async sendOtp(dni: string): Promise<{ success: boolean; maskedPhone: string; debugOtp?: string; message: string }> {
    const res = await fetch(`${API_BASE}/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al enviar código');
    return data;
  },

  async verifyOtp(dni: string, otpCode: string): Promise<PatientSession> {
    const res = await fetch(`${API_BASE}/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni, otpCode })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Código incorrecto o expirado');
    return data.session;
  },

  async validateToken(token: string): Promise<{ valid: boolean; message?: string; patient?: any }> {
    const res = await fetch(`${API_BASE}/validate-token/${token}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error validando enlace');
    return data;
  },

  async activatePassword(token: string, newPassword: string): Promise<{ success: boolean; message: string; sessionData: PatientSession }> {
    const res = await fetch(`${API_BASE}/activate-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error configurando contraseña');
    return data;
  },

  async createExpressAppointment(data: {
    id_persona: number;
    id_servicio?: number;
    sede_preferida?: string;
    horario_preferido?: string;
    duda_especifica?: string;
  }): Promise<{ success: boolean; id_solicitud: number; message: string }> {
    const res = await fetch(`${API_BASE}/express-appointment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const resData = await res.json();
    if (!res.ok) throw new Error(resData.error || 'Error al registrar cita express');
    return resData;
  }
};

