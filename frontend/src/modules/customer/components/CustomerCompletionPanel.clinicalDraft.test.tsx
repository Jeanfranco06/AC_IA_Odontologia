import { afterEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import CustomerCompletionPanel from './CustomerCompletionPanel';
vi.mock('@/shared/services/staffAuthService',()=>({staffAuthService:{getAccessToken:()=> 'test-token'}}));
vi.mock('@/shared/services/patientAuthService',()=>({patientAuthApi:{getAccessToken:()=>null}}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('exige guardar y revisar las correcciones y transfiere solo la versión confirmada',async()=>{
  let transferred=false;
  const original='Evaluación: No presenta dolor';
  const draft=(id:number)=>({id_borrador_ia:id,version_borrador:id,estado:transferred?'Aprobado':'Generado',fecha_transferencia_ficha:transferred?'2026-11-12T20:00:00Z':null,contenido_sugerido:JSON.stringify({originalNotes:original,sections:{evaluacion:id===1?'No presenta dolor':'No presenta dolor; nota corregida por el profesional'},warnings:[],existingSections:{}})});
  const fetch=vi.fn(async(url:string,options?:RequestInit)=>{
    const path=new URL(url).pathname;let data:unknown=[];
    if(path.endsWith('/capabilities')) data={externalDraftingEnabled:false};
    else if(path.endsWith('/attentions/20/clinical-drafts')) data=draft(1);
    else if(path.endsWith('/clinical-drafts/1/revisions')) data=draft(2);
    else if(path.endsWith('/clinical-drafts/2/transfer')) {transferred=true;data={attentionId:20,idempotent:false};}
    else if(/\/clinical-drafts\/[12]$/.test(path)){const id=Number(path.at(-1));const row=draft(id);data={draft:row,content:JSON.parse(row.contenido_sugerido),history:[row]};}
    return new Response(JSON.stringify({data}),{status:200});
  });
  vi.stubGlobal('fetch',fetch);
  render(<CustomerCompletionPanel audience="staff" role="ODONTOLOGO" attentionId={20}/>);
  fireEvent.change(screen.getByLabelText('Notas originales del profesional'),{target:{value:original}});
  const prepare=screen.getByRole('button',{name:'Preparar borrador extractivo'});
  await waitFor(()=>expect(prepare).not.toBeDisabled());fireEvent.click(prepare);
  const section=await screen.findByLabelText('Evaluación declarada');
  await waitFor(()=>expect(section).toHaveValue('No presenta dolor'));
  const confirmation=screen.getByLabelText('He revisado cada sección y confirmo la acción profesional seleccionada.');
  const transfer=screen.getByRole('button',{name:'Transferir esta versión a la ficha oficial'});
  fireEvent.click(confirmation);expect(transfer).not.toBeDisabled();
  fireEvent.change(section,{target:{value:'No presenta dolor; nota corregida por el profesional'}});
  expect(confirmation).not.toBeChecked();fireEvent.click(confirmation);expect(transfer).toBeDisabled();
  expect(screen.getByText(/Hay correcciones sin guardar/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Guardar nueva versión corregida'}));
  await waitFor(()=>expect(screen.queryByText(/Hay correcciones sin guardar/)).not.toBeInTheDocument());
  expect(confirmation).not.toBeChecked();expect(transfer).toBeDisabled();
  fireEvent.click(confirmation);fireEvent.click(transfer);
  await waitFor(()=>expect(transferred).toBe(true));
  const writes=fetch.mock.calls.filter(([url])=>url.includes('/transfer'));
  expect(writes).toHaveLength(1);expect(writes[0][0]).toContain('/clinical-drafts/2/transfer');
  expect(JSON.parse(String(writes[0][1]?.body))).toEqual({confirmed:true});
  await waitFor(()=>expect(screen.getByLabelText('Evaluación declarada')).toBeDisabled());
});
