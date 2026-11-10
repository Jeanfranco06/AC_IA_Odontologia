:r .\database\lead_revision\mart_hechos\00_CONTEXTO_HECHOS.sql
IF N'$(AutorizarPrincipal)'<>N'NO' OR DB_NAME() NOT IN (N'NexoSalud_Mart_LeadPreQA',N'NexoSalud_Mart_LeadFactsQA')
 THROW 54900,'Este ejecutor o prueba solo admite las copias de QA.',1;
