import crypto from 'crypto';
import { prisma } from '../../../../db';
import { CustomerAiPersistenceService } from '../../../../services/customerAiPersistenceService';
import { AiAgentError, AiAgentPrincipal } from '../types';
import { treatmentForPrincipal, attentionForPrincipal } from '../policies';
import { GeminiProvider } from '../llm/geminiProvider';
import {persistCustomerInteraction} from '../../../../services/customerInteractionAudit';
import { LlmProvider, runtimeConfig } from '../llm/provider';
import { AftercareSchedulerService } from './aftercareSchedulerService';

type Principal = AiAgentPrincipal;
type Tx = any;
const hash = (value: unknown) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const active = ['Activado', 'En ejecución', 'Contratado', 'Activo', 'En curso', 'En_Curso'];
const fields = ['motivo_consulta', 'antecedentes', 'alergias', 'evaluacion', 'procedimiento', 'observaciones', 'indicaciones_finales'] as const;
export type ClinicalField = typeof fields[number];
const validSections = (sections: ClinicalSections) => sections && typeof sections === 'object' && !Array.isArray(sections) && Object.keys(sections).every(f => fields.includes(f as ClinicalField)) && Object.entries(sections).every(([f,v]) => typeof v === 'string' && v.length <= (['motivo_consulta','alergias'].includes(f) ? 300 : 500));
export type ClinicalSections = Partial<Record<ClinicalField, string>>;
const clinicalNoteAliases: Record<string, ClinicalField> = {
  motivo: 'motivo_consulta', 'motivo de consulta': 'motivo_consulta', motivo_consulta: 'motivo_consulta',
  consulta: 'motivo_consulta', 'motivo de la consulta': 'motivo_consulta',
  antecedente: 'antecedentes', antecedentes: 'antecedentes', 'antecedentes medicos': 'antecedentes', 'antecedentes clinicos': 'antecedentes', 'historia medica': 'antecedentes',
  alergia: 'alergias', alergias: 'alergias', 'alergias documentadas': 'alergias', 'alergias conocidas': 'alergias',
  evaluacion: 'evaluacion', 'evaluacion declarada': 'evaluacion', 'evaluacion y exploracion clinica': 'evaluacion', 'evaluacion y exploracion': 'evaluacion', 'evaluacion clinica': 'evaluacion', examen: 'evaluacion', 'examen clinico': 'evaluacion', diagnostico: 'evaluacion', 'diagnostico clinico': 'evaluacion', exploracion: 'evaluacion', evolucion: 'evaluacion',
  procedimiento: 'procedimiento', 'procedimiento realizado': 'procedimiento', 'procedimiento registrado': 'procedimiento', tratamiento: 'procedimiento', 'tratamiento realizado': 'procedimiento', intervencion: 'procedimiento', acto: 'procedimiento',
  observacion: 'observaciones', observaciones: 'observaciones', 'observaciones clinicas': 'observaciones', nota: 'observaciones', notas: 'observaciones', comentario: 'observaciones', comentarios: 'observaciones',
  indicacion: 'indicaciones_finales', indicaciones: 'indicaciones_finales', 'indicaciones finales': 'indicaciones_finales', indicaciones_finales: 'indicaciones_finales', 'indicaciones post-atencion': 'indicaciones_finales', 'indicaciones postatencion': 'indicaciones_finales', 'indicaciones del profesional': 'indicaciones_finales', receta: 'indicaciones_finales', prescripcion: 'indicaciones_finales', cuidados: 'indicaciones_finales', 'cuidados posteriores': 'indicaciones_finales', pautas: 'indicaciones_finales'
};
function clinicalNoteLines(notes: string) {
  let currentField: ClinicalField | undefined = undefined;
  const result: Array<{ field?: ClinicalField; text: string }> = [];
  for (const rawLine of notes.split('\n')) {
    const text = rawLine.trim();
    if (!text) continue;
    const match = /^([^:]+):\s*(.*)$/.exec(text);
    const parsedField = match ? clinicalNoteAliases[match[1]!.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()] : undefined;
    if (parsedField && match) {
      currentField = parsedField;
      if (match[2]!.trim()) {
        result.push({ field: currentField, text: match[2]!.trim() });
      }
    } else if (currentField) {
      result.push({ field: currentField, text });
    } else {
      result.push({ field: undefined, text });
    }
  }
  return result;
}
function role(p: Principal, ...roles: Principal['role'][]) {
  if (!roles.includes(p.role) || (p.role !== 'PACIENTE' && !p.idUsuario)) throw new AiAgentError('FORBIDDEN', 'Perfil o identidad institucional no autorizado.');
}
function input(condition: unknown, message: string): asserts condition { if (!condition) throw new AiAgentError('INVALID_INPUT', message); }
function key(p: Principal, type: string, value: string) { input(typeof value === 'string' && value.length > 0 && value.length <= 120, 'Falta una clave de idempotencia válida.'); return hash([p.role, p.idPersona, p.idUsuario, type, value]); }
function slotTime(slot: any) { return new Date(Date.UTC(slot.fecha.getUTCFullYear(), slot.fecha.getUTCMonth(), slot.fecha.getUTCDate(), slot.hora_inicio.getUTCHours(), slot.hora_inicio.getUTCMinutes())); }
export interface CustomerAuditResource {personId?:number;treatmentId?:number;attentionId?:number;sessionId?:number;reviewed?:boolean;}
export async function auditCustomer(p: Principal, type: string, resource: CustomerAuditResource = {}, result = 'Completada', correlationId: string = crypto.randomUUID(), tx?: Tx) {
  return persistCustomerInteraction({ id_persona: resource.personId ?? p.idPersona ?? null, id_profesional: p.idProfesional ?? null, id_usuario_actor: p.idUsuario ?? null, id_usuario_revisor: resource.reviewed ? p.idUsuario ?? null : null, id_tratamiento: resource.treatmentId ?? null, id_atencion: resource.attentionId ?? null, id_sesion:resource.sessionId??null, actor_orientado: p.role, tipo_evento: type, resumen_consulta: 'Evento CUSTOMER; no se conserva el texto conversacional', resultado: result.slice(0, 200), id_correlacion: correlationId, version_agente: 'CUSTOMER-COMPLETE-v1', estado: result === 'Fallida' ? 'Rechazada' : 'Completada',es_diagnostico_o_prescripcion:false },tx);
}

export class CustomerCompletionService {
  static async requireProfessional(p: Principal) {
    role(p, 'ODONTOLOGO');
    if (!Number.isSafeInteger(p.idProfesional) || !p.idProfesional || p.idProfesional < 1) throw new AiAgentError('FORBIDDEN', 'Falta identidad profesional verificable.');
    const professional = await prisma.profesionales.findUnique({ where: { id_profesional: p.idProfesional }, select: { activo: true, numero_colegiatura: true } });
    if (!professional?.activo || !professional.numero_colegiatura) throw new AiAgentError('FORBIDDEN', 'Se requiere profesional activo y colegiado.');
  }
  static async policy(code: string, serviceId?: number, tx: Tx = prisma) {
    return tx.politicasCustomerIA.findFirst({ where: { codigo: code, estado: 'Publicada', ...(serviceId ? { id_servicio: serviceId } : {}) }, orderBy: { version: 'desc' } });
  }
  static async policies(p: Principal) { role(p, 'ADMIN', 'ODONTOLOGO'); return prisma.politicasCustomerIA.findMany({ orderBy: [{ codigo: 'asc' }, { version: 'desc' }] }); }
  static async createPolicy(p: Principal, data: { code: string; version: number; serviceId?: number; configuration: any }) {
    role(p, 'ADMIN');
    input(['DOCUMENTACION', 'CONFIRMACION', 'DERIVACION', 'PLANTILLA_INDICACIONES'].includes(data.code) && Number.isInteger(data.version) && data.version > 0, 'Código o versión de política inválido.');
    const c = data.configuration;
    input(c && typeof c === 'object' && !Array.isArray(c) && typeof c.sourceReference === 'string' && c.sourceReference.trim().length > 0, 'La política requiere procedencia y configuración.');
    if (data.code === 'DOCUMENTACION') input(Number.isInteger(data.serviceId) && Array.isArray(c.requiredFields) && c.requiredFields.every((f: unknown) => fields.includes(f as ClinicalField)) && c.requiredFields.length > 0, 'Los requisitos deben identificar servicio y campos soportados.');
    if (data.code === 'CONFIRMACION') input(Number.isInteger(c.windowMinutes) && c.windowMinutes > 0 && c.windowMinutes <= 43200, 'Ventana temporal inválida.');
    if (data.code === 'DERIVACION') input(c.prioritization === 'REVISION_HUMANA' && Array.isArray(c.triggers) && c.triggers.every((v: unknown) => typeof v === 'string' && v.length >= 3), 'Defina disparadores institucionales y revisión humana sin prioridad médica automática.');
    if (data.code === 'PLANTILLA_INDICACIONES') input(typeof c.text === 'string' && c.text.trim().length > 0 && data.serviceId, 'Falta plantilla y servicio.');
    const row = await prisma.politicasCustomerIA.create({ data: { codigo: data.code, version: data.version, id_servicio: data.serviceId, configuracion: JSON.stringify(c), id_usuario_creador: p.idUsuario! } });
    await auditCustomer(p, 'POLITICA_PROPUESTA', {}, `Política ${row.id_politica}`); return row;
  }
  static async transitionPolicy(p: Principal, id: number, publish: boolean) {
    if (publish) role(p, 'ADMIN'); else await this.requireProfessional(p);
    return prisma.$transaction(async tx => {
      const row = await tx.politicasCustomerIA.findUnique({ where: { id_politica: id } });
      if (!row || row.estado !== (publish ? 'Revisada' : 'Borrador')) throw new AiAgentError('CONFLICT', 'La política no admite esta transición.');
      const change = await tx.politicasCustomerIA.updateMany({ where: { id_politica: id, estado: row.estado }, data: publish ? { estado: 'Publicada', fecha_publicacion: new Date() } : { estado: 'Revisada', id_profesional_revisor: p.idProfesional, fecha_revision: new Date() } });
      if (change.count !== 1) throw new AiAgentError('CONFLICT', 'La política cambió durante la revisión.');
      await auditCustomer(p, publish ? 'POLITICA_PUBLICADA' : 'POLITICA_REVISADA', {reviewed:true}, `Política ${id}`, undefined, tx);
      return tx.politicasCustomerIA.findUnique({ where: { id_politica: id } });
    }, { isolationLevel: 'Serializable' });
  }
  static async pendingSessions(p: Principal, treatmentId: number) {
    const t = await treatmentForPrincipal(treatmentId, p);
    const plan = await prisma.planTratamiento.findFirst({ where: { id_tratamiento: treatmentId, es_vigente: true }, orderBy: { version_plan: 'desc' } });
    if (!plan || !Number.isInteger(plan.sesiones_planificadas) || plan.sesiones_planificadas < 1 || !Number.isInteger(plan.duracion_estimada) || plan.duracion_estimada <= 0 || !active.includes(t.estado_tratamiento)) throw new AiAgentError('CONFLICT', 'No hay un plan vigente activo que permita programar.');
    const sessions = await prisma.sesionesTratamiento.findMany({ where: { id_tratamiento: treatmentId }, select: { numero_sesion: true } });
    const used = new Set(sessions.map(s => s.numero_sesion));
    return { treatmentId, planId: plan.id_plan, planVersion: plan.version_plan, durationMinutes: plan.duracion_estimada, pendingNumbers: Array.from({ length: plan.sesiones_planificadas }, (_, i) => i + 1).filter(n => n > 1 && !used.has(n)) };
  }
  static async slots(p: Principal, treatmentId: number) {
    // Recepción recibe únicamente la proyección de agenda, sin expediente clínico.
    const t = p.role === 'RECEPCION' ? await prisma.tratamientosContratados.findUnique({ where: { id_tratamiento: treatmentId } }) : await treatmentForPrincipal(treatmentId, p);
    if (!t || !active.includes(t.estado_tratamiento)) throw new AiAgentError('NOT_FOUND', 'Tratamiento no disponible.');
    const plan = await prisma.planTratamiento.findFirst({ where: { id_tratamiento: treatmentId, es_vigente: true }, orderBy: { version_plan: 'desc' } });
    if (!plan || !Number.isInteger(plan.sesiones_planificadas) || plan.sesiones_planificadas < 1 || !Number.isInteger(plan.duracion_estimada) || plan.duracion_estimada <= 0) throw new AiAgentError('CONFLICT', 'No hay un plan vigente válido que permita ofrecer horarios.');
    const rows = await prisma.disponibilidad.findMany({ where: { id_profesional: t.id_profesional_responsable, id_sede: t.id_sede, estado: 'Disponible', disponible: true, fecha: { gte: new Date(new Date().toISOString().slice(0, 10)) }, Opciones: { none: { Reservas: { some: {} } } } }, include:{Profesional:true,Sede:true}, orderBy: [{ fecha: 'asc' }, { hora_inicio: 'asc' }], take: 100 });
    const sessions = await prisma.sesionesTratamiento.findMany({ where: { id_profesional: t.id_profesional_responsable, estado_programacion: { in: ['Programada', 'Confirmada', 'Reprogramada'] }, estado_asistencial: { not: 'Inasistida' } } });
    return rows.filter(slot => {
      const start = slotTime(slot); const duration = (slot.hora_fin.getTime() - slot.hora_inicio.getTime()) / 60000;
      return start > new Date() && duration >= (plan?.duracion_estimada ?? 0) && !sessions.some(s => start < new Date(s.fecha_programada_vigente.getTime() + s.duracion_programada_min * 60000) && s.fecha_programada_vigente < new Date(start.getTime() + (plan?.duracion_estimada ?? 0) * 60000));
    }).map(slot => ({ slotId: slot.id_disponibilidad, durationMinutes: (slot.hora_fin.getTime() - slot.hora_inicio.getTime()) / 60000, date: slotTime(slot).toISOString(), professionalId: slot.id_profesional, branchId: slot.id_sede, professionalName:`${slot.Profesional.nombres} ${slot.Profesional.apellidos}`,branchName:slot.Sede.nombre, sourceTimeStandard: 'UTC' }));
  }
  static async prepareScheduling(p: Principal, treatmentId: number, number: number, slotId: number, idempotencyKey: string) {
    role(p, 'PACIENTE');
    const pending = await this.pendingSessions(p, treatmentId);
    input(pending.pendingNumbers.includes(number), 'La sesión ya existe o queda fuera del plan.');
    const slot = (await this.slots(p, treatmentId)).find(slot => slot.slotId === slotId);
    input(slot, 'El horario no es elegible.');
    const payload = { type: 'AGENDAMIENTO', patientId: p.idPersona, treatmentId, number, slotId,date:slot.date,professionalName:slot.professionalName,branchName:slot.branchName, planId: pending.planId, key: key(p, 'AGENDAMIENTO', idempotencyKey), expires: Date.now() + 900000 };
    const secret = process.env.AI_AGENT_SESSION_SECRET || process.env.SESSION_SECRET;
    if (!secret) throw new AiAgentError('SERVICE_UNAVAILABLE', 'Falta configuración de firma.');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return { status: 'PREPARED', requiresConfirmation: true, summary: `Sesión ${number}: ${new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Lima' }).format(new Date(slot.date))} (hora de Lima) · ${slot.professionalName} · ${slot.branchName}. Propuesta aún no registrada ni aplicada; no reserva el cupo.`, confirmationToken: `${body}.${crypto.createHmac('sha256', secret).update(body).digest('hex')}` };
  }
  static async confirmScheduling(p: Principal, token: string) {
    role(p, 'PACIENTE');
    const [body, signature] = String(token).split('.'); const secret = process.env.AI_AGENT_SESSION_SECRET || process.env.SESSION_SECRET;
    input(body && signature && secret, 'Confirmación inválida.');
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    input(signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)), 'Firma inválida.');
    let data: any; try { data = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { throw new AiAgentError('INVALID_INPUT', 'Confirmación inválida.'); }
    input(data.type === 'AGENDAMIENTO' && data.patientId === p.idPersona && data.expires > Date.now(), 'La confirmación no corresponde al paciente o expiró.');
    const old = await prisma.solicitudesCustomerIA.findUnique({ where: { clave_idempotencia: data.key } }); if (old) return old;
    const pending = await this.pendingSessions(p, data.treatmentId);
    if (pending.planId !== data.planId || !pending.pendingNumbers.includes(data.number)) throw new AiAgentError('CONFLICT', 'El plan cambió o la sesión ya existe.');
    if (!(await this.slots(p, data.treatmentId)).some(slot => slot.slotId === data.slotId && slot.date === data.date)) throw new AiAgentError('CONFLICT', 'El horario ya no está disponible o cambió; consulte alternativas y prepare otra propuesta.');
    try {
      return await prisma.$transaction(async tx => {
        const activeRequests=await tx.solicitudesCustomerIA.findMany({where:{tipo:'AGENDAMIENTO',id_tratamiento:data.treatmentId,estado:{in:['Pendiente','En_Revision','Aprobada']}}});
        const sameOrdinal=activeRequests.find(row=>JSON.parse(row.payload).number===data.number);
        if(sameOrdinal){if(JSON.parse(sameOrdinal.payload).slotId===data.slotId)return sameOrdinal;throw new AiAgentError('CONFLICT','Ya hay una solicitud activa para esta sesión; revise o cancele esa solicitud.');}
        const request = await tx.solicitudesCustomerIA.create({ data: { tipo: 'AGENDAMIENTO', id_persona: p.idPersona!, id_tratamiento: data.treatmentId, payload: JSON.stringify(data), clave_idempotencia: data.key, id_correlacion: crypto.randomUUID() } });
        await auditCustomer(p, 'SOLICITUD_PROGRAMACION', { treatmentId: data.treatmentId }, 'Pendiente', request.id_correlacion, tx); return request;
      }, { isolationLevel: 'Serializable' });
    } catch (error: any) { if (error.code === 'P2002') return prisma.solicitudesCustomerIA.findUniqueOrThrow({ where: { clave_idempotencia: data.key } }); throw error; }
  }
  static async requests(p: Principal) {
    const where = p.role === 'PACIENTE' ? { id_persona: p.idPersona! } : p.role === 'ODONTOLOGO' ? { id_profesional: p.idProfesional!, tipo: { in: ['DERIVACION', 'CIERRE'] } } : p.role === 'RECEPCION' ? { tipo: 'AGENDAMIENTO' } : {};
    role(p, 'PACIENTE', 'ODONTOLOGO', 'RECEPCION', 'ADMIN');
    return prisma.solicitudesCustomerIA.findMany({ where, orderBy: { fecha_creacion: 'desc' }, take: 100 });
  }
  static async reviewRequest(p: Principal, id: number, state: string, evidence: string) {
    role(p, 'ODONTOLOGO', 'RECEPCION', 'ADMIN'); input(evidence?.trim() && evidence.length <= 500, 'Se requiere evidencia de hasta 500 caracteres.');
    return prisma.$transaction(async tx => {
      const row = await tx.solicitudesCustomerIA.findUnique({ where: { id_solicitud: id } });
      if (!row) throw new AiAgentError('NOT_FOUND', 'Solicitud inexistente.');
      if (row.tipo === 'AGENDAMIENTO') role(p, 'RECEPCION', 'ADMIN');
      else { await this.requireProfessional(p); if (row.id_profesional !== p.idProfesional) throw new AiAgentError('FORBIDDEN', 'Derivación ajena.'); }
      const transitions: Record<string, string[]> = row.tipo === 'AGENDAMIENTO' ? { Pendiente: ['En_Revision', 'Aprobada', 'Rechazada', 'Cancelada'], En_Revision: ['Aprobada', 'Rechazada', 'Cancelada'], Aprobada: ['Cancelada'] } : { Pendiente: ['En_Revision', 'Atendida'], En_Revision: ['Atendida', 'Rechazada'], Atendida: ['Resuelta'] };
      if (!transitions[row.estado]?.includes(state)) throw new AiAgentError('CONFLICT', 'Transición no permitida.');
      await tx.solicitudesCustomerIA.update({ where: { id_solicitud: id }, data: { estado: state, fecha_revision: new Date(), id_usuario_responsable: p.idUsuario, evidencia: evidence.trim() } });
      await auditCustomer(p, `SOLICITUD_${row.tipo}_${state.toUpperCase()}`, { personId: row.id_persona, treatmentId: row.id_tratamiento ?? undefined,reviewed:true }, 'Revisión humana registrada', row.id_correlacion, tx);
      return tx.solicitudesCustomerIA.findUnique({ where: { id_solicitud: id } });
    }, { isolationLevel: 'Serializable' });
  }
  static async applyScheduling(p: Principal, id: number) {
    role(p, 'RECEPCION', 'ADMIN');
    return prisma.$transaction(async tx => {
      const row = await tx.solicitudesCustomerIA.findUnique({ where: { id_solicitud: id } });
      if (!row || row.tipo !== 'AGENDAMIENTO') throw new AiAgentError('NOT_FOUND', 'Solicitud inexistente.');
      const data = JSON.parse(row.payload);
      if (row.estado === 'Aplicada') return { ...data, idempotent: true };
      if (row.estado !== 'Aprobada') throw new AiAgentError('CONFLICT', 'La solicitud requiere aprobación humana.');
      const t = await tx.tratamientosContratados.findUnique({ where: { id_tratamiento: row.id_tratamiento! } });
      const plan = await tx.planTratamiento.findFirst({ where: { id_tratamiento: row.id_tratamiento!, es_vigente: true }, orderBy: { version_plan: 'desc' } });
      if (!t || t.id_persona !== row.id_persona || !active.includes(t.estado_tratamiento) || !plan || plan.id_plan !== data.planId || data.number <= 1 || data.number > plan.sesiones_planificadas) throw new AiAgentError('CONFLICT', 'Tratamiento o plan ya no elegibles.');
      if (await tx.sesionesTratamiento.findFirst({ where: { id_tratamiento: t.id_tratamiento, numero_sesion: data.number } })) throw new AiAgentError('CONFLICT', 'La sesión ya fue programada.');
      const slot = await tx.disponibilidad.findUnique({ where: { id_disponibilidad: data.slotId } });
      if (!slot || slot.estado !== 'Disponible' || slot.disponible === false || slot.id_profesional !== t.id_profesional_responsable || slot.id_sede !== t.id_sede || slotTime(slot) <= new Date() || (slot.hora_fin.getTime() - slot.hora_inicio.getTime()) / 60000 < plan.duracion_estimada) throw new AiAgentError('CONFLICT', 'El horario ya no es compatible.');
      if (await tx.reservas.findFirst({ where: { Opcion: { id_disponibilidad: data.slotId } } })) throw new AiAgentError('CONFLICT', 'El horario pertenece a PAYER.');
      const result: any[] = await tx.$queryRaw`EXEC dbo.usp_ProgramarSesionTratamiento @id_tratamiento=${t.id_tratamiento}, @numero_sesion=${data.number}, @id_profesional=${slot.id_profesional}, @id_sede=${slot.id_sede}, @fecha_programada=${slotTime(slot)}, @duracion_min=${plan.duracion_estimada}, @id_disponibilidad=${slot.id_disponibilidad}, @id_usuario_responsable=${p.idUsuario}`;
      if (!result[0]?.id_sesion) throw new AiAgentError('CONFLICT', 'Agenda no confirmó la creación.');
      data.sessionId = result[0].id_sesion;
      const changed = await tx.solicitudesCustomerIA.updateMany({ where: { id_solicitud: id, estado: 'Aprobada' }, data: { estado: 'Aplicada', payload: JSON.stringify(data), fecha_revision: new Date(), id_usuario_responsable: p.idUsuario } });
      if (changed.count !== 1) throw new AiAgentError('CONFLICT', 'La solicitud cambió.');
      await auditCustomer(p, 'PROGRAMACION_APLICADA', { personId: row.id_persona, treatmentId: t.id_tratamiento }, 'Agenda oficial aplicada', row.id_correlacion, tx);
      return { ...data, idempotent: false };
    }, { isolationLevel: 'Serializable' });
  }

  static structureNotes(notes: string): { originalNotes: string; sections: ClinicalSections; method: string; warnings:string[] } {
    input(typeof notes === 'string' && notes.trim().length > 0 && notes.length <= 8000, 'Notas vacías o demasiado extensas.');
    const sections: ClinicalSections = {};
    const warnings:string[]=[];
    for (const line of clinicalNoteLines(notes)) {
      const destination = line.field || 'observaciones';
      if(sections[destination])warnings.push(`Revisar entradas múltiples en ${destination}; no se resolvieron contradicciones automáticamente.`);
      sections[destination] = [sections[destination], line.text].filter(Boolean).join('\n');
    }
    input(validSections(sections) && Object.values(sections).some(value => value?.trim()), 'Las notas deben contener texto clínico declarado dentro del tamaño de los campos de ficha (motivo y alergias: 300; los demás: 500 caracteres).');
    return { originalNotes: notes, sections, method: 'ESTRUCTURACION_EXTRACTIVA_SIN_INFERENCIAS', warnings };
  }
  static validateExtractiveDraft(notes: string, proposed: ClinicalSections) {
    input(validSections(proposed), 'Secciones no autorizadas o exceden el tamaño admitido en ficha.');
    this.structureNotes(notes);
    const source = clinicalNoteLines(notes);
    const used = new Set<number>();
    for (const [field, value] of Object.entries(proposed)) {
      for (const text of value.split('\n').map(line => line.trim()).filter(Boolean)) {
        const index = source.findIndex((line, i) => !used.has(i) && line.text === text && (!line.field || line.field === field));
        input(index >= 0, 'El borrador debe conservar líneas completas, negaciones y el campo indicado por el profesional; no admite recortes ni hallazgos nuevos.');
        used.add(index);
      }
    }
    input(used.size === source.length, 'El borrador omitió notas proporcionadas por el profesional. Debe conservar todo el contenido antes de su revisión.');
    return proposed;
  }
  static async prepareClinicalDraft(p: Principal, attentionId: number, notes: string, idempotencyKey: string, proposed?: ClinicalSections) {
    await this.requireProfessional(p); const a = await attentionForPrincipal(attentionId, p);
    if (a.estado_cierre_documental === 'Cerrada') throw new AiAgentError('CONFLICT', 'La ficha está cerrada; corresponde un procedimiento de enmienda.');
    const scoped = key(p, 'FICHA', idempotencyKey);
    const old = await prisma.borradoresIA.findFirst({ where: { clave_idempotencia: scoped, id_atencion: attentionId } });
    if (old) { input(JSON.parse(old.contenido_sugerido).originalNotes === notes, 'La clave de idempotencia ya corresponde a otras notas.'); return old; }
    const content = this.structureNotes(notes);
    Object.assign(content, { baseRevision: a.revision_ficha, existingSections: Object.fromEntries(fields.filter(field => a[field] !== null && a[field] !== undefined).map(field => [field, a[field]])) });
    if (proposed) { content.sections = this.validateExtractiveDraft(notes, proposed); content.method = 'ORGANIZACION_IA_EXTRACTIVA_SIN_INFERENCIAS'; }
    const replaced = Object.keys(content.sections).filter(field => a[field as ClinicalField]?.trim() && a[field as ClinicalField] !== content.sections[field as ClinicalField]);
    if (replaced.length) content.warnings.push(`La transferencia reemplazará datos registrados en: ${replaced.join(', ')}. Revise el contenido actual antes de confirmar.`);
    const draft = await CustomerAiPersistenceService.registrarBorrador({ idPersona: a.id_persona, idProfesional: p.idProfesional!, idAtencion: attentionId, idTratamiento: a.id_tratamiento, idSesion: a.id_sesion, tipoEvento: 'BORRADOR_FICHA_CLINICA', contenidoSugerido: JSON.stringify(content), claveIdempotencia: scoped, eventoAuditoria: { actorOrientado: 'ODONTOLOGO', idUsuario: p.idUsuario, idCorrelacion: crypto.randomUUID(), tipoEvento: 'FICHA_BORRADOR_CREADO', resultado: 'Estructura extractiva pendiente de revisión' } });
    return draft;
  }
  static async prepareClinicalDraftWithLlm(p: Principal, attentionId: number, notes: string, idempotencyKey: string, provider?: LlmProvider) {
    await this.requireProfessional(p); const attention = await attentionForPrincipal(attentionId,p); this.structureNotes(notes);
    if (attention.estado_cierre_documental === 'Cerrada') throw new AiAgentError('CONFLICT', 'La ficha está cerrada; corresponde un procedimiento de enmienda.');
    const config=runtimeConfig();
    if(!config.enabled||!config.externalDataAuthorized)throw new AiAgentError('SERVICE_UNAVAILABLE','La organización mediante proveedor externo no está autorizada o habilitada.');
    const engine=provider??new GeminiProvider();
    const result=await engine.complete({instructions:`Organiza notas del profesional en un objeto JSON con estas claves opcionales: ${fields.join(', ')}. Cada valor debe conservar líneas completas literales de las notas, sin omisiones ni duplicaciones. Conserva negaciones, cantidades y calificadores. Si una línea tiene encabezado de campo, conserva su asignación y usa el texto posterior al encabezado como valor. No inventes, resumas ni infieras contenido. Usa solo claves con texto declarado, sin null. No añadas markdown.`,input:[{role:'user',content:notes}],tools:[],model:config.model,maxOutputTokens:config.maxOutputTokens,timeoutMs:config.timeoutMs,signal:AbortSignal.timeout(config.timeoutMs)});
    if(result.kind!=='message')throw new AiAgentError('SERVICE_UNAVAILABLE','Se requiere un borrador documental, no una acción.');
    let sections: ClinicalSections;try{sections=JSON.parse(result.text);}catch{throw new AiAgentError('SERVICE_UNAVAILABLE','El proveedor no devolvió una estructura válida.');}
    this.validateExtractiveDraft(notes,sections);
    return this.prepareClinicalDraft(p,attentionId,notes,idempotencyKey,sections);
  }
  static async clinicalDraft(p: Principal, id: number) {
    await this.requireProfessional(p); const d = await prisma.borradoresIA.findUnique({ where: { id_borrador_ia: id } });
    if (!d || d.tipo_evento !== 'BORRADOR_FICHA_CLINICA') throw new AiAgentError('NOT_FOUND', 'Borrador de ficha inexistente.');
    await attentionForPrincipal(d.id_atencion, p);
    if (d.id_profesional !== p.idProfesional) throw new AiAgentError('FORBIDDEN', 'Borrador ajeno.');
    return d;
  }
  static async reviseClinicalDraft(p: Principal, id: number, sections: ClinicalSections) {
    const d = await this.clinicalDraft(p, id);
    input(validSections(sections) && Object.values(sections).some(v => v?.trim()), 'Secciones inválidas; motivo y alergias admiten 300 caracteres, los demás campos 500.');
    if (!d.es_version_actual || d.fecha_transferencia_ficha || !['Generado', 'En_Revision'].includes(d.estado)) throw new AiAgentError('CONFLICT', 'La versión ya no admite revisión.');
    const data = JSON.parse(d.contenido_sugerido); data.sections = sections; data.method = 'CORRECCION_PROFESIONAL';
    return CustomerAiPersistenceService.registrarBorrador({ idPersona: d.id_persona, idProfesional: p.idProfesional!, idAtencion: d.id_atencion, idTratamiento: d.id_tratamiento, idSesion: d.id_sesion, tipoEvento: 'BORRADOR_FICHA_CLINICA', contenidoSugerido: JSON.stringify(data), idBorradorRaiz: d.id_borrador_raiz || d.id_borrador_ia, versionBorrador: d.version_borrador + 1, eventoAuditoria: { actorOrientado: 'ODONTOLOGO', idUsuario: p.idUsuario, idCorrelacion: crypto.randomUUID(), tipoEvento: 'FICHA_BORRADOR_REVISION', resultado: 'Corrección declarada por el profesional' } });
  }
  static async transferClinicalDraft(p: Principal, id: number, confirmed: boolean) {
    input(confirmed === true, 'Debe confirmar explícitamente la transferencia a ficha.');
    const d = await this.clinicalDraft(p, id);
    return prisma.$transaction(async tx => {
      const current = await tx.borradoresIA.findUniqueOrThrow({ where: { id_borrador_ia: id } });
      if (current.fecha_transferencia_ficha) return { attentionId: current.id_atencion, idempotent: true };
      if (!current.es_version_actual || !['Generado', 'Aprobado', 'Corregido_Y_Aprobado'].includes(current.estado)) throw new AiAgentError('CONFLICT', 'Versión obsoleta o rechazada.');
      const data = JSON.parse(current.contenido_sugerido); const sections = data.sections as ClinicalSections;
      input(validSections(sections) && Object.values(sections).some(v => v?.trim()), 'Secciones no válidas para ficha.');
      const attention = await tx.atenciones.findUniqueOrThrow({ where: { id_atencion: d.id_atencion } });
      if (!Number.isInteger(data.baseRevision) || data.baseRevision !== attention.revision_ficha) throw new AiAgentError('CONFLICT', 'La ficha cambió desde la preparación del borrador; prepare una nueva propuesta.');
      if (attention.estado_cierre_documental === 'Cerrada') throw new AiAgentError('CONFLICT', 'Ficha cerrada; requiere procedimiento de enmienda.');
      await tx.atenciones.update({ where: { id_atencion: d.id_atencion }, data: sections });
      await tx.borradoresIA.update({ where: { id_borrador_ia: id }, data: { fecha_transferencia_ficha: new Date(), estado: 'Aprobado', id_profesional_aprobador: p.idProfesional, fecha_aprobacion: new Date(), id_usuario_revisor: p.idUsuario } });
      await auditCustomer(p, 'FICHA_TRANSFERIDA', { personId: d.id_persona, attentionId: d.id_atencion, treatmentId: d.id_tratamiento ?? undefined,sessionId:d.id_sesion??undefined,reviewed:true }, `Borrador ${id} versión ${d.version_borrador}`, undefined, tx);
      return { attentionId: d.id_atencion, idempotent: false };
    }, { isolationLevel: 'Serializable' });
  }
  static async evaluateAttention(tx: Tx, attention: any) {
    const policy = await this.policy('DOCUMENTACION', attention.id_servicio, tx);
    if (!policy) return { blocked: true, policyId: null, policyVersion: null, pending: ['Falta política documental publicada para este servicio; no se puede completar la verificación.'], fingerprint: hash(attention) };
    let config: any;
    try { config = JSON.parse(policy.configuracion); } catch { config = null; }
    if (!config || !Array.isArray(config.requiredFields) || !config.requiredFields.length || !config.requiredFields.every((field: unknown) => fields.includes(field as ClinicalField)) || ['requiresProcedure','requiresInstructions'].some(flag => config[flag] !== undefined && typeof config[flag] !== 'boolean')) {
      return { blocked: true, policyId: policy.id_politica, policyVersion: policy.version, pending: ['La política documental publicada tiene una configuración inválida; requiere revisión institucional.'], fingerprint: hash([policy.id_politica,policy.configuracion]) };
    }
    const pending: string[] = [];
    for (const f of config.requiredFields as ClinicalField[]) if (!String(attention[f] ?? '').trim()) pending.push(f);
    const procedures = await tx.detalleProcedimiento.findMany({ where: { id_atencion: attention.id_atencion }, select: { id_detalle_procedimiento: true, procedimiento_realizado: true, id_profesional: true, fecha_registro: true }, orderBy: { id_detalle_procedimiento: 'asc' } });
    const confirmedProcedure = procedures.some((row: any) => row.procedimiento_realizado?.trim()) || attention.procedimiento_realizado?.trim() || attention.procedimiento?.trim();
    if (config.requiresProcedure && !confirmedProcedure) pending.push('procedimiento_confirmado');
    const instructions = await tx.indicacionesPostatencion.findMany({ where: { id_atencion: attention.id_atencion, estado: { in: ['Documento emitido','Emitido','Vigente'] }, es_version_vigente: true, id_profesional_aprobador: { not: null }, fecha_aprobacion: { not: null }, fecha_emision: { not: null } }, select: { id_indicacion: true, version: true, contenido_indicaciones: true, fecha_aprobacion: true, fecha_emision: true, id_profesional_aprobador: true }, orderBy: { id_indicacion: 'asc' } });
    if (config.requiresInstructions && !instructions.length) pending.push('indicaciones_emitidas');
    return { blocked: false, policyId: policy.id_politica, policyVersion: policy.version, pending: [...new Set(pending)], fingerprint: hash([policy.id_politica,policy.version,policy.configuracion,attention.revision_ficha,fields.map(f => attention[f]),attention.procedimiento_realizado,procedures,instructions]) };
  }

  static async validateDocumentation(p: Principal, attentionId: number, confirm: boolean, options: {audit?:boolean} = {}) {
    await this.requireProfessional(p); const a = await attentionForPrincipal(attentionId, p);
    return prisma.$transaction(async tx => {
      const current = await tx.atenciones.findUniqueOrThrow({ where: { id_atencion: attentionId } }); const result = await this.evaluateAttention(tx, current);
      if (confirm) {
        if (result.blocked) throw new AiAgentError('CONFLICT', result.pending.join('; '));
        const last = await tx.validacionesFicha.findFirst({ where: { id_atencion: attentionId }, orderBy: { numero_revision: 'desc' } });
        await tx.validacionesFicha.create({ data: { id_atencion: attentionId, numero_revision: (last?.numero_revision ?? 0) + 1, resultado_validacion: result.pending.length ? 'Incompleta' : 'Completa', campos_pendientes: result.pending.join(', ').slice(0, 500) || null, id_profesional_validador: p.idProfesional, id_usuario_validador: p.idUsuario, id_politica_ia: result.policyId, huella_documental: result.fingerprint, revision_ficha: current.revision_ficha } });
        await auditCustomer(p, 'FICHA_VALIDADA', { personId: a.id_persona, attentionId, treatmentId:a.id_tratamiento??undefined,sessionId:a.id_sesion??undefined,reviewed:true }, result.pending.length ? 'Incompleta' : 'Completa', undefined, tx);
      } else if(options.audit!==false) await auditCustomer(p,'COMPROBACION_DOCUMENTAL',{personId:a.id_persona,attentionId,treatmentId:a.id_tratamiento??undefined,sessionId:a.id_sesion??undefined},result.blocked?'Bloqueada':result.pending.length?'Con pendientes':'Sin pendientes',undefined,tx);
      return { ...result, validationRecorded: confirm === true, readOnly: confirm !== true, attentionId, clinicalRevision: current.revision_ficha, source: 'NexoSaludDB', limitation: 'Verificación documental de registros; no certifica veracidad clínica, no firma ni cierra la ficha.' };
    }, { isolationLevel: 'Serializable' });
  }
  static async closeAttention(p: Principal, attentionId: number, confirmed: boolean) {
    input(confirmed === true, 'Se requiere confirmación profesional.'); await this.requireProfessional(p); const a = await attentionForPrincipal(attentionId, p);
    if (!a.id_sesion) throw new AiAgentError('CONFLICT', 'Atención sin sesión del plan.');
    const outcome = await prisma.$transaction(async tx => {
      const current = await tx.atenciones.findUniqueOrThrow({ where: { id_atencion: attentionId } }); const check = await this.evaluateAttention(tx, current);
      if (check.blocked || check.pending.length) throw new AiAgentError('CONFLICT', check.pending.join(', '));
      const validation = await tx.validacionesFicha.findFirst({ where: { id_atencion: attentionId }, orderBy: { numero_revision: 'desc' } });
      if (!validation || validation.resultado_validacion !== 'Completa' || validation.huella_documental !== check.fingerprint) throw new AiAgentError('CONFLICT', 'Debe validar profesionalmente la versión actual de la ficha.');
      const session = await tx.sesionesTratamiento.findUniqueOrThrow({ where: { id_sesion: a.id_sesion! } });
      if (session.estado_asistencial !== 'Realizada') throw new AiAgentError('CONFLICT', 'La sesión no tiene realización oficial.');
      if (session.estado_cierre === 'Cerrada') return { status: 'Cerrada', idempotent: true };
      await tx.$queryRaw`EXEC dbo.usp_CerrarSesionClinica @id_sesion=${a.id_sesion}, @id_profesional_validador=${p.idProfesional}, @id_usuario_responsable=${p.idUsuario}`;
      await auditCustomer(p, 'CIERRE_SESION_PROFESIONAL', { personId: a.id_persona, attentionId,treatmentId:a.id_tratamiento??undefined,sessionId:a.id_sesion??undefined,reviewed:true }, 'Cerrada', undefined, tx); return { status: 'Cerrada', idempotent: false };
    }, { isolationLevel: 'Serializable' });

    // Programar entrega de la tarjeta gráfica post-atención (por defecto 1 hora después)
    try {
      AftercareSchedulerService.scheduleAftercareDelivery(attentionId);
    } catch (schedErr) {
      console.warn('[Aftercare Scheduler] Error al programar entrega diferida:', schedErr);
    }

    return outcome;
  }
  static async confirmSession(p: Principal, id: number, confirm: boolean) {
    const session = await prisma.sesionesTratamiento.findUnique({ where: { id_sesion: id } }); if (!session) throw new AiAgentError('NOT_FOUND', 'Sesión inexistente.');
    if (p.role === 'PACIENTE') await treatmentForPrincipal(session.id_tratamiento, p); else role(p, 'RECEPCION', 'ADMIN');
    if (!confirm) throw new AiAgentError('INVALID_INPUT', 'Se requiere confirmación explícita.');
    if (session.confirmacion_paciente === 'Confirmada') return { ...session, idempotent: true };
    if (session.estado_asistencial!=='Pendiente'||session.estado_cierre==='Cerrada'||session.fecha_programada_vigente <= new Date() || !['Programada', 'Confirmada', 'Reprogramada'].includes(session.estado_programacion)) throw new AiAgentError('CONFLICT', 'La sesión no admite confirmación.');
    return prisma.$transaction(async tx => { const value = await tx.sesionesTratamiento.update({ where: { id_sesion: id }, data: { confirmacion_paciente: 'Confirmada', fecha_confirmacion: new Date() } }); await auditCustomer(p, 'CONFIRMACION_SESION', { treatmentId: session.id_tratamiento }, 'Confirmada', undefined, tx); return value; });
  }
  static async refer(p: Principal, treatmentId: number, reference: string, idempotencyKey: string) {
    role(p, 'PACIENTE'); const t = await treatmentForPrincipal(treatmentId, p);
    input(typeof reference === 'string' && reference.length <= 64 && reference.length > 0, 'Proporcione una referencia mínima a la consulta, sin texto clínico.');
    const scoped = key(p, 'DERIVACION', idempotencyKey); const old = await prisma.solicitudesCustomerIA.findUnique({ where: { clave_idempotencia: scoped } }); if (old) return old;
    try {
      return await prisma.$transaction(async tx => {
        const row = await tx.solicitudesCustomerIA.create({ data: { tipo: 'DERIVACION', id_persona: p.idPersona!, id_tratamiento: treatmentId, id_profesional: t.id_profesional_responsable, payload: JSON.stringify({ reference, classification: 'REVISION_HUMANA', clinicalPriorityAssigned: false }), clave_idempotencia: scoped, id_correlacion: crypto.randomUUID() } });
        await tx.alertasIA.create({data:{id_persona:p.idPersona!,id_tratamiento:treatmentId,id_profesional:t.id_profesional_responsable,tipo_evento:'ALT-C08',mensaje_alerta:`Solicitud de revisi\u00f3n humana ${row.id_solicitud} en bandeja profesional. Sin clasificaci\u00f3n m\u00e9dica autom\u00e1tica.`,severidad:'Media',estado:'Generada',requiere_revision_humana:true,version_agente:'CUSTOMER-COMPLETE-v1',clave_deduplicacion:hash(['DERIVACION',row.id_solicitud]),id_correlacion:row.id_correlacion}});
        await auditCustomer(p, 'DERIVACION_REGISTRADA', { treatmentId }, 'En bandeja profesional; sin tiempo de respuesta garantizado', row.id_correlacion, tx); return row;
      }, { isolationLevel: 'Serializable' });
    } catch(error:any){if(error.code==='P2002')return prisma.solicitudesCustomerIA.findUniqueOrThrow({where:{clave_idempotencia:scoped}});throw error;}
  }

  static async evaluateTreatmentClosure(tx: Tx, treatment: any) {
    const treatmentId = treatment.id_tratamiento;
    const plan = await tx.planTratamiento.findFirst({ where: { id_tratamiento: treatmentId, es_vigente: true }, orderBy: { version_plan: 'desc' } });
    const sessions: any[] = await tx.sesionesTratamiento.findMany({ where: { id_tratamiento: treatmentId }, orderBy: { numero_sesion: 'asc' }, include: { Atenciones: { orderBy: { id_atencion: 'asc' } } } });
    const pending: string[] = [];
    if (treatment.estado_tratamiento === 'Completado') pending.push('El tratamiento ya tiene un cierre formal registrado.');
    else if (treatment.estado_tratamiento !== 'En ejecución' || !treatment.fecha_inicio_real) pending.push('El tratamiento debe estar en ejecución y tener inicio real registrado antes del cierre.');
    if (!plan || !Number.isInteger(plan.sesiones_planificadas) || plan.sesiones_planificadas <= 0) pending.push('No hay un plan vigente con total de sesiones válido.');
    if (plan && sessions.length !== plan.sesiones_planificadas) pending.push('La cantidad de sesiones registradas difiere del plan vigente.');
    if (new Set(sessions.map(s => s.numero_sesion)).size !== sessions.length) pending.push('Hay números de sesión duplicados; requiere conciliación del plan.');
    const labels: Record<string,string> = {motivo_consulta:'motivo de consulta',antecedentes:'antecedentes',alergias:'registro de alergias',evaluacion:'evaluación',procedimiento:'procedimiento',observaciones:'observaciones',indicaciones_finales:'indicaciones finales',procedimiento_confirmado:'procedimiento confirmado',indicaciones_emitidas:'indicaciones aprobadas y emitidas'};
    const items = [];
    for (const session of sessions) {
      const completed = session.estado_asistencial === 'Realizada' && session.estado_cierre === 'Cerrada';
      const requiresExceptionReview = ['Cancelada','Cancelado'].includes(session.estado_programacion) || ['Inasistida','No asistió','No asiste'].includes(session.estado_asistencial);
      if (!completed) pending.push(`Sesión ${session.numero_sesion}: pendiente de realización y/o cierre.`);
      if (requiresExceptionReview) pending.push(`Sesión ${session.numero_sesion}: excepción que requiere decisión profesional.`);
      if (plan && session.id_plan !== plan.id_plan) pending.push(`Sesión ${session.numero_sesion}: corresponde a otra versión del plan.`);
      if (!session.Atenciones.length) pending.push(`Sesión ${session.numero_sesion}: sin atención vinculada.`);
      const attentions = [];
      for (const a of session.Atenciones) {
        const prefix = `Atención ${a.id_atencion}`;
        if (a.id_persona !== treatment.id_persona || a.id_tratamiento !== treatmentId || a.id_sesion !== session.id_sesion) {
          pending.push(`${prefix}: vínculos de paciente, sesión o tratamiento inconsistentes.`);
          // No recuperar ni exponer documentos de una atención vinculada incorrectamente.
          attentions.push({attentionId:a.id_atencion,linkageValid:false,validationMatchesCurrentRecords:false}); continue;
        }
        if (!['Realizado','Finalizado'].includes(a.estado_servicio) || !['Asistió','Asiste'].includes(a.asistencia)) pending.push(`${prefix}: sin realización asistencial oficial consistente.`);
        const check = await this.evaluateAttention(tx,a);
        const validation = await tx.validacionesFicha.findFirst({where:{id_atencion:a.id_atencion},orderBy:{numero_revision:'desc'}});
        const matches = !check.blocked && !check.pending.length && validation?.resultado_validacion === 'Completa' && !validation.campos_pendientes?.trim() && validation.id_politica_ia === check.policyId && validation.huella_documental === check.fingerprint && validation.revision_ficha === a.revision_ficha;
        for (const field of check.pending) pending.push(`${prefix}: ${labels[field] || field}`);
        if (!matches) pending.push(`${prefix}: falta validación profesional completa y vigente de los registros actuales.`);
        const instructions: any[] = await tx.indicacionesPostatencion.findMany({where:{id_atencion:a.id_atencion,estado:{in:['Documento emitido','Emitido','Vigente']},es_version_vigente:true,id_profesional_aprobador:{not:null},fecha_aprobacion:{not:null},fecha_emision:{not:null}},select:{id_indicacion:true,version:true,id_profesional_aprobador:true,fecha_aprobacion:true,fecha_emision:true},orderBy:{id_indicacion:'asc'}});
        attentions.push({attentionId:a.id_atencion,linkageValid:true,clinicalRevision:a.revision_ficha,validationId:validation?.id_validacion??null,validationResult:validation?.resultado_validacion??'SIN_VALIDACION',validationMatchesCurrentRecords:matches,validationDate:validation?.fecha_revision??null,validatingProfessionalId:validation?.id_profesional_validador??null,policyId:check.policyId,policyVersion:check.policyVersion,documentaryCheckBlocked:check.blocked,pendingFields:check.pending.map(field=>labels[field]||field),documentationClosure:a.estado_cierre_documental,issuedInstructionIds:instructions.map(i=>i.id_indicacion),issuedInstructions:instructions});
      }
      items.push({sessionId:session.id_sesion,number:session.numero_sesion,careStatus:session.estado_asistencial,closureStatus:session.estado_cierre,completed,requiresExceptionReview,attentions});
    }
    const unresolvedReviews: any[] = await tx.solicitudesCustomerIA.findMany({where:{id_tratamiento:treatmentId,tipo:'DERIVACION',estado:{in:['Pendiente','En_Revision','Atendida']}},select:{id_solicitud:true,estado:true},orderBy:{id_solicitud:'asc'}});
    if (unresolvedReviews.length) pending.push(`Revisiones humanas sin resolver: ${unresolvedReviews.length}. Atendida no equivale a Resuelta.`);
    const pendingDrafts: any[] = await tx.borradoresIA.findMany({where:{id_tratamiento:treatmentId,es_version_actual:true,estado:{in:['Generado','Corregido','En_Revision','Aprobado','Corregido_Y_Aprobado']},OR:[{tipo_evento:'BORRADOR_FICHA_CLINICA',fecha_transferencia_ficha:null},{tipo_evento:'BORRADOR_INDICACIONES_POSTATENCION'}]},select:{id_borrador_ia:true,id_atencion:true,tipo_evento:true,estado:true,version_borrador:true},orderBy:{id_borrador_ia:'asc'}});
    if (pendingDrafts.length) pending.push(`Borradores clínicos o de indicaciones sin resolver: ${pendingDrafts.length}. Revise su transferencia, emisión o descarte según corresponda.`);
    return {treatmentId,formalTreatmentStatus:treatment.estado_tratamiento,planId:plan?.id_plan??null,planVersion:plan?.version_plan??null,plannedSessions:plan?.sesiones_planificadas??null,completedSessions:items.filter(s=>s.completed).length,sessions:items,unresolvedReviews,pendingDrafts,pending:[...new Set(pending)],documentaryReadiness:pending.length?'REQUIERE_REVISION':'SIN_PENDIENTES_DOCUMENTALES',evaluatedAt:new Date().toISOString(),source:'NexoSaludDB',readOnly:true,requiresProfessionalConfirmation:true,disclaimer:'Preparación documental consultiva. No certifica alta clínica, no resuelve excepciones y no cierra ni transiciona el tratamiento. La conclusión requiere decisión profesional explícita.'};
  }

  static async closeTreatment(p: Principal, treatmentId: number, evidence: string, confirmed: boolean) {
    await this.requireProfessional(p); const t = await treatmentForPrincipal(treatmentId, p); input(confirmed === true && typeof evidence === 'string' && evidence.trim() && evidence.length <= 500, 'Falta confirmación o evidencia profesional.');
    return prisma.$transaction(async tx => {
      const existing = await tx.solicitudesCustomerIA.findUnique({ where: { clave_idempotencia: hash(['CIERRE', treatmentId]) } }); if (existing) return existing;
      const current = await tx.tratamientosContratados.findUniqueOrThrow({where:{id_tratamiento:treatmentId}});
      if(current.id_profesional_responsable!==p.idProfesional)throw new AiAgentError('FORBIDDEN','El responsable del tratamiento cambió; vuelva a consultar el contexto.');
      const checklist = await this.evaluateTreatmentClosure(tx,current);
      if(checklist.pending.length)throw new AiAgentError('CONFLICT',checklist.pending.join('; '));
      const result = await tx.$queryRaw`EXEC dbo.usp_CerrarTratamientoYTransicionarTurned @id_tratamiento=${treatmentId}, @id_profesional_cierre=${p.idProfesional}, @id_usuario_responsable=${p.idUsuario}`;
      const decision = await tx.solicitudesCustomerIA.create({ data: { tipo: 'CIERRE', id_persona: t.id_persona, id_tratamiento: treatmentId, id_profesional: p.idProfesional, estado: 'Aplicada', payload: JSON.stringify({ result }), clave_idempotencia: hash(['CIERRE', treatmentId]), id_correlacion: crypto.randomUUID(), id_usuario_responsable: p.idUsuario, fecha_revision: new Date(), evidencia: evidence } });
      await auditCustomer(p, 'CIERRE_TRATAMIENTO_PROFESIONAL', { personId: t.id_persona, treatmentId,reviewed:true }, 'Decisión formal registrada', decision.id_correlacion, tx); return decision;
    }, { isolationLevel: 'Serializable' });
  }
}
