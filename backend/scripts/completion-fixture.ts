import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/db';
import { hashStaffPassword } from '../src/services/staffAuthService';
import { patientAuthService } from '../src/services/patientAuthService';
import { AiAgentPrincipal } from '../src/modules/customer/ai-agent/types';

export async function createCompletionFixture() {
  const [environment] = await prisma.$queryRaw<Array<{db:string;admin:number;access:number}>>`SELECT DB_NAME() AS db,IS_SRVROLEMEMBER('sysadmin') AS admin,HAS_DBACCESS('NexoSaludDB') AS access`;
  if(environment.db!=='NexoSaludDB_Test'||environment.admin!==0||environment.access!==0)throw Error('Fixture fuera del entorno aislado.');
  const suffix=crypto.randomBytes(5).toString('hex'); const password=crypto.randomBytes(16).toString('hex')+'!aA9';
  const etapa=await prisma.etapas.findUniqueOrThrow({where:{nombre:'CUSTOMER'}});
  const professional=await prisma.profesionales.create({data:{nombres:'Profesional',apellidos:`Sintético ${suffix}`,numero_colegiatura:`SYN${suffix}`,activo:true}});
  const branch=await prisma.sedes.create({data:{nombre:`Sede sintética ${suffix}`,direccion:'Dirección sintética de laboratorio; no es una sede operativa',activo:true}});
  const service=await prisma.servicios.create({data:{nombre:`Certificación sintética ${suffix}`}});
  const makeUser=async(names:string[],name:string,prof?:number)=>{
    const rol=await prisma.roles.findFirstOrThrow({where:{nombre:{in:names}}});
    return prisma.usuarios.create({data:{nombres:'Prueba',apellidos:name,email:`${name}.${suffix}@example.invalid`,password_hash:hashStaffPassword(password),id_rol:rol.id_rol,id_profesional:prof}});
  };
  const admin=await makeUser(['Administrador','Admin','ADMIN'],'administracion');
  const dentist=await makeUser(['Odontologo','ODONTOLOGO'],'odontologia',professional.id_profesional);
  const reception=await makeUser(['Recepcion','RECEPCION','Recepcionista'],'recepcion');
  const createPatient=()=>prisma.personas.create({data:{nombres:'Paciente',apellidos:`Sintético ${suffix}`,dni:'99'+crypto.randomInt(100000,1000000).toString(),email:`patient.${crypto.randomBytes(4).toString('hex')}@example.invalid`,id_etapa_actual:etapa.id_etapa}});
  const patient=await createPatient(); const other=await createPatient();
  const date=new Date(Date.now()+86400000*7); date.setUTCHours(12,0,0,0);
  const createSlot=(offset:number)=>prisma.disponibilidad.create({data:{id_profesional:professional.id_profesional,id_sede:branch.id_sede,fecha:new Date(date.getTime()+offset*86400000),hora_inicio:new Date('1970-01-01T12:00:00Z'),hora_fin:new Date('1970-01-01T13:00:00Z'),estado:'Disponible'}});
  const initial=await createSlot(0);await prisma.disponibilidad.update({where:{id_disponibilidad:initial.id_disponibilidad},data:{estado:'Ocupado'}});
  const solicitud=await prisma.solicitudes.create({data:{id_persona:patient.id_persona,id_servicio:service.id_servicio,estado:'Convertida'}});
  const opcion=await prisma.opciones.create({data:{id_solicitud:solicitud.id_solicitud,id_disponibilidad:initial.id_disponibilidad,precio_ofrecido:100,seleccionada:true}});
  const reserva=await prisma.reservas.create({data:{id_persona:patient.id_persona,id_solicitud:solicitud.id_solicitud,id_opcion:opcion.id_opcion,estado:'Confirmada'}});
  await prisma.pagos.create({data:{id_persona:patient.id_persona,id_reserva:reserva.id_reserva,importe:100,estado:'Validado',fecha_validacion:new Date(),validado_por:admin.id_usuario}});
  const treatment=await prisma.tratamientosContratados.create({data:{id_persona:patient.id_persona,id_solicitud:solicitud.id_solicitud,id_reserva_origen:reserva.id_reserva,id_servicio:service.id_servicio,id_profesional_responsable:professional.id_profesional,id_sede:branch.id_sede,precio_pactado:100,fecha_contratacion:new Date(),fecha_inicio_real:new Date(),estado_tratamiento:'En ejecución'}});
  const plan=await prisma.planTratamiento.create({data:{id_tratamiento:treatment.id_tratamiento,version_plan:1,sesiones_planificadas:3,duracion_estimada:45,id_profesional_aprobador:professional.id_profesional}});
  const session=await prisma.sesionesTratamiento.create({data:{id_tratamiento:treatment.id_tratamiento,id_plan:plan.id_plan,numero_sesion:1,id_profesional:professional.id_profesional,id_sede:branch.id_sede,id_disponibilidad:initial.id_disponibilidad,fecha_programada_vigente:date,estado_programacion:'Programada',estado_asistencial:'Pendiente',estado_cierre:'Pendiente'}});
  const attention=await prisma.atenciones.create({data:{id_persona:patient.id_persona,id_reserva:reserva.id_reserva,id_tratamiento:treatment.id_tratamiento,id_sesion:session.id_sesion,id_servicio:service.id_servicio,id_profesional:professional.id_profesional,id_sede:branch.id_sede,fecha_atencion:date,asistencia:'Pendiente',estado_servicio:'Programado',motivo_consulta:'Motivo sintético',evaluacion:'Evaluación declarada sintética',procedimiento:'Procedimiento documental sintético',indicaciones_finales:'Documento sintético: conservar las cantidades 2 y 3; no es una prescripción.'}});
  const next=await createSlot(1); const reschedule=await createSlot(2);const third=await createSlot(3);
  const credentials=patientAuthService.hashPassword(password);
  await prisma.$executeRaw`INSERT dbo.CredencialesPaciente(id_persona,dni,password_hash,password_salt,token_used) VALUES(${patient.id_persona},${patient.dni},${credentials.hash},${credentials.salt},1)`;
  const principals={patient:{role:'PACIENTE',idPersona:patient.id_persona},other:{role:'PACIENTE',idPersona:other.id_persona},dentist:{role:'ODONTOLOGO',idUsuario:dentist.id_usuario,idProfesional:professional.id_profesional},reception:{role:'RECEPCION',idUsuario:reception.id_usuario},admin:{role:'ADMIN',idUsuario:admin.id_usuario}} as Record<string,AiAgentPrincipal>;
  return {suffix,password,patient,other,professional,service,branch,treatment,plan,session,attention,next,reschedule,third,admin,dentist,reception,principals};
}
if(require.main===module)createCompletionFixture().then(f=>{const dir=path.join(__dirname,'../storage/certification');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'browser-fixture.private.json'),JSON.stringify(f));console.log('Fixture sintético de navegador creado; credenciales privadas guardadas, no impresas.');}).finally(()=>prisma.$disconnect());
