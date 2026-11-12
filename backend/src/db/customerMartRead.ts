import {PrismaClient,Prisma} from '@prisma/client';
import {assertDatabasePair,expectedDatabases} from '../databaseProfiles';
import {AiAgentError} from '../modules/customer/ai-agent/types';
let reader:PrismaClient|undefined;
export function customerMartReader(){
 try{assertDatabasePair(process.env.SQLSERVER_URL,process.env.MART_READ_URL);}catch{throw new AiAgentError('SERVICE_UNAVAILABLE','La conexión analítica no está habilitada para este entorno.');}
 return reader??=(new PrismaClient({datasources:{db:{url:process.env.MART_READ_URL!}},log:[]}));
}
export async function verifyCustomerMartReader(){
 const db=customerMartReader();
 const [identity]=await db.$queryRaw<Array<{databaseName:string;isAdmin:number;canAlter:number;canExecute:number}>>`SELECT DB_NAME() databaseName,IS_SRVROLEMEMBER('sysadmin') isAdmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','ALTER') canAlter,HAS_PERMS_BY_NAME('dbo','SCHEMA','EXECUTE') canExecute`;
 if(identity.databaseName!==expectedDatabases().mart||identity.isAdmin!==0||identity.canAlter!==0||identity.canExecute!==0)throw new Error('La identidad analítica debe ser de solo lectura y sin privilegios administrativos.');
 const rights=await db.$queryRaw<Array<{name:string;canRead:number;canWrite:number}>>`SELECT name,HAS_PERMS_BY_NAME('dbo.'+name,'OBJECT','SELECT') canRead,COALESCE(HAS_PERMS_BY_NAME('dbo.'+name,'OBJECT','INSERT'),0)+COALESCE(HAS_PERMS_BY_NAME('dbo.'+name,'OBJECT','UPDATE'),0)+COALESCE(HAS_PERMS_BY_NAME('dbo.'+name,'OBJECT','DELETE'),0) canWrite FROM sys.tables WHERE name IN('Fact_TratamientoCustomer','Fact_SesionCustomer','Fact_AtencionCustomer_V2','Fact_InteraccionIACustomer')`;
 if(rights.length!==4||rights.some(r=>r.canRead!==1||r.canWrite!==0))throw new Error('Permisos de hechos analíticos incompatibles.');
 return {databaseName:identity.databaseName,readOnly:true};
}
let attestation:Promise<unknown>|undefined;
export async function readCustomerMart<T>(sql:Prisma.Sql):Promise<T[]> {
 try{await (attestation??=verifyCustomerMartReader().catch(e=>{attestation=undefined;throw e;}));return await customerMartReader().$queryRaw<T[]>(sql);}
 catch(error){if(error instanceof AiAgentError)throw error;throw new AiAgentError('SERVICE_UNAVAILABLE','No fue posible consultar el Mart con permisos verificados de solo lectura.');}
}
export async function closeCustomerMartReader(){await reader?.$disconnect();reader=undefined;attestation=undefined;}
