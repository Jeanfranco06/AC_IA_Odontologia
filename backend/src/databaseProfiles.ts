import dotenv from 'dotenv';
import path from 'path';
export type DatabaseProfile='development'|'certification'|'principal';
export function databaseProfile():DatabaseProfile {
 const value=process.env.NEXOSALUD_ENV||(process.env.NODE_ENV==='test'?'certification':'development');
 if(!['development','certification','principal'].includes(value))throw new Error('Perfil de bases no reconocido.');
 return value as DatabaseProfile;
}
export function expectedDatabases(){const main=databaseProfile()==='principal';return {oltp:main?'NexoSaludDB':'NexoSaludDB_Test',mart:main?'NexoSalud_Mart':'NexoSalud_Mart_Test'};}
export function loadDatabaseEnvironment(){
 const profile=databaseProfile();
 const file=process.env.CUSTOMER_CERT_ENV||(profile==='principal'?path.join(__dirname,'../.env.principal.local'):path.join(__dirname,'../.env.customer-cert.local'));
 dotenv.config({path:file,quiet:true});
 dotenv.config({path:path.join(__dirname,'../.env.customer-analytics.local'),quiet:true});
 if(profile==='principal'){
  // Nunca reutilizar silenciosamente la credencial administrativa heredada de .env.
  if(process.env.NEXOSALUD_OLTP_URL)process.env.SQLSERVER_URL=process.env.NEXOSALUD_OLTP_URL;
 }else if(process.env.NODE_ENV==='test')dotenv.config({path:path.join(__dirname,'../.env.test.local'),quiet:true});
 dotenv.config({path:path.join(__dirname,'../.env'),quiet:true});
}
export function configuredDatabase(url:string|undefined){return /(?:^|;)database=([^;]+)/i.exec(url||'')?.[1];}
export function assertDatabasePair(oltpUrl:string|undefined,martUrl:string|undefined){
 const expected=expectedDatabases();
 if(configuredDatabase(oltpUrl)!==expected.oltp||configuredDatabase(martUrl)!==expected.mart)throw new Error('Conexiones ausentes, mixtas o incompatibles con el perfil seleccionado.');
 if(databaseProfile()==='principal'&&!process.env.NEXOSALUD_OLTP_URL)throw new Error('Configure la credencial OLTP principal dedicada.');
}
