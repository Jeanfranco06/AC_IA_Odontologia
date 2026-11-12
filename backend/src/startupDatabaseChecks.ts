import {prisma} from './db';
import {databaseProfile,expectedDatabases,assertDatabasePair} from './databaseProfiles';
import {verifyCustomerMartReader} from './db/customerMartRead';
export async function verifyStartupDatabases(){
 assertDatabasePair(process.env.SQLSERVER_URL,process.env.MART_READ_URL);
 const [oltp]=await prisma.$queryRaw<Array<{databaseName:string;isAdmin:number}>>`SELECT DB_NAME() databaseName,IS_SRVROLEMEMBER('sysadmin') isAdmin`;
 if(oltp.databaseName!==expectedDatabases().oltp||oltp.isAdmin!==0)throw new Error('Conexión OLTP incorrecta o administrativa; inicio bloqueado.');
 const mart=await verifyCustomerMartReader();
 const [schema]=await prisma.$queryRaw<Array<{ready:number}>>`SELECT CASE WHEN COL_LENGTH('dbo.Atenciones','revision_ficha') IS NOT NULL AND COL_LENGTH('dbo.InteraccionesIA','id_usuario_actor') IS NOT NULL AND OBJECT_ID('dbo.PoliticasCustomerIA','U') IS NOT NULL AND OBJECT_ID('dbo.SolicitudesCustomerIA','U') IS NOT NULL AND OBJECT_ID('dbo.SesionesAccesoIA','U') IS NOT NULL THEN 1 ELSE 0 END ready`;
 if(!schema.ready)throw new Error('Migraciones CUSTOMER pendientes; inicio bloqueado sin modificar datos.');
 if(databaseProfile()==='principal'&&process.env.NEXOSALUD_PRINCIPAL_ENABLED!=='true')throw new Error('Ejecución principal pendiente de despliegue y habilitación autorizados.');
 return {profile:databaseProfile(),oltp:oltp.databaseName,mart:mart.databaseName,analyticsReadOnly:true};
}
