import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

async function main(){
 const config=path.join(__dirname,'../.env.customer-cert.local');dotenv.config({path:config,override:true,quiet:true});
 Object.assign(process.env,{CUSTOMER_CERT_ENV:config,NODE_ENV:'test',MART_CONNECTION_STRING:'',OLTP_CONNECTION_STRING:'',AI_AGENT_LLM_ENABLED:'true',AI_AGENT_EXTERNAL_DATA_AUTHORIZED:'true',AI_AGENT_ALLOW_REAL_GEMINI:'false',GEMINI_API_KEY:'',AI_AGENT_SESSION_REVOCATION_REQUIRED:'true',CUSTOMER_KNOWLEDGE_STORAGE_DIR:path.join(__dirname,'../storage/certification/browser-rag'),CORS_ORIGINS:'http://localhost:5174,http://127.0.0.1:5174'});
 const {createCompletionFixture}=await import('./completion-fixture');
 const {CustomerCompletionService:C}=await import('../src/modules/customer/ai-agent/services/customerCompletionService');
 const {prisma}=await import('../src/db');
 const location=path.join(__dirname,'../storage/certification/browser-fixture.private.json');
 const fresh=!fs.existsSync(location)||process.argv.includes('--fresh');
 const f=fresh?await createCompletionFixture():JSON.parse(fs.readFileSync(location,'utf8'));
 if(fresh){
   fs.mkdirSync(path.dirname(location),{recursive:true});fs.writeFileSync(location,JSON.stringify(f));
   for(const [code,configuration] of [['DOCUMENTACION',{requiredFields:['motivo_consulta','evaluacion','procedimiento'],requiresProcedure:true}],['CONFIRMACION',{windowMinutes:43200}]] as const){
     const last=await prisma.politicasCustomerIA.findFirst({where:{codigo:code},orderBy:{version:'desc'}});
     const policy=await C.createPolicy(f.principals.admin,{code,version:(last?.version??0)+1,serviceId:f.service.id_servicio,configuration:{sourceReference:'FIXTURE SINTÉTICO EN BASE TEST; NO APROBACIÓN INSTITUCIONAL',...configuration}});
     await C.transitionPolicy(f.principals.dentist,policy.id_politica,false);await C.transitionPolicy(f.principals.admin,policy.id_politica,true);
   }
 }
 const {customerAiOrchestrator}=await import('../src/modules/customer/ai-agent/llm/orchestrator');
 // Doble explícito solo del proveedor LLM; HTTP, permisos, servicios y SQL son reales.
 (customerAiOrchestrator as any).providerFactory=()=>({complete:async(request:any)=>{
   const results=request.input.filter((v:any)=>v.type==='function_call_output');
   if(!results.length)return {kind:'tool_call',callId:'browser-sql',name:'getUpcomingSessions',arguments:'{}'};
   const data=JSON.parse(results.at(-1).output);return {kind:'message',text:'Proveedor simulado de certificación. Cronograma recuperado del backend SQL: '+JSON.stringify(data.data)};
 }});
 const {default:app}=await import('../src/index');
 const {startCustomerAlertScheduler}=await import('../src/modules/customer/ai-agent/services/customerAlertLifecycleService');
 process.env.CUSTOMER_ALERT_SCHEDULER_ENABLED='true';process.env.CUSTOMER_ALERT_SCHEDULER_USER_ID=String(f.admin.id_usuario);startCustomerAlertScheduler();
 app.listen(3101,'127.0.0.1',()=>console.log('Certificación HTTP en 3101: SOLO Test; LLM simulado; dunning y correo no iniciados.'));
}
main().catch(()=>{console.error('No fue posible iniciar la certificación aislada.');process.exitCode=1;});
