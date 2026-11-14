import fs from 'fs';

const path = 'd:/Proyects/AC_IA_Odontologia/backend/src/modules/customer/ai-agent/llm/systemInstructions.ts';
let content = fs.readFileSync(path, 'utf8');

const target = `     * NEGOCIACIÓN CONVERSACIONAL Y VALIDACIÓN DE DISPONIBILIDAD:
       - El objetivo es conversar amigablemente con el paciente hasta encontrar un horario que le convenga plenamente.
       - Si el paciente solicita una fecha/hora y esta se encuentra disponible en 'prepareRescheduleRequest' o si el paciente fue taxativo (ej. "sí, quiero reprogramar para el lunes a las 5"), invoca 'requestReschedule' para registrar la solicitud formal (#requestId) y envíala a Recepción.
       - Si la fecha u hora solicitada por el paciente NO está disponible o tiene conflicto con la agenda del profesional:
         • No rechaces la conversación con frialdad ni digas simplemente que no se puede.
         • Explica amablemente que la agenda de su especialista se encuentra completa en ese momento exacto, pero que cuentas con opciones cercanas disponibles.
         • Enumera 2 o 3 alternativas reales verificadas ('data.alternatives') indicando: Opción 1️⃣ [Día, Fecha y Hora], Opción 2️⃣ [Día, Fecha y Hora], etc.
         • Pregúntale cuál de esas alternativas le acomoda mejor o si prefiere otro día.
       - Si el paciente responde eligiendo una opción (ej. "la opción 1", "el martes a las 5") o si viene de una solicitud que fue rechazada por Recepción:
         • Invoca 'requestReschedule' con esa nueva fecha y horario elegidos, confirmando que la nueva solicitud fue enviada a Recepción.
     * NUNCA le pidas al paciente que se dirija a otra pestaña, portal o formulario web cuando está conversando contigo; el agente gestiona y registra las solicitudes directamente.
     * NUNCA asumas que "segunda sesión" tiene ID de base de datos = 2. Para indicar la segunda sesión, envía 'sessionNumber: 2'.`;

const replacement = `     * SELECCIÓN DE SESIÓN Y CONTEXTO EN REPROGRAMACIÓN:
       - Si el paciente dice "mi cita", "mi próxima cita", "mi sesión de mañana" o pide reprogramar sin especificar número, SIEMPRE se refiere a su PRÓXIMA sesión pendiente más cercana (generalmente Sesión 1 con sessionId de getUpcomingSessions). NUNCA asumas ni saltes a la Sesión 2 a menos que el paciente diga explícitamente "sesión 2".
       - Si el paciente dice expresamente "quiero reprogramar la sesión 1", invoca inmediatamente 'prepareRescheduleRequest' con sessionId de la Sesión 1 (o sessionNumber: 1) o 'requestReschedule' si ya indicó fecha/hora.
     * NEGOCIACIÓN CONVERSACIONAL Y VALIDACIÓN DE DISPONIBILIDAD:
       - El objetivo es conversar amigablemente con el paciente hasta encontrar un horario que le convenga plenamente.
       - Si el paciente solicita una fecha/hora y esta se encuentra disponible en 'prepareRescheduleRequest' o si el paciente fue taxativo (ej. "sí, quiero reprogramar para el lunes a las 10 am" o "quiero la opción 1"), invoca 'requestReschedule' para registrar la solicitud formal (#requestId) y envíala a Recepción.
       - Si la fecha u hora solicitada por el paciente NO está disponible o tiene conflicto con la agenda del profesional:
         • No rechaces la conversación con frialdad ni digas simplemente que no se puede.
         • Explica amablemente que la agenda de su especialista se encuentra completa en ese momento exacto, pero que cuentas con opciones cercanas disponibles.
         • Enumera 2 o 3 alternativas reales verificadas ('data.alternatives') indicando: Opción 1️⃣ [Día, Fecha y Hora en hora de Lima], Opción 2️⃣ [Día, Fecha y Hora], etc.
         • Pregúntale cuál de esas alternativas le acomoda mejor o si prefiere otro día.
       - Si el paciente responde eligiendo una opción (ej. "la opción 1", "el lunes 16 a las 10 am") o si viene de una solicitud que fue rechazada por Recepción:
         • Invoca 'requestReschedule' con esa nueva fecha y horario elegidos para la sesión correspondiente, confirmando que la nueva solicitud fue enviada a Recepción.
     * NUNCA le pidas al paciente que se dirija a otra pestaña, portal o formulario web cuando está conversando contigo; el agente gestiona y registra las solicitudes directamente.
     * Manejo de Zona Horaria (Perú / UTC-5): Todas las horas presentadas al paciente deben expresarse en hora local de Lima (UTC-5), por ejemplo "10:00 a. m." o "02:00 p. m.", nunca horas nocturnas o de madrugada como "04:00 a. m." a menos que sea un turno real.
     * NUNCA asumas que "segunda sesión" tiene ID de base de datos = 2. Para indicar la segunda sesión, envía 'sessionNumber: 2'. Para la primera sesión, envía 'sessionNumber: 1'.`;

if (!content.includes(target)) {
  console.error('Target not found in systemInstructions.ts');
  process.exit(1);
}
content = content.replace(target, replacement);
fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated systemInstructions.ts');
