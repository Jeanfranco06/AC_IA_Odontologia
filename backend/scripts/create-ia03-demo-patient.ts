/** Caso sintético autorizado IA03. Ejecutar con --apply. No reemplaza registros. */
import crypto from 'crypto';
import { prisma } from '../src/db';
import { patientAuthService } from '../src/services/patientAuthService';
import { CustomerCompletionService as C } from '../src/modules/customer/ai-agent/services/customerCompletionService';
import { CustomerAiQueryService as Q } from '../src/modules/customer/ai-agent/services/customerAiQueryService';

async function main() {
  if (!process.argv.includes('--apply')) throw Error('Falta --apply.');
  const [db] = await prisma.$queryRaw<Array<{ name: string }>>`SELECT DB_NAME() AS name`;
  if (db.name !== 'NexoSaludDB') throw Error('Destino distinto de NexoSaludDB.');
  const dni = '99003103';
  const password = 'Demo!' + crypto.randomBytes(6).toString('hex') + 'A3';
  const credentials = patientAuthService.hashPassword(password);
  const start = new Date('2026-11-11T15:00:00Z');
  const end = new Date('2026-11-11T15:45:00Z');
  const result = await prisma.$transaction(async tx => {
    if (await tx.personas.findFirst({ where: { dni } })) throw Error('El caso ya existe; no se reemplazó.');
    const stage = await tx.etapas.findUniqueOrThrow({ where: { nombre: 'CUSTOMER' } });
    const source = await tx.tratamientosContratados.findFirstOrThrow({ where: { Servicios: { nombre: 'Restauración Estética' }, Sedes: { activo: true }, Profesionales_TratamientosContratados_id_profesional_responsableToProfesionales: { activo: true } } });
    const professional = source.id_profesional_responsable, branch = source.id_sede;
    const admin = await tx.usuarios.findFirstOrThrow({ where: { activo: true, Rol: { nombre: { in: ['Administrador', 'Admin', 'ADMIN'] } } } });
    const person = await tx.personas.create({ data: { nombres: 'Camila', apellidos: 'Rojas Medina (Simulada)', dni, email: 'camila.ia03@example.invalid', fecha_nacimiento: new Date('1994-05-18'), zona: 'Trujillo - caso simulado IA03', autoriza_contacto: false, id_etapa_actual: stage.id_etapa } });
    const initial = await tx.disponibilidad.create({ data: { id_profesional: professional, id_sede: branch, fecha: start, hora_inicio: new Date('1970-01-01T15:00:00Z'), hora_fin: new Date('1970-01-01T15:45:00Z'), estado: 'Ocupado' } });
    const request = await tx.solicitudes.create({ data: { id_persona: person.id_persona, id_servicio: source.id_servicio, estado: 'Convertida' } });
    const option = await tx.opciones.create({ data: { id_solicitud: request.id_solicitud, id_disponibilidad: initial.id_disponibilidad, precio_ofrecido: 450, seleccionada: true } });
    const booking = await tx.reservas.create({ data: { id_persona: person.id_persona, id_solicitud: request.id_solicitud, id_opcion: option.id_opcion, estado: 'Confirmada' } });
    const treatment = await tx.tratamientosContratados.create({ data: { id_persona: person.id_persona, id_solicitud: request.id_solicitud, id_reserva_origen: booking.id_reserva, id_servicio: source.id_servicio, id_profesional_responsable: professional, id_sede: branch, precio_pactado: 450, fecha_contratacion: new Date('2026-11-10T15:00:00Z'), fecha_activacion: start, fecha_inicio_real: start, estado_tratamiento: 'En ejecución' } });
    await tx.pagos.create({ data: { id_persona: person.id_persona, id_reserva: booking.id_reserva, id_tratamiento: treatment.id_tratamiento, importe: 450, estado: 'Validado', fecha_validacion: new Date('2026-11-10T16:00:00Z'), validado_por: admin.id_usuario, referencia_pago: 'SIMULADO-IA03-99003103', canal_pago: 'Simulado', observaciones: 'Pago ficticio de prueba IA03; no es un ingreso real.' } });
    const plan = await tx.planTratamiento.create({ data: { id_tratamiento: treatment.id_tratamiento, version_plan: 1, sesiones_planificadas: 3, duracion_estimada: 45, id_profesional_aprobador: professional, fecha_aprobacion: new Date('2026-11-10T17:00:00Z'), motivo_modificacion: 'SIMULADO IA03: primera sesión realizada; sesiones 2 y 3 sin agendar. No es decisión clínica real.' } });
    const session = await tx.sesionesTratamiento.create({ data: { id_tratamiento: treatment.id_tratamiento, id_plan: plan.id_plan, numero_sesion: 1, id_profesional: professional, id_sede: branch, id_disponibilidad: initial.id_disponibilidad, fecha_programada_vigente: start, duracion_programada_min: 45, fecha_llegada: start, fecha_inicio_atencion: start, fecha_cierre_sesion: end, estado_programacion: 'Programada', estado_asistencial: 'Realizada', estado_cierre: 'Cerrada', confirmacion_paciente: 'Confirmada', fecha_confirmacion: new Date('2026-11-10T18:00:00Z') } });
    await tx.atenciones.create({ data: { id_persona: person.id_persona, id_reserva: booking.id_reserva, id_tratamiento: treatment.id_tratamiento, id_sesion: session.id_sesion, id_servicio: source.id_servicio, id_profesional: professional, id_sede: branch, fecha_atencion: start, fecha_inicio: start, fecha_fin: end, asistencia: 'Asistió', estado_servicio: 'Finalizado', motivo_consulta: 'SIMULADO IA03: restauración por etapas.', evaluacion: 'Registro ficticio para continuidad administrativa; sin evaluación clínica real.', procedimiento: 'Primera etapa restauradora simulada.', observaciones: 'DATOS SINTÉTICOS; no corresponde a atención real.', indicaciones_finales: 'Simulación sin prescripción; dos sesiones adicionales sin fecha.', estado_cierre_documental: 'Cerrada', id_profesional_validador_cierre: professional, fecha_validacion_cierre: end } });
    const slotIds: number[] = [];
    for (const day of ['2026-11-16', '2026-11-17', '2026-11-19', '2026-11-20', '2026-11-23']) {
      if (slotIds.length === 3) break;
      const date = new Date(day + 'T20:00:00Z'), finish = new Date(date.getTime() + 45 * 60000);
      if (date <= new Date()) continue;
      const sessions = await tx.sesionesTratamiento.findMany({ where: { id_profesional: professional, fecha_programada_vigente: { lt: finish }, estado_programacion: { in: ['Programada', 'Confirmada', 'Reprogramada'] } } });
      if (sessions.some(s => s.fecha_programada_vigente.getTime() + s.duracion_programada_min * 60000 > date.getTime())) continue;
      const existing = await tx.disponibilidad.findMany({ where: { id_profesional: professional, fecha: new Date(day) } });
      if (existing.some(s => s.hora_inicio.getUTCHours() * 60 + s.hora_inicio.getUTCMinutes() < 1245 && s.hora_fin.getUTCHours() * 60 + s.hora_fin.getUTCMinutes() > 1200)) continue;
      const slot = await tx.disponibilidad.create({ data: { id_profesional: professional, id_sede: branch, fecha: new Date(day), hora_inicio: new Date('1970-01-01T20:00:00Z'), hora_fin: new Date('1970-01-01T20:45:00Z'), estado: 'Disponible' } });
      slotIds.push(slot.id_disponibilidad);
    }
    if (slotIds.length !== 3) throw Error('No hay tres alternativas; se revierte el caso.');
    await tx.$executeRaw`INSERT dbo.CredencialesPaciente(id_persona,dni,password_hash,password_salt,token_used) VALUES(${person.id_persona},${dni},${credentials.hash},${credentials.salt},1)`;
    await tx.interaccionesIA.create({ data: { id_persona: person.id_persona, id_tratamiento: treatment.id_tratamiento, id_usuario_actor: admin.id_usuario, actor_orientado: 'ADMIN', tipo_evento: 'CASO_SIMULADO_IA03', resumen_consulta: 'Caso sintético autorizado: paciente, pago y atención ficticios; plan de tres sesiones con dos sin programar. Sin envío de mensajes.', resultado: 'Caso creado para prueba manual', version_agente: 'IA03-DEMO-v1', estado: 'Completada', id_correlacion: crypto.randomUUID() } });
    return { person, treatment, slotIds };
  }, { isolationLevel: 'Serializable', timeout: 30000 });
  console.log(JSON.stringify({ created: true, database: db.name, dni, password, name: result.person.nombres + ' ' + result.person.apellidos }));
  const p = { role: 'PACIENTE' as const, idPersona: result.person.id_persona };
  const pending = await C.pendingSessions(p, result.treatment.id_tratamiento);
  const slots = (await C.slots(p, result.treatment.id_tratamiento)).filter(s => result.slotIds.includes(s.slotId));
  if (!pending.pendingNumbers.includes(2) || slots.length !== 3) throw Error('Caso creado; falló verificación de elegibilidad.');
  const proposal = await C.prepareScheduling(p, result.treatment.id_tratamiento, 2, slots[0]!.slotId, crypto.randomUUID());
  const response = await fetch('http://localhost:3001/api/patient-auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dni, password }) });
  const login: any = await response.json();
  if (!response.ok || !login.success || login.session?.id_persona !== p.idPersona) throw Error('Falló login HTTP del caso creado.');
  console.log(JSON.stringify({ verified: true, loginHttp: response.status, pendingNumbers: pending.pendingNumbers, progress: (await Q.getTreatmentProgress(p, result.treatment.id_tratamiento, { audit: false })).data, slots, proposalStatus: proposal.status, requestsCreated: await prisma.solicitudesCustomerIA.count({ where: { id_persona: p.idPersona } }) }));
}
main().catch(error => { console.error('IA03:', error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
