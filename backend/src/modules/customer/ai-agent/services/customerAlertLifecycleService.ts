import crypto from 'crypto';
import { prisma } from '../../../../db';
import { AiAgentPrincipal, AiAgentError } from '../types';
import { CustomerCompletionService as C, auditCustomer } from './customerCompletionService';

const terminal = ['Resuelta', 'Descartada_Justificada'];
const operational = ['ALT-C01', 'ALT-C02', 'ALT-C03'];
export class CustomerAlertLifecycleService {
  static async detect(p: AiAgentPrincipal, treatmentId?: number, afterId?: number) {
    const where: any = { ...(treatmentId ? { id_tratamiento: treatmentId } : {}), ...(afterId ? { id_tratamiento: { gt: afterId } } : {}) };
    if (p.role === 'PACIENTE') where.id_persona = p.idPersona;
    if (p.role === 'ODONTOLOGO') where.OR = [{ id_profesional_responsable: p.idProfesional }, { Atenciones: { some: { id_profesional: p.idProfesional } } }];
    const treatments = await prisma.tratamientosContratados.findMany({ where, orderBy: { id_tratamiento: 'asc' }, take: 100, include: { PlanTratamiento: { where: { es_vigente: true }, orderBy: { version_plan: 'desc' }, take: 1 }, SesionesTratamiento: { include: { Atenciones: { include: { ValidacionesFicha: { orderBy: { numero_revision: 'desc' }, take: 1 } } } } } } });
    if (treatmentId && !treatments.length) throw new AiAgentError('NOT_FOUND', 'Tratamiento fuera del ámbito autorizado.');
    const now = new Date(); const confirmationPolicy = await C.policy('CONFIRMACION');
    const windowMinutes = confirmationPolicy ? JSON.parse(confirmationPolicy.configuracion).windowMinutes : null;
    let generated = 0; let resolved = 0;
    for (const t of treatments) {
      const desired = new Map<string, { attentionId?: number; sessionId?: number; message: string; evidence: string }>();
      const want = (code: string, id: number, message: string, attentionId?: number, sessionId?: number, evidence: unknown = message) => desired.set(`${code}:${id}`, { message, attentionId, sessionId, evidence: JSON.stringify(evidence) });
      const plan = t.PlanTratamiento[0];
      const isActive = ['Activado', 'En ejecución', 'Contratado', 'Activo', 'En curso', 'En_Curso'].includes(t.estado_tratamiento);
      if (isActive && plan && t.SesionesTratamiento.length < plan.sesiones_planificadas) want('ALT-C03', t.id_tratamiento, 'El plan vigente tiene sesiones todavía sin programación. Revisar solicitud de agenda CUSTOMER.');
      for (const s of t.SesionesTratamiento) {
        const noOutcome = s.estado_asistencial === 'Pendiente' && ['Programada', 'Reprogramada', 'Confirmada'].includes(s.estado_programacion);
        if (windowMinutes && noOutcome && s.fecha_programada_vigente > now && s.fecha_programada_vigente.getTime() - now.getTime() <= windowMinutes * 60000 && s.confirmacion_paciente !== 'Confirmada') want('ALT-C01', s.id_sesion, 'Sesión próxima sin confirmación del paciente; solicitar confirmación, sin inferir inasistencia.', undefined, s.id_sesion, [s.fecha_programada_vigente,confirmationPolicy?.id_politica]);
        if (noOutcome && new Date(s.fecha_programada_vigente.getTime() + s.duracion_programada_min * 60000) < now) want('ALT-C02', s.id_sesion, 'Horario de sesión vencido sin desenlace persistido. Recepción debe solicitar revisión humana.', undefined, s.id_sesion, [s.fecha_programada_vigente,confirmationPolicy?.id_politica]);
        if (p.role === 'RECEPCION' || p.role === 'PACIENTE') continue;
        for (const a of s.Atenciones) {
          if (p.role === 'ODONTOLOGO' && a.id_profesional !== p.idProfesional && t.id_profesional_responsable !== p.idProfesional) continue;
          const background = await prisma.antecedentesClinicos.findMany({ where: { id_persona: t.id_persona }, select: { id_antecedente: true, estado_verificacion: true, descripcion_antecedente: true } });
          if (a.alergias?.trim() || background.some(b => b.estado_verificacion !== 'Verificado')) want('ALT-C04', a.id_atencion, 'Antecedentes o alergias documentados para revisión profesional; no determina contraindicaciones.', a.id_atencion, s.id_sesion, [a.alergias,background]);
          const check = await C.evaluateAttention(prisma, a);
          if (check.blocked || check.pending.length) want('ALT-C05', a.id_atencion, `Pendientes documentales: ${check.pending.join(', ').slice(0, 180)}.`, a.id_atencion, s.id_sesion);
          const draft = await prisma.borradoresIA.findFirst({ where: { id_atencion: a.id_atencion, es_version_actual: true, tipo_evento: { not: 'BORRADOR_FICHA_CLINICA' }, estado: { in: ['Generado', 'En_Revision'] } } });
          if (draft) want('ALT-C06', a.id_atencion, `Borrador postatención ${draft.id_borrador_ia}, versión ${draft.version_borrador}, pendiente de aprobación.`, a.id_atencion, s.id_sesion);
        }
      }
      if (!['PACIENTE', 'RECEPCION'].includes(p.role)) {
        const allManaged = plan && t.SesionesTratamiento.length === plan.sesiones_planificadas && t.SesionesTratamiento.every(s => s.estado_cierre === 'Cerrada' || ['Inasistida'].includes(s.estado_asistencial) || ['Cancelada', 'Cancelado'].includes(s.estado_programacion));
        if (isActive && allManaged) want('ALT-C07', t.id_tratamiento, 'Sesiones gestionadas; falta decisión formal de cierre. Revisar documentación y excepciones en el checklist.');
        const referrals = await prisma.solicitudesCustomerIA.findMany({ where: { tipo: 'DERIVACION', id_tratamiento: t.id_tratamiento, estado: { in: ['Pendiente', 'En_Revision', 'Atendida'] } } });
        for (const r of referrals) want('ALT-C08', r.id_solicitud, `Solicitud de revisión humana ${r.id_solicitud} en bandeja profesional. Sin clasificación médica automática.`);
      }
      for (const [logical, item] of desired) {
        const code = logical.split(':')[0];
        if (p.role === 'PACIENTE' && code !== 'ALT-C01') continue;
        if (p.role === 'RECEPCION' && !operational.includes(code)) continue;
        const scope = { tipo_evento: code, id_tratamiento: t.id_tratamiento, id_atencion: item.attentionId ?? null, id_sesion: item.sessionId ?? null };
        const dedup = crypto.createHash('sha256').update(JSON.stringify([logical, t.id_tratamiento, item.evidence])).digest('hex');
        // Una revisión documentada de la misma evidencia no debe reabrirse cada vez que se consulta.
        if (await prisma.alertasIA.findFirst({ where: { clave_deduplicacion: dedup } })) continue;
        if (code === 'ALT-C05' && await prisma.alertasIA.findFirst({ where: { id_atencion: item.attentionId, tipo_evento: 'AL-C01', estado: { notIn: terminal } } })) continue;
        if (await prisma.alertasIA.findFirst({ where: { ...scope, estado: { notIn: terminal } } })) continue;
        try {
          await prisma.$transaction(async tx=>{
            const row=await tx.alertasIA.create({ data: { ...scope, id_persona: t.id_persona, id_profesional: operational.includes(code) ? null : t.id_profesional_responsable, mensaje_alerta: item.message, severidad: 'Media', estado: 'Generada', requiere_revision_humana: true, version_agente: 'CUSTOMER-COMPLETE-v1', clave_deduplicacion: dedup, id_correlacion: crypto.randomUUID() } });
            await auditCustomer(p,'DETECCION_'+code,{personId:t.id_persona,treatmentId:t.id_tratamiento,attentionId:item.attentionId},`Alerta ${row.id_alerta_ia}`,row.id_correlacion??undefined,tx);
          }); generated++;
        } catch (error: any) { if (error.code !== 'P2002') throw error; }
      }
      // Resolución administrativa/documental con evidencia del backend, nunca alta clínica automática.
      const resolvable = ['ALT-C01', 'ALT-C02', 'ALT-C03', 'ALT-C05', 'ALT-C06', 'ALT-C07', 'ALT-C08'].filter(c => p.role === 'PACIENTE' ? c === 'ALT-C01' : p.role === 'RECEPCION' ? operational.includes(c) : true);
      const open = await prisma.alertasIA.findMany({ where: { id_tratamiento: t.id_tratamiento, tipo_evento: { in: resolvable }, estado: { notIn: terminal } } });
      for (const alert of open) {
        if ([...desired.keys()].some(k => k.startsWith(alert.tipo_evento + ':') && (desired.get(k)?.attentionId ?? null) === alert.id_atencion && (desired.get(k)?.sessionId ?? null) === alert.id_sesion)) continue;
        // Sin identidad institucional no se fabrica un revisor para resolver automáticamente.
        if (!p.idUsuario) continue;
        await prisma.$transaction(async tx => {
          const result = await tx.alertasIA.updateMany({ where: { id_alerta_ia: alert.id_alerta_ia, estado: alert.estado }, data: { estado: 'Resuelta', fecha_atencion_alerta: now, id_usuario_revisor: p.idUsuario, id_profesional_revisor: p.idProfesional, resultado: 'La condición fuente dejó de estar presente; verificación documental/operativa.' } });
          if (result.count) { resolved++; await auditCustomer(p, 'ALERTA_RESUELTA_POR_EVENTO', { personId: t.id_persona, treatmentId: t.id_tratamiento }, `Alerta ${alert.id_alerta_ia}`, alert.id_correlacion ?? undefined, tx); }
        });
      }
    }
    return { generated, resolved, evaluated: treatments.length, lastTreatmentId: treatments.at(-1)?.id_tratamiento ?? null, confirmationEnabled: Boolean(confirmationPolicy) };
  }
}

export function startCustomerAlertScheduler(options:{runImmediately?:boolean}={}) {
  if (process.env.CUSTOMER_ALERT_SCHEDULER_ENABLED !== 'true') return;
  const userId = Number(process.env.CUSTOMER_ALERT_SCHEDULER_USER_ID);
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error('Configure una identidad institucional para el scheduler CUSTOMER.');
  let running = false; let cursor = 0;
  const tick = async () => {
    if (running) return; running = true;
    try {
      const user = await prisma.usuarios.findUnique({ where: { id_usuario: userId }, include: { Rol: true } });
      if (!user?.activo || !['ADMIN', 'ADMINISTRADOR'].includes(user.Rol.nombre.toUpperCase())) throw new Error('Identidad del scheduler no autorizada.');
      const result = await CustomerAlertLifecycleService.detect({ role: 'ADMIN', idUsuario: userId }, undefined, cursor);
      cursor = result.evaluated === 100 ? result.lastTreatmentId! : 0;
    } catch { console.error('[CUSTOMER alerts] Falló el lote; se reintentará sin asignar desenlaces.'); }
    finally { running = false; }
  };
  const interval = Math.max(60000, Number(process.env.CUSTOMER_ALERT_INTERVAL_MS) || 60000);
  const timer = setInterval(() => void tick(), interval); timer.unref(); if(options.runImmediately!==false)void tick();
  return {runNow:tick,stop:()=>clearInterval(timer)};
}
