import { AiAgentError } from '../types';
export function preserveIssuedInstructions(rows: Array<{content:string;instructionId?:number;version?:number}>) {
  return 'Estas son las indicaciones aprobadas y emitidas para la atención consultada. Se conserva su texto íntegro, incluidas cantidades, frecuencia y duración. Si necesitas una interpretación clínica individual, solicita revisión profesional.\n\n'+rows.map(row=>`Indicación ${row.instructionId ?? ''}, versión ${row.version ?? ''}:\n${row.content}`).join('\n\n');
}
export function verifyCitations(text: string, references: Array<{documentCode:string;version:number;section:string}>) {
  const authorized = new Set(references.map(ref=>`[Documento: ${ref.documentCode} v${ref.version}, Sección: ${ref.section}]`));
  for(const match of text.matchAll(/\[Documento:[^\]]*\]/gi)) {
    if(!authorized.has(match[0])) throw new AiAgentError('SERVICE_UNAVAILABLE','La respuesta intentó citar una fuente no recuperada y autorizada.');
  }
  return text;
}
export function explainAnalytics(results:any[]) {
 return results.map(r=>`${r.activity} · Fuente: ${r.source}.${r.fact}\nPeríodo inclusivo: ${r.filter.startDate} a ${r.filter.endDate}. Ámbito: ${r.scope}.\n${r.definition}\n${Object.entries(r.totals).filter(([,v])=>v!==null).map(([k,v])=>`${k}: ${v}`).join('\n')}\n${r.groups.slice(0,6).map((g:any)=>`${g.label}: ${Object.entries(g).filter(([k])=>k!=='label').map(([k,v])=>`${k}=${v===null?'sin denominador':v}`).join(', ')}`).join('\n')}\n${r.groups.length>6?'Se muestran seis grupos; consulta la vista analítica para el detalle autorizado.\n':''}Última carga exitosa (hora del registro SQL, sin zona histórica acreditada): ${r.freshness.lastSuccessfulSync||'No disponible'}. ${r.freshness.warning}`).join('\n\n');
}
