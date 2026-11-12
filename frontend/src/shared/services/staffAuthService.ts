export type StaffRole = 'ODONTOLOGO' | 'RECEPCION' | 'ADMIN';

export interface StaffSession {
  id_usuario: number;
  nombres: string;
  apellidos: string;
  email: string;
  rol: string;
  agentRole: StaffRole;
  accessToken: string;
  idProfesional: number | null;
  initials: string;
  loginAt: string;
}

const STORAGE_KEY = 'nexosalud_staff_session_v2';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'NS';
}

export const staffAuthService = {
  getSession(): StaffSession | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw) as StaffSession;
      if (!session.accessToken || !session.agentRole) return null;
      return session;
    } catch {
      return null;
    }
  },

  getAccessToken(): string | null {
    return this.getSession()?.accessToken ?? null;
  },

  saveSession(session: StaffSession): void {
    const serialized = JSON.stringify(session);
    sessionStorage.setItem(STORAGE_KEY, serialized);
    localStorage.removeItem(STORAGE_KEY);
  },

  logout(): void {
    const token=this.getAccessToken();
    if(token)void fetch(`${API_URL}/staff-auth/logout`,{method:'POST',headers:{Authorization:`Bearer ${token}`},keepalive:true}).catch(()=>undefined);
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
  },

  async authenticate(emailInput: string, passwordInput: string): Promise<StaffSession> {
    const email = emailInput.trim().toLowerCase();
    if (!email || !passwordInput) throw new Error('Ingresa tu correo institucional y contraseña.');

    const response = await fetch(`${API_URL}/staff-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: passwordInput }),
    });
    const result = await response.json().catch(() => null) as {
      success?: boolean;
      accessToken?: string;
      user?: { idUsuario: number; name: string; role: StaffRole; idProfesional: number | null };
      error?: { message?: string };
    } | null;

    if (!response.ok || !result?.accessToken || !result.user) {
      throw new Error(result?.error?.message || 'No se pudo validar el acceso institucional.');
    }

    const [nombres, ...lastNames] = result.user.name.split(/\s+/);
    const session: StaffSession = {
      id_usuario: result.user.idUsuario,
      nombres,
      apellidos: lastNames.join(' '),
      email,
      rol: result.user.role,
      agentRole: result.user.role,
      accessToken: result.accessToken,
      idProfesional: result.user.idProfesional,
      initials: initials(result.user.name),
      loginAt: new Date().toISOString(),
    };
    this.saveSession(session);
    return session;
  },
};
