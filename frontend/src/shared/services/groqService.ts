const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODELS = ['groq/compound-mini', 'qwen/qwen3.8-27b', 'openai/gpt-oss-120b'];

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PayerContext {
  patientName: string;
  phone?: string;
  email?: string;
  state: string;
  amountToPay: number;
  serviceName?: string;
  reservationDate?: string;
  reservationTime?: string;
  branch?: string;
  professional?: string;
  channel?: string;
  operationNumber?: string;
  declaredAmount?: number;
  hasReceipt: boolean;
  incidentsCount: number;
  lastIncidentReason?: string;
}

export interface AiCollectionStrategy {
  id: 'FRIENDLY' | 'URGENCY' | 'RESCUE_50';
  title: string;
  badge: string;
  description: string;
  whatsappMessage: string;
  emailSubject: string;
  emailBody: string;
}

export interface RiskAnalysis {
  score: number; // 0 to 100
  level: 'BAJO' | 'MODERADO' | 'ALTO';
  color: 'emerald' | 'amber' | 'rose';
  explanation: string;
  factors: string[];
}

export interface AiCollectionResult {
  risk: RiskAnalysis;
  internalRecommendation: string;
  selectedStrategyId: 'FRIENDLY' | 'URGENCY' | 'RESCUE_50';
  strategies: {
    friendly: AiCollectionStrategy;
    urgency: AiCollectionStrategy;
    rescue: AiCollectionStrategy;
  };
  // Retrocompatibilidad
  whatsappMessage: string;
  emailSubject: string;
  emailBody: string;
}

const STATE_LABELS: Record<string, string> = {
  PENDING: 'Pendiente de pago (No ha registrado abono)',
  IN_REVIEW: 'Comprobante enviado (En revisión administrativa)',
  VALIDADO: 'Pago validado y aprobado',
  VALIDATED: 'Pago validado y aprobado',
  REJECTED: 'Pago rechazado por inconsistencia',
  REVERTED: 'Pago revertido manualmente',
};

// Disponibilidad.fecha es un día de calendario. Su límite de pago es la
// medianoche de ese día en Perú, no la medianoche del navegador ni de UTC.
export function appointmentMidnightInLima(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) return null;
  return new Date(Date.UTC(year, month - 1, day, 5)); // 00:00 en Perú (UTC-5)
}

/**
 * Motor Heurístico de Scoring de Riesgo de Impago (Business Intelligence)
 * Política de Cierre: 00:00 hrs del día de la cita (Cancelación y Liberación)
 */
export function calculatePayerRisk(ctx: PayerContext): RiskAnalysis {
  let score = 20; // Base risk
  const factors: string[] = [];

  if (ctx.state === 'VALIDADO' || ctx.state === 'VALIDATED') {
    return {
      score: 0,
      level: 'BAJO',
      color: 'emerald',
      explanation: 'El pago ya fue completado y conciliado exitosamente.',
      factors: ['Pago 100% aprobado y validado'],
    };
  }

  // Factor 0: Citas vencidas a las 00:00 hrs de Perú del día de la cita
  if (ctx.reservationDate) {
    const appointmentDayStart = appointmentMidnightInLima(ctx.reservationDate);
    if (appointmentDayStart) {
      const now = new Date();
      const hoursUntilMidnight = (appointmentDayStart.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Si ya son las 00:00 hrs del día de la cita o ya pasó la fecha
      if (now >= appointmentDayStart || (ctx.state === 'REJECTED' && ctx.lastIncidentReason?.includes('AUTO_CANCELACION'))) {
        return {
          score: 0,
          level: 'BAJO',
          color: 'emerald',
          explanation: 'Cita vencida y cancelada automáticamente por el cron job al llegar a las 00:00 hrs. El sillón fue liberado.',
          factors: [
            'Plazo límite superado (00:00 hrs del día de la cita)',
            'Sillón clínico liberado automáticamente en sistema',
            'Sin deuda activa por cobrar'
          ],
        };
      }

      // Factor de Tiempo hasta la medianoche límite
      if (hoursUntilMidnight <= 24 && hoursUntilMidnight > 0) {
        score += 30;
        factors.push('Cita de mañana: plazo límite de abono vence hoy a las 23:59 (urgencia crítica)');
      } else if (hoursUntilMidnight <= 48 && hoursUntilMidnight > 24) {
        score += 15;
        factors.push('Cita programada en 2 días (etapa preventiva)');
      }
    }
  }

  // Factor 1: Incidencias previas o rechazos
  if (ctx.incidentsCount > 0) {
    score += 35;
    factors.push(`${ctx.incidentsCount} incidencia(s) previa(s) de pago rechazada(s)`);
  }

  // Factor 2: Estado del pago
  if (ctx.state === 'REJECTED') {
    score += 25;
    factors.push('Comprobante rechazado pendiente de subsanar');
  } else if (ctx.state === 'PENDING') {
    score += 15;
    factors.push('Sin registro de comprobante preliminar');
  } else if (ctx.state === 'IN_REVIEW') {
    score -= 10;
    factors.push('Comprobante ya enviado por el paciente');
  }

  // Factor 3: Monto del tratamiento (tickets altos tienen mayor riesgo de desistimiento)
  if (ctx.amountToPay >= 300) {
    score += 20;
    factors.push(`Ticket alto (S/ ${ctx.amountToPay.toFixed(2)}) con mayor elasticidad`);
  } else if (ctx.amountToPay >= 150) {
    score += 10;
    factors.push(`Ticket intermedio (S/ ${ctx.amountToPay.toFixed(2)})`);
  }

  // Normalizar score entre 5 y 98
  score = Math.max(5, Math.min(98, score));

  let level: 'BAJO' | 'MODERADO' | 'ALTO' = 'BAJO';
  let color: 'emerald' | 'amber' | 'rose' = 'emerald';
  let explanation = 'Baja probabilidad de inasistencia. Requiere confirmación de rutina.';

  if (score >= 65) {
    level = 'ALTO';
    color = 'rose';
    explanation = 'Alta probabilidad de inasistencia o fuga. Se recomienda activar estrategia de urgencia o seña fraccionada.';
  } else if (score >= 35) {
    level = 'MODERADO';
    color = 'amber';
    explanation = 'Riesgo moderado. Requiere recordatorio persuasivo antes de liberar el sillón odontológico a las 00:00.';
  }

  return {
    score,
    level,
    color,
    explanation,
    factors,
  };
}

/**
 * Generador de Estrategias Multicanal Heurísticas
 */
export function generateHeuristicStrategies(ctx: PayerContext, risk: RiskAnalysis): AiCollectionResult['strategies'] {
  const halfAmount = (ctx.amountToPay / 2).toFixed(2);
  const fullAmount = ctx.amountToPay.toFixed(2);
  const doctor = ctx.professional ? `Esp. ${ctx.professional.replace(/^(Dr\.|Dra\.|Dr\/a\.)\s*/i, '')}` : 'el especialista de turno';
  const service = ctx.serviceName || 'Atención Odontológica';
  const branch = ctx.branch || 'Sede Principal';
  const dateStr = ctx.reservationDate || 'la fecha acordada';
  const timeStr = ctx.reservationTime || 'la hora indicada';

  // 1. Friendly (Preventivo)
  const friendly: AiCollectionStrategy = {
    id: 'FRIENDLY',
    title: '1. Recordatorio Amigable (Preventivo)',
    badge: 'Tono Cordial',
    description: 'Ideal para pacientes en riesgo bajo/medio. Confirma detalles y ofrece medios de pago digitales.',
    whatsappMessage: `¡Hola ${ctx.patientName}! 👋 Te saludamos de la Clínica Odontológica NexoSalud.\n\nTe recordamos que tienes una cita programada de *${service}* con el *${doctor}* para el *${dateStr}* a las *${timeStr}* en nuestra *${branch}*.\n\nPuedes asegurar tu turno realizando tu abono de *S/ ${fullAmount}* mediante Yape, Plin o Transferencia bancaria.\n\n¿Deseas que te enviemos nuestro código QR de Yape? ¡Quedamos atentos para recibirte! 🦷✨`,
    emailSubject: `Recordatorio de Cita Odontológica y Pago - NexoSalud (${ctx.patientName})`,
    emailBody: `Estimado(a) ${ctx.patientName},\n\nEsperamos que se encuentre muy bien. Le saludamos cordialmente de la Clínica Odontológica NexoSalud.\n\nLe recordamos los detalles de su próxima atención odontológica:\n• Tratamiento: ${service}\n• Especialista: ${doctor}\n• Fecha y Hora: ${dateStr} - ${timeStr}\n• Sede: ${branch}\n• Monto por regularizar: S/ ${fullAmount}\n\nPuede realizar el abono a través de nuestros canales autorizados (Yape, Plin o Tarjeta) para garantizar la disponibilidad del sillón clínico.\n\nAtentamente,\nEquipo de Recaudación y Atención - NexoSalud`,
  };

  // 2. Urgency (Urgencia Clínica)
  const urgency: AiCollectionStrategy = {
    id: 'URGENCY',
    title: '2. Urgencia Clínica (Sillón Reservado)',
    badge: 'Escasez de Cupo',
    description: 'Enfatiza el bloqueo temporal del sillón clínico con el especialista antes de liberar el horario.',
    whatsappMessage: `Hola ${ctx.patientName} ⚠️ Te informamos que el sillón odontológico del *${doctor}* para tu cita de *${service}* (${dateStr} - ${timeStr}) se encuentra *reservado temporalmente*.\n\nPara evitar que el sistema libere automáticamente el cupo a otro paciente en lista de espera, por favor confirma tu abono de *S/ ${fullAmount}* antes de las 5:00 PM.\n\nPuedes abonar al instante por Yape o Tarjeta aquí. ¡Muchas gracias por tu comprensión! ⏱️`,
    emailSubject: `URGENTE: Confirmación Requerida para su Cita Odontológica - NexoSalud`,
    emailBody: `Estimado(a) ${ctx.patientName},\n\nLe informamos que su turno para el tratamiento de ${service} con el ${doctor} programado para el día ${dateStr} a las ${timeStr} en nuestra ${branch} se encuentra actualmente en estado de RESERVA TEMPORAL.\n\nCon el objetivo de garantizar la preparación de los materiales y no perjudicar la agenda quirúrgica/clínica, requerimos la validación de su abono de S/ ${fullAmount}.\n\nEn caso de no registrar el abono con anticipación, el sillón odontológico será puesto a disposición de otros pacientes en espera.\n\nAtentamente,\nAdministración Clínica - NexoSalud`,
  };

  // 3. Rescue (Seña Fraccionada 50%)
  const rescue: AiCollectionStrategy = {
    id: 'RESCUE_50',
    title: '3. Rescate con Facilidad (Seña 50%)',
    badge: 'Plan de Rescate',
    description: 'Reduce la fricción de pago ofreciendo congelar el cupo con solo el 50% de anticipo.',
    whatsappMessage: `Hola ${ctx.patientName} 👋 Queremos asegurarnos de que no pierdas tu atención de *${service}* con el *${doctor}*.\n\nPara brindarte mayor facilidad, puedes *congelar tu cupo hoy abonando únicamente el 50% (S/ ${halfAmount})* por Yape o Plin, y cancelas la diferencia el mismo día en clínica.\n\n¿Te gustaría que te facilitemos los datos bancarios para reservar tu turno ahora mismo? 🌟`,
    emailSubject: `Facilidad de Pago para su Cita de ${service} - NexoSalud`,
    emailBody: `Estimado(a) ${ctx.patientName},\n\nEn NexoSalud nos comprometemos con su salud dental. Entendemos que pueden presentarse imprevistos, por lo que queremos ofrecerle una alternativa flexible para mantener su cita de ${service} con el ${doctor}.\n\nPuede congelar formalmente su horario abonando hoy únicamente un anticipo del 50% (S/ ${halfAmount}), pudiendo cancelar el saldo restante el mismo día de su consulta en recepción.\n\nPor favor contáctenos a la brevedad si desea acogerse a esta modalidad.\n\nAtentamente,\nCoordinación de Pagos - NexoSalud`,
  };

  return { friendly, urgency, rescue };
}

function buildSystemPrompt(): string {
  return `Eres el Agente de Inteligencia de Negocios y Cobranzas de NexoSalud (Clínica Odontológica).
Tu objetivo es analizar la situación del paciente en etapa PAYER y generar:
1. Recomendación estratégica interna para el cajero/recepcionista.
2. 3 estrategias persuasivas personalizadas de cobranza:
   - FRIENDLY: Tono cordial y preventivo.
   - URGENCY: Tono de urgencia clínica (sillón reservado temporalmente con el especialista).
   - RESCUE_50: Tono con facilidad de seña al 50% para evitar la pérdida de la cita.

Reglas:
- Si el estado es VALIDATED, ¡el pago ya está aprobado! Felicita al paciente y confirma su cita con el Esp., NUNCA cobres.
- Siempre usa "Esp." para referirse al odontólogo/especialista.

Debes responder ÚNICAMENTE con un objeto JSON válido con la siguiente estructura:
{
  "internalRecommendation": "Análisis y recomendación concisa para el operador interno.",
  "strategies": {
    "friendly": {
      "whatsappMessage": "Mensaje para WhatsApp",
      "emailSubject": "Asunto de correo",
      "emailBody": "Cuerpo de correo"
    },
    "urgency": {
      "whatsappMessage": "Mensaje de urgencia para WhatsApp",
      "emailSubject": "Asunto de urgencia",
      "emailBody": "Cuerpo de urgencia"
    },
    "rescue": {
      "whatsappMessage": "Mensaje de rescate con 50% para WhatsApp",
      "emailSubject": "Asunto de rescate",
      "emailBody": "Cuerpo de rescate"
    }
  }
}`;
}

function buildUserPrompt(ctx: PayerContext, risk: RiskAnalysis): string {
  const stateLabel = STATE_LABELS[ctx.state] || ctx.state;
  const isValidated = ctx.state === 'VALIDADO' || ctx.state === 'VALIDATED';

  return `Analiza y genera comunicaciones para el siguiente paciente:
- Paciente: ${ctx.patientName}
- Teléfono: ${ctx.phone || 'No registrado'}
- Correo: ${ctx.email || 'No registrado'}
- Estado: ${stateLabel} ${isValidated ? '(PAGO APROBADO)' : ''}
- Monto Total: S/ ${ctx.amountToPay.toFixed(2)} (50% = S/ ${(ctx.amountToPay / 2).toFixed(2)})
- Servicio: ${ctx.serviceName || 'Tratamiento Dental'}
- Cita: ${ctx.reservationDate || 'Fecha próxima'} - ${ctx.reservationTime || 'Hora asignada'}
- Sede: ${ctx.branch || 'Sede Principal'}
- Especialista: Esp. ${ctx.professional?.replace(/^(Dr\.|Dra\.|Dr\/a\.)\s*/i, '') || 'de Turno'}
- Score de Riesgo Calculado: ${risk.score}% (${risk.level})
- Factores de Riesgo: ${risk.factors.join(', ') || 'Sin factores de riesgo'}

Genera el JSON con: internalRecommendation y el objeto strategies con friendly, urgency y rescue.`;
}

export async function callGroqAssistant(ctx: PayerContext): Promise<AiCollectionResult> {
  const risk = calculatePayerRisk(ctx);
  const fallbackStrategies = generateHeuristicStrategies(ctx, risk);
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  let defaultRecommendation = '';
  if (ctx.state === 'VALIDADO' || ctx.state === 'VALIDATED') {
    defaultRecommendation = `El pago de S/ ${ctx.amountToPay.toFixed(2)} fue validado exitosamente. Paciente listo para transferir a CUSTOMER.`;
  } else if (risk.score === 0) {
    defaultRecommendation = `La cita se encuentra cancelada por vencimiento del plazo límite (00:00 hrs). El sillón fue liberado en la agenda clínica. No aplica cobranza ni recordatorio de pago.`;
  } else {
    defaultRecommendation = `Paciente con ${risk.level.toLowerCase()} riesgo de fuga (${risk.score}%). Se sugiere activar la estrategia de ${risk.score >= 65 ? 'Rescate 50% o Urgencia' : 'Recordatorio Preventivo'}.`;
  }

  const fallbackResult: AiCollectionResult = {
    risk,
    internalRecommendation: defaultRecommendation,
    selectedStrategyId: risk.score >= 65 ? 'RESCUE_50' : (risk.score >= 40 ? 'URGENCY' : 'FRIENDLY'),
    strategies: fallbackStrategies,
    whatsappMessage: fallbackStrategies.friendly.whatsappMessage,
    emailSubject: fallbackStrategies.friendly.emailSubject,
    emailBody: fallbackStrategies.friendly.emailBody,
  };

  if (!apiKey || apiKey === 'tu_groq_api_key_aqui') {
    return fallbackResult;
  }

  const messages: GroqMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: buildUserPrompt(ctx, risk) },
  ];

  for (const model of GROQ_MODELS) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.4,
          max_tokens: 1000,
          stream: false,
        }),
      });

      if (!response.ok) continue;

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content;
      if (!rawContent) continue;

      const cleanJson = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (parsed.strategies?.friendly && parsed.strategies?.urgency) {
        return {
          risk,
          internalRecommendation: parsed.internalRecommendation || defaultRecommendation,
          selectedStrategyId: risk.score >= 65 ? 'RESCUE_50' : (risk.score >= 40 ? 'URGENCY' : 'FRIENDLY'),
          strategies: {
            friendly: {
              ...fallbackStrategies.friendly,
              whatsappMessage: parsed.strategies.friendly.whatsappMessage || fallbackStrategies.friendly.whatsappMessage,
              emailSubject: parsed.strategies.friendly.emailSubject || fallbackStrategies.friendly.emailSubject,
              emailBody: parsed.strategies.friendly.emailBody || fallbackStrategies.friendly.emailBody,
            },
            urgency: {
              ...fallbackStrategies.urgency,
              whatsappMessage: parsed.strategies.urgency.whatsappMessage || fallbackStrategies.urgency.whatsappMessage,
              emailSubject: parsed.strategies.urgency.emailSubject || fallbackStrategies.urgency.emailSubject,
              emailBody: parsed.strategies.urgency.emailBody || fallbackStrategies.urgency.emailBody,
            },
            rescue: {
              ...fallbackStrategies.rescue,
              whatsappMessage: parsed.strategies.rescue?.whatsappMessage || fallbackStrategies.rescue.whatsappMessage,
              emailSubject: parsed.strategies.rescue?.emailSubject || fallbackStrategies.rescue.emailSubject,
              emailBody: parsed.strategies.rescue?.emailBody || fallbackStrategies.rescue.emailBody,
            },
          },
          whatsappMessage: parsed.strategies.friendly.whatsappMessage || fallbackStrategies.friendly.whatsappMessage,
          emailSubject: parsed.strategies.friendly.emailSubject || fallbackStrategies.friendly.emailSubject,
          emailBody: parsed.strategies.friendly.emailBody || fallbackStrategies.friendly.emailBody,
        };
      }
    } catch {
      // Try next model or fallback
    }
  }

  return fallbackResult;
}

// ============================================================================
// AGENTE DE MARKETING (ETAPA BUYER) — 4 ACTIVIDADES CLAVE DE BUSINESS INTELLIGENCE
// ============================================================================

export interface BuyerMarketingContext {
  fullName: string;
  phone?: string;
  email?: string;
  serviceOfInterest?: string;
  preferredBranch?: string;
  preferredTimeSlot?: string;
  channel?: string;
  attractionSource?: string;
  concreteRequest?: string;
  contactAuthorization?: boolean;
  qualityStatus?: string;
  state?: string;
  isConverted?: boolean;
}

export interface BuyerMarketingAnalysis {
  dataQuality: {
    status: 'Valido' | 'Incompleto' | 'Duplicado';
    isValidPhone: boolean;
    hasConsent: boolean;
    explanation: string;
  };
  preferencesProfile: {
    service: string;
    branch: string;
    timeSlot: string;
    category: string;
  };
  attribution: {
    channel: string;
    source: string;
    campaign: string;
    insight: string;
  };
  intentEvaluation: {
    hasConcreteIntent: boolean;
    intentLevel: 'ALTA' | 'MEDIA' | 'AMBIGUA';
    intentReason: string;
    suggestedAction: 'CONVERT_TO_LEAD' | 'KEEP_IN_BUYER';
    marketingRecommendation: string;
    urgencyLevel?: 'CRÍTICA_DOLOR' | 'URGENCIA_MODERADA' | 'ELECTIVA_ESTÉTICA' | 'PREVENTIVA';
    ticketCategory?: 'TICKET_ALTO' | 'TICKET_MEDIO' | 'TICKET_ENTRADA';
    leadScore?: number;
    priceSensitivity?: 'BAJA' | 'MODERADA' | 'ALTA';
  };
}

export async function analyzeBuyerMarketingAgent(ctx: BuyerMarketingContext): Promise<BuyerMarketingAnalysis> {
  const cleanPhone = (ctx.phone || '').replace(/\D/g, '');
  const isValidPhone = cleanPhone.length === 9;
  const hasConsent = !!ctx.contactAuthorization;
  const isAlreadyConverted = ctx.isConverted || ctx.state === 'CONVERTED';
  
  // 1. Actividad 1: Validación y Calidad de Datos
  let qualityStatus: 'Valido' | 'Incompleto' | 'Duplicado' = 'Valido';
  let qualityDetails = 'Registro con teléfono móvil verificado y consentimiento de Ley N° 29733 registrado.';
  
  if (ctx.qualityStatus === 'Duplicado' || ctx.state === 'DUPLICATED') {
    qualityStatus = 'Duplicado';
    qualityDetails = 'Contacto ya registrado previamente en la base de datos clínica (posible duplicidad detectada).';
  } else if (!isValidPhone && !cleanPhone) {
    qualityStatus = 'Incompleto';
    qualityDetails = 'Falta número telefónico de 9 dígitos para contacto directo por WhatsApp.';
  } else if (!isValidPhone) {
    qualityStatus = 'Incompleto';
    qualityDetails = `El teléfono proporcionado (${cleanPhone.length} dígitos) no cumple el formato peruano de 9 dígitos.`;
  } else if (!ctx.fullName) {
    qualityStatus = 'Incompleto';
    qualityDetails = 'Faltan nombres o apellidos completos del prospecto.';
  } else if (!hasConsent) {
    qualityStatus = 'Incompleto';
    qualityDetails = 'Pendiente de registrar el consentimiento de Protección de Datos (Ley N° 29733).';
  }

  // 2. Actividad 2: Clasificación de Preferencias Clínicas
  const service = ctx.serviceOfInterest || 'Consulta Odontológica General';
  const branch = ctx.preferredBranch || 'Sede San Isidro (Principal)';
  const timeSlot = ctx.preferredTimeSlot || 'Franja Flexible';
  
  let category = 'Odontología General';
  const sLower = service.toLowerCase();
  if (sLower.includes('orto') || sLower.includes('bracket') || sLower.includes('alinead')) category = 'Ortodoncia & Alineadores';
  else if (sLower.includes('blanquea') || sLower.includes('diseño') || sLower.includes('estét') || sLower.includes('carilla')) category = 'Estética & Cosmética Dental';
  else if (sLower.includes('implante') || sLower.includes('cirug') || sLower.includes('extracc') || sLower.includes('tercer')) category = 'Implantología & Cirugía Oral';
  else if (sLower.includes('niño') || sLower.includes('pediat')) category = 'Odontopediatría';
  else if (sLower.includes('endo') || sLower.includes('conducto')) category = 'Endodoncia & Salvamento Dental';
  else if (sLower.includes('perio') || sLower.includes('encía') || sLower.includes('limpieza')) category = 'Periodoncia & Profilaxis';

  // 3. Actividad 3: Origen y Atribución de Captación
  const channel = ctx.channel || 'Portal Web';
  const source = ctx.attractionSource || 'Meta Ads (Instagram / FB)';
  const campaign = 'Campaña Dental NexoSalud 2026';
  const insight = `Prospecto captado a través de ${channel} atribuido a ${source}. Tráfico digital con trazabilidad comercial verificada.`;

  // 4. Actividad 4: Evaluación de Intención Comercial & Conversión a LEAD
  const effectiveRequest = (ctx.concreteRequest && ctx.concreteRequest.trim().length > 0)
    ? ctx.concreteRequest.trim()
    : (ctx.serviceOfInterest ? `Interés en evaluación para ${ctx.serviceOfInterest}` : '');
  const reqLower = effectiveRequest.toLowerCase();

  const cLower = channel.toLowerCase();
  const isHighFrictionChannel = cLower.includes('presencial') || cLower.includes('telef') || cLower.includes('llamada') || cLower.includes('sede') || cLower.includes('whatsapp');
  const commercialKeywords = ['precio', 'costo', 'cuanto', 'cuánto', 'cita', 'agendar', 'horario', 'disponib', 'doctor', 'especialista', 'sede', 'turno', 'cotiz', 'evalua', 'consulta', 'sábado', 'mañana', 'urgencia', 'dolor', 'muela', 'sensib', 'sangr', 'ortodoncia', 'implante', 'brackets'];
  const matchedKeywords = commercialKeywords.filter(k => reqLower.includes(k));

  let hasConcreteIntent = true;
  let intentLevel: 'ALTA' | 'MEDIA' | 'AMBIGUA' = 'ALTA';
  let intentReason = '';
  let suggestedAction: 'CONVERT_TO_LEAD' | 'KEEP_IN_BUYER' = 'CONVERT_TO_LEAD';
  let marketingRecommendation = '';

  if (isAlreadyConverted) {
    // Si ya está convertido a LEAD
    intentLevel = 'ALTA';
    hasConcreteIntent = true;
    intentReason = 'Prospecto validado y transferido exitosamente a etapa LEAD. Intención comercial confirmada para negociación clínica.';
    suggestedAction = 'CONVERT_TO_LEAD';
    marketingRecommendation = 'Dar seguimiento en Mesa de Negociación (módulo LEAD) y coordinar cita diagnóstica con el especialista.';
  } else if (isHighFrictionChannel) {
    // Canal presencial, telefónico o WhatsApp directo
    intentLevel = 'ALTA';
    hasConcreteIntent = true;
    intentReason = `Contacto directo por canal prioritario (${channel}). Paciente con alta disposición de atención y decisión rápida.`;
    suggestedAction = 'CONVERT_TO_LEAD';
    marketingRecommendation = 'Asignar asesor comercial o recepcionista de inmediato para atención prioritaria.';
  } else if (
    reqLower === 'info' ||
    reqLower === 'hola' ||
    reqLower === 'prueba' ||
    reqLower === 'test' ||
    reqLower === 'asdf' ||
    (!isValidPhone && !ctx.serviceOfInterest && reqLower.length < 5)
  ) {
    // Consulta verdaderamente ambigua
    intentLevel = 'AMBIGUA';
    hasConcreteIntent = false;
    intentReason = 'Consulta exploratoria inicial sin especificación de tratamiento ni disponibilidad horaria.';
    suggestedAction = 'KEEP_IN_BUYER';
    marketingRecommendation = 'Mantener en BUYER y enviar mensaje automático de WhatsApp con catálogo de servicios y preguntas orientadoras.';
  } else if (matchedKeywords.length >= 2 || reqLower.includes('cita') || reqLower.includes('agendar') || reqLower.includes('precio') || reqLower.includes('dolor') || reqLower.includes('urgencia')) {
    intentLevel = 'ALTA';
    hasConcreteIntent = true;
    intentReason = `Intención comercial explícita (${matchedKeywords.slice(0, 3).join(', ')}). Paciente con requerimiento claro de consulta o presupuesto.`;
    suggestedAction = 'CONVERT_TO_LEAD';
    marketingRecommendation = 'Prospecto calificado para LEAD. Contactar en menos de 15 min vía WhatsApp con propuesta de horario en sede.';
  } else if (ctx.preferredBranch && ctx.preferredTimeSlot && ctx.serviceOfInterest) {
    // El paciente seleccionó tratamiento, sede y horario concreto
    intentLevel = 'ALTA';
    hasConcreteIntent = true;
    intentReason = `Perfil completo con tratamiento (${service}), sede preferida (${branch}) y franja horaria definida. Alta probabilidad de agendamiento.`;
    suggestedAction = 'CONVERT_TO_LEAD';
    marketingRecommendation = 'Contactar para confirmar turno en la franja horaria solicitada.';
  } else {
    // Interés moderado / exploratorio (Canal Web o Redes con tratamiento definido)
    intentLevel = 'MEDIA';
    hasConcreteIntent = true;
    intentReason = `Interés en ${service} vía ${channel}. Solicita orientación clínica sin urgencia crítica declarada.`;
    suggestedAction = 'CONVERT_TO_LEAD';
    marketingRecommendation = 'Enviar catálogo del tratamiento y agendar llamada de orientación odontológica.';
  }

  // Si hay API Key de Groq y la consulta tiene texto descriptivo adicional, enriquecer el análisis
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (apiKey && apiKey !== 'tu_groq_api_key_aqui' && ctx.concreteRequest && ctx.concreteRequest.trim().length > 6 && !isAlreadyConverted) {
    try {
      const prompt = `Analiza la intención comercial del siguiente prospecto odontológico:
- Paciente: ${ctx.fullName}
- Servicio: ${service}
- Canal de Captación: ${channel}
- Motivo / Mensaje: "${ctx.concreteRequest}"

Criterios de Clasificación:
1. "ALTA": Paciente contacta por Sede Presencial o Llamada Telefónica, o tiene dolor/urgencia, o solicita precio y disponibilidad para agendar cita.
2. "MEDIA": Paciente interesado en la web/redes que hace consultas exploratorias de servicios sin urgencia inmediata declarada.
3. "AMBIGUA": Mensaje vago ("info", "hola"), datos incompletos o sin propósito clínico definido.

Responde ÚNICAMENTE un JSON con:
{
  "hasConcreteIntent": true/false,
  "intentLevel": "ALTA" | "MEDIA" | "AMBIGUA",
  "intentReason": "explicación concisa del nivel de intención en 1 línea",
  "suggestedAction": "CONVERT_TO_LEAD" | "KEEP_IN_BUYER",
  "marketingRecommendation": "acción comercial recomendada en 1 línea"
}`;

      const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: GROQ_MODELS[0],
          messages: [
            { role: 'system', content: 'Eres el Agente de Marketing de NexoSalud Dental. Evalúas con precisión la intención comercial de los BUYERS.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
          max_tokens: 300,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.replace(/```json/gi, '')?.replace(/```/g, '')?.trim();
        if (content) {
          const parsed = JSON.parse(content);
          if (parsed.intentLevel) {
            hasConcreteIntent = Boolean(parsed.hasConcreteIntent ?? hasConcreteIntent);
            intentLevel = parsed.intentLevel;
            intentReason = parsed.intentReason || intentReason;
            suggestedAction = parsed.suggestedAction || suggestedAction;
            marketingRecommendation = parsed.marketingRecommendation || marketingRecommendation;
          }
        }
      }
    } catch {
      // Usar resultado heurístico
    }
  }

  return {
    dataQuality: {
      status: qualityStatus,
      isValidPhone,
      hasConsent,
      explanation: qualityDetails
    },
    preferencesProfile: {
      service,
      branch,
      timeSlot,
      category
    },
    attribution: {
      channel,
      source,
      campaign,
      insight
    },
    intentEvaluation: {
      hasConcreteIntent,
      intentLevel,
      intentReason,
      suggestedAction,
      marketingRecommendation
    }
  };
}

// ── 5. Resolución de Identidad y Desduplicación con IA (Agente de Marketing) ─
export interface IdentityResolutionResult {
  isSamePerson: boolean;
  confidence: number;
  reason: string;
  isDifferentPerson: boolean;
}

export async function analyzeIdentityResolutionWithAI(params: {
  enteredFullName: string;
  registeredFullName: string;
}): Promise<IdentityResolutionResult> {
  const entered = params.enteredFullName.trim();
  const registered = params.registeredFullName.trim();

  // 1. Normalización básica
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const eNorm = norm(entered);
  const rNorm = norm(registered);

  if (eNorm === rNorm) {
    return { isSamePerson: true, confidence: 1.0, reason: 'Coincidencia exacta de nombres y apellidos.', isDifferentPerson: false };
  }

  // Tokens
  const eTokens = eNorm.split(/\s+/).filter(t => t.length > 2);
  const rTokens = rNorm.split(/\s+/).filter(t => t.length > 2);
  const matches = eTokens.filter(t => rTokens.some(r => r.includes(t) || t.includes(r)));
  const overlapRatio = matches.length / Math.max(eTokens.length, 1);

  // Consulta al modelo Groq
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (apiKey && apiKey !== 'tu_groq_api_key_aqui') {
    const prompt = `Actúa como el Agente Inteligente de Marketing Odontológico especializado en Calidad de Datos y Resolución de Identidad de Pacientes.
Compara estos dos nombres para determinar si corresponden a la misma persona (variación ortográfica, apodo, error tipográfico, omisión de segundo nombre o apellido) o si son personas claramente distintas (ej: familiar, hijo/padre, o titular diferente):

- Nombre ingresado ahora en el formulario web: "${entered}"
- Nombre previamente registrado en la clínica: "${registered}"

Responde ÚNICAMENTE en JSON válido con este formato:
{
  "isSamePerson": true o false,
  "confidence": número entre 0.0 y 1.0,
  "reason": "explicación concisa en una sola frase"
}`;

    for (const model of GROQ_MODELS) {
      try {
        const response = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: 'Eres un sistema de resolución de identidad de pacientes. Responde únicamente JSON.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 150,
            response_format: { type: 'json_object' }
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
          if (parsed && typeof parsed.isSamePerson === 'boolean') {
            return {
              isSamePerson: parsed.isSamePerson,
              confidence: Number(parsed.confidence) || (parsed.isSamePerson ? 0.95 : 0.1),
              reason: parsed.reason || (parsed.isSamePerson ? 'Variación del mismo paciente' : 'Personas distintas detectadas'),
              isDifferentPerson: !parsed.isSamePerson,
            };
          }
        }
      } catch {
        // intentar con el siguiente modelo
      }
    }
  }

  // Heurística de respaldo
  if (overlapRatio >= 0.5) {
    return {
      isSamePerson: true,
      confidence: 0.85,
      reason: 'Coincidencia de nombres y/o apellidos principales.',
      isDifferentPerson: false,
    };
  }

  return {
    isSamePerson: false,
    confidence: 0.9,
    reason: 'Nombres y apellidos visiblemente distintos (posible familiar o nuevo paciente).',
    isDifferentPerson: true,
  };
}

/**
 * Genera con IA (Groq) un título publicitario de ALTO IMPACTO y PERSUASIÓN de MÁXIMO 3 PALABRAS para el encabezado del Flyer de Canva
 * (ej: "TRANSFORMA TU SONRISA", "SONRISA PERFECTA HOY", "SONRÍE SIN LÍMITES")
 */
export async function generateFlyerTitleWithAI(serviceName: string, patientName?: string): Promise<string> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  if (apiKey && apiKey !== 'tu_groq_api_key_aqui') {
    const prompt = `Actúa como Director Creativo de Neuromarketing Odontológico de NexoSalud.
Crea un titular publicitario MAGNÉTICO, PERSUASIVO Y DE MÁXIMO IMPACTO de EXACTAMENTE 2 O 3 PALABRAS (NUNCA MÁS DE 3 PALABRAS) para la cabecera del flyer oficial de Canva.

Tratamiento promocionado: "${serviceName}".
Paciente: "${patientName || 'Paciente'}".

REGLAS DE ORO:
1. Longitud: EXACTAMENTE 2 O 3 PALABRAS. Jamás 1 palabra ni más de 3 palabras.
2. Tono: Seductor, inspirador, empoderador y de alta estética dental.
3. Vocabulario recomendado: Verbos de transformación y belleza ("TRANSFORMA", "SONRÍE", "LUCE", "RENUEVA", "RECUPERA", "PERFECTA", "RADIANTE", "CONFIANZA", "SEGURIDAD").
4. Ejemplos de ALTO IMPACTO:
   - "TRANSFORMA TU SONRISA"
   - "SONRISA PERFECTA HOY"
   - "SONRÍE SIN LÍMITES"
   - "LUCE TU SONRISA"
   - "TU MEJOR SONRISA"
   - "SONRÍE CON CONFIANZA"
   - "DIENTES RADIANTES HOY"
   - "RENUEVA TU SONRISA"
5. NUNCA uses términos clínicos aburridos, preposiciones raras o frases incompletas. Responde ÚNICAMENTE las 2 o 3 palabras en MAYÚSCULAS sin comillas ni puntos.`;

    // Intentar con el modelo más rápido con timeout estricto de 1.2s para no demorar la generación
    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODELS[0],
          messages: [
            { role: 'system', content: 'Eres un copywriter publicitario dental de élite. Responde únicamente un titular impactante en mayúsculas de 2 o 3 palabras.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.5,
          max_tokens: 20,
        }),
        signal: AbortSignal.timeout(1200),
      });

      if (response.ok) {
        const data = await response.json();
        let raw = data.choices?.[0]?.message?.content?.trim() || '';
        raw = raw.replace(/["'«».:;\n\r]/g, '').trim();
        const words = raw.split(/\s+/).filter(Boolean);
        if (words.length >= 2) {
          return words.slice(0, 3).join(' ').toUpperCase();
        }
      }
    } catch (_) {}
  }

  // Fallback heurístico de alta persuasión por servicio (máximo 3 palabras)
  const lower = (serviceName || '').toLowerCase();
  if (lower.includes('ortodoncia') || lower.includes('bracket')) {
    return 'TRANSFORMA TU SONRISA';
  }
  if (lower.includes('blanquea') || lower.includes('estétic')) {
    return 'SONRISA BLANCA RADIANTE';
  }
  if (lower.includes('limpieza') || lower.includes('profilaxis')) {
    return 'SONRISA RADIANTE HOY';
  }
  if (lower.includes('implante') || lower.includes('prótesis')) {
    return 'RECUPERA TU SONRISA';
  }
  if (lower.includes('endodoncia') || lower.includes('curación') || lower.includes('caries') || lower.includes('urgencia')) {
    return 'ALIVIA Y SONRÍE';
  }

  return 'SONRÍE CON CONFIANZA';
}

export interface NegotiatorChatContext {
  patientName: string;
  serviceName: string;
  originalPrice: number;
  offeredPrice: number;
  discountPct: number;
  doctor?: string;
  sede?: string;
  expirationDate?: string;
}

export async function chatWithNegotiatorAgent(
  userMessage: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  ctx: NegotiatorChatContext
): Promise<string> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  const systemPrompt = `Eres el Asistente NexoSalud, asesor virtual oficial de la Clínica NexoSalud Odontología Especializada.
Estás hablando directamente con el paciente ${ctx.patientName || 'estimado paciente'}.

CONTEXTO DE LA OFERTA EXCLUSIVA:
- Tratamiento: ${ctx.serviceName}
- Precio Normal: S/ ${ctx.originalPrice.toFixed(2)}
- Precio Exclusivo Promocional: S/ ${ctx.offeredPrice.toFixed(2)} (${ctx.discountPct}% de Descuento congelado)
- Especialista asignado: ${ctx.doctor || 'Equipo de Especialistas Colegiados'}
- Sede: ${ctx.sede || 'Nuestra sede principal'}
- Límite de vigencia: ${ctx.expirationDate || 'Cupos limitados por 48 horas'}

TU MISIÓN:
1. Responder con gran calidez humana, empatía médica y claridad a cualquier duda del paciente (dolor, anestesia, duración, formas de pago, garantías).
2. Transmitir total tranquilidad: recalcar que en NexoSalud usamos tecnología indolora y diagnóstico digital.
3. Recordar que para congelar su precio promocional de S/ ${ctx.offeredPrice.toFixed(2)} y reservar su turno solo debe completar el formulario que tiene en pantalla.
4. Si pregunta por formas de pago: confirmar que puede pagar en clínica el día de la cita (efectivo/tarjeta) o por Yape/Plin, y que la pre-reserva NO le cobra nada obligatorio por adelantado.
5. Si pide más rebaja: explicar amablemente que el ${ctx.discountPct}% es el descuento máximo institucional permitido y ya incluye beneficios extra.
6. Mantén tus respuestas claras y concisas (máximo 2 a 3 párrafos breves), con un tono cordial y emojis profesionales.`;

  if (apiKey && apiKey !== 'tu_groq_api_key_aqui') {
    for (const model of GROQ_MODELS) {
      try {
        const messages = [
          { role: 'system', content: systemPrompt },
          ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: userMessage },
        ];
        const response = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.7,
            max_tokens: 350,
          }),
        });
        if (response.ok) {
          const data = await response.json();
          const reply = data.choices?.[0]?.message?.content?.trim();
          if (reply) return reply;
        }
      } catch (_) {}
    }
  }

  // Fallback heurístico si no hay API key o si se agota la cuota
  const lower = userMessage.toLowerCase();
  if (lower.includes('duele') || lower.includes('dolor') || lower.includes('miedo') || lower.includes('molesta')) {
    return `¡Hola ${ctx.patientName}! Te entiendo perfectamente, pero puedes estar con total tranquilidad. En NexoSalud utilizamos técnicas modernas y anestesia de mínimo impacto para que no sientas molestias durante tu tratamiento de ${ctx.serviceName}. El ${ctx.doctor || 'especialista'} cuidará de ti en todo momento. ¿Te gustaría que aseguremos tu turno en el formulario de al lado?`;
  }
  if (lower.includes('pago') || lower.includes('tarjeta') || lower.includes('yape') || lower.includes('plin') || lower.includes('efectivo')) {
    return `¡Hola! Puedes pagar con total comodidad: aceptamos Efectivo el día de tu cita en la clínica, Yape, Plin y todas las tarjetas de crédito o débito sin comisión adicional. Para congelar tu promoción a S/ ${ctx.offeredPrice.toFixed(2)}, solo selecciona tu medio preferido en el formulario y dale a Confirmar Pre-Reserva.`;
  }
  if (lower.includes('descuento') || lower.includes('menos') || lower.includes('rebaja') || lower.includes('caro')) {
    return `Comprendo tu consulta, ${ctx.patientName}. La tarifa promocional de S/ ${ctx.offeredPrice.toFixed(2)} ya cuenta con un ${ctx.discountPct}% de descuento exclusivo aplicado (ahorras respecto a los S/ ${ctx.originalPrice.toFixed(2)} regulares). Es el beneficio máximo institucional aprobado. Te sugiero completar tu pre-reserva hoy para que no pierdas este precio congelado.`;
  }
  if (lower.includes('familiar') || lower.includes('hijo') || lower.includes('hija') || lower.includes('mama') || lower.includes('papa') || lower.includes('espos')) {
    return `¡Por supuesto! Puedes utilizar esta promoción para ti o para algún familiar. En el formulario tienes la opción de marcar "¿La cita es para un familiar?" e indicar su nombre para que preparemos su historia clínica con anticipación.`;
  }
  return `¡Hola ${ctx.patientName}! Con mucho gusto te asesoro. Tu propuesta para ${ctx.serviceName} a S/ ${ctx.offeredPrice.toFixed(2)} está reservada para ti en nuestra sede. Puedes asegurar tu turno llenando los datos del formulario aquí a la derecha y te esperamos con el ${ctx.doctor || 'especialista'}. ¿Tienes alguna otra duda o consulta?`;
}

// ── 7. Agente Negociador (Fase LEAD): Actividad - Recomendación Predictiva de Oferta ──
export interface LeadNegotiationStrategy {
  leadScore: number;
  scoreLevel: 'HOT' | 'WARM' | 'COLD';
  urgencyLevel: 'CRÍTICA_DOLOR' | 'URGENCIA_MODERADA' | 'ELECTIVA_ESTÉTICA' | 'PREVENTIVA';
  ticketCategory: 'TICKET_ALTO' | 'TICKET_MEDIO' | 'TICKET_ENTRADA';
  priceSensitivity: 'BAJA' | 'MODERADA' | 'ALTA';
  
  // Preferencias operativas y comerciales para la negociación
  preferredChannel: string;
  paymentPreference: string;
  decisionDriver: string;
  agendaFlexibility: string;
  crossSellingOpenness: string;
  primaryBarrier: string;

  // Parámetros comerciales para auto-completar la alternativa
  suggestedDiscountPct: number;
  suggestedOfferedPrice: number;
  originalPrice: number;
  suggestedVigencia: '24h' | '48h' | '72h' | '7d';
  suggestedSedeId?: string;
  suggestedSedeNombre?: string;
  suggestedFranjaTexto?: string;
  suggestedConditions: string;
  
  // Justificación analítica & Pitch persuasivo
  strategyReason: string;
  persuasiveSalesPitch: string;
}

export async function predictLeadNegotiationStrategy(params: {
  lead: any;
  catalogs: any;
}): Promise<LeadNegotiationStrategy> {
  const { lead, catalogs } = params;
  if (!lead) {
    return {
      leadScore: 65,
      scoreLevel: 'WARM',
      urgencyLevel: 'PREVENTIVA',
      ticketCategory: 'TICKET_MEDIO',
      priceSensitivity: 'MODERADA',
      preferredChannel: 'WhatsApp (Mensajería rápida)',
      paymentPreference: 'Pago al contado con descuento',
      decisionDriver: 'Calidad y precio justo',
      agendaFlexibility: 'Horario vespertino (Disponibilidad laboral condicionada)',
      crossSellingOpenness: 'Receptivo a profilaxis previa o radiografía de diagnóstico',
      primaryBarrier: 'Comparación de tarifas y tiempo de tratamiento',
      suggestedDiscountPct: 15,
      suggestedOfferedPrice: 150,
      originalPrice: 180,
      suggestedVigencia: '48h',
      suggestedConditions: 'Garantía clínica y cupo reservado por 48 horas.',
      strategyReason: 'Tarifa comercial estándar con descuento preventivo sugerido.',
      persuasiveSalesPitch: 'Hola, te saludamos de NexoSalud Dental. Tenemos una propuesta especial para tu atención odontológica.'
    };
  }

  const patientName = `${lead.nombres || lead.person?.firstName || ''} ${lead.apellidos || lead.person?.lastName || ''}`.trim() || 'estimado paciente';
  const firstName = lead.nombres || lead.person?.firstName || 'paciente';
  
  // Servicio y Solicitud
  const sol = lead.Solicitudes?.[0] || {};
  const reqServicio = sol.Servicio?.nombre || lead.serviceOfInterest || 'Consulta Odontológica General';
  const reqMotivo = (sol.motivo || lead.concreteRequest || '').toLowerCase();
  
  // Salud Odontológica
  const salud = lead.SaludOdontologica?.[0] || lead.saludOdontologica || {};
  const dolor = (salud.nivel_dolor || '').toLowerCase();
  const sangrado = Boolean(salud.sangrado_o_inflamacion && salud.sangrado_o_inflamacion !== 'No');
  const sensibilidad = Boolean(salud.presenta_sensibilidad && salud.presenta_sensibilidad !== 'No');
  
  // Precios del Catálogo
  const foundServicio = catalogs?.servicios?.find((s: any) =>
    s.id_servicio === sol.id_servicio ||
    (s.nombre && reqServicio && s.nombre.toLowerCase().includes(reqServicio.toLowerCase()))
  );
  const officialPrice = Number(foundServicio?.Tarifas?.[0]?.precio || 180);

  // 1. Detección de Urgencia Clínica
  const hasUrgentKeywords = reqMotivo.includes('dolor') || reqMotivo.includes('urgenc') || reqMotivo.includes('muela') || reqMotivo.includes('hinch') || reqMotivo.includes('emergenc') || reqMotivo.includes('infecc');
  const hasPain = dolor.includes('alto') || dolor.includes('severo') || dolor.includes('fuerte') || dolor.includes('moderado') || hasUrgentKeywords;

  let urgencyLevel: 'CRÍTICA_DOLOR' | 'URGENCIA_MODERADA' | 'ELECTIVA_ESTÉTICA' | 'PREVENTIVA' = 'PREVENTIVA';
  if (hasPain || dolor.includes('alto') || dolor.includes('severo')) {
    urgencyLevel = 'CRÍTICA_DOLOR';
  } else if (sangrado || sensibilidad || dolor.includes('leve')) {
    urgencyLevel = 'URGENCIA_MODERADA';
  } else if (reqServicio.toLowerCase().includes('blanquea') || reqServicio.toLowerCase().includes('estét') || reqServicio.toLowerCase().includes('diseño') || reqServicio.toLowerCase().includes('carilla')) {
    urgencyLevel = 'ELECTIVA_ESTÉTICA';
  }

  // 2. Clasificación de Ticket
  const sLower = reqServicio.toLowerCase();
  let ticketCategory: 'TICKET_ALTO' | 'TICKET_MEDIO' | 'TICKET_ENTRADA' = 'TICKET_ENTRADA';
  if (sLower.includes('implante') || sLower.includes('ortodoncia') || sLower.includes('bracket') || sLower.includes('alineador') || sLower.includes('rehabilit') || sLower.includes('prótesis') || sLower.includes('corona') || officialPrice >= 600) {
    ticketCategory = 'TICKET_ALTO';
  } else if (sLower.includes('blanquea') || sLower.includes('endodoncia') || sLower.includes('periodoncia') || officialPrice >= 200) {
    ticketCategory = 'TICKET_MEDIO';
  }

  // 3. Sensibilidad al Precio & Descuento Sugerido
  let priceSensitivity: 'BAJA' | 'MODERADA' | 'ALTA' = 'MODERADA';
  let suggestedDiscountPct = 15;
  let suggestedVigencia: '24h' | '48h' | '72h' | '7d' = '48h';
  let leadScore = 75;
  let scoreLevel: 'HOT' | 'WARM' | 'COLD' = 'WARM';
  let strategyReason = '';

  if (urgencyLevel === 'CRÍTICA_DOLOR') {
    // Paciente con dolor: Valora la inmediatez de alivio, NO el regateo
    priceSensitivity = 'BAJA';
    suggestedDiscountPct = 5; // Descuento de cortesía
    suggestedVigencia = '24h';
    leadScore = 95;
    scoreLevel = 'HOT';
    strategyReason = 'Prioridad de Emergencia Clínica. El paciente busca alivio inmediato hoy mismo; no requiere quemar margen comercial con descuentos altos. Asignar turno express.';
  } else if (ticketCategory === 'TICKET_ALTO') {
    // Ticket alto (Implantes / Ortodoncia): Decisión evaluada, valora cuotas y tecnología
    priceSensitivity = 'MODERADA';
    suggestedDiscountPct = 12;
    suggestedVigencia = '72h';
    leadScore = 84;
    scoreLevel = 'WARM';
    strategyReason = 'Procedimiento de alta inversión. Se sugiere evaluación 3D digital incluida y propuesta en cuotas para acelerar la toma de decisión sin comprometer rentabilidad.';
  } else if (urgencyLevel === 'ELECTIVA_ESTÉTICA') {
    // Estética (Blanqueamiento, Carillas): Decisión motivacional / sensible a ofertas
    priceSensitivity = 'MODERADA';
    suggestedDiscountPct = 18;
    suggestedVigencia = '48h';
    leadScore = 80;
    scoreLevel = 'WARM';
    strategyReason = 'Tratamiento estético electivo. Descuento promocional del 18% con vigencia de 48 horas como gatillo psicológico de escasez para cierre rápido.';
  } else {
    // Entrada / Preventivo (Limpieza, Curaciones)
    priceSensitivity = 'ALTA';
    suggestedDiscountPct = 20;
    suggestedVigencia = '48h';
    leadScore = 72;
    scoreLevel = 'WARM';
    strategyReason = 'Servicio de entrada. Descuento de captación del 20% para fidelizar al paciente y abrir oportunidad de tratamientos integrales posteriores.';
  }

  // Calcular precio con descuento
  const suggestedOfferedPrice = Math.round(officialPrice * (1 - suggestedDiscountPct / 100));

  // Sede sugerida
  const prefSede = lead.Preferencias?.[0]?.sede_preferida;
  let suggestedSedeId: string | undefined = undefined;
  let suggestedSedeNombre: string = 'Sede California';
  if (prefSede && catalogs?.sedes) {
    const sMatch = catalogs.sedes.find((s: any) =>
      s.nombre?.toLowerCase().includes(prefSede.toLowerCase()) ||
      prefSede.toLowerCase().includes(s.nombre?.toLowerCase())
    );
    if (sMatch) {
      suggestedSedeId = sMatch.id_sede?.toString();
      suggestedSedeNombre = sMatch.nombre;
    }
  }

  // Franja sugerida
  let suggestedFranjaTexto = 'Turno Tarde (01:00 PM – 06:00 PM)';
  if (urgencyLevel === 'CRÍTICA_DOLOR') {
    suggestedFranjaTexto = 'Turno Prioritario Express (Hoy mismo)';
  } else if (reqMotivo.includes('noche') || reqMotivo.includes('18:00')) {
    suggestedFranjaTexto = 'Turno Noche (06:00 PM – 09:00 PM)';
  } else if (reqMotivo.includes('mañana') || reqMotivo.includes('08:00')) {
    suggestedFranjaTexto = 'Turno Mañana (08:00 AM – 01:00 PM)';
  }

  // Condiciones sugeridas
  let suggestedConditions = 'Garantía clínica y cupo reservado por 48 horas.';
  if (urgencyLevel === 'CRÍTICA_DOLOR') {
    suggestedConditions = 'Atención prioritaria de alivio inmediato con cupo reservado hoy.';
  } else if (ticketCategory === 'TICKET_ALTO') {
    suggestedConditions = 'Diagnóstico digital 3D incluido y facilidades de pago en cuotas.';
  }

  // Pitch Comercial Persuasivo Heurístico Base
  let persuasiveSalesPitch = '';
  if (urgencyLevel === 'CRÍTICA_DOLOR') {
    persuasiveSalesPitch = `¡Hola ${firstName}! 👋 Te saludamos de NexoSalud Dental. Notamos que presentas molestias. Hemos reservado un cupo de urgencia hoy mismo en nuestra ${suggestedSedeNombre} para evaluarte y aliviar el dolor con tecnología indolora. Tarifa especial de S/ ${suggestedOfferedPrice}.00. ¿Confirmamos tu horario para hoy? 🦷✨`;
  } else if (ticketCategory === 'TICKET_ALTO') {
    persuasiveSalesPitch = `¡Hola ${firstName}! 👋 En NexoSalud Dental preparamos una propuesta exclusiva para tu tratamiento de ${reqServicio}: Tarifa promocional de S/ ${suggestedOfferedPrice}.00 (Ahorras ${suggestedDiscountPct}%) con escaneo 3D incluido y opción en cuotas. Cupos disponibles esta semana en ${suggestedSedeNombre}. ¿Te gustaría conocer los horarios disponibles? 😊`;
  } else {
    persuasiveSalesPitch = `¡Hola ${firstName}! 👋 En NexoSalud Dental tenemos una promoción exclusiva para tu atención de ${reqServicio}: Tarifa especial de S/ ${suggestedOfferedPrice}.00 (precio regular S/ ${officialPrice.toFixed(2)}) válida por ${suggestedVigencia}. ¿Qué horario te acomoda mejor para agendar tu evaluación? ✨`;
  }

  // 4. Inferencia de Preferencias Operativas y Comerciales para la Negociación
  const hasPhone = Boolean(lead.numero || lead.person?.phone);
  const preferredChannel = hasPhone
    ? 'WhatsApp (Mensajería rápida)'
    : 'Correo electrónico institucional';

  let paymentPreference = 'Pago al contado con descuento';
  let decisionDriver = 'Calidad y precio justo';
  let primaryBarrier = 'Comparación de presupuestos con otras clínicas';
  let crossSellingOpenness = 'Receptivo a profilaxis previa o radiografía';

  if (urgencyLevel === 'CRÍTICA_DOLOR') {
    paymentPreference = 'Pago directo por sesión de alivio inmediato';
    decisionDriver = 'Atención el mismo día y eliminación del dolor';
    primaryBarrier = 'Miedo al procedimiento y tiempo de espera en sala';
    crossSellingOpenness = 'Enfocado estrictamente en la urgencia puntual';
  } else if (ticketCategory === 'TICKET_ALTO') {
    paymentPreference = 'Fraccionamiento en cuotas / Inicial accesible';
    decisionDriver = 'Garantía clínica, durabilidad de implantes y confianza médica';
    primaryBarrier = 'Inversión total y temor al procedimiento quirúrgico';
    crossSellingOpenness = 'Receptivo a paquete integral (Tomografía 3D + Limpieza previa)';
  } else if (urgencyLevel === 'ELECTIVA_ESTÉTICA') {
    paymentPreference = 'Cuotas con tarjeta de crédito sin intereses';
    decisionDriver = 'Estética de sonrisa y rapidez en ver resultados visibles';
    primaryBarrier = 'Sensibilidad dental post-tratamiento y duración de resultados';
    crossSellingOpenness = 'Receptivo a aclaramiento + profilaxis premium';
  } else {
    paymentPreference = 'Pago contado con descuento promocional';
    decisionDriver = 'Precio accesible y diagnóstico preventivo claro';
    primaryBarrier = 'Sensibilidad al costo y postergación de la cita';
    crossSellingOpenness = 'Receptivo a paquete familiar o limpieza dental profunda';
  }

  // Flexibilidad de agenda inferida
  const prefHorario = lead.Preferencias?.[0]?.Horario;
  let agendaFlexibility = 'Horario vespertino (Disponibilidad laboral condicionada)';
  if (prefHorario) {
    const diaNombre = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][prefHorario.dia_semana] || 'Día fijado';
    agendaFlexibility = `${diaNombre} fijo (Preferencia estricta por horario elegido)`;
  } else if (reqMotivo.includes('flexible')) {
    agendaFlexibility = 'Flexible ante disponibilidad de la sede';
  }

  // Enriquecimiento con Groq AI si la API Key está activa
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (apiKey && apiKey !== 'tu_groq_api_key_aqui') {
    try {
      const prompt = `Actúa como el Agente Negociador de la clínica odontológica NexoSalud Dental.
Genera una estrategia de negociación personalizada y persuasiva:
- Paciente: ${patientName}
- Tratamiento: ${reqServicio} (Precio oficial: S/ ${officialPrice})
- Motivo o Duda del paciente: "${reqMotivo || 'Consulta general'}"
- Nivel de dolor: ${dolor || 'No reportado'}
- Sede: ${suggestedSedeNombre}
- Descuento recomendado: ${suggestedDiscountPct}% (Precio ofrecido: S/ ${suggestedOfferedPrice})
- Vigencia: ${suggestedVigencia}

Responde ÚNICAMENTE un JSON con:
{
  "strategyReason": "Justificación concisa en 1 o 2 oraciones para el asesor de ventas sobre por qué esta oferta es ideal",
  "persuasiveSalesPitch": "Mensaje de WhatsApp cálido, empático, profesional y persuasivo listo para enviar (máximo 4 líneas con emojis)"
}`;

      const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: GROQ_MODELS[0],
          messages: [
            { role: 'system', content: 'Eres el Agente Negociador de NexoSalud Dental. Especialista en psicología de ventas y persuasión médica odontológica.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 300,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.replace(/```json/gi, '')?.replace(/```/g, '')?.trim();
        if (content) {
          const parsed = JSON.parse(content);
          if (parsed.strategyReason) strategyReason = parsed.strategyReason;
          if (parsed.persuasiveSalesPitch) persuasiveSalesPitch = parsed.persuasiveSalesPitch;
        }
      }
    } catch {
      // Mantiene el fallback heurístico
    }
  }

  return {
    leadScore,
    scoreLevel,
    urgencyLevel,
    ticketCategory,
    priceSensitivity,
    preferredChannel,
    paymentPreference,
    decisionDriver,
    agendaFlexibility,
    crossSellingOpenness,
    primaryBarrier,
    suggestedDiscountPct,
    suggestedOfferedPrice,
    originalPrice: officialPrice,
    suggestedVigencia,
    suggestedSedeId,
    suggestedSedeNombre,
    suggestedFranjaTexto,
    suggestedConditions,
    strategyReason,
    persuasiveSalesPitch
  };
}
