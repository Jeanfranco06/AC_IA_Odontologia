import fs from 'fs';

const path = 'd:/Proyects/AC_IA_Odontologia/backend/src/modules/customer/ai-agent/llm/systemInstructions.ts';
let content = fs.readFileSync(path, 'utf8');

const target = `     * NEGOCIACIÓN CONVERSACIONAL Y VALIDACIÓN DE DISPONIBILIDAD:
       - El objetivo es conversar amigablemente con el paciente hasta encontrar un horario que le convenga plenamente.
       - Si el paciente solicita una fecha/hora y esta se encuentra disponible en 'prepareRescheduleRequest' o si el paciente fue taxativo (ej. "sí, quiero reprogramar para el lunes a las 10 am" o "quiero la opción 1"), invoca 'requestReschedule' para registrar la solicitud formal (#requestId) y envíala a Recepción.
       - Si la fecha u hora solicitada por el paciente NO está disponible o tiene conflicto con la agenda del profesional:
         • No rechaces la conversación con frialdad ni digas simplemente que no se puede.
         • Explica amablemente que la agenda de su especialista se encuentra completa en ese momento exacto, pero que cuentas con opciones cercanas disponibles.
         • Enumera 2 o 3 alternativas reales verificadas ('data.alternatives') indicando: Opción 1️⃣ [Día, Fecha y Hora en hora de Lima], Opción 2️⃣ [Día, Fecha y Hora], etc.
         • Pregúntale cuál de esas alternativas le acomoda mejor o si prefiere otro día.
       - Si el paciente responde eligiendo una opción (ej. "la opción 1", "el lunes 16 a las 10 am") o si viene de una solicitud que fue rechazada por Recepción:
         • Invoca 'requestReschedule' con esa nueva fecha y horario elegidos para la sesión correspondiente, confirmando que la nueva solicitud fue enviada a Recepción.`;

const replacement = `     * NEGOCIACIÓN CONVERSACIONAL Y VALIDACIÓN DE DISPONIBILIDAD:
       - El objetivo es conversar amigablemente con el paciente hasta encontrar un horario que le convenga plenamente.
       - REGLA CRÍTICA DE HERRAMIENTAS: Para REPROGRAMAR citas existentes, ESTÁ PROHIBIDO invocar 'getCustomerSchedulingSlots', 'prepareSchedulingRequest' o 'getPendingPlanSessions'. Esas herramientas son exclusivamente para programar sesiones vírgenes que no tienen fecha.
       - Para reprogramar citas existentes, DEBES USAR SIEMPRE 'prepareRescheduleRequest' (para consultar disponibilidad) o 'requestReschedule' (para registrar la solicitud).
       - Cuando el paciente elija una alternativa o responda que sí a una propuesta (ej. "para el marte 17 a las 9 me parece bien", "la opción 1", o simplemente "sí"):
         • Invoca INMEDIATAMENTE 'requestReschedule' con la fecha (ej. "2026-11-17") y franja preferida (ej. "09:00") para la Sesión 1 (sessionId de getUpcomingSessions o sessionNumber: 1).
         • Confirma de inmediato al paciente el número de solicitud formal registrada (#requestId) y que fue remitida a Recepción. NUNCA respondas diciendo que no hay cupos si la herramienta prepareRescheduleRequest los listó como disponibles.
       - Si la fecha u hora solicitada por el paciente NO está disponible:
         • Explica amablemente que su especialista no tiene disponibilidad en ese horario exacto y ofrece las 2 o 3 opciones verificadas de 'prepareRescheduleRequest' ('data.alternatives').`;

content = content.replace(/\r\n/g, '\n');
const normalizedTarget = target.replace(/\r\n/g, '\n');

if (!content.includes(normalizedTarget)) {
  console.error('Target not found in systemInstructions.ts');
  process.exit(1);
}

content = content.replace(normalizedTarget, replacement);
fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated systemInstructions.ts');
