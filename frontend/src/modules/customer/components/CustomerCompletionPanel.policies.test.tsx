import { afterEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import CustomerCompletionPanel from './CustomerCompletionPanel';
vi.mock('@/shared/services/staffAuthService',()=>({staffAuthService:{getAccessToken:()=> 'test-token'}}));
vi.mock('@/shared/services/patientAuthService',()=>({patientAuthApi:{getAccessToken:()=>null}}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('muestra servicio, plantilla y procedencia sin aprobar ni publicar al visualizar',async()=>{
  const text='Procedimiento confirmado: {{procedimiento}}\n{{indicaciones_profesional}}\n{{observaciones}}';
  let reviewed=false;
  const fetch=vi.fn(async(url:string,options?:RequestInit)=>{
    const path=new URL(url).pathname;let data:unknown=[];
    if(path.endsWith('/capabilities'))data={externalDraftingEnabled:false};
    if(path.endsWith('/catalog'))data=[{id_servicio:7,nombre:'Evaluación General'}];
    if(path.endsWith('/policies/7/review')){reviewed=true;data={};}
    if(path.endsWith('/policies'))data=[{id_politica:7,codigo:'PLANTILLA_INDICACIONES',version:7,id_servicio:7,estado:reviewed?'Revisada':'Borrador',id_profesional_revisor:reviewed?2:null,configuracion:JSON.stringify({title:'Indicaciones — Evaluación General',sourceReference:'Formato preparado a solicitud del usuario',text})}];
    return new Response(JSON.stringify({data}),{status:200});
  });
  vi.stubGlobal('fetch',fetch);
  render(<CustomerCompletionPanel audience="staff" role="ODONTOLOGO"/>);
  fireEvent.click(screen.getByText('Plantillas y políticas: revisión y publicación'));
  await screen.findByText(/Indicaciones — Evaluación General/);
  fireEvent.click(screen.getByText('Ver contenido y procedencia antes de revisar'));
  expect(screen.getByText(/Formato preparado a solicitud del usuario/)).toBeInTheDocument();
  expect(screen.getByText(/indicaciones_profesional/)).toBeInTheDocument();
  expect(fetch.mock.calls.some(([,options])=>options?.method==='POST')).toBe(false);
  expect(screen.queryByRole('button',{name:'Publicar política revisada'})).not.toBeInTheDocument();
  const review=screen.getByRole('button',{name:'Revisar profesionalmente'});await waitFor(()=>expect(review).not.toBeDisabled());fireEvent.click(review);
  await screen.findByText(/Revisión registrada por profesional #2/);
  expect(fetch.mock.calls.filter(([url])=>url.endsWith('/review'))).toHaveLength(1);
  expect(fetch.mock.calls.some(([url])=>url.endsWith('/publish'))).toBe(false);
});
