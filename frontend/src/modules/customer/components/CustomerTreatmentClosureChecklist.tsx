import {useEffect,useRef,useState} from 'react';
import {customerAiAgentApi as api,type ClosureChecklist} from '../services/customerAiAgentApi';

export default function CustomerTreatmentClosureChecklist({initial}:{initial:ClosureChecklist}) {
  const [data,setData]=useState<ClosureChecklist|null>(initial);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const version=useRef(0);
  useEffect(()=>{version.current++;setData(initial);setError('');setBusy(false);return()=>{version.current++;};},[initial]);
  async function refresh(){
    const request=++version.current;setBusy(true);setError('');
    try{const result=await api.treatmentClosureChecklist(initial.treatmentId);if(request===version.current)setData(result.data);}
    catch(e){if(request===version.current){setData(null);setError(e instanceof Error?e.message:'No se pudo verificar el checklist.');}}
    finally{if(request===version.current)setBusy(false);}
  }
  return <section className="rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] p-4 space-y-3 text-xs" aria-label="Preparación del cierre del tratamiento">
    <h3 className="font-bold">Checklist consultivo de cierre - Tratamiento #{initial.treatmentId}</h3>
    <button type="button" className="pt-btn" disabled={busy} onClick={()=>void refresh()}>Actualizar checklist de cierre</button>
    {busy&&<p role="status">Consultando evidencias actuales…</p>}
    {error&&<p role="alert">{error}</p>}
    {data&&<>
      <p>Estado formal: {data.formalTreatmentStatus} · Sesiones realizadas y cerradas: {data.completedSessions}/{data.plannedSessions??'Sin plan'}</p>
      <p>{data.disclaimer}</p>
      {data.pending.length?<ul className="list-disc pl-4 space-y-1">{data.pending.map((item,i)=><li key={i}>{item}</li>)}</ul>:<p>Sin pendientes documentales detectados por estas reglas. Requiere decisión profesional; no acredita conclusión clínica.</p>}
      <details><summary className="font-semibold">Evidencias por sesión</summary>
        {!data.sessions?.length&&<p>No hay sesiones documentadas para este checklist.</p>}
        {data.sessions?.map(s=><article key={s.sessionId} className="my-3 border-t pt-2 space-y-1">
          <h4 className="font-semibold">Sesión {s.number}: {s.careStatus} · Cierre: {s.closureStatus}</h4>
          {s.requiresExceptionReview&&<p>Excepción pendiente de decisión profesional.</p>}
          {!s.attentions.length&&<p>Sin atención vinculada.</p>}
          {s.attentions.map(a=><div key={a.attentionId} className="pl-3 space-y-1">
            <p>Atención {a.attentionId}{a.clinicalRevision!==undefined?` · Revisión de ficha ${a.clinicalRevision}`:''}</p>
            {a.linkageValid===false?<p>Vínculos inconsistentes. No se recuperaron documentos de esta atención.</p>:<>
              <p>Validación registrada: {a.validationResult??'SIN_VALIDACION'}{a.validationId?` · Registro ${a.validationId}`:''}.</p>
              <p>{a.validationMatchesCurrentRecords?'Validación completa y coincidente con los registros actuales.':'La validación no acredita los registros actuales; requiere revisión.'}</p>
              <p>Política documental: {a.policyId?`${a.policyId}, versión ${a.policyVersion}`:'sin política publicada aplicable'}.</p>
              <p>Indicaciones aprobadas y emitidas vigentes: {a.issuedInstructionIds?.length?a.issuedInstructionIds.join(', '):'ninguna recuperada; su exigencia depende de la política del servicio'}.</p>
              {a.pendingFields?.length?<p>Requisitos pendientes: {a.pendingFields.join('; ')}.</p>:null}
            </>}
          </div>)}
        </article>)}
      </details>
      <p>Revisiones humanas sin resolver: {data.unresolvedReviews?.length??'No informado'}.</p>
      {data.unresolvedReviews?.map(r=><p key={r.id_solicitud}>Solicitud {r.id_solicitud}: {r.estado.replaceAll('_',' ')}.</p>)}
      <p>Borradores sin resolver: {data.pendingDrafts?.length??'No informado'}.</p>
      {data.pendingDrafts?.map(d=><p key={d.id_borrador_ia}>Borrador {d.id_borrador_ia}, versión {d.version_borrador}: {d.estado.replaceAll('_',' ')}.</p>)}
      <p>Fuente: NexoSaludDB{data.evaluatedAt?` · Consulta ${new Date(data.evaluatedAt).toLocaleString('es-PE',{timeZone:'America/Lima'})} (Lima)`:''}. Solo lectura.</p>
    </>}
  </section>;
}
