import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../db';
import { AiAgentError } from './types';
import type { AiAgentPrincipal } from './types';
export async function assertCurrentIdentity(p:AiAgentPrincipal) {
  if(p.role==='PACIENTE')return;
  const user=await prisma.usuarios.findUnique({where:{id_usuario:p.idUsuario},include:{Rol:true,Profesional:true}});
  const name=user?.Rol.nombre.trim().toUpperCase()??'';
  const current=['ADMIN','ADMINISTRADOR'].includes(name)?'ADMIN':name.includes('ODONTO')||name.includes('DENTAL')?'ODONTOLOGO':name.includes('RECEPC')||name.includes('SECRET')||name.includes('AGENDA')?'RECEPCION':null;
  if(!user?.activo||current!==p.role||(p.role==='ODONTOLOGO'&&(!user.Profesional?.activo||!user.Profesional.numero_colegiatura||user.Profesional.id_profesional!==p.idProfesional)))throw new AiAgentError('UNAUTHENTICATED','La identidad institucional ya no está habilitada para este perfil.');
}
const attempts = new Map<string, { count: number; expires: number }>();
export function limitAuthentication(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  for (const [key,row] of attempts) if (row.expires < now) attempts.delete(key);
  const bucket = `${req.ip}:${req.path}`;
  const row = attempts.get(bucket) ?? { count: 0, expires: now + 600000 }; row.count++; attempts.set(bucket,row);
  if (row.count > 10) { res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Demasiados intentos. Reintente más tarde.' } }); return; }
  next();
}
export async function enforceSession(token: string, expires: number) {
  const id = crypto.createHash('sha256').update(token).digest('hex');
  const row = await prisma.sesionesAccesoIA.findUnique({ where: { id_sesion: id } });
  if (row?.fecha_revocacion) throw new AiAgentError('UNAUTHENTICATED','La sesión fue revocada.');
  if (!row) await prisma.$executeRaw`INSERT dbo.SesionesAccesoIA(id_sesion,fecha_expiracion) SELECT ${id},${new Date(expires)} WHERE NOT EXISTS(SELECT 1 FROM dbo.SesionesAccesoIA WITH(UPDLOCK,HOLDLOCK) WHERE id_sesion=${id})`;
  const current=await prisma.sesionesAccesoIA.findUnique({where:{id_sesion:id}});
  if(current?.fecha_revocacion)throw new AiAgentError('UNAUTHENTICATED','La sesión fue revocada.');
}
export async function revokeSession(token: string) {
  const id = crypto.createHash('sha256').update(token).digest('hex');
  await enforceSession(token,Date.now());
  return prisma.sesionesAccesoIA.update({where:{id_sesion:id},data:{fecha_revocacion:new Date()}});
}
