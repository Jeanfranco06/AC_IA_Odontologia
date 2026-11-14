import {afterEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import CustomerOperationalProgress from './CustomerOperationalProgress';
import {customerAiAgentApi as api} from '../services/customerAiAgentApi';
vi.mock('../services/customerAiAgentApi',()=>({customerAiAgentApi:{operationalTreatments:vi.fn(),treatmentProgress:vi.fn()}}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
it('refresca el conteo oficial sin cerrar tratamiento y conserva null como revisión',async()=>{
  vi.mocked(api.operationalTreatments).mockResolvedValue({data:[{treatmentId:30,patientName:'Paciente Simulado',serviceName:'Servicio',status:'En ejecución'}]} as any);
  const data={completedSessions:1,plannedSessions:2,pendingSessions:1,performedPendingClosureSessions:0,operationalProgressPercent:50,currentStatus:'En ejecución'};
  vi.mocked(api.treatmentProgress).mockResolvedValueOnce({data} as any).mockResolvedValueOnce({data:{...data,completedSessions:2,pendingSessions:0,operationalProgressPercent:100}} as any).mockResolvedValue({data:{...data,pendingSessions:null,operationalProgressPercent:null,calculationStatus:'REQUIERE_REVISION'}} as any);
  render(<CustomerOperationalProgress/>);
  await screen.findByRole('option',{name:/Paciente Simulado/});fireEvent.change(screen.getByLabelText('Tratamiento'),{target:{value:'30'}});
  await screen.findByText('Avance administrativo: 50%');expect(api.treatmentProgress).toHaveBeenCalledWith(30,'staff');
  await waitFor(()=>expect(screen.getByRole('button',{name:'Actualizar progreso'})).not.toBeDisabled());fireEvent.click(screen.getByRole('button',{name:'Actualizar progreso'}));
  await screen.findByText('Avance administrativo: 100%');expect(screen.getByText('Estado formal del tratamiento: En ejecución')).toBeInTheDocument();
  await waitFor(()=>expect(screen.getByRole('button',{name:'Actualizar progreso'})).not.toBeDisabled());fireEvent.click(screen.getByRole('button',{name:'Actualizar progreso'}));
  await screen.findByText('Avance administrativo: Requiere revisión');expect(screen.getByText('Pendientes administrativas: Requiere revisión')).toBeInTheDocument();
});
it('ignora una respuesta antigua al seleccionar otro tratamiento',async()=>{
  vi.mocked(api.operationalTreatments).mockResolvedValue({data:[{treatmentId:30,patientName:'Primero',serviceName:'Servicio',status:''},{treatmentId:31,patientName:'Segundo',serviceName:'Servicio',status:''}]} as any);
  let finish!:(value:any)=>void;
  vi.mocked(api.treatmentProgress).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValue({data:{completedSessions:0,plannedSessions:3,pendingSessions:3,operationalProgressPercent:0,currentStatus:'Activado'}} as any);
  render(<CustomerOperationalProgress/>);await screen.findByRole('option',{name:/Primero/});
  fireEvent.change(screen.getByLabelText('Tratamiento'),{target:{value:'30'}});fireEvent.change(screen.getByLabelText('Tratamiento'),{target:{value:'31'}});
  await screen.findByText('Avance administrativo: 0%');finish({data:{operationalProgressPercent:99}});
  await waitFor(()=>expect(screen.queryByText('Avance administrativo: 99%')).not.toBeInTheDocument());
});
