import { prisma } from '../../../db';
import { AiAgentError, AiAgentPrincipal } from './types';

export async function treatmentForPrincipal(idTratamiento: number, principal: AiAgentPrincipal) {
  const treatment = await prisma.tratamientosContratados.findUnique({ where: { id_tratamiento: idTratamiento }, include: { Servicios: true, Sedes: true, Profesionales_TratamientosContratados_id_profesional_responsableToProfesionales: true } });
  if (!treatment) throw new AiAgentError('NOT_FOUND', 'Tratamiento no encontrado.');
  if (principal.role === 'PACIENTE' && treatment.id_persona !== principal.idPersona) throw new AiAgentError('NOT_FOUND', 'Tratamiento no encontrado.');
  if (principal.role === 'ODONTOLOGO' && principal.idProfesional !== treatment.id_profesional_responsable) throw new AiAgentError('NOT_FOUND', 'Tratamiento no encontrado.');
  return treatment;
}

export async function attentionForPrincipal(idAtencion: number, principal: AiAgentPrincipal) {
  const attention = await prisma.atenciones.findUnique({ where: { id_atencion: idAtencion }, include: { Servicio: true, Sede: true, Profesional: true, TratamientosContratados: true, SesionesTratamiento: true } });
  if (!attention) throw new AiAgentError('NOT_FOUND', 'Atención no encontrada.');
  const allowed = principal.role === 'ADMIN' ||
    (principal.role === 'PACIENTE' && attention.id_persona === principal.idPersona) ||
    (principal.role === 'ODONTOLOGO' && (attention.id_profesional === principal.idProfesional || attention.TratamientosContratados?.id_profesional_responsable === principal.idProfesional));
  if (!allowed) throw new AiAgentError('NOT_FOUND', 'Atención no encontrada.');
  return attention;
}
