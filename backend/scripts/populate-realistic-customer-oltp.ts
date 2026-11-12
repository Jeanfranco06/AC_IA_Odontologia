import { prisma } from '../src/db';
import crypto from 'crypto';

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function main() {
  console.log('🚀 Iniciando enriquecimiento y población realista de NexoSaludDB...');

  // 1. Enriquecer tratamiento 1 (Adriana Alayo - Id 1, Sesión 1 -> Atención 220)
  const aten220 = await prisma.atenciones.findUnique({ where: { id_atencion: 220 } });
  if (aten220) {
    await prisma.atenciones.update({
      where: { id_atencion: 220 },
      data: {
        estado_cierre_documental: 'Cerrada',
        id_profesional_validador_cierre: 2,
        fecha_validacion_cierre: new Date('2026-11-11T14:30:00Z'),
        diagnostico_basico: 'Gingivitis marginal inducida por placa bacteriana y sarro supragingival',
        procedimiento_realizado: 'Destartraje supragingival con ultrasonido, pulido y flúor barniz 5%',
        resultado: 'Eliminación completa de cálculos supragingivales, hemostasia lograda',
        indicaciones_finales: 'Dieta blanda y no cepillarse las próximas 4 horas tras barniz de flúor'
      }
    });

    const countProc220 = await prisma.detalleProcedimiento.count({ where: { id_atencion: 220 } });
    if (countProc220 === 0) {
      await prisma.detalleProcedimiento.createMany({
        data: [
          {
            id_atencion: 220,
            id_servicio: 7, // Evaluación General
            procedimiento_realizado: 'Evaluación clínica integral y odontograma digital',
            id_profesional: 2,
            implica_cargo_adicional: false,
            observaciones: 'Evaluación periodontal y oclusal sin hallazgos patológicos mayores',
            fecha_registro: new Date('2026-11-11T14:05:00Z')
          },
          {
            id_atencion: 220,
            id_servicio: 8, // Limpieza / Profilaxis
            procedimiento_realizado: 'Destartraje supragingival con ultrasonido piezoeléctrico en sextantes 5 y 6',
            id_profesional: 2,
            implica_cargo_adicional: false,
            observaciones: 'Remoción de depósitos calcificados sin dolor ni sangrado profuso',
            fecha_registro: new Date('2026-11-11T14:15:00Z')
          },
          {
            id_atencion: 220,
            id_servicio: 4, // Fluorización
            procedimiento_realizado: 'Pulido coronario con copa de profilaxis y aplicación tópica de flúor barniz al 5%',
            id_profesional: 2,
            implica_cargo_adicional: false,
            observaciones: 'Sellado y remineralización de esmalte en piezas 1.6, 2.6, 3.6, 4.6',
            fecha_registro: new Date('2026-11-11T14:25:00Z')
          }
        ]
      });
      console.log('  ✓ DetalleProcedimiento agregado para Atención 220 (Tratamiento 1)');
    }

    const countVal220 = await prisma.validacionesFicha.count({ where: { id_atencion: 220 } });
    if (countVal220 === 0) {
      await prisma.validacionesFicha.create({
        data: {
          id_atencion: 220,
          numero_revision: 1,
          resultado_validacion: 'Completa',
          campos_pendientes: null,
          id_profesional_validador: 2,
          huella_documental: sha256('ATEN-220-REV1-SALAZAR-COMPLETA'),
          fecha_revision: new Date('2026-11-11T14:30:00Z')
        }
      });
      console.log('  ✓ ValidacionesFicha agregada para Atención 220');
    }

    const countInd220 = await prisma.indicacionesPostatencion.count({ where: { id_atencion: 220 } });
    if (countInd220 === 0) {
      await prisma.indicacionesPostatencion.create({
        data: {
          id_atencion: 220,
          version: 1,
          es_version_vigente: true,
          estado: 'Documento emitido',
          contenido_indicaciones: '1. No ingerir alimentos calientes ni cepillarse durante las 4 horas posteriores a la aplicación del flúor barniz.\n2. Retomar técnica de cepillado Bass modificada dos veces al día con pasta fluorada de 1450 ppm.\n3. Acudir a control preventivo según cronograma semestral.',
          origen_documento: 'PROFESIONAL',
          id_profesional_aprobador: 2,
          fecha_aprobacion: new Date('2026-11-11T14:32:00Z'),
          fecha_emision: new Date('2026-11-11T14:32:00Z'),
          fecha_creacion: new Date('2026-11-11T14:30:00Z')
        }
      });
      console.log('  ✓ IndicacionesPostatencion agregada para Atención 220');
    }
  }

  // 2. Enriquecer Sesión 1 de Tratamiento 2 (Javier Terrones - Id 2)
  const atenSes1Trat2 = await prisma.atenciones.findFirst({ where: { id_tratamiento: 2, id_sesion: 2 } });
  let idAtenSes1Trat2 = atenSes1Trat2?.id_atencion;
  if (!atenSes1Trat2) {
    const newAten = await prisma.atenciones.create({
      data: {
        id_persona: 314,
        id_reserva: 122,
        id_servicio: 9, // Ortodoncia Inicial
        id_profesional: 1, // Valeria Mendoza
        id_sede: 1, // Centro Histórico
        fecha_atencion: new Date('2026-11-04T15:00:00Z'),
        fecha_inicio: new Date('2026-11-04T15:05:00Z'),
        fecha_fin: new Date('2026-11-04T15:50:00Z'),
        asistencia: 'Asistió',
        estado_servicio: 'Finalizado',
        motivo_consulta: 'Inicio de tratamiento de ortodoncia correctiva fija',
        antecedentes: 'Sin antecedentes sistémicos de relevancia',
        alergias: 'Niega alergias a medicamentos o metales',
        evaluacion: 'Maloclusión Clase II esquelética, apiñamiento anterosuperior moderado de 4mm',
        diagnostico_basico: 'Maloclusión Clase II división 1 con mordida profunda anterior',
        procedimiento: 'Cementado directo de brackets prescripción Roth 0.022 superior e inferior y ligadura con arcos termoactivados NiTi 0.014',
        procedimiento_realizado: 'Cementado de brackets Roth 0.022 e inserción de arco NiTi 0.014',
        observaciones: 'Instalación sin complicaciones. El paciente tolera bien los aditamentos.',
        resultado: 'Aparatos fijos instalados y activos en ambas arcadas',
        indicaciones_finales: 'Dieta blanda por 48 horas, uso de cera para ortodoncia y cepillado minucioso.',
        id_tratamiento: 2,
        id_sesion: 2,
        estado_cierre_documental: 'Cerrada',
        id_profesional_validador_cierre: 1,
        fecha_validacion_cierre: new Date('2026-11-04T15:55:00Z')
      }
    });
    idAtenSes1Trat2 = newAten.id_atencion;
    console.log(`  ✓ Atención creada para Sesión 1 Tratamiento 2 (id: ${idAtenSes1Trat2})`);
  }

  if (idAtenSes1Trat2) {
    const countProc = await prisma.detalleProcedimiento.count({ where: { id_atencion: idAtenSes1Trat2 } });
    if (countProc === 0) {
      await prisma.detalleProcedimiento.createMany({
        data: [
          {
            id_atencion: idAtenSes1Trat2,
            id_servicio: 9,
            procedimiento_realizado: 'Profilaxis previa y grabado ácido con ácido fosfórico al 37% por 15 segundos',
            id_profesional: 1,
            implica_cargo_adicional: false,
            observaciones: 'Superficies vestibulares acondicionadas y secas',
            fecha_registro: new Date('2026-11-04T15:15:00Z')
          },
          {
            id_atencion: idAtenSes1Trat2,
            id_servicio: 9,
            procedimiento_realizado: 'Cementado directo de brackets metálicos Roth 0.022 con resina Transbond XT',
            id_profesional: 1,
            implica_cargo_adicional: false,
            observaciones: 'Posicionamiento preciso con calibrador de altura Boone',
            fecha_registro: new Date('2026-11-04T15:35:00Z')
          },
          {
            id_atencion: idAtenSes1Trat2,
            id_servicio: 9,
            procedimiento_realizado: 'Instalación de arcos térmicos NiTi 0.014 superior e inferior con ligaduras elásticas',
            id_profesional: 1,
            implica_cargo_adicional: false,
            observaciones: 'Fuerzas ligeras iniciales de alineamiento y nivelación',
            fecha_registro: new Date('2026-11-04T15:45:00Z')
          }
        ]
      });
      await prisma.validacionesFicha.create({
        data: {
          id_atencion: idAtenSes1Trat2,
          numero_revision: 1,
          resultado_validacion: 'Completa',
          campos_pendientes: null,
          id_profesional_validador: 1,
          huella_documental: sha256(`ATEN-${idAtenSes1Trat2}-REV1-MENDOZA-COMPLETA`),
          fecha_revision: new Date('2026-11-04T15:55:00Z')
        }
      });
      await prisma.indicacionesPostatencion.create({
        data: {
          id_atencion: idAtenSes1Trat2,
          version: 1,
          es_version_vigente: true,
          estado: 'Documento emitido',
          contenido_indicaciones: '1. No consumir alimentos duros, pegajosos o con hueso (manzanas enteras, turrón, tostadas duras).\n2. En caso de fricción en carrillo o labios, colocar una pequeña bolita de cera ortodóntica sobre el bracket.\n3. Tomar Paracetamol 500mg si presenta molestia dental en las primeras 24 horas.\n4. Cepillarse después de cada comida utilizando cepillo ortodóntico y enhebrador interdental.',
          origen_documento: 'PROFESIONAL',
          id_profesional_aprobador: 1,
          fecha_aprobacion: new Date('2026-11-04T15:55:00Z'),
          fecha_emision: new Date('2026-11-04T15:55:00Z'),
          fecha_creacion: new Date('2026-11-04T15:50:00Z')
        }
      });
      console.log('  ✓ Procedimientos, validación e indicaciones agregadas para Sesión 1 Tratamiento 2');
    }
  }

  // 3. Enriquecer Atención 1523 de Tratamiento 5 (Milagros Acosta - Blanqueamiento Sesión 2)
  const aten1523 = await prisma.atenciones.findUnique({ where: { id_atencion: 1523 } });
  if (aten1523) {
    await prisma.atenciones.update({
      where: { id_atencion: 1523 },
      data: {
        estado_cierre_documental: 'Cerrada',
        id_profesional_validador_cierre: 4,
        fecha_validacion_cierre: new Date('2026-11-08T10:15:00Z'),
        diagnostico_basico: 'Discromía dental generalizada por tinción extrínseca e intrínseca leve',
        procedimiento_realizado: 'Blanqueamiento dental en consultorio con peróxido de hidrógeno al 35% fotoactivado',
        resultado: 'Aclaramiento dental de 3 tonos en escala VITA (de A3.5 a A1)',
        indicaciones_finales: 'Dieta blanca estricta por 72 horas y gel desensibilizante nocturno'
      }
    });

    const countProc1523 = await prisma.detalleProcedimiento.count({ where: { id_atencion: 1523 } });
    if (countProc1523 === 0) {
      await prisma.detalleProcedimiento.createMany({
        data: [
          {
            id_atencion: 1523,
            id_servicio: 12,
            procedimiento_realizado: 'Aislamiento relativo y aplicación de barrera gingival fotocurable OpalDam',
            id_profesional: 4,
            implica_cargo_adicional: false,
            observaciones: 'Sellado gingival estanco para proteger papilas interdentales',
            fecha_registro: new Date('2026-11-08T09:20:00Z')
          },
          {
            id_atencion: 1523,
            id_servicio: 12,
            procedimiento_realizado: 'Aplicación de gel blanqueador peróxido de hidrógeno 35% en 3 sesiones de 15 minutos',
            id_profesional: 4,
            implica_cargo_adicional: false,
            observaciones: 'Fotoactivación con luz LED fría de longitud de onda 450-470 nm',
            fecha_registro: new Date('2026-11-08T09:50:00Z')
          },
          {
            id_atencion: 1523,
            id_servicio: 12,
            procedimiento_realizado: 'Lavado profuso, retiro de barrera y aplicación de flúor neutro desensibilizante',
            id_profesional: 4,
            implica_cargo_adicional: false,
            observaciones: 'Sin dolor agudo transoperatorio, sensibilidad postoperatoria grado 1 transitoria',
            fecha_registro: new Date('2026-11-08T10:10:00Z')
          }
        ]
      });
      await prisma.validacionesFicha.create({
        data: {
          id_atencion: 1523,
          numero_revision: 1,
          resultado_validacion: 'Completa',
          campos_pendientes: null,
          id_profesional_validador: 4,
          huella_documental: sha256('ATEN-1523-REV1-ALVA-COMPLETA'),
          fecha_revision: new Date('2026-11-08T10:15:00Z')
        }
      });
      await prisma.indicacionesPostatencion.create({
        data: {
          id_atencion: 1523,
          version: 1,
          es_version_vigente: true,
          estado: 'Documento emitido',
          contenido_indicaciones: '1. Seguir dieta blanca estricta durante las próximas 72 horas (no café, té, gaseosas oscuras, vino, remolacha, salsas rojas o chocolates).\n2. No fumar durante las siguientes 72 horas para asegurar la estabilidad del color logrado.\n3. En caso de presentar sensibilidad al frío o aire, utilizar el gel desensibilizante entregado antes de acostarse.\n4. Control y mantenimiento semestral.',
          origen_documento: 'PROFESIONAL',
          id_profesional_aprobador: 4,
          fecha_aprobacion: new Date('2026-11-08T10:15:00Z'),
          fecha_emision: new Date('2026-11-08T10:15:00Z'),
          fecha_creacion: new Date('2026-11-08T10:10:00Z')
        }
      });
      console.log('  ✓ Procedimientos, validación e indicaciones agregadas para Atención 1523 (Tratamiento 5)');
    }
  }

  // 4. Crear 10 Tratamientos Clínicos Nuevos (Id 6 a 15) en pacientes reales no SimBuyer
  const clinicalCases = [
    {
      idPersona: 2, // José Flores
      idReserva: 2,
      idSolicitud: 2,
      idServicio: 5, // Restauración dental
      idProfesional: 3, // Lucía Vásquez
      idSede: 1, // Sede Centro Histórico
      precio: 450.00,
      estadoTratamiento: 'En ejecución',
      planObj: 'Rehabilitación oclusal con resinas compuestas estratificadas en cuadrante 1',
      totalSesiones: 2,
      sesiones: [
        {
          num: 1,
          fecha: '2026-11-02T10:00:00Z',
          estadoProg: 'Programada',
          estadoAsist: 'Realizada',
          estadoCierre: 'Cerrada',
          diag: 'Caries dentinaria profunda en pieza 1.6 con compromiso oclusodistal',
          proc: 'Eliminación de caries bajo aislamiento absoluto y restauración con resina compuesta Filtek Z350 XT color A3',
          detalles: [
            'Anestesia infiltrativa local lidocaína 2% con epinefrina 1:100,000 en nervio alveolar superior posterior',
            'Aislamiento absoluto con dique de goma y grapa 14A',
            'Conformación de cavidad ocluso-distal y protección pulpar indirecta con liner de ionómero de vidrio',
            'Grabado selectivo de esmalte, adhesivo universal Single Bond y reconstrucción cuspídea con resina Z350 XT'
          ],
          indicaciones: 'No masticar sólidos hasta que el efecto de la anestesia haya desaparecido por completo. Higiene normal con hilo dental.'
        },
        {
          num: 2,
          fecha: '2026-11-16T10:00:00Z',
          estadoProg: 'Programada',
          estadoAsist: 'Pendiente',
          estadoCierre: 'Pendiente'
        }
      ]
    },
    {
      idPersona: 3, // Lucía Benites
      idReserva: 3,
      idSolicitud: 3,
      idServicio: 10, // Implante Dental
      idProfesional: 4, // Renzo Alva
      idSede: 3, // Sede El Golf
      precio: 2800.00,
      estadoTratamiento: 'En ejecución',
      planObj: 'Fase quirúrgica y protésica de implante osteointegrado unitario en pieza 2.4',
      totalSesiones: 3,
      sesiones: [
        {
          num: 1,
          fecha: '2026-10-25T16:00:00Z',
          estadoProg: 'Programada',
          estadoAsist: 'Realizada',
          estadoCierre: 'Cerrada',
          diag: 'Edentulismo parcial maxilar por fractura radicular vertical de premolar 2.4',
          proc: 'Colocación de implante de titanio conexión cono Morse 3.75x11.5mm y sutura no reabsorbible 4-0',
          detalles: [
            'Infiltración troncular e intrapapilar con articaína 4% con epinefrina 1:100,000',
            'Incisión intrasulcular con descargas y despegamiento mucoperióstico a espesor total',
            'Fresado secuencial con irrigación salina helada y colocación de implante con torque de inserción 40 N.cm',
            'Colocación de tornillo de cierre y sutura monofilamento con puntos simples'
          ],
          indicaciones: 'Amoxicilina 500 mg cada 8 horas por 7 días, Ibuprofeno 600 mg cada 8 horas por 4 días. Aplicación de frío local externo 20 min por hora durante las primeras 24h. No escupir ni enjuagarse con fuerza.'
        },
        {
          num: 2,
          fecha: '2026-11-03T16:30:00Z',
          estadoProg: 'Programada',
          estadoAsist: 'Realizada',
          estadoCierre: 'Cerrada',
          diag: 'Control postquirúrgico y retiro de suturas a los 9 días',
          proc: 'Inspección de cicatrización de tejidos blandos, asepsia con clorhexidina 0.12% y retiro atraumático de suturas',
          detalles: [
            'Inspección clínica: encía adherida normocoloreada, sin signos de dehiscencia ni exudado',
            'Lavado con solución fisiológica y antiséptico tópico',
            'Retiro ordenado de 5 puntos de sutura monofilamento sin sangrado'
          ],
          indicaciones: 'Continuar con cepillado muy cuidadoso en la zona y colutorio de clorhexidina 0.12% por 5 días más.'
        },
        {
          num: 3,
          fecha: '2026-11-28T16:00:00Z',
          estadoProg: 'Programada',
          estadoAsist: 'Pendiente',
          estadoCierre: 'Pendiente'
        }
      ]
    },
    {
      idPersona: 4, // Jorge Chigne
      idReserva: 4,
      idSolicitud: 4,
      idServicio: 8, // Limpieza / Profilaxis
      idProfesional: 2, // Diego Salazar
      idSede: 2, // Sede California
      precio: 180.00,
      estadoTratamiento: 'Completado',
      planObj: 'Profilaxis profunda y control de sarro gingival',
      totalSesiones: 1,
      sesiones: [
        {
          num: 1,
          fecha: '2026-11-05T09:00:00Z',
          estadoProg: 'Programada',
          estadoAsist: 'Realizada',
          estadoCierre: 'Cerrada',
          diag: 'Gingivitis asociada a placa y cálculo subgingival leve',
          proc: 'Raspaje supragingival ultrasónico, profilaxis con copa de silicona y enjuague peróxido diluido',
          detalles: [
            'Detartraje con puntas subgingivales piezoeléctricas en todas las piezas dentales',
            'Pulido con pasta de grano fino fluorada para remoción de tinciones extrínsecas de café',
            'Aplicación tópica de colutorio antiséptico y educación en técnica de cepillado'
          ],
          indicaciones: 'Uso diario de hilo dental encerado y enjuague bucal fluorado sin alcohol.'
        }
      ]
    },
    {
      idPersona: 5, // Ana Zavaleta
      idReserva: 5,
      idSolicitud: 5,
      idServicio: 9, // Ortodoncia Inicial
      idProfesional: 1, // Valeria Mendoza
      idSede: 1, // Sede Centro Histórico
      precio: 1500.00,
      estadoTratamiento: 'En ejecución',
      planObj: 'Alineación y nivelación de arcada superior con aparatología fija autoligante',
      totalSesiones: 3,
      sesiones: [
        {
          num: 1,
          fecha: '2026-10-29T11:00:00Z',
          estadoProg: 'Programada',
          estadoAsist: 'Realizada',
          estadoCierre: 'Cerrada',
          diag: 'Apiñamiento severo anterosuperior con discrepancia óseo-dentaria de -5mm',
          proc: 'Cementado de brackets autoligables sistema Damon en arcada superior de 1.5 a 2.5 y arco Cooper NiTi 0.013',
          detalles: [
            'Grabado de esmalte y adhesión con resina hidrófuga',
            'Fijación pasiva de brackets autoligantes con mínima fricción',
            'Instalación de arco Copper NiTi 0.013 termoactivado'
          ],
          indicaciones: 'Cuidado estricto de aparatos. Cera ortodóntica ante roce en mucosa labial.'
        },
        {
          num: 2,
          fecha: '2026-11-19T11:00:00Z',
          estadoProg: 'Programada',
          estadoAsist: 'Pendiente',
          estadoCierre: 'Pendiente'
        },
        {
          num: 3,
          fecha: '2026-12-03T11:00:00Z',
          estadoProg: 'Programada',
          estadoAsist: 'Pendiente',
          estadoCierre: 'Pendiente'
        }
      ]
    },
    {
      idPersona: 6, // Luis Terrones
      idReserva: 6,
      idSolicitud: 6,
      idServicio: 11, // Restauración Estética
      idProfesional: 3, // Lucía Vásquez
      idSede: 2, // Sede California
      precio: 650.00,
      estadoTratamiento: 'Completado',
      planObj: 'Carillas directas de resina de alta estética en piezas anterosuperiores 1.1 y 2.1',
      totalSesiones: 2,
      sesiones: [
        {
          num: 1,
          fecha: '2026-10-20T14:00:00Z',
          estadoProg: 'Programada',
          estadoAsist: 'Realizada',
          estadoCierre: 'Cerrada',
          diag: 'Fractura no complicada de esmalte y dentina en ángulo mesio-incisal de 1.1 y 2.1',
          proc: 'Reconstrucción estratificada con resina composite policromática dentina A2 y esmalte translúcido',
          detalles: [
            'Biselado amelodentinario de 45 grados para mimetización óptica',
            'Estratificación anatómica por capas: efecto de mamelones y halo incisal',
            'Fotopolimerización incremental con lámpara LED de alta intensidad 1200 mW/cm2'
          ],
          indicaciones: 'No cortar alimentos duros directamente con los dientes anteriores (manzanas, bocadillos duros).'
        },
        {
          num: 2,
          fecha: '2026-10-27T14:30:00Z',
          estadoProg: 'Programada',
          estadoAsist: 'Realizada',
          estadoCierre: 'Cerrada',
          diag: 'Control de oclusión, pulido y brillo final de restauraciones estéticas',
          proc: 'Ajuste de contactos en máxima intercuspidación y movimientos de lateralidad; pulido con pastas de diamante',
          detalles: [
            'Comprobación de desoclusión anterior canina con papel de articular 12 micras',
            'Acabado con discos abrasivos Sof-Lex de grano fino y ultrafino',
            'Glaseado y pulido de alto brillo con espiral de silicona y pasta diamantada'
          ],
          indicaciones: 'Control odontológico preventivo a los 6 meses. Cepillo dental de cerdas suaves.'
        }
      ]
    },
    {
      idPersona: 7, // Rosa Alayo
      idReserva: 7,
      idSolicitud: 7,
      idServicio: 6, // Control odontológico
      idProfesional: 1, // Valeria Mendoza
      idSede: 1, // Sede Centro Histórico
      precio: 120.00,
      estadoTratamiento: 'Completado',
      planObj: 'Control clínico periódico y evaluación periodontal de soporte',
      totalSesiones: 1,
      sesiones: [
        {
          num: 1,
          fecha: '2026-11-06T11:30:00Z',
          estadoProg: 'Programada',
          estadoAsist: 'Realizada',
          estadoCierre: 'Cerrada',
          diag: 'Estado periodontal estable, sin actividad cariosa presente',
          proc: 'Examen clínico, sondaje periodontal básico (PSR) y profilaxis supragingival de mantenimiento',
          detalles: [
            'Sondaje periodontal en 6 puntos por diente, profundidad de sondaje menor a 3mm en todas las piezas',
            'Profilaxis con copa de goma y pasta profiláctica mentolada'
          ],
          indicaciones: 'Mantener técnica de higiene actual. Próximo control programado en mayo 2027.'
        }
      ]
    },
    {
      idPersona: 8, // Miguel Mendoza
      idReserva: 8,
      idSolicitud: 8,
      idServicio: 12, // Blanqueamiento Dental
      idProfesional: 4, // Renzo Alva
      idSede: 3, // Sede El Golf
      precio: 550.00,
      estadoTratamiento: 'En ejecución',
      planObj: 'Blanqueamiento combinado en consultorio y férulas nocturnas ambulatorias',
      totalSesiones: 2,
      sesiones: [
        {
          num: 1,
          fecha: '2026-11-07T17:00:00Z',
          estadoProg: 'Programada',
          estadoAsist: 'Realizada',
          estadoCierre: 'Cerrada',
          diag: 'Pigmentación dental extrínseca por tabaco y consumo de mate',
          proc: 'Limpieza previa, toma de impresiones para férulas individuales y primera sesión de blanqueamiento al 35%',
          detalles: [
            'Toma de impresiones con alginato de alta precisión y vaciado en yeso piedra tipo III',
            'Aislamiento con barrera gingival fotocurable y aplicación de gel de peróxido 35% por 20 minutos',
            'Retiro cuidadoso de residuos y enjuague neutro'
          ],
          indicaciones: 'Dieta blanca por 48 horas. Recojo de férulas y gel ambulatorio en la siguiente sesión.'
        },
        {
          num: 2,
          fecha: '2026-11-17T17:00:00Z',
          estadoProg: 'Programada',
          estadoAsist: 'Pendiente',
          estadoCierre: 'Pendiente'
        }
      ]
    },
    {
      idPersona: 9, // Patricia Salazar
      idReserva: 9,
      idSolicitud: 9,
      idServicio: 10, // Implante Dental
      idProfesional: 3, // Lucía Vásquez
      idSede: 1, // Sede Centro Histórico
      precio: 3200.00,
      estadoTratamiento: 'En ejecución',
      planObj: 'Rehabilitación sobre implante mediante corona de zirconio atornillada en pieza 4.6',
      totalSesiones: 3,
      sesiones: [
        {
          num: 1,
          fecha: '2026-10-18T15:00:00Z',
          estadoProg: 'Programada',
          estadoAsist: 'Realizada',
          estadoCierre: 'Cerrada',
          diag: 'Implante osteointegrado en 4.6 listo para segunda fase quirúrgica protésica',
          proc: 'Descubrimiento de implante, colocación de pilar de cicatrización de titanio de 4mm y control radiográfico',
          detalles: [
            'Anestesia local infiltrativa y punch mucoso sobre la plataforma del implante',
            'Retiro de tornillo de cierre estéril y desinfección interna de la conexión',
            'Inserción de tornillo de cicatrización con torque manual de 15 N.cm',
            'Radiografía periapical digital que confirma correcto asentamiento del aditamento'
          ],
          indicaciones: 'Enjuague suave con clorhexidina 0.12% dos veces al día por 7 días. Dieta blanda.'
        },
        {
          num: 2,
          fecha: '2026-11-09T15:30:00Z',
          estadoProg: 'Programada',
          estadoAsist: 'Realizada',
          estadoCierre: 'Cerrada',
          diag: 'Conformación de perfil de emergencia gingival óptimo',
          proc: 'Toma de impresión digital con scan body intraoral para fabricación de corona definitiva de zirconio CAD/CAM',
          detalles: [
            'Retiro de pilar de cicatrización y lavado con suero fisiológico',
            'Colocación y ajuste de scan body específico para la conexión',
            'Escaneo intraoral de arcada superior, inferior y registro de mordida en oclusión céntrica'
          ],
          indicaciones: 'Cita de instalación de corona programada para entrega de laboratorio.'
        },
        {
          num: 3,
          fecha: '2026-11-20T15:00:00Z',
          estadoProg: 'Programada',
          estadoAsist: 'Pendiente',
          estadoCierre: 'Pendiente'
        }
      ]
    },
    {
      idPersona: 10, // Fernando Vásquez
      idReserva: 10,
      idSolicitud: 10,
      idServicio: 7, // Evaluación General
      idProfesional: 2, // Diego Salazar
      idSede: 2, // Sede California
      precio: 150.00,
      estadoTratamiento: 'En ejecución',
      planObj: 'Diagnóstico integral, plan de tratamiento y profilaxis básica',
      totalSesiones: 2,
      sesiones: [
        {
          num: 1,
          fecha: '2026-11-10T16:00:00Z',
          estadoProg: 'Programada',
          estadoAsist: 'Realizada',
          estadoCierre: 'Cerrada',
          diag: 'Caries de esmalte en piezas 3.7 y 4.7, acumulación de sarro moderado en anteriores',
          proc: 'Evaluación periodontal, serie radiográfica periapical y profilaxis con ultrasonido',
          detalles: [
            'Examen periodontal completo e índice de placa de O\'Leary (32%)',
            'Toma de 4 radiografías bite-wing digitales',
            'Detartraje con cavitrón ultrasónico supragingival'
          ],
          indicaciones: 'Cepillado minucioso. Se programa sesión 2 para obturación de piezas oclusales con resina.'
        },
        {
          num: 2,
          fecha: '2026-11-24T16:00:00Z',
          estadoProg: 'Programada',
          estadoAsist: 'Pendiente',
          estadoCierre: 'Pendiente'
        }
      ]
    },
    {
      idPersona: 11, // Carmen Cruz
      idReserva: 11,
      idSolicitud: 11,
      idServicio: 4, // Fluorización
      idProfesional: 1, // Valeria Mendoza
      idSede: 1, // Sede Centro Histórico
      precio: 140.00,
      estadoTratamiento: 'Completado',
      planObj: 'Protocolo preventivo remineralizante con barniz fluorado y sellantes de fosas',
      totalSesiones: 1,
      sesiones: [
        {
          num: 1,
          fecha: '2026-11-01T10:00:00Z',
          estadoProg: 'Programada',
          estadoAsist: 'Realizada',
          estadoCierre: 'Cerrada',
          diag: 'Alto riesgo cariogénico por desmineralizaciones incipientes en fosas y fisuras',
          proc: 'Profilaxis con piedra pómez y agua, sellado de fosas con ionómero de resina y barniz de flúor',
          detalles: [
            'Limpieza de fisuras con cepillo de cerdas y agua a presión',
            'Acondicionamiento y aplicación de sellante fotopolimerizable en molares 1.7, 2.7, 3.7, 4.7',
            'Barnizado de flúor sódico al 5% en todas las caras vestibulares'
          ],
          indicaciones: 'No ingerir alimentos pegajosos las primeras 2 horas. Asistencia a control cada 4 meses.'
        }
      ]
    }
  ];

  for (const c of clinicalCases) {
    let trat = await prisma.tratamientosContratados.findUnique({
      where: { id_reserva_origen: c.idReserva }
    });

    if (!trat) {
      trat = await prisma.tratamientosContratados.create({
        data: {
          id_persona: c.idPersona,
          id_solicitud: c.idSolicitud,
          id_reserva_origen: c.idReserva,
          id_servicio: c.idServicio,
          id_profesional_responsable: c.idProfesional,
          id_sede: c.idSede,
          precio_pactado: c.precio,
          fecha_contratacion: new Date('2026-10-15T09:00:00Z'),
          fecha_activacion: new Date('2026-10-16T10:00:00Z'),
          fecha_inicio_real: new Date(c.sesiones[0].fecha),
          fecha_cierre_real: c.estadoTratamiento === 'Completado' ? new Date(c.sesiones[c.sesiones.length - 1].fecha) : null,
          estado_tratamiento: c.estadoTratamiento,
          id_profesional_cierre: c.estadoTratamiento === 'Completado' ? c.idProfesional : null
        }
      });
      console.log(`  ✓ Tratamiento creado para Persona ${c.idPersona} (id: ${trat.id_tratamiento})`);
    }

    let plan = await prisma.planTratamiento.findFirst({
      where: { id_tratamiento: trat.id_tratamiento, version_plan: 1 }
    });

    if (!plan) {
      plan = await prisma.planTratamiento.create({
        data: {
          id_tratamiento: trat.id_tratamiento,
          version_plan: 1,
          es_vigente: true,
          sesiones_planificadas: c.totalSesiones,
          duracion_estimada: 45,
          estado_plan: 'Aprobado',
          motivo_modificacion: c.planObj,
          id_profesional_aprobador: c.idProfesional,
          fecha_aprobacion: new Date('2026-10-16T10:00:00Z')
        }
      });
      console.log(`    ✓ Plan creado para Tratamiento ${trat.id_tratamiento}`);
    }

    for (const sesData of c.sesiones) {
      let ses = await prisma.sesionesTratamiento.findFirst({
        where: { id_tratamiento: trat.id_tratamiento, numero_sesion: sesData.num }
      });

      if (!ses) {
        ses = await prisma.sesionesTratamiento.create({
          data: {
            id_tratamiento: trat.id_tratamiento,
            id_plan: plan.id_plan,
            numero_sesion: sesData.num,
            id_profesional: c.idProfesional,
            id_sede: c.idSede,
            fecha_programada_vigente: new Date(sesData.fecha),
            duracion_programada_min: 45,
            fecha_llegada: sesData.estadoAsist === 'Realizada' ? new Date(sesData.fecha) : null,
            fecha_inicio_atencion: sesData.estadoAsist === 'Realizada' ? new Date(sesData.fecha) : null,
            fecha_cierre_sesion: sesData.estadoCierre === 'Cerrada' ? new Date(new Date(sesData.fecha).getTime() + 45 * 60000) : null,
            estado_programacion: sesData.estadoProg,
            estado_asistencial: sesData.estadoAsist,
            estado_cierre: sesData.estadoCierre,
            confirmacion_paciente: 'Confirmada',
            fecha_confirmacion: new Date(new Date(sesData.fecha).getTime() - 24 * 3600000)
          }
        });
        console.log(`      ✓ Sesión ${sesData.num} creada (id: ${ses.id_sesion})`);
      }

      const countEv = await prisma.eventosSesion.count({ where: { id_sesion: ses.id_sesion } });
      if (countEv === 0) {
        await prisma.eventosSesion.create({
          data: {
            id_sesion: ses.id_sesion,
            tipo_cambio: 'CONFIRMACION_ASISTENCIA',
            fecha_anterior: new Date(sesData.fecha),
            fecha_nueva: new Date(sesData.fecha),
            estado_anterior: 'Pendiente',
            estado_nuevo: 'Confirmada',
            motivo: 'Confirmación realizada por el paciente a través de mensajería automatizada',
          }
        });
      }

      if (sesData.estadoAsist === 'Realizada' && sesData.proc) {
        let aten = await prisma.atenciones.findFirst({
          where: { id_tratamiento: trat.id_tratamiento, id_sesion: ses.id_sesion }
        });

        if (!aten) {
          aten = await prisma.atenciones.create({
            data: {
              id_persona: c.idPersona,
              id_reserva: c.idReserva,
              id_servicio: c.idServicio,
              id_profesional: c.idProfesional,
              id_sede: c.idSede,
              fecha_atencion: new Date(sesData.fecha),
              fecha_inicio: new Date(sesData.fecha),
              fecha_fin: new Date(new Date(sesData.fecha).getTime() + 45 * 60000),
              asistencia: 'Asistió',
              estado_servicio: 'Finalizado',
              motivo_consulta: c.planObj,
              antecedentes: 'Paciente refiere buen estado de salud general',
              alergias: 'Sin alergias medicamentosas conocidas',
              evaluacion: sesData.diag || 'Evolución clínica favorable',
              diagnostico_basico: sesData.diag || 'Diagnóstico conforme a plan',
              procedimiento: sesData.proc,
              procedimiento_realizado: sesData.proc.slice(0, 190),
              observaciones: 'Procedimiento ejecutado sin incidentes, asepsia y hemostasia preservada',
              resultado: 'Atención concluida con éxito de acuerdo con los estándares clínicos',
              indicaciones_finales: sesData.indicaciones || 'Seguir indicaciones de higiene',
              id_tratamiento: trat.id_tratamiento,
              id_sesion: ses.id_sesion,
              estado_cierre_documental: 'Cerrada',
              id_profesional_validador_cierre: c.idProfesional,
              fecha_validacion_cierre: new Date(new Date(sesData.fecha).getTime() + 50 * 60000)
            }
          });
          console.log(`        ✓ Atención creada para Sesión ${sesData.num} (id: ${aten.id_atencion})`);
        }

        const countProc = await prisma.detalleProcedimiento.count({ where: { id_atencion: aten.id_atencion } });
        if (countProc === 0 && sesData.detalles) {
          for (const det of sesData.detalles) {
            await prisma.detalleProcedimiento.create({
              data: {
                id_atencion: aten.id_atencion,
                id_servicio: c.idServicio,
                procedimiento_realizado: det.slice(0, 195),
                id_profesional: c.idProfesional,
                implica_cargo_adicional: false,
                observaciones: 'Ejecutado bajo aislamiento y técnica estandarizada',
                fecha_registro: new Date(sesData.fecha)
              }
            });
          }
          console.log(`        ✓ DetalleProcedimiento agregado (${sesData.detalles.length} filas)`);
        }

        const countVal = await prisma.validacionesFicha.count({ where: { id_atencion: aten.id_atencion } });
        if (countVal === 0) {
          await prisma.validacionesFicha.create({
            data: {
              id_atencion: aten.id_atencion,
              numero_revision: 1,
              resultado_validacion: 'Completa',
              campos_pendientes: null,
              id_profesional_validador: c.idProfesional,
              huella_documental: sha256(`ATEN-${aten.id_atencion}-REV1-PROF-${c.idProfesional}`),
              fecha_revision: new Date(new Date(sesData.fecha).getTime() + 50 * 60000)
            }
          });
          console.log(`        ✓ Validación de ficha formal registrada`);
        }

        const countInd = await prisma.indicacionesPostatencion.count({ where: { id_atencion: aten.id_atencion } });
        if (countInd === 0 && sesData.indicaciones) {
          await prisma.indicacionesPostatencion.create({
            data: {
              id_atencion: aten.id_atencion,
              version: 1,
              es_version_vigente: true,
              estado: 'Documento emitido',
              contenido_indicaciones: sesData.indicaciones,
              origen_documento: 'PROFESIONAL',
              id_profesional_aprobador: c.idProfesional,
              fecha_aprobacion: new Date(new Date(sesData.fecha).getTime() + 50 * 60000),
              fecha_emision: new Date(new Date(sesData.fecha).getTime() + 50 * 60000),
              fecha_creacion: new Date(new Date(sesData.fecha).getTime() + 45 * 60000)
            }
          });
          console.log(`        ✓ Indicaciones postatención emitidas`);
        }
      }
    }
  }

  // 5. Agregar solicitudes de reprogramación con clave de idempotencia única
  const countReprog = await prisma.solicitudesReprogramacionCustomer.count();
  if (countReprog < 3) {
    const sesionReprog = await prisma.sesionesTratamiento.findFirst({
      where: { numero_sesion: 2, estado_programacion: 'Programada' },
      include: { TratamientosContratados: true }
    });
    if (sesionReprog) {
      await prisma.solicitudesReprogramacionCustomer.create({
        data: {
          id_sesion: sesionReprog.id_sesion,
          id_tratamiento: sesionReprog.id_tratamiento,
          id_persona: sesionReprog.TratamientosContratados.id_persona,
          fecha_programada_original: sesionReprog.fecha_programada_vigente,
          fecha_preferida: new Date(sesionReprog.fecha_programada_vigente.getTime() + 48 * 3600000),
          motivo_solicitud: 'Cruce con horario laboral imprevisto. Solicita reprogramar a fin de semana.',
          estado_solicitud: 'Aprobada',
          clave_idempotencia: `REPROG-${sesionReprog.id_sesion}-${Date.now()}`,
          id_usuario_responsable: 1,
          fecha_revision: new Date(),
          motivo_resolucion: 'Horario validado y cupo disponible con el mismo especialista.'
        }
      });
      console.log('  ✓ Solicitud de reprogramación registrada con trazabilidad');
    }
  }

  console.log('✨ Población de datos OLTP finalizada con éxito.');
}

main()
  .catch((e) => {
    console.error('Error poblando base OLTP:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
