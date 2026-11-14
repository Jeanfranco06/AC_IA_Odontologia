import crypto from 'crypto';
import {prisma} from '../db';

// Una conversación tiene un desenlace. Las acciones supervisadas son eventos
// diferentes aunque compartan la correlación de la operación de origen.
export async function persistCustomerInteraction(data: any, transaction?: any) {
  const row={...data,id_correlacion:data.id_correlacion||crypto.randomUUID()};
  const write=async(tx:any)=>{
    const conversation=String(row.tipo_evento).startsWith('CONVERSACION_');
    const existing=await tx.interaccionesIA.findFirst({where:{
      id_correlacion:row.id_correlacion,actor_orientado:row.actor_orientado,
      id_persona:row.id_persona??null,id_usuario_actor:row.id_usuario_actor??null,
      tipo_evento:conversation?{startsWith:'CONVERSACION_'}:row.tipo_evento,
      id_tratamiento:row.id_tratamiento??null,id_sesion:row.id_sesion??null,id_atencion:row.id_atencion??null
    },orderBy:{id_interaccion_ia:'asc'}});
    return existing??tx.interaccionesIA.create({data:row});
  };
  if(transaction)return write(transaction);
  for(let attempt=0;;attempt++){
    try{return await prisma.$transaction(write,{isolationLevel:'Serializable'});}
    catch(error:any){if(error?.code!=='P2034'||attempt>=2)throw error;}
  }
}
