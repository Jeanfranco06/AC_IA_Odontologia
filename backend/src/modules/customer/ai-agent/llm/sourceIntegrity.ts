import { AiAgentError } from '../types';
export interface IssuedInstruction {
  content: string; instructionId?: number; version?: number; id_atencion?: number;
  attentionDate?: string; serviceName?: string | null; professionalName?: string | null;
}
export function preserveIssuedInstructions(rows: IssuedInstruction[]) {
  const header = 'Estas son las indicaciones aprobadas y emitidas por el odontólogo para la atención consultada. Se conserva el texto original para no cambiar su contenido clínico.';
  const documents = rows.map(row => {
    const date = row.attentionDate ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeZone: 'America/Lima' }).format(new Date(row.attentionDate)) : null;
    const context = [row.serviceName, date, row.professionalName].filter(Boolean).join(' · ');
    return `${context ? context + '\n' : ''}Indicaciones autorizadas${row.version ? ` · versión ${row.version}` : ''}:\n${row.content}`;
  }).join('\n\n');
  return `${header}\n\n${documents}\n\nPara leerlas: identifica qué debes hacer y, cuando se indiquen, la cantidad, cada cuánto y durante cuánto tiempo. Esta explicación no agrega ni cambia dosis, horarios o tratamientos. Si una indicación no se entiende o parece contradictoria, solicita aclaración al odontólogo; no la ajustes por tu cuenta.`;
}
export function verifyCitations(text: string, references: Array<{documentCode:string;version:number;section:string}>) {
  const authorized = new Set(references.map(ref=>`[Documento: ${ref.documentCode} v${ref.version}, Sección: ${ref.section}]`));
  for(const match of text.matchAll(/\[Documento:[^\]]*\]/gi)) {
    if(!authorized.has(match[0])) throw new AiAgentError('SERVICE_UNAVAILABLE','La respuesta intentó citar una fuente no recuperada y autorizada.');
  }
  return text;
}
export function ensureKnowledgeCitations(text: string, references: Array<{documentCode:string;version:number;section:string}>) {
  const verified = verifyCitations(text, references);
  if (!references.length || /\[Documento:[^\]]*\]/i.test(verified)) return verified;
  const citations = [...new Set(references.map(r => `[Documento: ${r.documentCode} v${r.version}, Sección: ${r.section}]`))];
  return `${verified}\n\nFuentes recuperadas: ${citations.join(' ')}`;
}
export function explainDocumentationCheck(result: {blocked:boolean;pending:string[];policyId?:number|null;policyVersion?:number|null}) {
  const labels: Record<string,string> = { motivo_consulta:'Motivo de consulta', antecedentes:'Antecedentes registrados', alergias:'Registro de alergias', evaluacion:'Evaluación registrada', procedimiento:'Procedimiento registrado', observaciones:'Observaciones', indicaciones_finales:'Indicaciones finales registradas', procedimiento_confirmado:'Procedimiento confirmado', indicaciones_emitidas:'Indicaciones vigentes, aprobadas y emitidas' };
  return ['Comprobación documental actual — fuente: NexoSaludDB.', result.policyId ? `Política documental ${result.policyId}, versión ${result.policyVersion ?? 'no registrada'}.` : 'Sin política documental publicada aplicable.', result.blocked ? 'La comprobación está bloqueada:' : result.pending.length ? 'Pendientes detectados:' : 'No se detectaron pendientes entre los requisitos documentales evaluados.', ...result.pending.map(item=>`- ${labels[item]||item}`), 'Esta consulta no registra una validación profesional, no firma ni cierra la ficha. La presencia de documentos no certifica su veracidad clínica.'].join('\n');
}
export function explainTreatmentClosureChecklist(result: {data:{formalTreatmentStatus:string;completedSessions:number;plannedSessions:number|null;pending:string[];disclaimer:string}}) {
  const data=result.data;
  return ['Checklist consultivo de cierre — fuente: NexoSaludDB.',`Estado formal: ${data.formalTreatmentStatus}. Sesiones realizadas y cerradas: ${data.completedSessions} de ${data.plannedSessions??'total no válido'}.`,data.pending.length?'Pendientes para revisión profesional:':'Sin pendientes documentales detectados por estas reglas; esto no acredita conclusión clínica.',...data.pending.map(item=>`- ${item}`),data.disclaimer,'Consulta el detalle de evidencias en Atención & Documentación. No se ha registrado ninguna decisión de cierre.'].join('\n');
}
export function explainAnalytics(results:any[]) {
 return results.map(r=>`${r.activity} · Fuente: ${r.source}.${r.fact}\nPeríodo inclusivo: ${r.filter.startDate} a ${r.filter.endDate}. Ámbito: ${r.scope}.\n${r.definition}\n${Object.entries(r.totals).filter(([,v])=>v!==null).map(([k,v])=>`${k}: ${v}`).join('\n')}\n${r.groups.slice(0,6).map((g:any)=>`${g.label}: ${Object.entries(g).filter(([k])=>k!=='label').map(([k,v])=>`${k}=${v===null?'sin denominador':v}`).join(', ')}`).join('\n')}\n${r.groups.length>6?'Se muestran seis grupos; consulta la vista analítica para el detalle autorizado.\n':''}Última carga exitosa (hora del registro SQL, sin zona histórica acreditada): ${r.freshness.lastSuccessfulSync||'No disponible'}. ${r.freshness.warning}`).join('\n\n');
}
