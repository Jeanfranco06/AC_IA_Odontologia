import crypto from 'crypto';
import { prisma } from '../db';
import { issueAiAgentToken } from '../modules/customer/ai-agent/authContext';

const ITERATIONS = 120_000;

export function hashStaffPassword(password: string): string {
  if (password.length < 12) throw new Error('La contraseña institucional debe tener al menos 12 caracteres.');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, 64, 'sha512').toString('hex');
  return `pbkdf2$${ITERATIONS}$${salt}$${hash}`;
}

function verifyStaffPassword(password: string, encoded: string): boolean {
  const [algorithm, iterationsText, salt, expectedHex] = encoded.split('$');
  const iterations = Number(iterationsText);
  if (algorithm !== 'pbkdf2' || !Number.isInteger(iterations) || iterations < 100_000 || !salt || !expectedHex) return false;
  const actual = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512');
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export class StaffAuthService {
  async login(email: string, password: string) {
    const user = await prisma.usuarios.findUnique({ where: { email: email.trim().toLowerCase() }, include: { Rol: true, Profesional: true } });
    if (!user || !user.activo || !verifyStaffPassword(password, user.password_hash)) throw new Error('Credenciales institucionales inválidas.');
    const roleName = user.Rol.nombre.trim().toUpperCase();
    const isAdmin = ['ADMIN', 'ADMINISTRADOR'].includes(roleName);
    const isReception = roleName.includes('RECEPC') || roleName.includes('SECRET') || roleName.includes('AGENDA');
    const isDentist = isAdmin || roleName.includes('ODONTO') || roleName.includes('DENTAL');
    if (!isDentist && !isReception) throw new Error('El usuario no tiene un perfil autorizado para el agente.');
    if (isDentist && !isAdmin && (!user.Profesional?.activo || !user.Profesional.numero_colegiatura)) throw new Error('El profesional no está activo o colegiado.');
    const role = isAdmin ? 'ADMIN' : isDentist ? 'ODONTOLOGO' : 'RECEPCION';
    const token = issueAiAgentToken({ role, idUsuario: user.id_usuario, idProfesional: user.Profesional?.id_profesional });
    return { accessToken: token, user: { idUsuario: user.id_usuario, name: `${user.nombres} ${user.apellidos}`.trim(), role, idProfesional: user.Profesional?.id_profesional ?? null } };
  }
}

export const staffAuthService = new StaffAuthService();
