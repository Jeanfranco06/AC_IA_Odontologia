import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { AiAgentError, AiAgentPrincipal, AiAgentRole } from './types';
import { enforceSession,assertCurrentIdentity } from './securityControls';

const secret = () => process.env.AI_AGENT_SESSION_SECRET || process.env.SESSION_SECRET;

export function issueAiAgentToken(principal: AiAgentPrincipal): string {
  const key = secret();
  if (!key) throw new Error('AI_AGENT_SESSION_SECRET is not configured');
  const payload = Buffer.from(JSON.stringify({ ...principal, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', key).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyAiAgentToken(token: string): AiAgentPrincipal {
  const key = secret();
  if (!key) throw new AiAgentError('SERVICE_UNAVAILABLE', 'La autenticación del agente no está configurada.');
  const parts=token.split('.');
  if(parts.length!==2)throw new AiAgentError('UNAUTHENTICATED','Formato de credencial inválido.');
  const [payload, signature] = parts;
  if (!payload || !signature) throw new AiAgentError('UNAUTHENTICATED', 'Credenciales inválidas.');
  const expected = crypto.createHmac('sha256', key).update(payload).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new AiAgentError('UNAUTHENTICATED', 'Credenciales inválidas.');
  let claims: AiAgentPrincipal & { exp: number };
  try { claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AiAgentPrincipal & { exp: number }; }
  catch { throw new AiAgentError('UNAUTHENTICATED', 'Credenciales inválidas.'); }
  if (!claims.exp || claims.exp < Date.now() || !['PACIENTE', 'ODONTOLOGO', 'RECEPCION', 'ADMIN'].includes(claims.role)) throw new AiAgentError('UNAUTHENTICATED', 'Credenciales expiradas o inválidas.');
  const positive = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0;
  if ((claims.role === 'PACIENTE' && !positive(claims.idPersona)) ||
      (claims.role !== 'PACIENTE' && !positive(claims.idUsuario)) ||
      (claims.role === 'ODONTOLOGO' && !positive(claims.idProfesional))) throw new AiAgentError('UNAUTHENTICATED', 'La identidad del perfil esta incompleta.');
  return claims;
}

export async function aiAgentAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.header('authorization');
    if (!header?.startsWith('Bearer ')) throw new AiAgentError('UNAUTHENTICATED', 'Se requiere autenticación.');
    const claims = verifyAiAgentToken(header.slice(7));
    if (process.env.NODE_ENV !== 'test' || process.env.AI_AGENT_SESSION_REVOCATION_REQUIRED === 'true') {
      await enforceSession(header.slice(7), (claims as AiAgentPrincipal & {exp:number}).exp);
      await assertCurrentIdentity(claims);
    }
    (req as Request & { aiPrincipal: AiAgentPrincipal }).aiPrincipal = claims;
    next();
  } catch (error) { next(error); }
}

export function principalOf(req: Request): AiAgentPrincipal {
  const principal = (req as Request & { aiPrincipal?: AiAgentPrincipal }).aiPrincipal;
  if (!principal) throw new AiAgentError('UNAUTHENTICATED', 'Se requiere autenticación.');
  return principal;
}

export function requireRole(...roles: AiAgentRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try { if (!roles.includes(principalOf(req).role)) throw new AiAgentError('FORBIDDEN', 'El perfil no está autorizado para esta operación.'); next(); } catch (error) { next(error); }
  };
}
