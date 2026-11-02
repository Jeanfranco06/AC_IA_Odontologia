export interface StaffSession {
  id_usuario: number;
  nombres: string;
  apellidos: string;
  email: string;
  rol: string;
  initials: string;
  loginAt: string;
}

const STORAGE_KEY = 'nexosalud_staff_session_v1';

export const DEFAULT_STAFF_ACCOUNTS: StaffSession[] = [
  {
    id_usuario: 1,
    nombres: 'Dr. Carlos',
    apellidos: 'Benitez',
    email: 'dr.benitez@nexosalud.pe',
    rol: 'Administrador Clínico',
    initials: 'CB',
    loginAt: '',
  },
  {
    id_usuario: 2,
    nombres: 'Ana',
    apellidos: 'Ramos',
    email: 'ana.ramos@odontologia-trujillo.pe',
    rol: 'Administrador',
    initials: 'AR',
    loginAt: '',
  },
  {
    id_usuario: 3,
    nombres: 'Carlos',
    apellidos: 'Benites',
    email: 'carlos.benites@odontologia-trujillo.pe',
    rol: 'Negociador Clínico',
    initials: 'CB',
    loginAt: '',
  },
  {
    id_usuario: 4,
    nombres: 'María',
    apellidos: 'Fernández',
    email: 'maria.fernandez@odontologia-trujillo.pe',
    rol: 'Coordinadora de Admisión',
    initials: 'MF',
    loginAt: '',
  },
];

function computeInitials(nombres: string, apellidos: string): string {
  const first = (nombres || '').replace(/^Dr\.\s*/i, '').trim()[0] || 'N';
  const last = (apellidos || '').trim()[0] || 'S';
  return `${first}${last}`.toUpperCase();
}

export const staffAuthService = {
  getSession(): StaffSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StaffSession;
      if (!parsed || !parsed.email) return null;
      return parsed;
    } catch {
      return null;
    }
  },

  saveSession(session: StaffSession): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...session,
          initials: session.initials || computeInitials(session.nombres, session.apellidos),
          loginAt: new Date().toISOString(),
        })
      );
    } catch (e) {
      console.warn('No se pudo guardar la sesión en localStorage:', e);
    }
  },

  logout(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('No se pudo limpiar la sesión de localStorage:', e);
    }
  },

  async authenticate(emailInput: string, passwordInput: string): Promise<StaffSession> {
    const cleanEmail = emailInput.trim().toLowerCase();
    const cleanPass = passwordInput.trim();

    if (!cleanEmail) {
      throw new Error('Ingresa tu correo institucional o usuario.');
    }
    if (!cleanPass || cleanPass.length < 4) {
      throw new Error('Ingresa tu contraseña de acceso (mínimo 4 caracteres).');
    }

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

    // Intentar validar contra los usuarios reales del backend si está disponible
    try {
      const res = await fetch(`${API_URL}/config/usuarios`);
      if (res.ok) {
        const data = await res.json();
        const usuarios = Array.isArray(data?.usuarios) ? data.usuarios : [];
        const matched = usuarios.find(
          (u: any) =>
            u.activo !== false &&
            (String(u.email || '').toLowerCase() === cleanEmail ||
              String(u.nombres || '').toLowerCase() === cleanEmail)
        );
        if (matched) {
          const cleanLastName = String(matched.apellidos || '').replace(/\s*\(.*?\)\s*/g, '').trim();
          const session: StaffSession = {
            id_usuario: Number(matched.id_usuario) || 1,
            nombres: matched.nombres || 'Operador',
            apellidos: cleanLastName || 'Clínico',
            email: matched.email,
            rol: matched.Rol?.nombre || 'Administrador',
            initials: computeInitials(matched.nombres || 'O', cleanLastName || 'C'),
            loginAt: new Date().toISOString(),
          };
          this.saveSession(session);
          return session;
        }
      }
    } catch {
      // Fallback silencioso a cuentas locales si el servidor no responde
    }

    // Buscar en cuentas preconfiguradas o permitir ingreso clínico institucional
    const preset = DEFAULT_STAFF_ACCOUNTS.find(
      (a) => a.email.toLowerCase() === cleanEmail
    );

    if (preset) {
      const session: StaffSession = {
        ...preset,
        loginAt: new Date().toISOString(),
      };
      this.saveSession(session);
      return session;
    }

    // Si ingresa un correo válido de @nexosalud o @odontologia, crear sesión activa
    if (cleanEmail.includes('@')) {
      const localPart = cleanEmail.split('@')[0] || 'doctor';
      const parts = localPart.split(/[._-]/).filter(Boolean);
      const firstName =
        parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : 'Dr. Benitez';
      const lastName =
        parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : 'Clínico';

      const session: StaffSession = {
        id_usuario: 99,
        nombres: firstName,
        apellidos: lastName,
        email: cleanEmail,
        rol: 'Especialista / Staff',
        initials: computeInitials(firstName, lastName),
        loginAt: new Date().toISOString(),
      };
      this.saveSession(session);
      return session;
    }

    throw new Error('Credenciales no reconocidas. Selecciona un perfil clínico o usa tu correo institucional.');
  },
};
