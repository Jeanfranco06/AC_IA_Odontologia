:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET QUOTED_IDENTIFIER ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;

IF NOT (
 (N'$(AutorizarPrincipal)'=N'NO' AND (
  (DB_NAME()=N'NexoSalud_Mart_LeadQA' AND N'$(Origen)'=N'NexoSaludDB_MartLeadQA')
  OR (DB_NAME()=N'NexoSalud_Mart_LeadPreQA' AND N'$(Origen)'=N'NexoSaludDB_LeadPreQA')))
 OR (DB_NAME()=N'NexoSalud_Mart' AND N'$(Origen)'=N'NexoSaludDB' AND @@SERVERNAME=N'ANTHONY'
  AND N'$(AutorizarPrincipal)'=N'SI' AND N'$(ProvocarError)'=N'NO')
) THROW 54710,'Par OLTP/Mart no autorizado.',1;
IF N'$(ProvocarError)' NOT IN (N'SI',N'NO') THROW 54717,'Indicador de prueba inválido.',1;
IF DB_ID(N'$(Origen)') IS NULL THROW 54711,'No existe la fuente OLTP.',1;
