import { afterEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CustomerAiStaffWorkspacePage from './CustomerAiStaffWorkspacePage';
const { api } = vi.hoisted(() => ({ api: { staffPendingSessions: vi.fn(), clinicalSessionContext: vi.fn(), getDraft:vi.fn(), approveDraft:vi.fn(), issueDraft:vi.fn(), reviseDraft:vi.fn(), alerts: vi.fn(), staffAttentions: vi.fn(), knowledgeDocuments: vi.fn(), clinicalContext: vi.fn(), documentationStatus: vi.fn(), attentionDrafts: vi.fn() } }));
vi.mock('../components/CustomerCompletionPanel', () => ({ default: () => null }));
vi.mock('../services/customerAiAgentApi', () => ({ customerAiAgentApi: api }));
vi.mock('@/shared/services/staffAuthService', () => ({ staffAuthService: { getSession: () => ({ agentRole: 'ODONTOLOGO', accessToken: 'test-token', nombres: 'Doctor', apellidos: 'Prueba', initials: 'DP' }) } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('escribir otro ID no cambia el contexto actual y una respuesta atrasada no sustituye la selección nueva', async () => {
  api.staffPendingSessions.mockResolvedValue({ data: [] });
  api.alerts.mockResolvedValue({ data: [] }); api.staffAttentions.mockResolvedValue({ data: [] }); api.knowledgeDocuments.mockResolvedValue({ data: [] });
  api.documentationStatus.mockResolvedValue({ data: { closureStatus: 'Pendiente', pendingInstructions: [] } });
  api.attentionDrafts.mockResolvedValue({ data: [] });
  let resolveFirst!: (value: unknown) => void;
  const first = new Promise(resolve => { resolveFirst = resolve; });
  const context = (id: number, summary: string) => ({ data: { currentAttention: {}, currentTreatment: null, previousAttentions: [], relevantBackground: [], clinicalDisclaimer: 'Confirmar con el paciente', preparationSummary: summary, provenance: { attentionId: id, source: 'NexoSaludDB' } } });
  api.clinicalContext.mockImplementation((id: number) => id === 101 ? first : Promise.resolve(context(102, 'Contexto de segunda sesión futura')));
  render(<MemoryRouter><CustomerAiStaffWorkspacePage /></MemoryRouter>);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Cargar' })).not.toBeDisabled());
  const search = screen.getByLabelText(/O buscar por ID de Atención Directo/);
  fireEvent.change(search, { target: { value: '101' } });
  fireEvent.submit(search.closest('form')!);
  await waitFor(() => expect(api.clinicalContext).toHaveBeenCalledWith(101));
  fireEvent.change(search, { target: { value: '102' } });
  expect(screen.getByText('Atención #101')).toBeInTheDocument();
  expect(screen.queryByText('Atención #102')).not.toBeInTheDocument();
  fireEvent.submit(search.closest('form')!);
  await screen.findByText('Contexto de segunda sesión futura');
  await act(async () => { resolveFirst(context(101, 'Contexto antiguo que llegó tarde')); });
  expect(screen.getByText('Atención #102')).toBeInTheDocument();
  expect(screen.queryByText('Contexto antiguo que llegó tarde')).not.toBeInTheDocument();
  expect(api.attentionDrafts).toHaveBeenCalledWith(102);
  expect(api.attentionDrafts).not.toHaveBeenCalledWith(101);
});

it('permite preparar una sesión futura sin atención y no consulta documentación ni habilita acciones clínicas', async () => {
  api.alerts.mockResolvedValue({ data: [] }); api.staffAttentions.mockResolvedValue({ data: [] }); api.knowledgeDocuments.mockResolvedValue({ data: [] });
  api.staffPendingSessions.mockResolvedValue({ data: [{ sessionId: 42, number: 2, date: '2099-11-18T20:00:00Z', patientName: 'Paciente Simulada', serviceName: 'Restauración', careStatus: 'Pendiente' }] });
  api.clinicalSessionContext.mockResolvedValue({ data: { preparationOnly: true, currentAttention: {}, currentTreatment: null, previousAttentions: [], relevantBackground: [], currentSession: {number:2,careStatus:'Pendiente'}, clinicalDisclaimer: 'Preparación sin iniciar atención', preparationSummary: 'Sesión futura preparada', provenance: {attentionId:null,sessionId:42,source:'OLTP autorizado'} } });
  render(<MemoryRouter><CustomerAiStaffWorkspacePage /></MemoryRouter>);
  const select = await screen.findByLabelText('Próximas sesiones sin atención abierta');
  await waitFor(() => expect(select).not.toBeDisabled());
  expect(screen.getByRole('option', {name:/Paciente Simulada.*Sesión 2.*18\/11\/2099.*15:00.*Pendiente/})).toBeInTheDocument();
  fireEvent.change(select, {target:{value:'42'}});
  await screen.findByText('Sesión futura preparada');
  expect(api.clinicalSessionContext).toHaveBeenCalledWith(42);
  expect(api.clinicalContext).not.toHaveBeenCalled();
  expect(api.documentationStatus).not.toHaveBeenCalled();
  expect(screen.queryByText('Acciones del Copiloto')).not.toBeInTheDocument();
  expect(screen.getByText(/Atención aún no abierta/)).toBeInTheDocument();
});

it('contextualiza las alertas sin confundir horario vencido con tiempo en sillón ni gravedad clínica', async () => {
  api.staffAttentions.mockResolvedValue({ data: [] }); api.staffPendingSessions.mockResolvedValue({ data: [] }); api.knowledgeDocuments.mockResolvedValue({ data: [] });
  api.alerts.mockResolvedValue({ data: [
    {alertId:1,type:'ALT-C02',message:'Horario vencido sin desenlace',severity:'Media',status:'Generada',createdAt:'2026-11-12T20:00:00Z',ruleVersion:'REGLA-v1',source:'NexoSaludDB'},
    {alertId:2,type:'ALT-C04',message:'Antecedentes registrados para revisar',severity:'Alta',status:'Generada',createdAt:'2026-11-12T20:00:00Z',ruleVersion:'REGLA-v1',source:'NexoSaludDB'}
  ] });
  render(<MemoryRouter><CustomerAiStaffWorkspacePage /></MemoryRouter>);
  await waitFor(() => expect(api.alerts).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', {name:/Alertas Asistenciales/}));
  await screen.findByText(/Horario vencido sin desenlace registrado · Prioridad de revisión: Media/);
  expect(screen.getByText(/Antecedentes o alergias para revisión · Prioridad de revisión: Alta/)).toBeInTheDocument();
  expect(screen.queryByText(/Sobretiempo en Sillón/)).not.toBeInTheDocument();
  expect(screen.getByText(/no mide gravedad clínica/)).toBeInTheDocument();
  expect(screen.getAllByText(/Regla:.*REGLA-v1.*NexoSaludDB/)).toHaveLength(2);
});

it('bloquea correcciones sin guardar y separa aprobación de la emisión al paciente', async () => {
  api.alerts.mockResolvedValue({data:[]});api.staffAttentions.mockResolvedValue({data:[]});api.staffPendingSessions.mockResolvedValue({data:[]});api.knowledgeDocuments.mockResolvedValue({data:[]});
  let status='Generado';const content='Documento sintético de indicaciones para revisión';
  api.getDraft.mockImplementation(async()=>({data:{draftId:5,rootId:5,version:1,status,content,isIssued:status==='Emitido',requiresHumanReview:status==='Generado'}}));
  api.approveDraft.mockImplementation(async()=>{status='Aprobado';return {data:{issuedToPatient:false}};});
  api.issueDraft.mockImplementation(async()=>{status='Emitido';return {data:{issuedToPatient:true}};});
  render(<MemoryRouter><CustomerAiStaffWorkspacePage /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Borradores Clínicos'}));
  const id=await screen.findByPlaceholderText('Ej. 46, 52...');fireEvent.change(id,{target:{value:'5'}});fireEvent.submit(id.closest('form')!);
  const text=await screen.findByLabelText('Contenido de indicaciones postatención');await waitFor(()=>expect(text).toHaveValue(content));
  fireEvent.change(text,{target:{value:content+' corrección sin guardar'}});
  fireEvent.click(screen.getByRole('button',{name:'Revisar y aprobar indicaciones'}));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(api.approveDraft).not.toHaveBeenCalled();
  fireEvent.change(text,{target:{value:content}});fireEvent.click(screen.getByRole('button',{name:'Revisar y aprobar indicaciones'}));
  const checkbox=screen.getByLabelText(/Emitir inmediatamente al portal del paciente/);expect(checkbox).not.toBeChecked();
  fireEvent.click(screen.getByRole('button',{name:'Solo Aprobar'}));
  const issue=await screen.findByRole('button',{name:'Emitir versión aprobada al portal del paciente'});
  expect(api.approveDraft).toHaveBeenCalledWith(5,false);expect(api.issueDraft).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Contenido de indicaciones postatención')).toBeDisabled();
  fireEvent.click(issue);await waitFor(()=>expect(api.issueDraft).toHaveBeenCalledWith(5));
});

it('distingue una validación histórica completa de una comprobación actual bloqueada',async()=>{
  api.alerts.mockResolvedValue({data:[]});api.staffAttentions.mockResolvedValue({data:[]});api.staffPendingSessions.mockResolvedValue({data:[]});api.knowledgeDocuments.mockResolvedValue({data:[]});api.attentionDrafts.mockResolvedValue({data:[]});
  api.clinicalContext.mockResolvedValue({data:{currentAttention:{},currentTreatment:null,previousAttentions:[],relevantBackground:[],clinicalDisclaimer:'Confirmar con paciente',provenance:{attentionId:221,source:'OLTP autorizado'}}});
  api.documentationStatus.mockResolvedValue({data:{closureStatus:'Pendiente',pendingInstructions:[],lastValidation:{result:'Completa',pendingFields:null,matchesCurrentRecords:false},currentCheck:{blocked:true,pending:['Falta política documental publicada para este servicio'],limitation:'No registra validación ni cierra la ficha'}}});
  render(<MemoryRouter><CustomerAiStaffWorkspacePage /></MemoryRouter>);
  await waitFor(()=>expect(screen.getByRole('button',{name:'Cargar'})).not.toBeDisabled());
  const search=screen.getByLabelText(/O buscar por ID de Atención Directo/);fireEvent.change(search,{target:{value:'221'}});fireEvent.submit(search.closest('form')!);
  await screen.findByLabelText('Comprobación documental vigente');
  expect(screen.getByText(/La última validación es histórica o quedó desactualizada/)).toBeInTheDocument();
  expect(screen.getByText('Comprobación actual bloqueada')).toBeInTheDocument();
  expect(screen.getByText('Falta política documental publicada para este servicio')).toBeInTheDocument();
});
