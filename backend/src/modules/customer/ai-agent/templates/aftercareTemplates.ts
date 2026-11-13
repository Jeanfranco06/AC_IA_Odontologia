/** Formatos de organización; no son protocolos ni recomendaciones clínicas nuevas. */
export const AFTERCARE_TEMPLATE_SET = 'IA10-FORMATO-PROFESIONAL-v1';

export function buildAftercareTemplate(service: { id_servicio: number; nombre: string }) {
  return {
    templateSet: AFTERCARE_TEMPLATE_SET,
    title: `Indicaciones postatención — ${service.nombre}`,
    serviceName: service.nombre,
    preparedBy: 'Asistente, a solicitud del usuario; sujeto a revisión profesional registrada',
    sourceReference: 'IA10: formato de organización por servicio. El contenido clínico procede exclusivamente del procedimiento confirmado y de las indicaciones registradas por el odontólogo. No agrega pautas, medicamentos, dosis ni contactos.',
    requiresProfessionalInstructions: true,
    text: [
      `Servicio: ${service.nombre}`,
      'Procedimiento confirmado: {{procedimiento}}',
      '',
      'Indicaciones registradas por su odontólogo:',
      '{{indicaciones_profesional}}',
      '',
      'Observaciones registradas de esta atención:',
      '{{observaciones}}',
      '',
      'Si necesita aclarar el significado de estas indicaciones, consulte al odontólogo que las emitió.'
    ].join('\n')
  };
}
