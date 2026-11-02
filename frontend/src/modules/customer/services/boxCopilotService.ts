/**
 * Agente Copiloto de Box (IA Clinical Engine) - Fase CUSTOMER
 * Implementación de las 6 actividades oficiales:
 * 1. Admisión y verificación de llegada (Alerta ALT-C4)
 * 2. Inicio del acto clínico y triaje preventivo (Cruce de salud y dolor)
 * 3. Ejecución y registro del procedimiento (Plantillas clínicas estructuradas)
 * 4. Monitoreo de tiempo en sillón dental (Alerta ALT-C2 de sobretiempo >15%)
 * 5. Prescripción de indicaciones postoperatorias (Human-in-the-loop / WhatsApp)
 * 6. Auditoría de integridad y finalización (Alerta ALT-C3 y KPI C4)
 */

export interface ClinicalTemplate {
  key: string;
  name: string;
  badge: string;
  serviceCategory: string;
  standardDuration: number; // Minutos estándar
  reasonForConsultation: string;
  evaluation: string;
  procedure: string;
  instructions: string;
}

export const CLINICAL_TEMPLATES: Record<string, ClinicalTemplate> = {
  PROFILAXIS: {
    key: 'PROFILAXIS',
    name: 'Profilaxis & Destartraje Ultrasónico',
    badge: 'Higiene & Prevención',
    serviceCategory: 'Periodoncia Básica',
    standardDuration: 35,
    reasonForConsultation: 'Control periódico e higiene dental preventiva.',
    evaluation: 'Presencia de cálculo supragingival y pigmentaciones extrínsecas en sector anteroinferior. Tejido gingival con ligera inflamación marginal.',
    procedure: 'Destartraje supragingival con ultrasonido piezoeléctrico. Pulido coronario con escobilla profiláctica y pasta de óxido de aluminio de grano fino. Aplicación tópica de flúor barniz 5% en caras oclusales y libres.',
    instructions: '1. No ingerir alimentos sólidos ni bebidas calientes o ácidas durante las próximas 2 horas.\n2. Mantener técnica de cepillado suave de Bass y uso diario de hilo dental.\n3. Evitar enjuagues con alcohol por 24 horas.\n4. Se programa próximo control preventivo en 6 meses.',
  },
  CURACION: {
    key: 'CURACION',
    name: 'Restauración Estética con Resina',
    badge: 'Operatoria Dental',
    serviceCategory: 'Restaurativa',
    standardDuration: 45,
    reasonForConsultation: 'Sensibilidad térmica leve y presencia de lesión cariosa visible.',
    evaluation: 'Caries de esmalte y dentina superficial (Clase I / Oclusal) sin compromiso pulpar ni dolor espontáneo.',
    procedure: 'Aislamiento absoluto con dique de goma y clamp. Remoción mecánica de tejido cariado. Grabado ácido selectivo por 15 segundos y lavado profuso. Aplicación de adhesivo universal y fotopolimerización por 20 seg. Restauración anatómica estratificada con resina compuesta nanohíbrida. Control de oclusión con papel articular y pulido con discos abrasivos.',
    instructions: '1. No masticar alimentos de consistencia dura o pegajosa por las próximas 24 horas sobre la zona tratada.\n2. Si siente la mordida alta o molestia al ocluir, contactar a la clínica para un ajuste oclusal rápido.\n3. Tomar Paracetamol 500mg cada 8 horas condicional a dolor leve si fuera necesario.\n4. Mantener cepillado habitual.',
  },
  ENDODONCIA: {
    key: 'ENDODONCIA',
    name: 'Tratamiento de Conductos / Endodoncia',
    badge: 'Endodoncia Especializada',
    serviceCategory: 'Terapia Pulpar',
    standardDuration: 60,
    reasonForConsultation: 'Dolor agudo punzante e irradiado al frío y calor.',
    evaluation: 'Diagnóstico clínico de pulpitis irreversible sintomática. Cámara pulpar comprometida con respuesta dolorosa prolongada.',
    procedure: 'Anestesia infiltrativa local al 2% con epinefrina 1:100000. Aislamiento absoluto. Apertura cameral y localización de conductos radiculares. Instrumentación biomecánica rotatoria. Irrigación continua con Hipoclorito de Sodio 2.5% y activación sónica. Medicación intraconducto y obturación temporal hermética con ionómero de vidrio.',
    instructions: '1. No masticar del lado intervenido mientras tenga la curación temporal.\n2. Tomar Ibuprofeno 400mg cada 8h por 3 días para control de la inflamación periapical.\n3. Asistir puntualmente a la cita programada para la reconstrucción/corona definitiva.\n4. En caso de dolor severo o inflamación facial, acudir inmediatamente a urgencias clínicas.',
  },
  BLANQUEAMIENTO: {
    key: 'BLANQUEAMIENTO',
    name: 'Blanqueamiento Dental Clínico LED',
    badge: 'Estética Dental',
    serviceCategory: 'Cosmética',
    standardDuration: 50,
    reasonForConsultation: 'Aclaramiento y mejora estética del tono dental.',
    evaluation: 'Discromía dental exógena generalizada. Esmalte íntegro sin caries activas ni hipoplasias severas. Tono inicial registrado en escala Vita.',
    procedure: 'Profilaxis previa para remoción de biofilme. Aislamiento y protección gingival con barrera fotocurable. Aplicación controlada de gel de Peróxido de Hidrógeno al 35% en 3 ciclos de 15 minutos con fotoactivación LED. Enjuague abundante y colocación de gel desensibilizante con nitrato de potasio.',
    instructions: '1. Dieta blanca estricta durante 48 horas (evitar café, té, gaseosas oscuras, vino, salsas rojas y tabaco).\n2. Utilizar pasta dental desensibilizante por 1 semana.\n3. Evitar bebidas extremadamente frías o calientes en las próximas 24 horas.\n4. Control de estabilidad de color en 15 días.',
  },
  EVALUACION: {
    key: 'EVALUACION',
    name: 'Evaluación Clínica Odontológica Integral',
    badge: 'Diagnóstico & Plan',
    serviceCategory: 'Diagnóstico',
    standardDuration: 30,
    reasonForConsultation: 'Evaluación general del estado de salud bucodental.',
    evaluation: 'Examen clínico estomatológico completo de tejidos blandos y duros. Registro de odontograma basal. Exploración de oclusión y articulación temporomandibular.',
    procedure: 'Inspección visual intraoral y extraoral. Sondaje periodontal de despistaje. Asesoría en higiene oral y presentación explicativa del plan de tratamiento prioritario.',
    instructions: '1. Seguir el cronograma de citas del plan de tratamiento acordado.\n2. Mantener técnica de cepillado 3 veces al día.\n3. Realizar control odontológico semestral.',
  },
};

export interface BoxCopilotAnalysis {
  triage: {
    level: 'BAJO' | 'MODERADO' | 'ALTO' | 'CRITICO';
    badgeColor: string;
    alerts: string[];
    recommendations: string[];
    isSafeForAnesthesia: boolean;
  };
  timeMonitoring: {
    standardDurationMinutes: number;
    elapsedMinutes: number;
    isOvertime: boolean;
    overtimePercent: number;
    statusText: string;
    alertAltC2?: string; // Alerta ALT-C2 de sobretiempo >15%
  };
  attendanceAlert?: {
    code: 'ALT-C4';
    message: string;
    actionSuggested: string;
  };
  qualityChecklist: {
    hasReason: boolean;
    hasEvaluation: boolean;
    hasProcedure: boolean;
    hasInstructions: boolean;
    isComplete: boolean;
    missingCount: number;
    alertAltC3?: string; // Alerta ALT-C3 si faltan campos obligatorios
  };
}

export class BoxCopilotService {
  /**
   * Ejecuta el análisis clínico integral del Agente Copiloto de Box
   */
  public static analyzeCustomerContext(params: {
    state: string;
    serviceName?: string;
    standardDurationMinutes?: number;
    startTime?: string;
    scheduledTime?: string;
    scheduledDate?: string;
    saludOdontologica?: any;
    currentFormData: {
      reasonForConsultation?: string;
      evaluation?: string;
      procedure?: string;
      instructions?: string;
    };
  }): BoxCopilotAnalysis {
    const salud = params.saludOdontologica || {};
    const dolor = (salud.nivelDolor || '').toLowerCase();
    const alergias = (salud.condicionEspecial || '').toLowerCase();
    const protesis = (salud.protesis || '').toLowerCase();
    const sangrado = (salud.sangradoOInflamacion || '').toLowerCase();

    // ── 1. Triaje Preventivo y Cruce de Alergias/Dolor (Actividad 2) ────────
    const alerts: string[] = [];
    const recommendations: string[] = [];
    let level: 'BAJO' | 'MODERADO' | 'ALTO' | 'CRITICO' = 'BAJO';

    if (dolor.includes('intenso') || dolor.includes('severo') || dolor.includes('agudo') || dolor.includes('alto')) {
      level = 'ALTO';
      alerts.push('Dolor Agudo / Severo reportado por el paciente');
      recommendations.push('Priorizar anestesia profunda y manejo suave de tejidos con prueba de sensibilidad antes de instrumentar.');
    } else if (dolor.includes('moderado')) {
      if (level === 'BAJO') level = 'MODERADO';
      alerts.push('Dolor Moderado al masticar o térmico');
      recommendations.push('Verificar vitalidad pulpar y evaluar necesidad de anestesia local infiltrativa.');
    }

    if (alergias.includes('penicil') || alergias.includes('anest') || alergias.includes('latex') || alergias.includes('medicam')) {
      level = 'CRITICO';
      alerts.push(`Alerta Médica: ${salud.condicionEspecial}`);
      recommendations.push('Evitar fármacos o anestésicos con contraindicación cruzada. Verificar historia médica.');
    } else if (alergias && alergias !== 'ninguna' && alergias !== 'ninguno' && alergias !== '') {
      if (level === 'BAJO') level = 'MODERADO';
      alerts.push(`Condición Especial: ${salud.condicionEspecial}`);
      recommendations.push('Monitorear signos vitales y confort del paciente durante el procedimiento.');
    }

    if (protesis.includes('ortodoncia') || protesis.includes('prótesis') || protesis.includes('protesis')) {
      alerts.push(`Usa aparatología: ${salud.protesis}`);
      recommendations.push('Cuidado al utilizar ultrasonido o instrumental rotatorio en zonas adyacentes a brackets/prótesis.');
    }

    if (sangrado.includes('sangrado') || sangrado.includes('inflamación') || sangrado.includes('ambos')) {
      alerts.push('Presencia de sangrado o inflamación gingival activa');
      recommendations.push('Realizar hemostasia cuidadosa y evaluar protocolo de enjuague antiséptico con Clorhexidina 0.12%.');
    }

    if (alerts.length === 0) {
      alerts.push('Sin antecedentes médicos de riesgo crítico');
      recommendations.push('Paciente apto para tratamiento de rutina según protocolo estándar.');
    }

    const badgeColor = 
      level === 'CRITICO' ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-800'
      : level === 'ALTO' ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-800'
      : level === 'MODERADO' ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/80 dark:text-blue-200 dark:border-blue-800'
      : 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-800';

    // ── 2. Monitoreo de Tiempo en Sillón Dental (Actividad 4 & Alerta ALT-C2) ─
    const standardDuration = params.standardDurationMinutes || 45;
    let elapsedMinutes = 0;
    let isOvertime = false;
    let overtimePercent = 0;
    let statusText = 'En espera de inicio en sillón';
    let alertAltC2: string | undefined = undefined;

    if (params.startTime && params.state === 'IN_ATTENTION') {
      try {
        const start = new Date(params.startTime);
        if (!isNaN(start.getTime())) {
          elapsedMinutes = Math.max(0, Math.floor((Date.now() - start.getTime()) / 60000));
          overtimePercent = Math.round(((elapsedMinutes - standardDuration) / standardDuration) * 100);

          if (elapsedMinutes > standardDuration * 1.15) {
            isOvertime = true;
            statusText = `Sobretiempo de ${elapsedMinutes - standardDuration} min (+${overtimePercent}%)`;
            alertAltC2 = `🚨 ALERTA ALT-C2: Sobretiempo en sillón (${elapsedMinutes} min transcurridos vs ${standardDuration} min estándar). Se recomienda aviso a recepción para modular la sala de espera.`;
          } else {
            statusText = `${elapsedMinutes} min en sillón (de ${standardDuration} min estimados)`;
          }
        }
      } catch (_) {}
    } else if (params.state === 'ATTENDED') {
      statusText = 'Atención finalizada conforme';
    }

    // ── 3. Alerta de Tolerancia de Asistencia (Actividad 1 & Alerta ALT-C4) ───
    let attendanceAlert: BoxCopilotAnalysis['attendanceAlert'] = undefined;
    if (params.state === 'SCHEDULED' && params.scheduledTime) {
      try {
        const now = new Date();
        const timeParts = params.scheduledTime.split(':');
        if (timeParts.length >= 2) {
          let apptTime = new Date();
          if (params.scheduledDate) {
            const cleanDate = params.scheduledDate.split('T')[0];
            const [year, month, day] = cleanDate.split('-').map(Number);
            if (year && month && day) {
              apptTime = new Date(year, month - 1, day, Number(timeParts[0]), Number(timeParts[1]), 0, 0);
            } else {
              apptTime.setHours(Number(timeParts[0]), Number(timeParts[1]), 0, 0);
            }
          } else {
            apptTime.setHours(Number(timeParts[0]), Number(timeParts[1]), 0, 0);
          }

          const minutesPassed = Math.floor((now.getTime() - apptTime.getTime()) / 60000);
          
          // Solo alertar si la fecha/hora de la cita ya ocurrió y han transcurrido más de 20 minutos de tolerancia
          if (minutesPassed > 20) {
            attendanceAlert = {
              code: 'ALT-C4',
              message: `Tolerancia de 20 minutos superada (${minutesPassed} min transcurridos desde la hora programada).`,
              actionSuggested: 'Sugerido contactar al paciente o registrar inasistencia (No-Show) para liberar el sillón dental.',
            };
          }
        }
      } catch (_) {}
    }

    // ── 4. Auditoría de Integridad y Checklist de Calidad (Actividad 6) ─────
    const hasReason = Boolean(params.currentFormData.reasonForConsultation && params.currentFormData.reasonForConsultation.trim().length >= 3);
    const hasEvaluation = Boolean(params.currentFormData.evaluation && params.currentFormData.evaluation.trim().length >= 5);
    const hasProcedure = Boolean(params.currentFormData.procedure && params.currentFormData.procedure.trim().length >= 5);
    const hasInstructions = Boolean(params.currentFormData.instructions && params.currentFormData.instructions.trim().length >= 5);

    let missingCount = 0;
    if (!hasReason) missingCount++;
    if (!hasEvaluation) missingCount++;
    if (!hasProcedure) missingCount++;
    if (!hasInstructions) missingCount++;

    const isComplete = hasReason && hasEvaluation && hasProcedure && hasInstructions;
    let alertAltC3: string | undefined = undefined;

    if (!isComplete && params.state === 'IN_ATTENTION') {
      alertAltC3 = `⚠️ ALERTA ALT-C3: Ficha clínica incompleta (${4 - missingCount}/4 requisitos). Complete el diagnóstico, procedimiento e indicaciones para autorizar la transición a TURNED.`;
    }

    return {
      triage: {
        level,
        badgeColor,
        alerts,
        recommendations,
        isSafeForAnesthesia: level !== 'CRITICO',
      },
      timeMonitoring: {
        standardDurationMinutes: standardDuration,
        elapsedMinutes,
        isOvertime,
        overtimePercent,
        statusText,
        alertAltC2,
      },
      attendanceAlert,
      qualityChecklist: {
        hasReason,
        hasEvaluation,
        hasProcedure,
        hasInstructions,
        isComplete,
        missingCount,
        alertAltC3,
      },
    };
  }

  /**
   * Genera el formato de indicaciones médicas listo para copiar y enviar por WhatsApp (Actividad 5)
   */
  public static generateWhatsAppPostopText(patientName: string, serviceName: string, instructions: string): string {
    return `*🏥 NexoSalud Dental - Indicaciones Postoperatorias*\n\n` +
      `¡Hola *${patientName}*! 👋\n` +
      `Esperamos que te encuentres muy bien tras tu atención de *${serviceName}*.\n\n` +
      `📋 *Recomendaciones del Odontólogo:*\n` +
      `${instructions}\n\n` +
      `💬 _Si presentas alguna duda o molestia inusual, escríbenos directamente por este medio. ¡Tu sonrisa es nuestra prioridad!_`;
  }
}
