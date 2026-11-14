import {afterEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import CustomerTreatmentClosureChecklist from './CustomerTreatmentClosureChecklist';
import {customerAiAgentApi as api,type ClosureChecklist} from '../services/customerAiAgentApi';
vi.mock('../services/customerAiAgentApi',()=>({customerAiAgentApi:{treatmentClosureChecklist:vi.fn()}}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
const initial:ClosureChecklist={treatmentId:30,formalTreatmentStatus:'En ejecución',plannedSessions:1,completedSessions:1,pending:['Atención 20: falta validación profesional vigente.'],readOnly:true,requiresProfessionalConfirmation:true,disclaimer:'Preparación consultiva. No cierra el tratamiento.',unresolvedReviews:[{id_solicitud:9,estado:'Atendida'}],pendingDrafts:[],sessions:[{sessionId:1,number:1,careStatus:'Realizada',closureStatus:'Cerrada',requiresExceptionReview:false,attentions:[{attentionId:20,validationId:8,validationResult:'Completa',validationMatchesCurrentRecords:false,policyId:3,policyVersion:2,issuedInstructionIds:[]}]}]};
it('distingue validación histórica de vigente y presenta evidencias y revisiones pendientes',()=>{
  render(<CustomerTreatmentClosureChecklist initial={initial}/>);
  fireEvent.click(screen.getByText('Evidencias por sesión'));
  expect(screen.getByText(/Validación registrada: Completa/)).toBeInTheDocument();
  expect(screen.getByText(/La validación no acredita los registros actuales/)).toBeInTheDocument();
  expect(screen.getByText('Solicitud 9: Atendida.')).toBeInTheDocument();
  expect(screen.getByText(/su exigencia depende de la política del servicio/)).toBeInTheDocument();
  expect(api.treatmentClosureChecklist).not.toHaveBeenCalled();
});
it('actualiza solo al consultar y retira el resultado si falla una nueva verificación',async()=>{
  vi.mocked(api.treatmentClosureChecklist).mockResolvedValueOnce({data:{...initial,pending:[]}} as any).mockRejectedValueOnce(new Error('No se pudo verificar en SQL'));
  render(<CustomerTreatmentClosureChecklist initial={initial}/>);fireEvent.click(screen.getByRole('button',{name:'Actualizar checklist de cierre'}));
  await screen.findByText(/Sin pendientes documentales detectados/);expect(api.treatmentClosureChecklist).toHaveBeenCalledWith(30);
  await waitFor(()=>expect(screen.getByRole('button',{name:'Actualizar checklist de cierre'})).not.toBeDisabled());
  fireEvent.click(screen.getByRole('button',{name:'Actualizar checklist de cierre'}));await screen.findByRole('alert');
  expect(screen.queryByText(/Sin pendientes documentales detectados/)).not.toBeInTheDocument();
});
