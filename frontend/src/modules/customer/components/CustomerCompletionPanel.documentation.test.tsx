import {afterEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import CustomerCompletionPanel from './CustomerCompletionPanel';
vi.mock('@/shared/services/staffAuthService',()=>({staffAuthService:{getAccessToken:()=> 'test-token'}}));
vi.mock('@/shared/services/patientAuthService',()=>({patientAuthApi:{getAccessToken:()=>null}}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('muestra pendientes legibles y consulta sin confirmar ni cerrar',async()=>{
  const fetch=vi.fn(async(url:string,_options?:RequestInit)=>{const path=new URL(url).pathname;const data=path.endsWith('/validate')?{blocked:false,pending:['evaluacion','indicaciones_emitidas'],readOnly:true,validationRecorded:false}:path.endsWith('/capabilities')?{externalDraftingEnabled:false}:[];return new Response(JSON.stringify({data}),{status:200});});
  vi.stubGlobal('fetch',fetch);render(<CustomerCompletionPanel audience="staff" role="ODONTOLOGO" attentionId={20}/>);
  const button=screen.getByRole('button',{name:'Comprobar requisitos'});await waitFor(()=>expect(button).not.toBeDisabled());fireEvent.click(button);
  await screen.findByLabelText('Resultado de comprobación documental');
  expect(screen.getByText('Indicaciones vigentes, aprobadas y emitidas')).toBeInTheDocument();
  expect(screen.getByText(/Consulta de solo lectura: no registra una validación/)).toBeInTheDocument();
  const calls=fetch.mock.calls.filter(([url])=>url.includes('/validate'));expect(calls).toHaveLength(1);
  const options=(fetch.mock.calls as unknown as Array<[string,RequestInit]>).find(([url])=>url.includes('/validate'))?.[1];expect(JSON.parse(String(options?.body))).toEqual({confirmed:false});
  expect(fetch.mock.calls.some(([url])=>url.endsWith('/close'))).toBe(false);
});
