import {afterEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import CustomerInteractionAudit from './CustomerInteractionAudit';
import {customerAiAgentApi as api} from '../services/customerAiAgentApi';
vi.mock('../services/customerAiAgentApi',()=>({customerAiAgentApi:{interactionAudit:vi.fn()}}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
const row={id_interaccion_ia:1,tipo_evento:'CONVERSACION_CON_HERRAMIENTAS',actor_orientado:'ODONTOLOGO',estado:'Completada',fecha_hora:'2026-11-13T20:00:00Z',id_correlacion:'synthetic-operation',id_usuario_actor:3,id_usuario_revisor:null,id_persona:10,id_tratamiento:30,id_sesion:1,id_atencion:20,id_profesional:2,version_agente:'TEST-v1'};
it('muestra metadatos y correlación sin presentar una consulta como revisión humana',async()=>{
  vi.mocked(api.interactionAudit).mockResolvedValue({data:{interactions:[row]}} as any);
  render(<CustomerInteractionAudit/>);await screen.findByText('synthetic-operation');
  expect(screen.getByText('Revisor Sin revisión registrada')).toBeInTheDocument();expect(screen.getByText('Tratamiento 30')).toBeInTheDocument();expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Siguiente'})).toBeDisabled();
});
it('pagina y descarta el resultado visible cuando falla una nueva consulta',async()=>{
  vi.mocked(api.interactionAudit).mockResolvedValueOnce({data:{interactions:Array.from({length:25},(_,i)=>({...row,id_interaccion_ia:i+1}))}} as any).mockResolvedValueOnce({data:{interactions:[{...row,id_interaccion_ia:26,id_correlacion:'page-two'}]}} as any).mockRejectedValueOnce(new Error('Sesión expirada'));
  render(<CustomerInteractionAudit/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Siguiente'})).not.toBeDisabled());fireEvent.click(screen.getByRole('button',{name:'Siguiente'}));
  await screen.findByText('page-two');expect(api.interactionAudit).toHaveBeenLastCalledWith(2);
  fireEvent.click(screen.getByRole('button',{name:'Actualizar eventos'}));await screen.findByText('Sesión expirada');expect(screen.queryByText('page-two')).not.toBeInTheDocument();
});
