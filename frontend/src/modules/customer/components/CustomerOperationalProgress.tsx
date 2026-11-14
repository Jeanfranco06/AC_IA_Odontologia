import {useEffect, useState} from 'react';
import {customerAiAgentApi as api, type TreatmentProgress} from '../services/customerAiAgentApi';

export default function CustomerOperationalProgress() {
  const [search,setSearch]=useState('');
  const [query,setQuery]=useState({text:''});
  const [rows,setRows]=useState<{treatmentId:number;patientName:string;serviceName:string;status:string}[]>([]);
  const [selected,setSelected]=useState('');
  const [revision,setRevision]=useState(0);
  const [progress,setProgress]=useState<TreatmentProgress|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  useEffect(()=>{
    let current=true; setRows([]);setSelected('');setError('');
    api.operationalTreatments(query.text).then(r=>{if(current)setRows(r.data);}).catch(e=>{if(current)setError(e.message);});
    return ()=>{current=false;};
  },[query]);
  useEffect(()=>{
    let current=true;let requestVersion=0;
    setProgress(null);setError('');
    if(!selected){setLoading(false);return;}
    const refresh=async()=>{
      const version=++requestVersion;setLoading(true);
      try {const result=await api.treatmentProgress(Number(selected),'staff');if(current&&version===requestVersion){setProgress(result.data);setError('');}}
      catch(e){if(current&&version===requestVersion){setProgress(null);setError(e instanceof Error?e.message:'No se pudo verificar el progreso.');}}
      finally{if(current&&version===requestVersion)setLoading(false);}
    };
    void refresh();
    const onFocus=()=>{if(document.visibilityState==='visible')void refresh();};
    window.addEventListener('focus',onFocus);
    const timer=window.setInterval(onFocus,30000);
    return ()=>{current=false;window.clearInterval(timer);window.removeEventListener('focus',onFocus);};
  },[selected,revision]);
  return <section className="space-y-4" aria-label="Progreso administrativo de sesiones">
    <h2 className="pt-display text-xl">Progreso administrativo de sesiones</h2>
    <p>Coordinación consulta el conteo vigente de NexoSaludDB. Una sesión completada administrativamente debe estar realizada y cerrada; validar documentación por sí solo no aumenta ese conteo.</p>
    <form className="flex gap-3" onSubmit={e=>{e.preventDefault();setQuery({text:search});}}>
      <label className="pt-field flex-1">Buscar por nombre, apellido o servicio<input className="pt-input" maxLength={100} value={search} onChange={e=>setSearch(e.target.value)}/></label>
      <button className="pt-btn" type="submit">Buscar tratamientos</button>
    </form>
    <p className="pt-note">Se muestran hasta 50 tratamientos por búsqueda. Ajusta el filtro para encontrar otro.</p>
    <label className="pt-field">Tratamiento<select className="pt-input" value={selected} onChange={e=>{setProgress(null);setSelected(e.target.value);}}><option value="">Seleccionar tratamiento</option>{rows.map(r=><option key={r.treatmentId} value={r.treatmentId}>{r.patientName} · {r.serviceName} · Tratamiento {r.treatmentId}</option>)}</select></label>
    <button className="pt-btn" disabled={!selected||loading} onClick={()=>setRevision(r=>r+1)}>Actualizar progreso</button>
    {error&&<p role="alert">{error}</p>}
    {loading&&<p role="status">Consultando progreso…</p>}
    {progress&&<div className="pt-note space-y-2">
      <p>Sesiones realizadas y cerradas: {progress.completedSessions} de {progress.plannedSessions??'Sin total válido'}</p>
      <p>Realizadas pendientes de cierre: {progress.performedPendingClosureSessions??'No informado'}</p>
      <p>Pendientes administrativas: {progress.pendingSessions??'Requiere revisión'}</p>
      <p>Avance administrativo: {progress.operationalProgressPercent===null?'Requiere revisión':`${progress.operationalProgressPercent}%`}</p>
      <p>Estado formal del tratamiento: {progress.currentStatus}</p>
      {progress.calculationStatus==='REQUIERE_REVISION'&&<p>El plan o los registros presentan inconsistencias. Solicita su revisión antes de informar un porcentaje.</p>}
      {progress.calculatedAt&&<p>Consulta: {new Date(progress.calculatedAt).toLocaleString('es-PE',{timeZone:'America/Lima'})} (Lima). Se actualiza al volver a esta ventana y cada 30 segundos mientras esté visible.</p>}
      <p>Fuente: NexoSaludDB. Consulta de solo lectura. Alcanzar 100 % no cierra el tratamiento ni acredita alta clínica.</p>
    </div>}
  </section>;
}
