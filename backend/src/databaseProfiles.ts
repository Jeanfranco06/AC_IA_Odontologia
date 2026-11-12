import dotenv from 'dotenv';
import path from 'path';
export type DatabaseProfile='development'|'certification'|'principal';
export function databaseProfile():DatabaseProfile {
 const value=process.env.NEXOSALUD_ENV||(process.env.NODE_ENV==='test'?'certification':(process.env.CUSTOMER_CERT_ENV?'certification':'principal'));
 if(!['development','certification','principal'].includes(value))throw new Error('Perfil de bases no reconocido.');
 return value as DatabaseProfile;
}
export function expectedDatabases(){
 const isCert = databaseProfile()==='certification' || Boolean(process.env.CUSTOMER_CERT_ENV) || process.env.NODE_ENV==='test';
 return {oltp:isCert?'NexoSaludDB_Test':'NexoSaludDB',mart:isCert?'NexoSalud_Mart_Test':'NexoSalud_Mart'};
}
export function loadDatabaseEnvironment(){
 const isCert = databaseProfile()==='certification' || Boolean(process.env.CUSTOMER_CERT_ENV) || process.env.NODE_ENV==='test';
 if(isCert){
  const file=process.env.CUSTOMER_CERT_ENV||path.join(__dirname,'../.env.customer-cert.local');
  dotenv.config({path:file,quiet:true});
  dotenv.config({path:path.join(__dirname,'../.env.customer-analytics.local'),quiet:true});
  if(process.env.NODE_ENV==='test')dotenv.config({path:path.join(__dirname,'../.env.test.local'),quiet:true});
 }else{
  dotenv.config({path:path.join(__dirname,'../.env.principal.local'),quiet:true});
  if(process.env.NEXOSALUD_OLTP_URL)process.env.SQLSERVER_URL=process.env.NEXOSALUD_OLTP_URL;
 }
 dotenv.config({path:path.join(__dirname,'../.env'),quiet:true});
}
export function configuredDatabase(url:string|undefined){return /(?:^|;)database=([^;]+)/i.exec(url||'')?.[1];}
export function assertDatabasePair(oltpUrl:string|undefined,martUrl:string|undefined){
 const expected=expectedDatabases();
 if(configuredDatabase(oltpUrl)!==expected.oltp||configuredDatabase(martUrl)!==expected.mart)throw new Error('Conexiones ausentes, mixtas o incompatibles con el perfil seleccionado.');
 if(databaseProfile()==='principal'&&!process.env.NEXOSALUD_OLTP_URL&&!process.env.SQLSERVER_URL)throw new Error('Configure la credencial OLTP principal.');
}
