// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../src/db';
import { CustomerAiPersistenceService } from '../src/services/customerAiPersistenceService';

const sqlServerIntegrationEnabled = process.env.AI_AGENT_SQLSERVER_INTEGRATION === 'true';

describe.skipIf(!sqlServerIntegrationEnabled)('PASO 1: Capa de Persistencia del Agente Inteligente Customer (SQL Server aislado)', () => {
  let pacienteValidoId: number;
  let otroPacienteId: number;
  let odontologoValidoId: number;
  let tratamientoValidoId: number;
  let sesionValidaId: number;
  let atencionValidaId: number;
  let usuarioRevisorId: number;

  beforeAll(async () => {
    const expectedInstance = process.env.AI_AGENT_TEST_SQLSERVER_INSTANCE?.trim();
    if (!expectedInstance) throw new Error('Integración bloqueada: defina AI_AGENT_TEST_SQLSERVER_INSTANCE tras verificar la instancia aislada.');
    const [database] = await prisma.$queryRaw<Array<{ databaseName: string; serverName: string; isSysadmin: number }>>`SELECT DB_NAME() AS databaseName, CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) AS serverName, IS_SRVROLEMEMBER('sysadmin') AS isSysadmin`;
    if (database?.databaseName !== 'NexoSaludDB_Test' || database.serverName?.toLowerCase() !== expectedInstance.toLowerCase() || Number(database.isSysadmin) === 1) {
      throw new Error('Integración bloqueada: se requiere NexoSaludDB_Test en la instancia autorizada y una credencial que no sea sysadmin.');
    }

    // 1. Obtener datos válidos de prueba existentes en la base de datos
    const paciente = await prisma.personas.findFirst({
      where: {
        TratamientosContratados: { some: {} },
        Atenciones: { some: {} },
      },
      include: {
        TratamientosContratados: {
          include: { SesionesTratamiento: true },
        },
        Atenciones: true,
      },
    });

    if (!paciente) {
      throw new Error('No se encontró un paciente con tratamientos y atenciones para las pruebas.');
    }

    pacienteValidoId = paciente.id_persona;
    tratamientoValidoId = paciente.TratamientosContratados[0].id_tratamiento;
    sesionValidaId = paciente.TratamientosContratados[0].SesionesTratamiento[0].id_sesion;
    atencionValidaId = paciente.Atenciones[0].id_atencion;

    // Segundo paciente para pruebas de aislamiento de seguridad
    const otroPaciente = await prisma.personas.findFirst({
      where: {
        id_persona: { not: pacienteValidoId },
        TratamientosContratados: { some: {} },
      },
    });
    if (!otroPaciente) {
      throw new Error('No se encontró un segundo paciente para probar aislamiento.');
    }
    otroPacienteId = otroPaciente.id_persona;

    // Odontólogo profesional activo
    const odontologo = await prisma.profesionales.findFirst({
      where: { activo: true, numero_colegiatura: { not: null } },
    });
    if (!odontologo) {
      throw new Error('No se encontró un odontólogo colegiado activo.');
    }
    odontologoValidoId = odontologo.id_profesional;

    // Usuario revisor administrativo o auditor
    const usuario = await prisma.usuarios.findFirst({
      where: { activo: true },
    });
    if (!usuario) {
      throw new Error('No se encontró un usuario del sistema.');
    }
    usuarioRevisorId = usuario.id_usuario;
  });

  // P01: Comprobar que las tablas de IA existen y responden en la base de pruebas
  it('P01: Las tablas de persistencia de IA existen y responden mediante Prisma ORM', async () => {
    const totalInteracciones = await prisma.interaccionesIA.count();
    const totalAlertas = await prisma.alertasIA.count();
    const totalBorradores = await prisma.borradoresIA.count();

    expect(typeof totalInteracciones).toBe('number');
    expect(typeof totalAlertas).toBe('number');
    expect(typeof totalBorradores).toBe('number');
  });

  // P02: Se puede registrar una interacción válida
  it('P02: Se puede registrar una interacción significativa válida', async () => {
    const interaccion = await CustomerAiPersistenceService.registrarInteraccion({
      idPersona: pacienteValidoId,
      actorOrientado: 'PACIENTE',
      tipoEvento: 'CONSULTA_PROXIMA_CITA',
      resumenConsulta: 'Paciente consulta fecha de su siguiente sesión terapéutica.',
      idTratamiento: tratamientoValidoId,
      idSesion: sesionValidaId,
      idAtencion: atencionValidaId,
      idCorrelacion: 'CORR-TEST-P02-001',
    });

    expect(interaccion).toBeDefined();
    expect(interaccion.id_interaccion_ia).toBeGreaterThan(0);
    expect(interaccion.actor_orientado).toBe('PACIENTE');
    expect(interaccion.id_persona).toBe(pacienteValidoId);
    expect(interaccion.es_diagnostico_o_prescripcion).toBe(false);
  });

  // P03: Se rechazan referencias inexistentes a tratamientos, sesiones o atenciones
  it('P03: Se rechazan referencias inexistentes a tratamientos o sesiones', async () => {
    // Tratamiento inexistente
    await expect(
      CustomerAiPersistenceService.registrarInteraccion({
        idPersona: pacienteValidoId,
        actorOrientado: 'PACIENTE',
        tipoEvento: 'CONSULTA_FALLIDA',
        resumenConsulta: 'Prueba de referencia inexistente',
        idTratamiento: 99999999,
      })
    ).rejects.toThrow(/Referencia inválida: el tratamiento 99999999 no existe/);

    // Sesión no perteneciente o inexistente
    await expect(
      CustomerAiPersistenceService.registrarInteraccion({
        idPersona: pacienteValidoId,
        actorOrientado: 'PACIENTE',
        tipoEvento: 'CONSULTA_FALLIDA',
        resumenConsulta: 'Prueba de sesión inexistente',
        idTratamiento: tratamientoValidoId,
        idSesion: 88888888,
      })
    ).rejects.toThrow(/Referencia inválida: la sesión 88888888 no existe/);

    // Tratamiento perteneciente a otro paciente
    await expect(
      CustomerAiPersistenceService.registrarInteraccion({
        idPersona: otroPacienteId, // persona distinta
        actorOrientado: 'PACIENTE',
        tipoEvento: 'CONSULTA_FALLIDA',
        resumenConsulta: 'Intento de acceso cruzado',
        idTratamiento: tratamientoValidoId, // pertenece a pacienteValidoId
      })
    ).rejects.toThrow(/Violación de seguridad: el tratamiento/);
  });

  // P04: Se puede crear una alerta asociada a una interacción
  it('P04: Se puede crear una alerta asociada a una interacción existente', async () => {
    const interaccion = await CustomerAiPersistenceService.registrarInteraccion({
      idPersona: pacienteValidoId,
      actorOrientado: 'ODONTOLOGO',
      tipoEvento: 'ANALISIS_FICHA_CLINICA',
      resumenConsulta: 'Detección automática de campo pendiente en ficha clínica.',
      idTratamiento: tratamientoValidoId,
      idAtencion: atencionValidaId,
    });

    const alerta = await CustomerAiPersistenceService.registrarAlerta({
      idPersona: pacienteValidoId,
      tipoEvento: 'ALERTA_FICHA_INCOMPLETA',
      mensajeAlerta: 'La atención presenta evolución pendiente de validación.',
      severidad: 'Alta',
      idInteraccionOrigen: interaccion.id_interaccion_ia,
      idTratamiento: tratamientoValidoId,
      idAtencion: atencionValidaId,
    });

    expect(alerta).toBeDefined();
    expect(alerta.id_alerta_ia).toBeGreaterThan(0);
    expect(alerta.id_interaccion_origen).toBe(interaccion.id_interaccion_ia);
    expect(alerta.estado).toBe('Generada');
    expect(alerta.severidad).toBe('Alta');
  });

  // P05: Una alerta puede revisarse sin marcarse automáticamente como resuelta
  it('P05: Una alerta puede ponerse En_Revision sin marcarse automáticamente como Atendida', async () => {
    const alerta = await CustomerAiPersistenceService.registrarAlerta({
      idPersona: pacienteValidoId,
      tipoEvento: 'ALERTA_SEGUIMIENTO_POST_TRATAMIENTO',
      mensajeAlerta: 'Paciente reporta leve molestia post-procedimiento.',
      severidad: 'Media',
      idTratamiento: tratamientoValidoId,
    });

    // Revisar sin resolver (En_Revision)
    const alertaEnRevision = await CustomerAiPersistenceService.atenderAlerta({
      idAlerta: alerta.id_alerta_ia,
      idUsuarioRevisor: usuarioRevisorId,
      resultado: 'Alerta asignada a operador para llamada de seguimiento preventivo.',
      estado: 'En_Revision',
    });

    expect(alertaEnRevision.estado).toBe('En_Revision');
    expect(alertaEnRevision.fecha_atencion_alerta).toBeNull();

    // Atender formalmente con evidencia
    const alertaAtendida = await CustomerAiPersistenceService.atenderAlerta({
      idAlerta: alerta.id_alerta_ia,
      idProfesionalRevisor: odontologoValidoId,
      resultado: 'Odontólogo contactó al paciente; molestia remitió normalmente.',
      estado: 'Atendida',
    });

    expect(alertaAtendida.estado).toBe('Atendida');
    expect(alertaAtendida.fecha_atencion_alerta).not.toBeNull();
  });

  // P06: Se puede registrar un borrador y aprobarlo mediante un profesional autorizado
  it('P06: Se puede registrar un borrador y aprobarlo mediante un odontólogo colegiado', async () => {
    const borrador = await CustomerAiPersistenceService.registrarBorrador({
      idPersona: pacienteValidoId,
      idProfesional: odontologoValidoId,
      idAtencion: atencionValidaId,
      idTratamiento: tratamientoValidoId,
      contenidoSugerido: 'Borrador IA: Evitar alimentos duros por 48 horas y aplicar enjuague con clorhexidina 0.12%.',
    });

    expect(borrador.id_borrador_ia).toBeGreaterThan(0);
    expect(borrador.estado).toBe('Generado');
    expect(borrador.requiere_revision_humana).toBe(true);

    const borradorAprobado = await CustomerAiPersistenceService.aprobarBorrador({
      idBorrador: borrador.id_borrador_ia,
      idProfesionalAprobador: odontologoValidoId,
      resultado: 'Aprobado formalmente por el odontólogo tratante tras revisión en sillón.',
    });

    expect(borradorAprobado.estado).toBe('Aprobado');
    expect(borradorAprobado.id_profesional_aprobador).toBe(odontologoValidoId);
    expect(borradorAprobado.fecha_aprobacion).not.toBeNull();
  });

  // P07: Un usuario no autorizado no puede aprobar borradores
  it('P07: Se rechaza la aprobación de borradores por un usuario sin colegiatura odontológica activa', async () => {
    const borrador = await CustomerAiPersistenceService.registrarBorrador({
      idPersona: pacienteValidoId,
      idProfesional: odontologoValidoId,
      idAtencion: atencionValidaId,
      contenidoSugerido: 'Borrador IA pendiente de validación.',
    });

    // Intento con ID de profesional inexistente (ej. ID 99999)
    await expect(
      CustomerAiPersistenceService.aprobarBorrador({
        idBorrador: borrador.id_borrador_ia,
        idProfesionalAprobador: 99999,
      })
    ).rejects.toThrow(/Permiso denegado: el usuario no es un odontólogo colegiado activo/);
  });

  // P08: Un paciente no puede acceder a registros de otro paciente
  it('P08: Un paciente no puede acceder a los registros ni tratamientos de otro paciente', async () => {
    await expect(
      CustomerAiPersistenceService.consultarHistorialPacienteAutorizado(
        { rol: 'PACIENTE', idPersona: pacienteValidoId },
        otroPacienteId // intento de consultar a otro paciente
      )
    ).rejects.toThrow(/Acceso denegado: el paciente .* no está autorizado a ver información del paciente/);

    // Consulta legítima de su propio expediente
    const propioExpediente = await CustomerAiPersistenceService.consultarHistorialPacienteAutorizado(
      { rol: 'PACIENTE', idPersona: pacienteValidoId },
      pacienteValidoId
    );
    expect(propioExpediente).toBeDefined();
    expect(propioExpediente?.id_persona).toBe(pacienteValidoId);
  });

  // P09: Las versiones de un borrador no generan conteos duplicados en borradores_generados
  it('P09: Versionar un mismo borrador conserva el borrador_raiz y no duplica borradores_generados', async () => {
    const metricasIniciales = await CustomerAiPersistenceService.obtenerMetricasIA();

    // Crear borrador versión 1
    const v1 = await CustomerAiPersistenceService.registrarBorrador({
      idPersona: pacienteValidoId,
      idProfesional: odontologoValidoId,
      idAtencion: atencionValidaId,
      contenidoSugerido: 'Versión 1 del borrador de indicaciones post-cirugía.',
      versionBorrador: 1,
    });

    const metricasTrasV1 = await CustomerAiPersistenceService.obtenerMetricasIA();
    expect(metricasTrasV1.borradores_generados).toBe(metricasIniciales.borradores_generados + 1);

    // Crear versión 2 asociada al mismo borrador raíz
    const v2 = await CustomerAiPersistenceService.registrarBorrador({
      idPersona: pacienteValidoId,
      idProfesional: odontologoValidoId,
      idAtencion: atencionValidaId,
      contenidoSugerido: 'Versión 2 corregida del borrador.',
      idBorradorRaiz: v1.id_borrador_raiz,
      versionBorrador: 2,
    });

    expect(v2.id_borrador_raiz).toBe(v1.id_borrador_raiz);
    expect(v2.version_borrador).toBe(2);

    const metricasTrasV2 = await CustomerAiPersistenceService.obtenerMetricasIA();
    // La métrica de borradores únicos generados NO debe incrementarse con la nueva versión
    expect(metricasTrasV2.borradores_generados).toBe(metricasTrasV1.borradores_generados);
  });

  // P10: Las operaciones no modifican reservas, pagos validados ni importes comerciales
  it('P10: Las operaciones del servicio de IA son de persistencia aislada y no modifican reservas ni pagos de PAYER', async () => {
    // Tomar snapshot de reservas y pagos
    const pagoAntes = await prisma.pagos.findFirst({
      where: { estado: 'Validado' },
    });
    if (!pagoAntes) {
      throw new Error('No hay pagos validados para la prueba de inmutabilidad.');
    }

    const reservaAntes = await prisma.reservas.findUnique({
      where: { id_reserva: pagoAntes.id_reserva },
    });

    // Ejecutar múltiples operaciones de IA
    const interaccion = await CustomerAiPersistenceService.registrarInteraccion({
      idPersona: pagoAntes.id_persona,
      actorOrientado: 'PACIENTE',
      tipoEvento: 'CONSULTA_COMPROBANTE',
      resumenConsulta: 'Paciente solicita copia de comprobante emitido.',
    });

    await CustomerAiPersistenceService.registrarAlerta({
      idPersona: pagoAntes.id_persona,
      tipoEvento: 'AVISO_DOCUMENTAL',
      mensajeAlerta: 'Envío de resumen realizado.',
      idInteraccionOrigen: interaccion.id_interaccion_ia,
    });

    // Verificar que pagos y reservas permanecen intactos
    const pagoDespues = await prisma.pagos.findUnique({
      where: { id_pago: pagoAntes.id_pago },
    });
    const reservaDespues = await prisma.reservas.findUnique({
      where: { id_reserva: pagoAntes.id_reserva },
    });

    expect(pagoDespues?.importe.toNumber()).toEqual(pagoAntes.importe.toNumber());
    expect(pagoDespues?.estado).toBe(pagoAntes.estado);
    expect(pagoDespues?.referencia_pago).toBe(pagoAntes.referencia_pago);
    expect(reservaDespues?.estado).toBe(reservaAntes?.estado);
  });

  // P11: Las relaciones Prisma coinciden con la estructura real de SQL Server
  it('P11: Las relaciones Prisma coinciden con la estructura real de SQL Server', async () => {
    const interaccionConRelaciones = await prisma.interaccionesIA.findFirst({
      where: { id_tratamiento: { not: null }, id_atencion: { not: null } },
      include: {
        Personas: true,
        TratamientosContratados: true,
        Atenciones: true,
        AlertasIA: true,
      },
    });

    expect(interaccionConRelaciones).toBeDefined();
    expect(interaccionConRelaciones?.Personas).toBeDefined();
    expect(interaccionConRelaciones?.TratamientosContratados).toBeDefined();
    expect(interaccionConRelaciones?.Atenciones).toBeDefined();
  });

  // P12: Las nuevas migraciones no afectan las funcionalidades previas de CUSTOMER y PAYER
  it('P12: Compatibilidad preservada con entidades y rutas clave de CUSTOMER y PAYER', async () => {
    const totalTratamientos = await prisma.tratamientosContratados.count();
    const totalPagos = await prisma.pagos.count();
    const totalReservas = await prisma.reservas.count();
    const totalAtenciones = await prisma.atenciones.count();

    expect(totalTratamientos).toBeGreaterThan(0);
    expect(totalPagos).toBeGreaterThan(0);
    expect(totalReservas).toBeGreaterThan(0);
    expect(totalAtenciones).toBeGreaterThan(0);
  });
});
