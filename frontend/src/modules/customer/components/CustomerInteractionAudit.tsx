import {useEffect,useState} from 'react';
import {customerAiAgentApi as api,type InteractionAuditEvent} from '../services/customerAiAgentApi';

export default function CustomerInteractionAudit(){
  const [page,setPage]=useState(1);const [revision,setRevision]=useState(0);
  const [rows,setRows]=useState<InteractionAuditEvent[]>([]);const [error,setError]=useState('');const [busy,setBusy]=useState(true);
  useEffect(()=>{let current=true;setBusy(true);setError('');setRows([]);
    api.interactionAudit(page).then(r=>{if(current)setRows(r.data.interactions);}).catch(e=>{if(current)setError(e.message);}).finally(()=>{if(current)setBusy(false);});
    return()=>{current=false;};
  },[page,revision]);
  return <section aria-label="Auditoría de interacciones" className="space-y-4">
    <h2 className="pt-display text-xl">Auditoría de interacciones</h2>
    <p>Metadatos registrados en NexoSaludDB. Una conversación genera un desenlace; las acciones supervisadas tienen eventos propios y pueden compartir su correlación. Esta consulta no genera otra interacción de IA.</p>
    <p className="pt-note">Los indicadores de BI se actualizan mediante la carga del Data Mart. Su cantidad total de eventos incluye clases distintas: interacciones, alertas y borradores.</p>
    <p className="pt-note">La fecha se presenta con los componentes almacenados en SQL; los registros históricos no acreditan una zona horaria.</p>
    <button type="button" className="pt-btn" disabled={busy} onClick={()=>setRevision(r=>r+1)}>Actualizar eventos</button>
    {busy&&<p role="status">Consultando eventos…</p>}{error&&<p role="alert">{error}</p>}
    {!busy&&!error&&!rows.length&&<p>No hay eventos en esta página.</p>}
    <div className="overflow-x-auto"><table className="w-full text-xs text-left"><caption className="sr-only">Eventos de IA, más recientes primero</caption><thead><tr>{['Evento y fecha del registro','Actor y revisión','Referencias','Correlación'].map(h=><th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>
      {rows.map(r=><tr className="border-t border-[var(--pt-line)]" key={r.id_interaccion_ia}>
        <td className="p-3"><p>#{r.id_interaccion_ia} · {r.tipo_evento}</p><p>{new Date(r.fecha_hora).toLocaleString('es-PE',{timeZone:'UTC'})}</p><p>{r.estado} · {r.version_agente}</p></td>
        <td className="p-3"><p>{r.actor_orientado} · Usuario {r.id_usuario_actor??'No aplica'}</p><p>Profesional {r.id_profesional??'No aplica'}</p><p>Revisor {r.id_usuario_revisor??'Sin revisión registrada'}</p></td>
        <td className="p-3"><p>Paciente {r.id_persona??'No vinculado'}</p><p>Tratamiento {r.id_tratamiento??'No vinculado'}</p><p>Sesión {r.id_sesion??'No vinculada'} · Atención {r.id_atencion??'No vinculada'}</p></td>
        <td className="p-3 break-all font-mono">{r.id_correlacion??'Sin correlación histórica'}</td>
      </tr>)}
    </tbody></table></div>
    <div className="flex gap-3 items-center"><button type="button" className="pt-btn" disabled={busy||page===1} onClick={()=>setPage(p=>p-1)}>Anterior</button><span>Página {page}</span><button type="button" className="pt-btn" disabled={busy||Boolean(error)||rows.length<25} onClick={()=>setPage(p=>p+1)}>Siguiente</button></div>
  </section>;
}
